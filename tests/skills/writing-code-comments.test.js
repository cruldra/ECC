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

test("frontmatter description stays within the 1024-character harness limit", () => {
  const match = body.match(/^description: '([^']+)'$/m);
  assert.ok(match, "description must be a single-quoted inline scalar");
  assert.ok(
    match[1].length <= 1024,
    `description exceeds 1024 characters (${match[1].length})`
  );
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
  assert.ok(body.includes("When the arguments start with `<path>:<start>-<end>`"));
  assert.ok(body.includes("Words after the range are the user's request for this comment."));
  assert.ok(body.includes("Write it in Chinese."));
  assert.ok(body.includes("no Chinese name marks (`@Comment`), no code changes"));
  assert.ok(body.includes("The answer is the comment body only: no `#`, `//`, `/* */`, `/** */`, leading ` * `, or `\"\"\"`, no indentation"));
  assert.ok(body.includes("it never speaks to the person who asked"));
});

test("a code range gets the comment the preview replaces: doc comment, plain comment, or the new kind", () => {
  assert.ok(body.includes("Write the one comment the preview replaces. The range tells which one:"));
  assert.ok(body.includes("**The block's own doc comment**"));
  assert.ok(body.includes("with `@param` / `@return` / `@throws` tags where they apply"));
  assert.ok(body.includes("**The plain comment** that opens the range"));
  assert.ok(body.includes("a docstring for a Python function or class, `/** */` for a TypeScript or JavaScript function, class, enum, constant, or variable, `///` for a Rust item"));
  assert.ok(body.includes("Embed the PNG from `docs/prototype/<feature>/openpencil/exports/`."));
  assert.doesNotMatch(body, /are not written in this mode|read tools only/, "the preview writes doc comments now");
});

test("a code range may draw with op but change no source file; later messages revise the same comment", () => {
  assert.ok(body.includes("Write and Edit only under `docs/prototype/<feature>/openpencil/`. Everything else is refused"));
  assert.ok(body.includes("Later messages in the same session are the user's requests to change this comment."));
  assert.ok(body.includes("Each starts with the block's current `<path>:<start>-<end>`"));
  assert.ok(body.includes("answer with the whole new body the same way"));
});

test("from the preview op runs by its full path, one command per call, into the prototype directory", () => {
  assert.ok(body.includes("#### From the Code-Reading Preview"));
  assert.ok(body.includes("no shell variables, `export`, redirects, `&`, `&&`, or `;`"));
  assert.ok(body.includes("without `OPENPENCIL_DESKTOP_BIN`"));
  assert.ok(body.includes("docs/prototype/<feature>/openpencil/build.js"));
  assert.ok(body.includes("On a reuse, do not run `op design`."));
  assert.ok(body.includes("/Applications/OpenPencil.app/Contents/MacOS/op start --headless --file docs/prototype/<feature>/openpencil/<feature>.op"));
  assert.ok(body.includes("/Applications/OpenPencil.app/Contents/MacOS/op export --item <id> --output docs/prototype/<feature>/openpencil/exports/<board>.png --scale 2"));
  assert.ok(body.includes("mkdir -p docs/prototype/<feature>/openpencil/exports"));
});

test("explains code the Feynman way in one plain sentence", () => {
  assert.ok(body.includes("Explain code the Feynman way"));
  assert.ok(body.includes("One sentence."));
  assert.ok(body.includes("If one plain sentence will not come"));
});

test("complex flows are a mermaid diagram kept inside the comment body", () => {
  assert.ok(body.includes("### Complex Flows: Use Mermaid, Not Prose"));
  assert.ok(body.includes("Fenced `mermaid` blocks inside the body are required for complex flows"));
  assert.ok(body.includes("Do not write the flow as a paragraph or a numbered list"));
  assert.ok(body.includes("Derive every node and edge from the code you read."));
  assert.ok(body.includes("exclude diagram blocks from the reference checks below"));
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
  assert.ok(body.includes("docs/prototype/<feature>/openpencil/exports/<board>.png"));
  assert.ok(body.includes("Ignore `figma-plugin/`."));
  assert.ok(body.includes("The same words on a menu item or a button do not count."));
  assert.ok(body.includes("in the same style as `my-apps`, not the component's class name."));
  assert.ok(body.includes("Write this component's file path from the repo root into the board title or the note that introduces the board."));
  assert.ok(body.includes("A path written anywhere else does not count."));
  assert.ok(body.includes("No absolute path, no `$PWD`, and no `cd`."));
  assert.ok(body.includes("Do not add a board to a prototype that already exists."));
  assert.ok(body.includes('"$OP" export --item <id> --output "$PWD/docs/prototype/<feature>/openpencil/exports/<board>.png"'));
  assert.ok(body.includes('mkdir -p "$PWD/docs/prototype/<feature>/openpencil/exports"'), "op export does not create the directory");
  assert.doesNotMatch(body, /temporary directory, not under `docs\/prototype`|prototypes\/<ComponentName>|spx-comment-/, "drawings stay in the prototype directory");
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
