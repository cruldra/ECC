#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const skillFile = path.join(
  path.resolve(__dirname, "..", ".."),
  "skills",
  "writing-plans",
  "SKILL.md"
);
const body = fs.readFileSync(skillFile, "utf8");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message}`);
    failed++;
  }
}

/** Reads the example tree into `{ depth, name }` entries, root line excluded. */
function exampleTree() {
  const section = body.split("## File structure section")[1].split("\n## Task size")[0];
  const tree = section.split("\n```\n")[1];
  return tree
    .split("\n")
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const marker = line.search(/[├└]── /);
      return { depth: marker / 4, name: line.slice(marker + 4).split("  ")[0] };
    });
}

console.log("\n=== Testing writing-plans skill ===\n");

test("the file tree leaves test files out", () => {
  assert.ok(body.includes("Leave test files out: test code, test fixtures, snapshots."));
  assert.ok(body.includes("tests are listed under each task's **Files:**"));
  for (const { name } of exampleTree()) {
    assert.doesNotMatch(name, /(^|\/)(tests?\/|test_)|\.(test|spec)\./, `${name} is a test file`);
  }
});

test("a directory with several files gets its own line; one file folds into the path", () => {
  assert.ok(body.includes("A directory holding two or more listed files gets its own line"));
  assert.ok(body.includes("A directory holding exactly one listed file folds into that file's line"));
  assert.ok(body.includes("A directory whose only listed content is one subdirectory merges with it"));
  const entries = exampleTree();
  assert.ok(entries.some(({ name }) => /^[^/]+\/[^/]+\.\w+$/.test(name)), "Expected a folded one-file path");
  assert.ok(entries.some(({ name }) => /^[^/]+\/[^/]+\/$/.test(name)), "Expected a merged directory chain");
});

test("sibling lines in the example never share a leading directory", () => {
  const entries = exampleTree();
  const parents = [];
  const siblings = new Map();
  entries.forEach((entry, index) => {
    parents[entry.depth] = index;
    const parent = entry.depth === 0 ? -1 : parents[entry.depth - 1];
    const firstDir = entry.name.includes("/") ? entry.name.split("/")[0] : null;
    if (!firstDir) return;
    const key = `${parent}:${firstDir}`;
    assert.ok(!siblings.has(key), `${entry.name} shares ${firstDir}/ with a sibling line`);
    siblings.set(key, entry.name);
  });
});

test("self-review checks the file tree", () => {
  assert.ok(body.includes("**File tree:** no test files, and no two sibling lines whose paths start with the same directory"));
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
