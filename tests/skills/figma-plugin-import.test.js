#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");
const script = path.join(root, "skills", "figma-plugin-prototyping", "scripts", "import-into-figma.js");
const {
  asExtensionEntries,
  nextExtensionId,
  findManifestEntry,
  buildManifestEntry,
  appendManifestEntry,
  pluginNameFrom,
} = require(script);

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

console.log("\n=== Testing figma-plugin-prototyping import ===\n");

test("only well-formed entries are read out of the array", () => {
  const entries = asExtensionEntries([
    { id: 1, manifestPath: "/a/manifest.json" },
    { id: "2", manifestPath: "/b/manifest.json" },
    { manifestPath: "/c/manifest.json" },
    null,
    "junk",
    { id: 4, manifestPath: "/d/manifest.json" },
  ]);
  assert.deepStrictEqual(entries.map((entry) => entry.id), [1, 4]);
  assert.deepStrictEqual(asExtensionEntries(undefined), []);
});

test("the next id clears ids reserved for code entries Figma has not written yet", () => {
  const entries = [
    { id: 1, manifestPath: "/a/manifest.json", fileMetadata: { type: "manifest", codeFileId: 2 } },
    { id: 2, manifestPath: "/a/code.js", fileMetadata: { type: "code", manifestFileId: 1 } },
    { id: 9, manifestPath: "/b/manifest.json", fileMetadata: { type: "manifest", codeFileId: 10 } },
  ];
  assert.strictEqual(nextExtensionId(entries), 11);
});

test("an empty list starts at 1", () => {
  assert.strictEqual(nextExtensionId([]), 1);
});

test("a manifest entry reserves the following id for its code file", () => {
  const entry = buildManifestEntry({ id: 7, manifestPath: "/x/manifest.json", name: "Design Lab" });
  assert.strictEqual(entry.fileMetadata.codeFileId, 8);
  assert.strictEqual(entry.lastKnownName, "Design Lab");
  assert.strictEqual(entry.lastKnownPluginId, "");
  assert.strictEqual(entry.fileMetadata.type, "manifest");
});

test("appending a new manifest adds one entry and reports it", () => {
  const before = [{ id: 1, manifestPath: "/a/manifest.json", fileMetadata: { codeFileId: 2 } }];
  const result = appendManifestEntry(before, { manifestPath: "/b/manifest.json", name: "B" });
  assert.strictEqual(result.added, true);
  assert.strictEqual(result.entries.length, 2);
  assert.strictEqual(result.entries[1].id, 3);
  assert.strictEqual(result.name, "B");
});

test("a manifest already in the list is not added twice and keeps its recorded name", () => {
  const before = [{ id: 1, manifestPath: "/a/manifest.json", lastKnownName: "Old Name" }];
  const result = appendManifestEntry(before, { manifestPath: "/a/manifest.json", name: "New Name" });
  assert.strictEqual(result.added, false);
  assert.strictEqual(result.entries.length, 1);
  assert.strictEqual(result.name, "Old Name");
  assert.strictEqual(findManifestEntry(result.entries, "/a/manifest.json").id, 1);
});

test("the plugin name comes from the manifest, falling back to its directory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "figma-import-"));
  const named = path.join(dir, "manifest.json");
  fs.writeFileSync(named, JSON.stringify({ name: "  Quota Lab  ", main: "code.js" }));
  assert.strictEqual(pluginNameFrom(named), "Quota Lab");

  const anon = path.join(dir, "figma-plugin");
  fs.mkdirSync(anon);
  const anonManifest = path.join(anon, "manifest.json");
  fs.writeFileSync(anonManifest, JSON.stringify({ main: "code.js" }));
  assert.strictEqual(pluginNameFrom(anonManifest), "figma-plugin");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a missing manifest path fails instead of touching Figma settings", () => {
  try {
    execFileSync("node", [script, "/definitely/not/here/manifest.json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.fail("should have exited non-zero");
  } catch (error) {
    assert.strictEqual(error.status, 1);
    assert.match(error.stderr, /manifest 不存在/);
  }
});

test("no argument prints usage", () => {
  try {
    execFileSync("node", [script], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.fail("should have exited non-zero");
  } catch (error) {
    assert.strictEqual(error.status, 1);
    assert.match(error.stderr, /用法: import-into-figma\.js/);
  }
});

test("SKILL.md asks before opening Figma and explains the quit", () => {
  const body = fs.readFileSync(
    path.join(root, "skills", "figma-plugin-prototyping", "SKILL.md"),
    "utf8"
  );
  assert.match(body, /Ask before opening Figma/);
  assert.match(body, /import-into-figma\.js/);
  assert.match(body, /never kills/);
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
