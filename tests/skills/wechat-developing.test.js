#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const skillDir = path.join(root, "skills", "wechat-developing");

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

const read = (...parts) => fs.readFileSync(path.join(skillDir, ...parts), "utf8");
const skill = read("SKILL.md");
const referenceFiles = fs.readdirSync(path.join(skillDir, "references")).filter((f) => f.endsWith(".md"));
const h5 = read("references", "official-account-h5.md");
const hosting = read("references", "mainland-hosting.md");

console.log("\n=== Testing wechat-developing skill ===\n");

test("frontmatter names the skill and quotes the description", () => {
  assert.match(skill, /^---\nname: wechat-developing\ndescription: "[^"]+"\n---\n/);
});

test("keeps the required sections", () => {
  for (const heading of ["## When to Use", "## How It Works", "## Examples"]) {
    assert.ok(skill.includes(heading), `missing ${heading}`);
  }
});

test("topic map lists every reference file and nothing else", () => {
  const mapped = [...skill.matchAll(/`references\/([\w-]+\.md)`/g)].map((m) => m[1]);
  assert.deepStrictEqual([...new Set(mapped)].sort(), referenceFiles.sort());
});

test("H5 notes document the signature string and the hash-free URL", () => {
  assert.ok(h5.includes("jsapi_ticket=<ticket>&noncestr=<nonce>&timestamp=<ts>&url=<url>"));
  assert.ok(h5.includes("location.href.split('#')[0]"));
});

test("H5 notes cover the whitelist failure and where to fix it", () => {
  assert.ok(h5.includes("40164"));
  assert.ok(h5.includes("微信开发者平台"));
  assert.ok(h5.includes("管理员扫码授权设置 API IP 白名单"));
});

test("requires a real-phone check before claiming behavior", () => {
  assert.ok(skill.includes("Verify on a real phone before claiming"));
  assert.ok(h5.includes("On a real phone"));
});

test("hosting notes reproduce the ICP interception with both key-share groups", () => {
  assert.ok(hosting.includes("-groups \"$g\""));
  assert.ok(hosting.includes("X25519MLKEM768"));
});

test("leaks no project-specific AppID, IP, or domain", () => {
  for (const [name, body] of [["SKILL.md", skill], ...referenceFiles.map((f) => [f, read("references", f)])]) {
    assert.doesNotMatch(body, /wx[0-9a-f]{16}/, `${name} has an AppID`);
    assert.doesNotMatch(body, /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, `${name} has an IP`);
    assert.doesNotMatch(body, /luxiaofei|luhuoai|ziwuxian/, `${name} has a project domain`);
  }
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
