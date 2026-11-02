#!/usr/bin/env node
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const skillDir = path.join(path.resolve(__dirname, "..", ".."), "skills", "applying-design-patterns");
const skillFile = path.join(skillDir, "SKILL.md");
const body = fs.readFileSync(skillFile, "utf8");
const translation = fs.readFileSync(path.join(skillDir, "i18n", "zh-CN.md"), "utf8");

const CATALOG = {
  creational: ["Factory Method", "Abstract Factory", "Builder", "Prototype", "Singleton"],
  structural: ["Adapter", "Bridge", "Composite", "Decorator", "Facade", "Flyweight", "Proxy"],
  behavioral: [
    "Chain of Responsibility",
    "Command",
    "Iterator",
    "Mediator",
    "Memento",
    "Observer",
    "State",
    "Strategy",
    "Template Method",
    "Visitor",
  ],
};
const CARD_FIELDS = ["Intent", "Signals", "Steps", "Costs", "Look-alikes", "Native form"];

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

function readReference(category) {
  return fs.readFileSync(path.join(skillDir, "references", `${category}.md`), "utf8");
}

function cards(text) {
  const result = new Map();
  for (const chunk of text.split(/^## /m).slice(1)) {
    const [title, ...rest] = chunk.split("\n");
    result.set(title.trim(), rest.join("\n"));
  }
  return result;
}

console.log("\n=== Testing applying-design-patterns skill ===\n");

test("frontmatter names the skill with a quoted one-line description under 1024 characters", () => {
  const match = body.match(/^---\nname: applying-design-patterns\ndescription: '([^'\n]+)'\n---\n/);
  assert.ok(match, "frontmatter must hold name and a single-quoted description");
  assert.ok(match[1].length <= 1024, `description is ${match[1].length} characters`);
  assert.ok(match[1].includes("references/creational.md, structural.md and behavioral.md"));
});

test("keeps the sections in order", () => {
  const headings = body.split("\n").filter((line) => line.startsWith("## "));
  assert.deepStrictEqual(headings, [
    "## When to Use",
    "## How It Works",
    "## Examples",
    "## Before You Finish",
    "## Source",
  ]);
});

test("the workflow puts the pain and the gate before any pattern", () => {
  const steps = body.split("\n").filter((line) => line.startsWith("### ") && /^### \d\./.test(line));
  assert.deepStrictEqual(steps, [
    "### 1. Name the Pain Before the Pattern",
    "### 2. Pass the Gate",
    "### 3. Map the Signal to a Pattern",
    "### 4. Prefer the Language-Native Form",
    "### 5. Refactor in Small Steps",
    "### 6. Know What Each Pattern Costs",
    "### 7. Tell Look-Alikes Apart",
    "### 8. Report the Proposal",
  ]);
  assert.ok(body.includes('"Every time we add or change X, we edit Y."'));
  assert.ok(body.includes('"No pattern" is a valid result.'));
});

test("links every reference file, and each links back to SKILL.md", () => {
  for (const category of Object.keys(CATALOG)) {
    assert.ok(body.includes(`(references/${category}.md)`), `SKILL.md must link references/${category}.md`);
    assert.ok(readReference(category).includes("[SKILL.md](../SKILL.md)"), `${category}.md must link back`);
  }
});

test("each reference holds exactly its category's patterns, in catalog order", () => {
  for (const [category, patterns] of Object.entries(CATALOG)) {
    assert.deepStrictEqual([...cards(readReference(category)).keys()], patterns);
  }
});

test("every pattern card carries all six fields", () => {
  for (const category of Object.keys(CATALOG)) {
    for (const [title, card] of cards(readReference(category))) {
      for (const field of CARD_FIELDS) {
        assert.ok(card.includes(`- **${field}**:`), `${title} is missing ${field}`);
      }
    }
  }
});

test("the signal table only names patterns that have a card", () => {
  const known = new Set(Object.values(CATALOG).flat());
  const section = body.split("### 3. Map the Signal to a Pattern")[1].split("### 4.")[0];
  const rows = section.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| ---"));
  const firstCandidates = rows.slice(1).map((line) => line.split("|")[2].trim());
  const unknown = firstCandidates.filter((name) => !known.has(name) && !name.startsWith("One instance injected"));
  assert.deepStrictEqual(unknown, []);
  assert.strictEqual(firstCandidates.length, 22, "one signal row per classic pattern");
});

test("the zh-CN translation tracks the current SKILL.md", () => {
  const digest = crypto.createHash("sha256").update(fs.readFileSync(skillFile)).digest("hex");
  assert.match(translation, /^---\nname: applying-design-patterns\ndescription: '[^'\n]+'\nlocale: zh-CN\n/);
  assert.ok(translation.includes(`source_hash: ${digest}`), "re-sync i18n/zh-CN.md after editing SKILL.md");
  const sourceHeadings = body.split("\n").filter((line) => /^#{2,3} /.test(line)).length;
  const translatedHeadings = translation.split("\n").filter((line) => /^#{2,3} /.test(line)).length;
  assert.strictEqual(translatedHeadings, sourceHeadings);
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
