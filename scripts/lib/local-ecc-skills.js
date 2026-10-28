'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const { execFileSync } = require('child_process');

const NATIVE_AGENTS = new Set(['claude', 'codex', 'pi']);
const SKILL_ROOTS = ['skills', '.agents/skills'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function skillDirectory(operation, homeDir) {
  if (operation.kind !== 'copy-file' || !operation.destinationPath) return null;
  const destination = path.resolve(operation.destinationPath);
  for (const relative of SKILL_ROOTS) {
    const root = path.join(homeDir, '.codex', relative);
    const within = path.relative(root, destination);
    if (within && !within.startsWith(`..${path.sep}`) && within !== '..' && !path.isAbsolute(within)) {
      return path.join(root, within.split(path.sep)[0]);
    }
  }
  return null;
}

function excludeCodexSkillCopies(plan, homeDir) {
  const keep = operation => !skillDirectory(operation, homeDir);
  return {
    ...plan,
    operations: plan.operations.filter(keep),
    statePreview: { ...plan.statePreview, operations: plan.statePreview.operations.filter(keep) },
  };
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing to archive symlink: ${file}`);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
}

function assertOwnedSkill(directory, operations) {
  const managed = new Map(operations.filter(operation => operation.ownership === 'managed')
    .map(operation => [path.resolve(operation.destinationPath), operation]));
  for (const file of listFiles(directory)) {
    const operation = managed.get(file);
    const digest = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (!operation || operation.contentSha256 !== digest) {
      throw new Error(`Refusing to archive modified or unowned skill file: ${file}`);
    }
  }
}

function planArchives(state, homeDir) {
  const directories = [...new Set(state.operations.filter(operation => operation.ownership === 'managed')
    .map(operation => skillDirectory(operation, homeDir)).filter(Boolean))].sort();
  return directories.filter(directory => {
    let stat;
    try {
      stat = fs.lstatSync(directory);
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      const library = path.join(homeDir, '.config/magpie/library/skills', path.basename(directory));
      if (fs.realpathSync(directory) === fs.realpathSync(library)) return false;
      throw new Error(`Refusing to archive foreign symlink: ${directory}`);
    }
    if (!stat.isDirectory()) throw new Error(`Skill path is not a directory: ${directory}`);
    assertOwnedSkill(directory, state.operations);
    return true;
  });
}

function planPiSettings(homeDir, sourceRoot) {
  const file = path.join(homeDir, '.pi/agent/settings.json');
  const settings = readJson(file);
  const resolveSource = source => source.startsWith('~/')
    ? path.join(homeDir, source.slice(2))
    : path.resolve(path.dirname(file), source);
  const isEcc = item => {
    const source = typeof item === 'string' ? item : item.source;
    return typeof source === 'string' && resolveSource(source) === sourceRoot;
  };
  if (!Array.isArray(settings.packages) || !settings.packages.some(isEcc)) {
    throw new Error('Pi must have the local ECC package before reconciling skill sources.');
  }
  let changed = false;
  const packages = settings.packages.map(item => {
    if (!isEcc(item) || typeof item === 'string' || !Array.isArray(item.skills) || item.skills.length) return item;
    const { skills: _skills, ...remaining } = item;
    changed = true;
    return remaining;
  });
  return changed ? { ...settings, packages } : null;
}

function createSkillSourcePlan({ sourceRoot, homeDir = os.homedir() }) {
  const libraryFile = path.join(homeDir, '.config/magpie/library.json');
  const library = fs.existsSync(libraryFile) ? readJson(libraryFile) : { skills: [] };
  const root = path.join(sourceRoot, 'skills');
  const names = new Set(fs.readdirSync(root).filter(name => fs.existsSync(path.join(root, name, 'SKILL.md'))));
  const routes = library.skills.filter(skill => names.has(skill.name)).flatMap(skill => {
    if (!Array.isArray(skill.agents)) throw new Error(`Missing explicit Magpie skill recipients: ${skill.name}`);
    const agents = skill.agents.filter(agent => !NATIVE_AGENTS.has(agent));
    return agents.length === skill.agents.length ? [] : [{ name: skill.name, agents }];
  });
  const stateFile = path.join(homeDir, '.codex/ecc-install-state.json');
  const state = fs.existsSync(stateFile) ? readJson(stateFile) : { operations: [] };
  const operations = state.operations.filter(operation => !skillDirectory(operation, homeDir));
  return {
    routes,
    archives: planArchives(state, homeDir),
    piSettings: planPiSettings(homeDir, sourceRoot),
    codexState: operations.length !== state.operations.length ? { ...state, operations } : null,
  };
}

function backupFiles(homeDir, backupRoot) {
  fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  for (const [relative, name] of [
    ['.config/magpie/library.json', 'magpie-library.json'],
    ['.pi/agent/settings.json', 'pi-settings.json'],
    ['.codex/ecc-install-state.json', 'ecc-install-state.json'],
  ]) {
    const file = path.join(homeDir, relative);
    if (fs.existsSync(file)) {
      const destination = path.join(backupRoot, name);
      fs.copyFileSync(file, destination);
      fs.chmodSync(destination, 0o600);
    }
  }
}

function reconcileSkillSources(options) {
  const homeDir = options.homeDir || os.homedir();
  const plan = createSkillSourcePlan({ ...options, homeDir });
  const changed = Boolean(plan.routes.length || plan.archives.length || plan.piSettings || plan.codexState);
  if (options.dryRun || !changed) return { ...plan, changed };
  const backupRoot = path.join(homeDir, '.local/state/ecc-upgrade',
    `skill-sources-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
  backupFiles(homeDir, backupRoot);
  const run = options.run || ((command, args) => execFileSync(command, args, {
    encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
  }));
  if (plan.piSettings) writeJson(path.join(homeDir, '.pi/agent/settings.json'), plan.piSettings);
  plan.routes.forEach((route, index) => {
    run('magpie', ['library', 'skill', 'agents', route.name, route.agents.join(',') || 'none']);
    if (options.onProgress && (index % 25 === 0 || index === plan.routes.length - 1)) {
      options.onProgress(`Magpie skill routes: ${index + 1}/${plan.routes.length}`);
    }
  });
  const stateFile = path.join(homeDir, '.codex/ecc-install-state.json');
  const state = fs.existsSync(stateFile) ? readJson(stateFile) : { operations: [] };
  for (const directory of plan.archives) {
    assertOwnedSkill(directory, state.operations);
    const destination = path.join(backupRoot, 'codex', path.relative(path.join(homeDir, '.codex'), directory));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(directory, destination);
  }
  if (plan.codexState) writeJson(stateFile, plan.codexState);
  return { ...plan, changed, backupRoot };
}

module.exports = { createSkillSourcePlan, excludeCodexSkillCopies, reconcileSkillSources };
