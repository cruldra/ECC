'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const { execFileSync } = require('child_process');
const {
  createSkillSourcePlan,
  excludeCodexSkillCopies,
  reconcileSkillSources,
} = require('../../scripts/lib/local-ecc-skills');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-skill-sources-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const homeDir = path.join(root, 'home');
  const sourceRoot = path.join(root, 'ECC');
  const libraryRoot = path.join(homeDir, '.config/magpie/library/skills');
  for (const name of ['organizing-code', 'writing-code-comments']) {
    fs.mkdirSync(path.join(sourceRoot, 'skills', name), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'skills', name, 'SKILL.md'), name);
    fs.mkdirSync(path.join(libraryRoot, name), { recursive: true });
    fs.writeFileSync(path.join(libraryRoot, name, 'SKILL.md'), name);
  }
  writeJson(path.join(homeDir, '.config/magpie/library.json'), {
    skills: [
      { name: 'organizing-code', agents: ['claude', 'codex', 'pi', 'opencode'] },
      { name: 'writing-code-comments', agents: ['claude', 'codex', 'pi'] },
      { name: 'personal', agents: ['claude', 'codex', 'pi'] },
    ],
  });
  writeJson(path.join(homeDir, '.pi/agent/settings.json'), {
    packages: ['npm:other', { source: sourceRoot, skills: [], prompts: ['commands/plan.md'] }],
  });
  writeJson(path.join(homeDir, '.codex/ecc-install-state.json'), { operations: [] });
  return { homeDir, sourceRoot, libraryRoot };
}

function ownedSkill(context, name, text = 'owned', relativeRoot = '.agents/skills') {
  const file = path.join(context.homeDir, '.codex', relativeRoot, name, 'SKILL.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  const stateFile = path.join(context.homeDir, '.codex/ecc-install-state.json');
  const state = JSON.parse(fs.readFileSync(stateFile));
  writeJson(stateFile, { ...state, operations: [...state.operations, {
    kind: 'copy-file', ownership: 'managed', destinationPath: file,
    contentSha256: createHash('sha256').update(text).digest('hex'),
  }] });
  return file;
}

test('native Codex plan excludes both skill copy roots without mutating the input', () => {
  const homeDir = '/home/example';
  const operations = [
    { kind: 'copy-file', destinationPath: '/home/example/.codex/skills/a/SKILL.md' },
    { kind: 'copy-file', destinationPath: '/home/example/.codex/.agents/skills/a/SKILL.md' },
    { kind: 'copy-file', destinationPath: '/home/example/.codex/agents/reviewer.toml' },
    { kind: 'copy-file', destinationPath: '/home/example/.codex/skills-other/keep.md' },
  ];
  const original = { operations, statePreview: { operations } };
  const result = excludeCodexSkillCopies(original, homeDir);
  assert.deepEqual(result.operations, operations.slice(2));
  assert.deepEqual(result.statePreview.operations, operations.slice(2));
  assert.equal(original.operations.length, 4);
});

test('routing removes only the three native ECC consumers and preserves personal skills', t => {
  const context = fixture(t);
  const result = createSkillSourcePlan(context);
  assert.deepEqual(result.routes, [
    { name: 'organizing-code', agents: ['opencode'] },
    { name: 'writing-code-comments', agents: [] },
  ]);
  assert.equal(result.piSettings.packages[0], 'npm:other');
  assert.deepEqual(result.piSettings.packages[1], {
    source: context.sourceRoot, prompts: ['commands/plan.md'],
  });
});

test('routing preserves an intentional nonempty Pi skill selection', t => {
  const context = fixture(t);
  writeJson(path.join(context.homeDir, '.pi/agent/settings.json'), {
    packages: [{ source: context.sourceRoot, skills: ['skills/organizing-code'] }],
  });
  assert.equal(createSkillSourcePlan(context).piSettings, null);
});

test('archive plan accepts only unmodified installer-owned skill directories', t => {
  const context = fixture(t);
  const file = ownedSkill(context, 'old');
  assert.deepEqual(createSkillSourcePlan(context).archives, [path.dirname(file)]);
  fs.writeFileSync(file, 'personal modification');
  assert.throws(() => createSkillSourcePlan(context), /modified|unowned/);
});

test('archive preflight rejects unrecorded files and symlinks without running commands', t => {
  const context = fixture(t);
  const file = ownedSkill(context, 'old');
  fs.writeFileSync(path.join(path.dirname(file), 'notes.md'), 'personal');
  const calls = [];
  assert.throws(() => reconcileSkillSources({ ...context, run: (...args) => calls.push(args) }), /unowned/);
  assert.equal(calls.length, 0);
});

test('archive preflight never follows a symlink below a managed directory', t => {
  const context = fixture(t);
  const file = ownedSkill(context, 'old');
  fs.symlinkSync(context.sourceRoot, path.join(path.dirname(file), 'foreign'));
  assert.throws(() => createSkillSourcePlan(context), /symlink/);
});

test('Magpie-owned skill links are left to the Magpie CLI', t => {
  const context = fixture(t);
  const file = ownedSkill(context, 'organizing-code', 'organizing-code', 'skills');
  fs.rmSync(path.dirname(file), { recursive: true });
  fs.symlinkSync(path.join(context.libraryRoot, 'organizing-code'), path.dirname(file));
  assert.deepEqual(createSkillSourcePlan(context).archives, []);
});

test('reconciliation backs up, routes, archives, updates Pi and is idempotent', t => {
  const context = fixture(t);
  const file = ownedSkill(context, 'old');
  const stateFile = path.join(context.homeDir, '.codex/ecc-install-state.json');
  const originalState = fs.readFileSync(stateFile, 'utf8');
  const calls = [];
  const run = (command, args) => {
    calls.push([command, args]);
    const libraryFile = path.join(context.homeDir, '.config/magpie/library.json');
    const library = JSON.parse(fs.readFileSync(libraryFile));
    const agents = args[4] === 'none' ? [] : args[4].split(',');
    writeJson(libraryFile, { ...library, skills: library.skills.map(skill => (
      skill.name === args[3] ? { ...skill, agents } : skill
    )) });
  };
  const result = reconcileSkillSources({ ...context, run });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ['magpie', ['library', 'skill', 'agents', 'organizing-code', 'opencode']]);
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.readFileSync(path.join(result.backupRoot, 'codex/.agents/skills/old/SKILL.md'), 'utf8'), 'owned');
  assert.equal(fs.readFileSync(path.join(result.backupRoot, 'ecc-install-state.json'), 'utf8'), originalState);
  assert.deepEqual(JSON.parse(fs.readFileSync(stateFile)).operations, []);
  const packages = JSON.parse(fs.readFileSync(path.join(context.homeDir, '.pi/agent/settings.json'))).packages;
  assert.equal(Object.hasOwn(packages[1], 'skills'), false);
  const again = reconcileSkillSources({ ...context, run });
  assert.equal(again.changed, false);
  assert.equal(calls.length, 2);
});

