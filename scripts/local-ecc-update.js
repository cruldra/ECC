#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const pluginId = 'ecc@ecc';
const sourceRoot = path.resolve(__dirname, '..');

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function parseCliJson(output) {
  const text = output.trim();
  return text ? JSON.parse(text.split('\n').at(-1)) : {};
}

function applyCodexOverrides(plan, root) {
  const overrideOperation = operation => {
    if (operation.kind !== 'copy-file' || !operation.sourceRelativePath?.startsWith('skills/')) return operation;
    const relative = path.join('.codex', operation.sourceRelativePath);
    const override = path.join(root, relative);
    return fs.existsSync(override)
      ? { ...operation, sourcePath: override, sourceRelativePath: relative }
      : operation;
  };
  return {
    ...plan,
    operations: plan.operations.map(overrideOperation),
    statePreview: { ...plan.statePreview, operations: plan.statePreview.operations.map(overrideOperation) },
  };
}

function samePath(a, b) {
  return path.resolve(a) === path.resolve(b);
}

function claudeMarketplaceUsesSource(marketplaces, root) {
  return marketplaces.some(marketplace => marketplace.name === 'ecc' &&
    marketplace.source === 'directory' &&
    marketplace.path &&
    samePath(marketplace.path, root));
}

function codexMarketplaceUsesSource(marketplaces, root) {
  return marketplaces.some(marketplace => marketplace.name === 'ecc' &&
    marketplace.marketplaceSource?.sourceType === 'local' &&
    samePath(marketplace.marketplaceSource.source, root));
}

function ensureClaudeMarketplace(home, root) {
  const marketplaces = JSON.parse(run('claude', ['plugin', 'marketplace', 'list', '--json'], home));
  if (!claudeMarketplaceUsesSource(marketplaces, root)) {
    run('claude', ['plugin', 'marketplace', 'add', root], home);
  }
}

function ensureCodexMarketplace(home, root) {
  const { marketplaces } = JSON.parse(run('codex', ['plugin', 'marketplace', 'list', '--json'], home));
  if (!codexMarketplaceUsesSource(marketplaces, root)) {
    run('codex', ['plugin', 'marketplace', 'add', root, '--json'], home);
  }
}

function snapshotEnabled(file, format) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (format === 'json') {
    const data = text === null ? {} : JSON.parse(text);
    return { file, format, value: data.enabledPlugins?.[pluginId] };
  }
  const block = text?.match(/^\[plugins\."ecc@ecc"\][\s\S]*?(?=^\[|$(?![\s\S]))/m)?.[0];
  return { file, format, value: block };
}

