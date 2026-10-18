#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const skillFile = path.join(
  path.resolve(__dirname, "..", ".."),
  "skills",
  "writing-code-comments",
  "SKILL.md"
);
const body = fs.readFileSync(skillFile, "utf8");
const scriptFile = path.join(path.dirname(skillFile), "scripts", "export-component.py");

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
  const description = body.match(/^description: '([^']+)'$/m)[1];
  assert.ok(description.length <= 1024, `description is ${description.length} characters; Pi and other Agent Skills harnesses allow 1024`);
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
  assert.ok(body.includes("Embed the PNG the export script writes under `docs/prototype/<feature>/openpencil/exports/`."));
  assert.doesNotMatch(body, /are not written in this mode|read tools only/, "the preview writes doc comments now");
});

test("a code range may draw with op but change no source file; later messages revise the same comment", () => {
  assert.ok(body.includes("Write and Edit only under `docs/prototype/<feature>/openpencil/`. Everything else is refused"));
  assert.ok(body.includes("Later messages in the same session are the user's requests to change this comment."));
  assert.ok(body.includes("Each starts with the block's current `<path>:<start>-<end>`"));
  assert.ok(body.includes("answer with the whole new body the same way"));
});

test("from the preview op and the export script run one command per call, into the prototype directory", () => {
  assert.ok(body.includes("#### From the Code-Reading Preview"));
  assert.ok(body.includes("Bash for OpenPencil's `op` and for `uv run ${CLAUDE_SKILL_DIR}/scripts/export-component.py`"));
  assert.ok(body.includes("no shell variables, `export`, redirects, `&`, `&&`, or `;`"));
  assert.ok(body.includes("without `OPENPENCIL_DESKTOP_BIN`"));
  assert.ok(body.includes("docs/prototype/<feature>/openpencil/build.js"));
  assert.ok(body.includes("With the markers already in place, do not run `op design`."));
  assert.ok(body.includes("/Applications/OpenPencil.app/Contents/MacOS/op start --headless --file docs/prototype/<feature>/openpencil/<feature>.op"));
  assert.ok(body.includes("/Applications/OpenPencil.app/Contents/MacOS/op delete <id>"));
  assert.ok(body.includes("uv run ${CLAUDE_SKILL_DIR}/scripts/export-component.py docs/prototype/<feature>/openpencil desktop <path>#<Component>"));
  assert.doesNotMatch(body, /op export --item|mkdir -p/, "every picture goes through the script, which makes exports/ itself");
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
  assert.ok(body.includes("It writes `docs/prototype/<feature>/openpencil/exports/<board>--<Component>.png`, or `exports/<board>.png` when the marker is on the board's title"));
  assert.ok(body.includes("Ignore `figma-plugin/`."));
  assert.ok(body.includes("The same words on a menu item or a button do not count."));
  assert.ok(body.includes("in the same style as `my-apps`, not the component's class name."));
  assert.ok(body.includes("No absolute path besides the script's, no `$PWD`, and no `cd`."));
  assert.ok(body.includes("Do not start a second prototype of a page that has one."));
  assert.ok(body.includes("An editor that is already running is not yours"), "op start hands back someone else's editor");
  assert.ok(body.includes("Do not stop it, and do not delete, design, or save in it."));
  assert.ok(body.includes("`op stop` only an editor you started."));
  assert.doesNotMatch(body, /temporary directory, not under `docs\/prototype`|prototypes\/<ComponentName>|spx-comment-/, "drawings stay in the prototype directory");
  assert.doesNotMatch(body, /screenshot|opencli|cropOffset/i, "no screenshot workflow left");
});