test('a Magpie failure preserves the old skill files and ownership record', t => {
  const context = fixture(t);
  const file = ownedSkill(context, 'old');
  const stateFile = path.join(context.homeDir, '.codex/ecc-install-state.json');
  const original = fs.readFileSync(stateFile, 'utf8');
  assert.throws(() => reconcileSkillSources({
    ...context, run: () => { throw new Error('Magpie unavailable'); },
  }), /Magpie unavailable/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'owned');
  assert.equal(fs.readFileSync(stateFile, 'utf8'), original);
});

test('dedupe CLI dry run emits one JSON result and leaves configuration untouched', t => {
  const context = fixture(t);
  const sourceRoot = path.resolve(__dirname, '../..');
  const settingsFile = path.join(context.homeDir, '.pi/agent/settings.json');
  writeJson(settingsFile, { packages: [{ source: sourceRoot, skills: [] }] });
  const original = fs.readFileSync(settingsFile, 'utf8');
  const output = execFileSync(process.execPath, [
    path.join(sourceRoot, 'scripts/local-ecc-update.js'), '--dedupe-skills', '--dry-run',
  ], { encoding: 'utf8', env: { ...process.env, HOME: context.homeDir } });
  const result = JSON.parse(output);
  assert.equal(result.magpieRoutes, 2);
  assert.equal(result.piPackageChanged, true);
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), original);
});

test('dry run does not alter any files or invoke Magpie', t => {
  const context = fixture(t);
  const file = ownedSkill(context, 'old');
  const result = reconcileSkillSources({ ...context, dryRun: true, run: () => assert.fail('unexpected command') });
  assert.equal(result.routes.length, 2);
  assert.equal(result.archives.length, 1);
  assert.equal(fs.existsSync(file), true);
  assert.equal(fs.existsSync(path.join(context.homeDir, '.local/state/ecc-upgrade')), false);
});