function restoreEnabled(snapshot) {
  if (!fs.existsSync(snapshot.file)) return;
  const text = fs.readFileSync(snapshot.file, 'utf8');
  let next;
  if (snapshot.format === 'json') {
    const data = JSON.parse(text);
    if (snapshot.value === undefined) {
      if (data.enabledPlugins) {
        delete data.enabledPlugins[pluginId];
        if (Object.keys(data.enabledPlugins).length === 0) delete data.enabledPlugins;
      }
    } else {
      data.enabledPlugins = { ...data.enabledPlugins, [pluginId]: snapshot.value };
    }
    next = JSON.stringify(data, null, 2) + '\n';
  } else {
    const section = /^\[plugins\."ecc@ecc"\][\s\S]*?(?=^\[|$(?![\s\S]))/m;
    if (section.test(text)) next = text.replace(section, snapshot.value || '');
    else next = text + (snapshot.value ? '\n' + snapshot.value : '');
  }
  if (next !== text) fs.writeFileSync(snapshot.file, next);
}

async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--pull', '--dry-run'].includes(arg))) {
    throw new Error('Usage: node scripts/local-ecc-update.js [--pull | --dry-run]');
  }
  if (args.includes('--pull') && args.includes('--dry-run')) {
    throw new Error('--pull and --dry-run cannot be combined');
  }
  const home = os.homedir();
  if (args.includes('--pull')) {
    if (run('git', ['status', '--porcelain'], sourceRoot).trim()) {
      throw new Error('Commit your local changes before updating upstream.');
    }
    run('git', ['fetch', 'origin', 'main'], sourceRoot);
    run('git', ['rebase', 'origin/main'], sourceRoot);
    run('git', ['submodule', 'update', '--init', '--recursive'], sourceRoot);
  }

  const registry = JSON.parse(fs.readFileSync(path.join(home, '.claude/plugins/installed_plugins.json'), 'utf8'));
  const entries = registry.plugins?.[pluginId] || [];
  const existing = entries.filter(entry => entry.scope === 'user' ||
    (entry.projectPath && fs.existsSync(entry.projectPath)));
  if (existing.some(entry => !['user', 'project', 'local'].includes(entry.scope))) {
    throw new Error('Managed installation found; refusing to change its scope.');
  }
  const skipped = entries.filter(entry => !existing.includes(entry)).map(entry => entry.projectPath);
  const statePath = path.join(home, '.codex/ecc-install-state.json');
  const previous = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const { createManifestInstallPlan, applyInstallPlan, previewInstallPlan } = require('./lib/install-executor');
  const plan = applyCodexOverrides(createManifestInstallPlan({
    target: 'codex', profileId: previous.request.profile,
    moduleIds: previous.request.modules,
    includeComponentIds: previous.request.includeComponents,
    excludeComponentIds: previous.request.excludeComponents,
    sourceRoot, projectRoot: sourceRoot, homeDir: home,
  }), sourceRoot);
  if (args.includes('--dry-run')) {
    console.log(JSON.stringify({ sourceRoot, scopes: existing.map(({ scope, projectPath }) => ({ scope, projectPath })), skipped, plan: previewInstallPlan(plan) }, null, 2));
    return;
  }
  const { projectCanonicalInstallState } = require('./lib/install-state-store-sync');

  const settings = new Set([path.join(home, '.claude/settings.json')]);
  for (const entry of existing) {
    if (entry.projectPath) {
      settings.add(path.join(entry.projectPath, '.claude/settings.json'));
      settings.add(path.join(entry.projectPath, '.claude/settings.local.json'));
    }
  }
  const snapshots = [...settings].map(file => snapshotEnabled(file, 'json'));
  snapshots.push(snapshotEnabled(path.join(home, '.codex/config.toml'), 'toml'));
  try {
    ensureClaudeMarketplace(home, sourceRoot);
    for (const entry of existing) {
      const cwd = entry.projectPath || home;
      const removed = parseCliJson(run('claude', ['plugin', 'uninstall', pluginId, '--scope', entry.scope, '--keep-data', '--json'], cwd));
      if (removed.outcome && removed.outcome !== 'ok') throw new Error(JSON.stringify(removed));
      const result = parseCliJson(run('claude', ['plugin', 'install', pluginId, '--scope', entry.scope, '--yes', '--json'], cwd));
      if (result.outcome && result.outcome !== 'ok') throw new Error(JSON.stringify(result));
      console.log(`Claude ${entry.scope}: ${entry.projectPath || home}`);
    }
    ensureCodexMarketplace(home, sourceRoot);
    const inventory = JSON.parse(run('codex', ['plugin', 'list', '--json'], home));
    if (inventory.installed.some(plugin => plugin.pluginId === pluginId)) {
      run('codex', ['plugin', 'remove', pluginId, '--json'], home);
    }
    const installed = JSON.parse(run('codex', ['plugin', 'add', pluginId, '--json'], home));
    const result = applyInstallPlan(plan);
    const projection = await projectCanonicalInstallState(result.statePreview, { homeDir: home });
    if (projection.warning) console.warn(projection.warning.message);
    console.log(`Codex: ${installed.version}; managed files: ${result.operations.length}`);
    console.log(`Skipped missing project directories: ${skipped.length}`);
  } finally {
    for (const snapshot of snapshots) restoreEnabled(snapshot);
  }
}

module.exports = {
  applyCodexOverrides,
  claudeMarketplaceUsesSource,
  codexMarketplaceUsesSource,
  parseCliJson,
  snapshotEnabled,
  restoreEnabled,
};
if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
