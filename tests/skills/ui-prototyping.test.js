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

test("OpenPencil route drives the editor with the op command line", () => {
  assert.ok(openpencil.includes("op install --target claude"));
  assert.ok(openpencil.includes("claude plugin marketplace update openpencil-skill"));
  assert.ok(openpencil.includes("OPENPENCIL_DESKTOP_BIN"));
  assert.ok(openpencil.includes("op start --headless --file"));
  assert.ok(openpencil.includes("op design @build.js"));
  assert.ok(openpencil.includes("op export --item <id>"));
  assert.ok(openpencil.includes("Ask before opening OpenPencil"));
});

test("no path points at the old skill directory", () => {
  for (const file of ["SKILL.md", "references/figma-plugin.md", "references/openpencil.md"]) {
    assert.ok(!read(file).includes("figma-plugin-prototyping"), `${file} still names figma-plugin-prototyping`);
  }
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
