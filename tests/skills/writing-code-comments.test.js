#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const skillFile = path.join(
  path.resolve(__dirname, "..", ".."),
  "skills",
  "writing-code-comments",
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

console.log("\n=== Testing writing-code-comments skill ===\n");

test("frontmatter names the skill and quotes the description", () => {
  assert.match(body, /^---\nname: writing-code-comments\ndescription: '[^']+'\n---\n/);
});

test("keeps the sections in order", () => {
  const headings = body.split("\n").filter((line) => line.startsWith("## "));
  assert.deepStrictEqual(headings, [
    "## Explaining Code: One Plain Sentence",
    "## Rewriting a Comment: Start From the Code",
    "## Comment Format: KDoc Markdown in Every Language",
    "## Chinese Name Marks: `@Comment`",
  ]);
});

test("explains code the Feynman way in one plain sentence", () => {
  assert.ok(body.includes("Explain code the Feynman way"));
  assert.ok(body.includes("One sentence."));
  assert.ok(body.includes("If one plain sentence will not come"));
});

test("rewrites start from the code, not the old comment", () => {
  assert.ok(body.includes("do not edit the old one. Ignore it, read the code"));
  for (const check of ["The summary is true.", "Nothing restates the code.", "Each note sits where it applies.", "Nothing describes other modules."]) {
    assert.ok(body.includes(check), `missing check: ${check}`);
  }
});

test("every language uses KDoc-style Markdown comments", () => {
  assert.ok(body.includes("whatever the language"));
  assert.ok(body.includes("`@param name description`"));
  for (const fence of ["```kotlin", "```python", "```ts"]) {
    assert.ok(body.includes(fence), `missing ${fence} example`);
  }
});

test("Chinese name marks live only on the definition", () => {
  assert.ok(body.includes("on the Definition Only"));
  assert.ok(body.includes('Annotated[Type, Comment("name")]'));
  assert.ok(body.includes("# @Comment 管理员"));
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
