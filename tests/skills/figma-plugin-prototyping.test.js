'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const skillDir = path.join(repoRoot, 'skills', 'figma-plugin-prototyping');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed++;
  }
}

function runNodeTest(cwd, file) {
  const result = spawnSync(process.execPath, ['--test', file], { cwd, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, `${file} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

console.log('\n=== Testing figma-plugin-prototyping skill assets ===\n');

test('fake-figma mock passes its own tests', () => {
  runNodeTest(skillDir, path.join('scripts', 'fake-figma.test.js'));
});

test('templates run green in the layout the skill prescribes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'figma-lab-'));
  const pluginDir = path.join(root, 'docs', 'prototype', 'demo', 'figma-plugin');
  const labDir = path.join(root, 'docs', 'prototype', 'figma-lab');
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.mkdirSync(labDir, { recursive: true });
  for (const file of ['code.js', 'test.js', 'manifest.json']) {
    fs.copyFileSync(path.join(skillDir, 'templates', file), path.join(pluginDir, file));
  }
  fs.copyFileSync(path.join(skillDir, 'scripts', 'fake-figma.js'), path.join(labDir, 'fake-figma.js'));
  const check = spawnSync(process.execPath, ['--check', path.join(pluginDir, 'code.js')], { encoding: 'utf8' });
  assert.strictEqual(check.status, 0, check.stderr);
  const output = runNodeTest(root, path.join('docs', 'prototype', 'demo', 'figma-plugin', 'test.js'));
  assert.match(output, /^# fail 0$/m);
});

test('template manifest carries no fabricated plugin id', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(skillDir, 'templates', 'manifest.json'), 'utf8'));
  assert.strictEqual('id' in manifest, false);
  assert.deepStrictEqual(manifest.networkAccess.allowedDomains, ['none']);
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);

process.exit(failed > 0 ? 1 : 0);
