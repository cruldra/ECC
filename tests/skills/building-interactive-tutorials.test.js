#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const skillDir = path.join(path.resolve(__dirname, "..", ".."), "skills", "building-interactive-tutorials");
const skillFile = path.join(skillDir, "SKILL.md");
const body = fs.readFileSync(skillFile, "utf8");
const translation = fs.readFileSync(path.join(skillDir, "i18n", "zh-CN.md"), "utf8");
const vizDir = path.join(skillDir, "assets", "viz");
const exampleDir = path.join(vizDir, "src", "topics", "example");
const notebookHtml = fs.readFileSync(path.join(exampleDir, "notebook.html"), "utf8");
const notebookCss = fs.readFileSync(path.join(vizDir, "src", "notebook", "notebook.css"), "utf8");
const checkLinks = path.join(skillDir, "scripts", "check_links.py");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message}`);
    failed++;
  }
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [path.relative(vizDir, full)];
  });
}

/** 从 SKILL.md 的目录树代码块里取出文件名（带扩展名的那些）。 */
function treeFiles(text) {
  const tree = text.match(/```\nviz\/\n([\s\S]*?)```/);
  assert.ok(tree, "SKILL.md must draw the viz/ tree");
  return [...tree[1].matchAll(/[─ ]([\w-]+\.(?:mjs|md|css|js|html))\s/g)].map((m) => m[1]).sort();
}

async function loadScenes() {
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tutorial-steps-")), "steps.mjs");
  fs.copyFileSync(path.join(exampleDir, "steps.js"), copy);
  const { buildExampleScenes } = await import(pathToFileURL(copy).href);
  return buildExampleScenes();
}

async function main() {
  console.log("\n=== Testing building-interactive-tutorials skill ===\n");

  await test("frontmatter names the skill with a quoted one-line description under 1024 characters", () => {
    const match = body.match(/^---\nname: building-interactive-tutorials\ndescription: '([^'\n]+)'\n---\n/);
    assert.ok(match, "frontmatter must hold name and a single-quoted description");
    assert.ok(match[1].length <= 1024, `description is ${match[1].length} characters`);
    assert.ok(match[1].includes("assets/viz") && match[1].includes("scripts/check_links.py"));
  });

  await test("keeps the sections and the eight steps in order", () => {
    const sections = body.split("\n").filter((line) => line.startsWith("## "));
    assert.deepStrictEqual(sections, [
      "## When to Use",
      "## How It Works",
      "## Examples",
      "## Common Mistakes",
      "## Before You Finish",
      "## Source",
    ]);
    const steps = body.split("\n").filter((line) => /^### \d\./.test(line));
    assert.deepStrictEqual(steps, [
      "### 1. Set Up viz/ Once",
      "### 2. Study the Code and Run It",
      "### 3. Outline the Page",
      "### 4. Write the Cells",
      "### 5. Link Every Term to an Official Page",
      "### 6. Compute the Demo From Real Results",
      "### 7. Build and Click Through Every Step",
      "### 8. Update the Index",
    ]);
  });

  await test("every path under the skill directory that SKILL.md names exists", () => {
    const named = [...body.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w./-]+)/g)].map((m) => m[1]);
    assert.ok(named.length >= 2);
    for (const rel of named) assert.ok(fs.existsSync(path.join(skillDir, rel)), `missing ${rel}`);
  });

  await test("the viz/ tree in SKILL.md and in the scaffold README lists exactly the scaffold files", () => {
    const files = listFiles(vizDir).map((f) => path.basename(f)).sort();
    assert.deepStrictEqual(treeFiles(body), files);
    const readme = fs.readFileSync(path.join(vizDir, "README.md"), "utf8");
    const readmeTree = readme.match(/```\nviz\/\n([\s\S]*?)```/)[1];
    for (const file of files.filter((f) => f !== "README.md")) {
      assert.ok(readmeTree.includes(file), `scaffold README tree is missing ${file}`);
    }
  });

  await test("the example page keeps the build placeholders and links only to ids it has", () => {
    assert.ok(notebookHtml.includes("<style>{{STYLE}}</style>"));
    assert.ok(notebookHtml.includes("<script>{{SCRIPT}}</script>"));
    const ids = new Set([...notebookHtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const [, id] of notebookHtml.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(id), `no id ${id}`);
  });

  await test("notebook.css styles every diagram and card class SKILL.md tells you to use", () => {
    for (const cls of ["box", "end", "edge", "name", "role", "mono", "lane"]) {
      assert.ok(notebookCss.includes(`.diagram .${cls}`), `.diagram .${cls} is not styled`);
    }
    for (const cls of ["used", "optional"]) assert.ok(notebookCss.includes(`.diagram .box.${cls}`));
    assert.ok(notebookCss.includes(".cards") && notebookCss.includes(".card li.pick"));
  });

  await test("the example demo is registered under its data-scene and its steps follow the tile contract", async () => {
    const scenes = await loadScenes();
    const sceneIds = [...notebookHtml.matchAll(/data-scene="([^"]+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(scenes.map((s) => s.id), sceneIds);
    const tags = new Set(["base", "focus", "new", "done", "muted", "unk", "removed"]);
    for (const scene of scenes) {
      let before = new Set();
      for (const step of scene.steps) {
        for (const field of ["phase", "title", "text"]) assert.ok(step[field], `a step has no ${field}`);
        const tiles = step.rows.flatMap((row) => row.tiles);
        const ids = tiles.map((t) => t.id);
        assert.strictEqual(new Set(ids).size, ids.length, `duplicate tile id in ${step.title}`);
        for (const tile of tiles) {
          assert.ok(tags.has(tile.tag), `unknown tag ${tile.tag}`);
          for (const source of tile.from ?? []) assert.ok(before.has(source), `${tile.id} grows from missing ${source}`);
        }
        before = new Set(ids);
      }
    }
  });

  await test("check_links.py --offline flags a missing #id and a missing file, and ignores script text", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tutorial-links-"));
    fs.writeFileSync(path.join(dir, "real.py"), "");
    fs.writeFileSync(
      path.join(dir, "page.html"),
      [
        '<h2 id="here">x</h2><a href="#here">ok</a><a href="#nowhere">bad</a>',
        '<a href="real.py">ok</a><a href="gone.py">bad</a><a href="vscode://file/x">skip</a>',
        "<script>const a = '<a href=\"#fake\">';</script>",
      ].join("\n"),
    );
    const run = spawnSync("python3", [checkLinks, "--offline", path.join(dir, "page.html")], { encoding: "utf8" });
    assert.strictEqual(run.status, 1, run.stderr);
    assert.deepStrictEqual(run.stdout.trim().split("\n"), ["FAIL 页内没有 id #nowhere", "FAIL 文件不存在 gone.py"]);
  });

  await test("the zh-CN translation tracks the current SKILL.md", () => {
    const digest = crypto.createHash("sha256").update(fs.readFileSync(skillFile)).digest("hex");
    assert.match(translation, /^---\nname: building-interactive-tutorials\ndescription: '[^'\n]+'\nlocale: zh-CN\n/);
    assert.ok(translation.includes(`source_hash: ${digest}`), "re-sync i18n/zh-CN.md after editing SKILL.md");
    const count = (text) => text.split("\n").filter((line) => /^#{2,3} /.test(line)).length;
    assert.strictEqual(count(translation), count(body));
  });

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
