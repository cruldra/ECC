'use strict';

const assert = require('assert');
const path = require('path');
const { parseRoute, formatRoute } = require(
  path.resolve(__dirname, '../console/src/ecc_plugin_console/static/js/lib/route.js')
);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }
}

console.log('\n=== console hash routes ===\n');

test('parses tab, item and editor routes', () => {
  assert.deepStrictEqual(parseRoute('#/agent'), { kind: 'agent', id: '', edit: false });
  assert.deepStrictEqual(parseRoute('#/agent/code-reviewer'), { kind: 'agent', id: 'code-reviewer', edit: false });
  assert.deepStrictEqual(parseRoute('#/agent/code-reviewer/edit'), { kind: 'agent', id: 'code-reviewer', edit: true });
  assert.deepStrictEqual(parseRoute('#/hook/pre:bash:dispatcher'), { kind: 'hook', id: 'pre:bash:dispatcher', edit: false });
});

test('rejects junk and never edits without an id', () => {
  assert.strictEqual(parseRoute(''), null);
  assert.strictEqual(parseRoute('#'), null);
  assert.strictEqual(parseRoute('#/Agent'), null);
  assert.strictEqual(parseRoute('#/agent/../etc'), null);
  assert.strictEqual(parseRoute('#/agent/x/delete'), null);
  assert.deepStrictEqual(parseRoute('#/agent//edit'), null);
});

test('format and parse round-trip', () => {
  for (const route of [
    { kind: 'skill', id: '', edit: false },
    { kind: 'command', id: 'plan', edit: false },
    { kind: 'agent', id: 'code-reviewer', edit: true },
  ]) {
    assert.deepStrictEqual(parseRoute(formatRoute(route)), route);
  }
  assert.strictEqual(formatRoute({ kind: 'skill', id: '', edit: true }), '#/skill');
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed ? 1 : 0);
