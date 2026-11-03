#!/usr/bin/env node
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const skillDir = path.join(path.resolve(__dirname, "..", ".."), "skills", "using-spx-cli");
const skillFile = path.join(skillDir, "SKILL.md");
const body = fs.readFileSync(skillFile, "utf8");
const translation = fs.readFileSync(path.join(skillDir, "i18n", "zh-CN.md"), "utf8");
const schema = JSON.parse(fs.readFileSync(path.join(skillDir, "references", "state-json.schema.json"), "utf8"));

const SPX_COMMANDS = [
  "issue view",
  "issue create",
  "issue marker",
  "issue state get",
  "issue state merge",
  "pr view",
  "pr create",
  "pr review-comment",
];

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

function headings(text) {
  return text.split("\n").filter((line) => /^#{2,3} /.test(line));
}

function slug(heading) {
  return heading
    .replace(/^#+ /, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

function localFields() {
  return Object.entries(schema.properties)
    .filter(([, spec]) => spec["x-local"] === true)
    .map(([name]) => name);
}

console.log("\n=== Testing using-spx-cli skill ===\n");

test("frontmatter names the skill with a quoted one-line description under 1024 characters", () => {
  const match = body.match(/^---\nname: using-spx-cli\ndescription: '([^'\n]+)'\n---\n/);
  assert.ok(match, "frontmatter must hold name and a single-quoted description");
  assert.ok(match[1].length <= 1024, `description is ${match[1].length} characters`);
  assert.ok(match[1].includes("<git common dir>/superwork/local-issue-state.json"));
  assert.ok(match[1].includes("references/state-json.schema.json"));
});

test("keeps the sections in order", () => {
  const sections = body.split("\n").filter((line) => line.startsWith("## "));
  assert.deepStrictEqual(sections, ["## When to Use", "## How It Works", "## Examples", "## Common Mistakes"]);
});

test("explains the forge, the state comment, local fields, markers, commands and flags in that order", () => {
  const steps = body.split("\n").filter((line) => /^### \d\./.test(line));
  assert.deepStrictEqual(steps, [
    "### 1. Forge and Credentials",
    "### 2. State JSON Lives in a Hidden Comment",
    "### 3. Local Fields Go to the Local Issue-State File",
    "### 4. Body Markers",
    "### 5. Commands",
    "### 6. Global Flags",
  ]);
});

test("the bundled schema is strict and its local fields match the list in SKILL.md", () => {
  assert.strictEqual(schema.additionalProperties, false);
  const listed = body.match(/are \*\*local fields\*\*: (.+?)\. They describe this machine/);
  assert.ok(listed, "SKILL.md must list the local fields");
  const names = [...listed[1].matchAll(/`([A-Za-z]+)`/g)].map((m) => m[1]);
  assert.deepStrictEqual([...names].sort(), localFields().sort());
  assert.ok(localFields().includes("worktreePath") && localFields().includes("prDiffFile"));
});

test("every --state-json example only uses schema fields with valid values", () => {
  const examples = [...body.matchAll(/--state-json '(\{[^']*\})'/g)].map((m) => m[1]).filter((raw) => raw !== "{...}");
  assert.ok(examples.length >= 3, "expected the create and merge examples");
  for (const raw of examples) {
    for (const [field, value] of Object.entries(JSON.parse(raw))) {
      const spec = schema.properties[field];
      assert.ok(spec, `${field} is not in the schema`);
      if (spec.enum) assert.ok(spec.enum.includes(value), `${field}=${value} is not in its enum`);
      if (spec.pattern) assert.match(value, new RegExp(spec.pattern), `${field} breaks its pattern`);
    }
  }
});

test("every spx command in SKILL.md is a real spx subcommand, and each subcommand is documented", () => {
  const used = new Set(
    [...body.matchAll(/opencli spx ((?:issue|pr) (?:state )?[a-z-]+)/g)].map((m) => m[1])
  );
  assert.deepStrictEqual([...used].filter((cmd) => !SPX_COMMANDS.includes(cmd)), []);
  assert.deepStrictEqual(SPX_COMMANDS.filter((cmd) => !used.has(cmd)), []);
});

test("Gitea credentials need a tea login; GITEA_TOKEN only fills in for it", () => {
  assert.ok(body.includes("For Gitea a tea login for the host is required."));
  assert.ok(body.includes("spx never sends it to a host that tea has not logged in to"));
});

test("in-page links point at existing headings, in SKILL.md and in the translation", () => {
  for (const text of [body, translation]) {
    const anchors = new Set(headings(text).map(slug));
    const links = [...text.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
    assert.ok(links.length >= 2, "expected cross-links between sections");
    for (const link of links) assert.ok(anchors.has(link), `#${link} has no heading`);
  }
});

test("the zh-CN translation tracks the current SKILL.md", () => {
  const digest = crypto.createHash("sha256").update(fs.readFileSync(skillFile)).digest("hex");
  assert.match(translation, /^---\nname: using-spx-cli\ndescription: '[^'\n]+'\nlocale: zh-CN\n/);
  assert.ok(translation.includes(`source_hash: ${digest}`), "re-sync i18n/zh-CN.md after editing SKILL.md");
  assert.strictEqual(headings(translation).length, headings(body).length);
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
