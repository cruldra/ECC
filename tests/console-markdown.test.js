'use strict';

const assert = require('assert');
const path = require('path');
const { splitFrontmatter, joinFrontmatter, frontmatterEntries } = require(
  path.resolve(__dirname, '../console/src/ecc_plugin_console/static/js/lib/markdown.js')
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

console.log('\n=== console markdown split ===\n');

test('splits yaml head from body', () => {
  const src = '---\nname: demo\n---\n\n# Demo\n\nHello.\n';
  const parts = splitFrontmatter(src);
  assert.strictEqual(parts.frontmatter, 'name: demo');
  assert.strictEqual(parts.body, '# Demo\n\nHello.\n');
});

test('join roundtrip keeps skill markdown', () => {
  const src = '---\nname: demo\ndescription: x\n---\n\n# Demo\n';
  const parts = splitFrontmatter(src);
  assert.strictEqual(joinFrontmatter(parts.frontmatter, parts.body), src);
});

test('body-only file has empty frontmatter', () => {
  const parts = splitFrontmatter('# Hi\n');
  assert.strictEqual(parts.frontmatter, '');
  assert.strictEqual(parts.body, '# Hi\n');
});

test('yaml head becomes key/value rows, block scalars folded', () => {
  const rows = frontmatterEntries('name: demo\ndescription: >-\n  first line\n  second line\ntools: Read, Grep\nmodel: "sonnet"');
  assert.deepStrictEqual(rows, [
    { key: 'name', value: 'demo' },
    { key: 'description', value: 'first line\nsecond line' },
    { key: 'tools', value: 'Read, Grep' },
    { key: 'model', value: 'sonnet' },
  ]);
  assert.deepStrictEqual(frontmatterEntries(''), []);
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed ? 1 : 0);