test("each component gets its own picture, found by the marker in node names", () => {
  assert.ok(body.includes("A node names the component it draws after ` · `: the file path from the repo root, `#`, and the component's name"));
  assert.ok(body.includes("`top bar · src/components/marketing/SiteNav.tsx#SiteNav`"));
  assert.ok(body.includes("the board's title carries the marker, and the picture is the whole board with no frame"));
  assert.ok(body.includes("every one of those nodes, each framed in the same picture"));
  assert.ok(body.includes("add a board for that state, the usual desktop page with it open"));
  assert.ok(body.includes("![plain name](docs/prototype/<feature>/openpencil/exports/<board>--<Component>.png)"));
  assert.ok(body.includes("![top bar](docs/prototype/home/openpencil/exports/desktop--SiteNav.png)"));
  assert.ok(body.includes("`${CLAUDE_SKILL_DIR}` is the directory of this SKILL.md. When the script path in a command does not start with `/`, replace everything before `/scripts/` with the absolute path of that directory."), "harnesses other than Claude Code leave the variable as is");
  assert.match(body, /^description: '[^']*`<path>#<Component>`[^']*exports\/<board>--<Component>\.png/m);
  assert.doesNotMatch(body, /One picture: the usual desktop board|not a dialog\.|do not edit that `build\.js`/, "the whole-page picture for every component is gone");
});

test("a missing marker is appended in build.js and the .op rebuilt, nothing drawn changes", () => {
  assert.ok(body.includes("**No marker yet: add it to `build.js`, then rebuild the `.op`.**"));
  assert.ok(body.includes("Change nothing that is drawn: the rebuilt page looks as it did."));
  assert.ok(body.includes("delete every board `op get --depth 1` lists (a new file has none), run `op design` on `build.js`"));
  assert.ok(body.includes("Export every picture with the script, not with `op export`."));
});

test("the export script ships in the skill with Pillow declared inline", () => {
  assert.ok(body.includes("`${CLAUDE_SKILL_DIR}/scripts/export-component.py`"));
  assert.ok(fs.existsSync(scriptFile), `missing ${scriptFile}`);
  const script = fs.readFileSync(scriptFile, "utf8");
  assert.match(script, /^# \/\/\/ script\n# requires-python = ">=3\.10"\n# dependencies = \[\n# {5}"pillow[^"]*",\n# \]\n# \/\/\/\n/);
  assert.ok(script.includes('MARK_SEPARATOR = " · "'), "the script splits names the way the skill writes markers");
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

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function whitePng(width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.alloc(1 + width * 3, 255);
  row[0] = 0;
  const pixels = zlib.deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", pixels),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngSize(file) {
  const bytes = fs.readFileSync(file);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

const uv = spawnSync("uv", ["--version"], { encoding: "utf8" });
if (process.platform === "win32" || uv.status !== 0) {
  console.log("  - skipped export-component.py runs: needs uv and a POSIX shell for the fake op");
} else {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "export-component-"));
  const board = {
    id: "n1", name: "Home · src/app/page.tsx#HomePage", type: "frame", x: 100, y: 50, width: 400, height: 2000,
    children: [
      { id: "n2", name: "Prompt · src/components/Prompt.tsx#Prompt", type: "frame", x: 150, y: 1050, width: 300, height: 100 },
      { id: "n3", name: "Top · src/components/Shell.tsx#Shell", type: "frame", x: 100, y: 50, width: 400, height: 40 },
      { id: "n4", name: "Footer · src/components/Shell.tsx#Shell", type: "frame", x: 100, y: 1950, width: 400, height: 100 },
      { id: "n5", name: "Card · src/components/Card.tsx#Card", type: "frame", x: 100, y: 500, width: 100, height: 100 },
    ],
  };
  const other = { id: "n9", name: "Login", type: "frame", x: 600, y: 50, width: 400, height: 900,
    children: [{ id: "n10", name: "Card · src/components/Card.tsx#Card", type: "frame", x: 600, y: 60, width: 100, height: 100 }] };
  fs.writeFileSync(path.join(work, "layout.json"), JSON.stringify({ layout: [board, other] }));
  fs.writeFileSync(path.join(work, "board.png"), whitePng(800, 4000));
  const fakeOp = path.join(work, "op");
  fs.writeFileSync(fakeOp, `#!${process.execPath}
const fs = require("fs");
const args = process.argv.slice(2);
if (args[0] === "layout") process.stdout.write(fs.readFileSync(${JSON.stringify(path.join(work, "layout.json"))}, "utf8"));
else if (args[0] === "export") fs.copyFileSync(${JSON.stringify(path.join(work, "board.png"))}, args[args.indexOf("--output") + 1]);
else process.exit(2);
`);
  fs.chmodSync(fakeOp, 0o755);

  const exportComponent = marker => spawnSync("uv", ["run", "--quiet", scriptFile, "proto", "desktop", marker], {
    cwd: work, encoding: "utf8", env: { ...process.env, OPENPENCIL_CLI: fakeOp },
  });
  const pixels = (file, points) => {
    const code = "import json, sys\nfrom PIL import Image\nimage = Image.open(sys.argv[1]).convert('RGB')\nprint(json.dumps([image.getpixel((x, y)) for x, y in json.loads(sys.argv[2])]))";
    const run = spawnSync("uv", ["run", "--quiet", "--no-project", "--with", "pillow", "python", "-I", "-c", code, file, JSON.stringify(points)], { encoding: "utf8" });
    assert.strictEqual(run.status, 0, run.stderr);
    return JSON.parse(run.stdout);
  };

  test("export-component.py frames one area on one screen centred on it, the rest dimmed", () => {
    const run = exportComponent("src/components/Prompt.tsx#Prompt");
    assert.strictEqual(run.status, 0, run.stderr);
    const out = path.join(work, run.stdout.trim());
    assert.strictEqual(run.stdout.trim(), path.join("proto", "exports", "desktop--Prompt.png"));
    assert.deepStrictEqual(pngSize(out), [400, 900]);
    // The window starts at 587: the box spans 1000-1100 on the board, with its frame and tag above it.
    const [inside, outside] = pixels(out, [[200, 463], [200, 100]]);
    assert.deepStrictEqual(inside, [255, 255, 255]);
    assert.ok(outside.every(value => value < 140), `outside the frame should be dimmed, got ${outside}`);
  });

  test("export-component.py frames every node of a component that draws several areas", () => {
    const run = exportComponent("src/components/Shell.tsx#Shell");
    assert.strictEqual(run.status, 0, run.stderr);
    assert.deepStrictEqual(pngSize(path.join(work, run.stdout.trim())), [400, 2000], "top bar and footer need the whole board");
  });

  test("export-component.py exports the whole board for a marker on the board's title", () => {
    const run = exportComponent("src/app/page.tsx#HomePage");
    assert.strictEqual(run.status, 0, run.stderr);
    assert.strictEqual(run.stdout.trim(), path.join("proto", "exports", "desktop.png"));
    assert.deepStrictEqual(pngSize(path.join(work, run.stdout.trim())), [800, 4000]);
  });

  test("export-component.py refuses a missing, ambiguous, or malformed marker", () => {
    const missing = exportComponent("src/components/Missing.tsx#Missing");
    assert.strictEqual(missing.status, 1);
    assert.match(missing.stderr, /no node is named with src\/components\/Missing\.tsx#Missing/);
    const twice = exportComponent("src/components/Card.tsx#Card");
    assert.strictEqual(twice.status, 1);
    assert.match(twice.stderr, /is on more than one board \(Home, Login\)/);
    const malformed = exportComponent("src/components/Card.tsx");
    assert.strictEqual(malformed.status, 1);
    assert.match(malformed.stderr, /is not <path from the repo root>#<Component>/);
  });

  fs.rmSync(work, { recursive: true, force: true });
}

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
