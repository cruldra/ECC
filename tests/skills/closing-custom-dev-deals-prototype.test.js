#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const skillDir = path.join(root, "skills", "closing-custom-dev-deals");
const starter = path.join(skillDir, "prototype-starter");

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

const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");

console.log("\n=== Testing closing-custom-dev-deals prototype starter ===\n");

test("the starter carries everything pnpm install and the Dockerfile need", () => {
  for (const file of [
    "package.json",
    "pnpm-lock.yaml",
    "index.html",
    "vite.config.ts",
    "tsconfig.json",
    "Dockerfile",
    "README.md",
    "src/main.tsx",
    "src/router.tsx",
    "src/index.css",
    "src/shell/SceneShell.tsx",
    "src/scenes/scene1/index.tsx",
    "src/data/scene1.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(starter, file)), `missing ${file}`);
  }
});

test("the Dockerfile's frozen install has a lockfile to freeze against", () => {
  const dockerfile = read(starter, "Dockerfile");
  assert.match(dockerfile, /pnpm-lock\.yaml/);
  assert.match(dockerfile, /--frozen-lockfile/);
  assert.ok(fs.statSync(path.join(starter, "pnpm-lock.yaml")).size > 0);
});

test("SceneShell requires every band, and pains pair off against gains", () => {
  const shell = read(starter, "src/shell/SceneShell.tsx");
  for (const required of ["title", "subtitle", "pains", "gains", "demoTitle", "demo"]) {
    assert.match(shell, new RegExp(`\\b${required}\\b`), `SceneShell drops ${required}`);
    assert.ok(
      !new RegExp(`\\b${required}\\?:`).test(shell),
      `${required} must be a required prop, not optional`
    );
  }
  for (const label of ["现状", "解决方案"]) {
    assert.ok(shell.includes(label), `SceneShell drops the ${label} column`);
  }
});

test("the example scene goes through SceneShell and is actually clickable", () => {
  const scene = read(starter, "src/scenes/scene1/index.tsx");
  assert.match(scene, /SceneShell/);
  assert.match(scene, /useState/);
  assert.match(scene, /onClick/);
});

test("sample data is labelled as sample", () => {
  const data = read(starter, "src/data/scene1.ts");
  assert.ok(data.includes("示例"), "sample rows must be marked 示例");
});

test("nothing in the starter promises a timeline, a saving, or an ROI", () => {
  const banned = [/回本周期/, /投资回报/, /\bROI\b/, /节省\s*\d/, /\d+\s*天上线/, /保证.{0,6}(上线|交付)/];
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|md|html|json)$/.test(entry.name) && entry.name !== "pnpm-lock.yaml") files.push(full);
    }
  })(starter);

  for (const file of files) {
    const body = fs.readFileSync(file, "utf8");
    for (const pattern of banned) {
      // README and the data file name these words only to forbid them.
      const forbidding = /不许|禁止|一律不|不要写|红线/.test(body);
      if (pattern.test(body) && !forbidding) {
        assert.fail(`${path.relative(root, file)} matches ${pattern}`);
      }
    }
  }
});

test("SKILL.md points at the starter, the three bands, the red lines, and the deploy script", () => {
  const body = read(skillDir, "SKILL.md");
  assert.match(body, /prototype-starter/);
  assert.match(body, /每屏三段/);
  assert.match(body, /现状 \/ 解决方案/);
  assert.match(body, /交互演示工作区/);
  assert.match(body, /不许出现问号/);
  assert.match(body, /不许承诺任何东西/);
  assert.match(body, /dify-deploy\.sh/);
  assert.ok(!/frpc\.toml/.test(body), "the hand-rolled frp config should be gone");
});

test("the starter is registered for install and packaging", () => {
  const pkg = JSON.parse(read(root, "package.json"));
  assert.ok(pkg.files.includes("skills/closing-custom-dev-deals/"), "not in package.json files");
  const modules = JSON.parse(read(root, "manifests", "install-modules.json"));
  const paths = modules.modules.flatMap((module) => module.paths || []);
  assert.ok(paths.includes("skills/closing-custom-dev-deals"), "not in install-modules.json");
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
