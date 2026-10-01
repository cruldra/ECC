'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  applyCodexOverrides,
  claudeMarketplaceUsesSource,
  codexMarketplaceUsesSource,
  parseCliJson,
  restoreEnabled,
  snapshotEnabled,
} = require('../../scripts/local-ecc-update');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-local-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

for (const enabled of [false, true, undefined]) {
  test(`preserve Claude enabled=${enabled} while retaining other installer changes`, t => {
    const file = path.join(fixture(t), 'settings.json');
    fs.writeFileSync(file, JSON.stringify({ enabledPlugins: { 'ecc@ecc': enabled, other: true } }));
    const snapshot = snapshotEnabled(file, 'json');
    fs.writeFileSync(file, JSON.stringify({ enabledPlugins: { 'ecc@ecc': true, other: false }, extraKnownMarketplaces: { ecc: { source: 'local' } } }));
    restoreEnabled(snapshot);
    const result = JSON.parse(fs.readFileSync(file));
    assert.equal(result.enabledPlugins['ecc@ecc'], enabled);
    assert.equal(result.enabledPlugins.other, false);
    assert.equal(result.extraKnownMarketplaces.ecc.source, 'local');
  });
}

for (const original of ['', '[plugins."ecc@ecc"]\nenabled = false\n\n']) {
  test(`preserve Codex scope with original section ${JSON.stringify(original)}`, t => {
    const file = path.join(fixture(t), 'config.toml');
    fs.writeFileSync(file, 'model = "example"\n\n' + original + '[features]\napps = false\n');
    const snapshot = snapshotEnabled(file, 'toml');
    fs.writeFileSync(file, 'model = "example"\n\n[plugins."ecc@ecc"]\nenabled = true\n\n[features]\napps = true\n');
    restoreEnabled(snapshot);
    assert.equal(fs.readFileSync(file, 'utf8'), 'model = "example"\n\n' + original + '[features]\napps = true\n');
  });
}

test('restore enabled section at EOF without affecting other plugins', t => {
  const file = path.join(fixture(t), 'config.toml');
  fs.writeFileSync(file, '[plugins."ecc@ecc"]\nenabled = false');
  const snapshot = snapshotEnabled(file, 'toml');
  fs.writeFileSync(file, '[plugins."other"]\nenabled = true\n[plugins."ecc@ecc"]\nenabled = true\n');
  restoreEnabled(snapshot);
  assert.equal(fs.readFileSync(file, 'utf8'), '[plugins."other"]\nenabled = true\n[plugins."ecc@ecc"]\nenabled = false');
});

test('Codex overrides use tracked source paths for installer ownership', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '.codex/skills/grilling'), { recursive: true });
  fs.writeFileSync(path.join(root, '.codex/skills/grilling/SKILL.md'), 'custom');
  const operations = ['grilling', 'spec'].map(skill => ({ kind: 'copy-file', sourceRelativePath: `skills/${skill}/SKILL.md`, destinationPath: `/home/skills/${skill}/SKILL.md` }));
  const plan = applyCodexOverrides({ operations, statePreview: { operations } }, root);
  assert.equal(plan.operations[0].sourceRelativePath, '.codex/skills/grilling/SKILL.md');
  assert.equal(plan.operations[0].destinationPath, operations[0].destinationPath);
  assert.equal(plan.operations[1], operations[1]);
  assert.equal(operations[0].sourceRelativePath, 'skills/grilling/SKILL.md');
  assert.equal(plan.statePreview.operations[0].sourceRelativePath, '.codex/skills/grilling/SKILL.md');
});

test('detects existing Claude local marketplace source', () => {
  const root = '/Users/example/Projects/ECC';
  const marketplaces = [
    { name: 'ecc', source: 'directory', path: '/Users/example/Projects/ECC' },
    { name: 'other', source: 'github', repo: 'example/other' },
  ];
  assert.equal(claudeMarketplaceUsesSource(marketplaces, root), true);
  assert.equal(claudeMarketplaceUsesSource(marketplaces, '/Users/example/Other'), false);
});

test('detects existing Codex local marketplace source', () => {
  const root = '/Users/example/Projects/ECC';
  const marketplaces = [
    { name: 'ecc', marketplaceSource: { sourceType: 'local', source: '/Users/example/Projects/ECC' } },
    { name: 'other', marketplaceSource: { sourceType: 'git', source: 'example/other' } },
  ];
  assert.equal(codexMarketplaceUsesSource(marketplaces, root), true);
  assert.equal(codexMarketplaceUsesSource(marketplaces, '/Users/example/Other'), false);
});

test('parses the last JSON line from CLI output', () => {
  assert.deepEqual(parseCliJson(''), {});
  assert.deepEqual(parseCliJson('notice\n{"outcome":"ok"}\n'), { outcome: 'ok' });
});
