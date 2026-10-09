#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const skill = fs.readFileSync(path.join(root, "skills", "clash-best-practices", "SKILL.md"), "utf8");

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

console.log("\n=== Testing clash-best-practices skill ===\n");

test("frontmatter names the skill and includes metadata", () => {
  assert.match(skill, /^---\nname: clash-best-practices\ndescription: "[^"]+"\nmetadata:\n  version: "1\.0\.0"\n  source: "conversation-derived-and-corrected"\n---\n/);
});

test("covers the complete operating workflow", () => {
  for (const heading of [
    "## 不可跳过的约束",
    "## 1. 建立基线并保护会话",
    "## 2. 先判断家宽是否需要中转",
    "## 3. 分流与 DNS 配套",
    "## 4. 区分 IPv4、IPv6、UDP 与检测标签",
    "## 5. 验证通过后再应用",
    "## 6. 持久化、合并和手机导出",
    "## 工具与结论要求",
  ]) assert.ok(skill.includes(heading), `missing ${heading}`);
});

test("protects credentials and the current management path", () => {
  assert.ok(skill.includes("不进日志、技能、仓库或外部报告"));
  assert.ok(skill.includes("保护当前会话和远程管理连接"));
  assert.ok(skill.includes("先独立验证，再应用"));
  assert.ok(skill.includes("192.0.2.20/32,DIRECT,no-resolve"));
  assert.ok(skill.includes("REPLACE_LOCALLY"));
});

test("covers relay, DNS, protocol, validation, and mobile export traps", () => {
  for (const marker of [
    "dialer-proxy: STABLE_RELAY_NODE",
    "direct-nameserver",
    "proxy-server-nameserver",
    "tun.enable: false",
    "SOCKS 的 TCP 登录成功不代表 UDP 能用",
    "手机要导出增强处理后的完整 YAML",
    "不直接修改会被订阅刷新覆盖的原始下载文件",
  ]) assert.ok(skill.includes(marker), `missing ${marker}`);
});

test("contains no project-specific credentials or private network values", () => {
  assert.doesNotMatch(skill, /wx[0-9a-f]{16}/i);
  assert.doesNotMatch(skill, /\b192\.168\.\d{1,3}\.\d{1,3}\b/);
  assert.doesNotMatch(skill, /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  assert.doesNotMatch(skill, /https?:\/\/[^\s`)'\"]+\.(?:cn|com)\b/i);
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
