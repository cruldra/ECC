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
    "## Front-End Components: Show What It Looks Like",
    "## Before You Finish: Check Every Comment You Wrote",
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

test("code elsewhere in the repo is a repo-root link with a symbol anchor", () => {
  assert.ok(body.includes("`[plain name](path/from/repo/root#Symbol)`"));
  assert.ok(body.includes("Never a line number."));
  assert.ok(body.includes("[agent table](backend/src/app/agent/models.py#Agent)"));
  assert.doesNotMatch(body, /\]\([^)\s]+#L?\d+\)/, "links must not point at line numbers");
});

test("front-end components embed a cropped screenshot from a running environment", () => {
  assert.ok(body.includes("Reuse an environment that is already running."));
  assert.ok(body.includes("Never commit a screenshot with real user data."));
  assert.ok(body.includes("`<component dir>/screenshots/<ComponentName>.png`"));
  assert.ok(body.includes("--cropOffset <y> <x>"));
});

test("names in this file or its imports are [Name]; everything else is a full link", () => {
  assert.ok(body.includes("defined in this file or imported into it, as in KDoc"));
  assert.ok(body.includes("`@throws [ExceptionClass] when it is thrown`"));
  assert.ok(body.includes("this file first, then its imports"));
  assert.ok(!body.includes("Never a bare `[Name]` without a path."));
});

test("a final pass checks every comment written, with a grep for bare references", () => {
  assert.ok(body.includes("go over every comment written or changed in this task, not a sample"));
  assert.ok(body.includes("git diff -U0 | grep '^+' | grep -nE"));
  assert.ok(body.includes("Fix every miss before reporting the work as finished."));
});

test("Chinese name marks live only on the definition", () => {
  assert.ok(body.includes("on the Definition Only"));
  assert.ok(body.includes('Annotated[Type, Comment("name")]'));
  assert.ok(body.includes("# @Comment 管理员"));
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
