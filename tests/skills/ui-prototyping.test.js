#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const skillDir = path.join(path.resolve(__dirname, "..", ".."), "skills", "ui-prototyping");
const read = (...parts) => fs.readFileSync(path.join(skillDir, ...parts), "utf8");
const skill = read("SKILL.md");
const openpencil = read("references", "openpencil.md");

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

console.log("\n=== Testing ui-prototyping skill ===\n");

test("frontmatter names the skill and quotes the description", () => {
  assert.match(skill, /^---\nname: ui-prototyping\ndescription: '[^\n]+'\n---\n/);
});

test("asks which tool to use unless the user named one", () => {
  assert.ok(skill.includes("If the user already named the tool, use it."));
  assert.ok(skill.includes("`AskUserQuestion`"));
  assert.ok(skill.includes("**Figma 插件**"));
  assert.ok(skill.includes("**OpenPencil**"));
});

test("routes each tool to a reference that exists", () => {
  const refs = [...skill.matchAll(/`references\/([\w-]+\.md)`/g)].map((m) => m[1]);
  assert.deepStrictEqual([...new Set(refs)].sort(), ["figma-plugin.md", "openpencil.md"]);
  for (const ref of refs) {
    assert.ok(fs.existsSync(path.join(skillDir, "references", ref)), `missing ${ref}`);
  }
});

test("OpenPencil route drives the editor with the app-bundled op command line", () => {
  assert.ok(openpencil.includes("OP=/Applications/OpenPencil.app/Contents/MacOS/op"));
  assert.ok(openpencil.includes("OPENPENCIL_DESKTOP_BIN"));
  assert.ok(openpencil.includes('"$OP" start --headless --file'));
  assert.ok(openpencil.includes('"$OP" design @build.js'));
  assert.ok(openpencil.includes('"$OP" export --item <id>'));
  assert.ok(!openpencil.includes("op install --target"), "official skill is bundled, not installed as a plugin");
  assert.ok(!/Require version/.test(openpencil), "no version gate on the bundled CLI");
});

test("OpenPencil design reference is bundled verbatim and pinned by hash", () => {
  const match = openpencil.match(/SHA-256: `([0-9a-f]{64})`/);
  assert.ok(match, "openpencil.md records the SHA-256 of the bundled reference");
  const bundled = fs.readFileSync(path.join(skillDir, "references", "openpencil-design.md"));
  const digest = require("crypto").createHash("sha256").update(bundled).digest("hex");
  assert.strictEqual(digest, match[1]);
});

test("OpenPencil editor is closed while drawing and opened without asking when done", () => {
  assert.ok(openpencil.includes("Close a running editor"));
  assert.ok(openpencil.includes("Open OpenPencil, no question"));
  assert.ok(!openpencil.includes("Ask before opening OpenPencil"));
  assert.ok(skill.includes("open the `.op` in OpenPencil without asking"));
});

test("no path points at the old skill directory", () => {
  for (const file of ["SKILL.md", "references/figma-plugin.md", "references/openpencil.md"]) {
    assert.ok(!read(file).includes("figma-plugin-prototyping"), `${file} still names figma-plugin-prototyping`);
  }
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
