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
  assert.match(body, /^---\nname: writing-code-comments\ndescription: '[^']+'\nargument-hint: '<path>:<start>-<end>'\n---\n/);
});

test("keeps the sections in order", () => {
  const headings = body.split("\n").filter((line) => line.startsWith("## "));
  assert.deepStrictEqual(headings, [
    "## Called With a Code Range",
    "## Explaining Code: One Plain Sentence",
    "## Rewriting a Comment: Start From the Code",
    "## Comment Format: KDoc Markdown in Every Language",
    "## Front-End Components: Show What It Looks Like",
    "## Before You Finish: Check Every Comment You Wrote",
    "## Chinese Name Marks: `@Comment`",
  ]);
});

test("a code range from the preview gets the comment body only", () => {
  assert.ok(body.includes("Arguments for this call: `$ARGUMENTS`"));
  assert.ok(body.includes("When the arguments have the form `<path>:<start>-<end>`"));
  assert.ok(body.includes("You have read tools only; do not try to edit any file."));
  assert.ok(body.includes("Write it in Chinese."));
  assert.ok(body.includes("no Chinese name marks (`@Comment`), no code changes"));
  assert.ok(body.includes("The answer is the comment body only: no `#`, `//`, or `/* */`, no indentation"));
  assert.ok(body.includes("it never speaks to the person who asked"));
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

test("does one thing: writes the comment, never judges, deletes, or changes code", () => {
  assert.ok(body.includes("This skill does one thing: read the code you are given and write its comment."));
  assert.ok(body.includes("The result is always a comment, and the comment describes the code"));
  assert.doesNotMatch(body, /the comment goes|drop the comment|should be deleted/, "no rule asks to remove a comment");
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

test("front-end components embed a prototype drawn from the code with op", () => {
  assert.ok(body.includes("Draw it from the code."));
  assert.ok(body.includes("`<component dir>/prototypes/<ComponentName>.png`"));
  assert.ok(body.includes("Keep the drawing files out of the repo."));
  assert.ok(body.includes('"$OP" export --item <id> --output "<component dir>/prototypes/<ComponentName>.png"'));
  assert.ok(body.includes('mkdir -p "<component dir>/prototypes"'), "op export does not create the directory");
  assert.doesNotMatch(body, /screenshot|opencli|cropOffset/i, "no screenshot workflow left");
});

test("op usage points at the ui-prototyping OpenPencil route that exists", () => {
  const link = "../ui-prototyping/references/openpencil.md";
  assert.ok(body.includes(`(${link})`));
  assert.ok(fs.existsSync(path.join(path.dirname(skillFile), link)), `missing ${link}`);
  assert.ok(body.includes("Skip step 8."));
  const route = fs.readFileSync(path.join(path.dirname(skillFile), link), "utf8");
  assert.ok(route.includes("8. **Open OpenPencil"), "step 8 of the route is still the one that opens the editor");
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
