#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), "utf8");
const skill = read("skills", "agent-browser", "SKILL.md");

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

console.log("\n=== Testing agent-browser skill ===\n");

test("frontmatter names the skill and limits tools to the agent-browser CLI", () => {
  assert.match(skill, /^---\nname: agent-browser\ndescription: [^\n]+\nallowed-tools: Bash\(agent-browser:\*\)\n---\n/);
});

test("loads the version-matched guide from the installed CLI before the first command", () => {
  assert.ok(skill.includes("agent-browser skills get core"));
  assert.ok(skill.includes("--ref commands"));
});

test("never attaches to the user's Chrome", () => {
  assert.ok(skill.includes("Never attach to the user's Chrome with `--auto-connect` or `--cdp`"));
});

test("one named session per task, closed at the end", () => {
  assert.ok(skill.includes("agent-browser session id --scope worktree --prefix <task>"));
  assert.ok(skill.includes("agent-browser --session <name> close"));
});

test("passwords are filled from bw without being echoed", () => {
  assert.ok(skill.includes("bw get password <item-id>"));
  assert.ok(skill.includes("Never print `password` or `totp` fields"));
  assert.ok(skill.includes("never handle the master password"));
  assert.ok(skill.includes("bw unlock --raw > ~/.config/bw/session"), "session key lives at the generic path");
  assert.ok(!skill.includes("luffy"), "no project-specific path");
});

test("opencli-browser is gone and nothing ships or installs it", () => {
  assert.ok(!fs.existsSync(path.join(repoRoot, "skills", "opencli-browser")));
  for (const file of ["package.json", "manifests/install-modules.json", "manifests/pi-core.json"]) {
    const text = read(file);
    assert.ok(!text.includes("opencli-browser"), `${file} still names opencli-browser`);
    assert.ok(text.includes("agent-browser"), `${file} does not name agent-browser`);
  }
});

test("browser-qa and e2e-runner drive pages with agent-browser, not opencli browser", () => {
  for (const file of ["skills/browser-qa/SKILL.md", "agents/e2e-runner.md"]) {
    const text = read(file);
    assert.ok(text.includes("agent-browser"), `${file} does not name agent-browser`);
    assert.ok(!text.includes("opencli browser"), `${file} still uses opencli browser`);
  }
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
