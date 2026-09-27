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

test("frontmatter quotes the description so # stays inside it", () => {
  assert.match(body, /^---\nname: writing-code-comments\ndescription: '[^']+'\n---\n/);
  assert.ok(body.split("---")[1].includes("# @Comment"));
});

test("deletion is mandatory and addition stays restrained", () => {
  assert.ok(body.includes("删**(清理坏注释)→ **强制**"));
  assert.ok(body.includes("「克制」只管「加」,**不管「删」**"));
});

test("docstring lines that only restate the signature get deleted", () => {
  assert.ok(body.includes("遮住函数签名"));
  assert.ok(body.includes("只复述参数名 / 类型 / 返回类型"));
});

test("multi-branch functions get a numbered control-flow map", () => {
  assert.ok(body.includes("# ① ② ③"));
  assert.ok(body.includes("右对齐"));
  assert.ok(body.includes("≥2 个并列分支或多步流程"));
});

test("Chinese name marks live only on the definition", () => {
  assert.ok(body.includes("# @Comment 名字"));
  assert.ok(body.includes("只写在**定义处**"));
  assert.ok(body.includes("中文名标记不算「复述代码」,不删"));
});

test("forbids history notes in comments", () => {
  assert.ok(body.includes("不留历史痕迹"));
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
