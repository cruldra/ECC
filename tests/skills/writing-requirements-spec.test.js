#!/usr/bin/env node
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const skillDir = path.join(path.resolve(__dirname, "..", ".."), "skills", "writing-requirements-spec");
const skillFile = path.join(skillDir, "SKILL.md");
const scripts = path.join(skillDir, "scripts");
const body = fs.readFileSync(skillFile, "utf8");
const translation = fs.readFileSync(path.join(skillDir, "i18n", "zh-CN.md"), "utf8");
const outline = fs.readFileSync(path.join(skillDir, "references", "srs-outline.md"), "utf8");

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

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "writing-requirements-spec-"));
}

function run(script, args, options = {}) {
  return spawnSync("python3", ["-I", path.join(scripts, script), ...args], { encoding: "utf8", ...options });
}

// Calls one function of a bundled script with a JSON argument and returns its JSON result.
function call(script, fn, arg) {
  const code = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("m", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
print(json.dumps(getattr(module, sys.argv[2])(json.loads(sys.argv[3])), ensure_ascii=False))
`;
  const result = spawnSync("python3", ["-I", "-c", code, path.join(scripts, script), fn, JSON.stringify(arg)], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const INTERNAL = [
  "# 需求",
  "",
  "背景见会议 [00][03]。",
  "",
  "| 编号 | 需求 | 优先级 | 状态 | 来源 |",
  "|---|---|---|---|---|",
  "| FR-01 | 系统应支持上传 PDF | 必须 | 已确认 | [04][12] |",
  "| FR-02 | 系统应导出 Word | 应该 | 推断 | — |",
  "",
  "| 数据对象 | 说明 |",
  "|---|---|",
  "| 订单 | 记录数据来源和审核状态 |",
  "",
].join("\n");

console.log("\n=== Testing writing-requirements-spec ===\n");

test("frontmatter names the skill and keeps the description within 1024 characters", () => {
  const match = body.match(/^---\nname: writing-requirements-spec\ndescription: '([^'\n]+)'\n---\n/);
  assert.ok(match, "frontmatter shape");
  assert.ok(match[1].length <= 1024, `description is ${match[1].length} characters`);
});

test("keeps the sections in order", () => {
  const headings = body.split("\n").filter((line) => line.startsWith("## "));
  assert.deepStrictEqual(headings, ["## When to Use", "## How It Works", "## Examples"]);
});

test("every bundled script is stdlib-only, exists, and runs through uv from the skill directory", () => {
  for (const name of ["condense_srt.py", "strip_annotations.py", "md2docx.py"]) {
    const source = fs.readFileSync(path.join(scripts, name), "utf8");
    assert.ok(source.startsWith('# /// script\n# requires-python = ">=3.10"\n# dependencies = []\n# ///\n'), `${name} PEP 723 header`);
  }
  for (const name of ["condense_srt.py", "strip_annotations.py", "md2docx.py"]) {
    assert.ok(body.includes(`uv run --script \${CLAUDE_SKILL_DIR}/scripts/${name}`), `${name} invocation`);
  }
  assert.ok(body.includes("`references/srs-outline.md`"));
});

test("the outline carries the requirement columns and the three appendices", () => {
  assert.ok(outline.includes("| 编号 | 需求 | 优先级 | 状态 | 来源 |"));
  for (const heading of ["## 附录 A 待确认问题", "## 附录 B 沟通共识", "## 附录 C 甲方需提供的资料", "### 3.6 模型与数据需求"]) {
    assert.ok(outline.includes(heading), heading);
  }
});

test("condense_srt joins each minute's cues on one line, across hours, BOM, CRLF and multi-line cues", () => {
  const srt = "\ufeff1\r\n00:00:00,200 --> 00:00:04,200\r\n第一句\r\n\r\n2\r\n00:00:59,000 --> 00:01:01,000\r\n第二句\r\n续行\r\n\r\n"
    + "3\r\n00:01:30,000 --> 00:01:31,000\r\n第三句\r\n\r\n4\r\n01:02:00,000 --> 01:02:01,000\r\n第四句\r\n";
  assert.strictEqual(call("condense_srt.py", "condense", srt), "[00] 第一句 / 第二句 / 续行\n[01] 第三句\n[62] 第四句\n");
});

test("strip_annotations drops the status and source columns and minute markers, leaving other tables alone", () => {
  const result = call("strip_annotations.py", "strip", INTERNAL);
  assert.ok(result.includes("背景见会议。"), "markers removed from prose");
  assert.ok(result.includes("| 编号 | 需求 | 优先级 |"));
  assert.ok(result.includes("| FR-01 | 系统应支持上传 PDF | 必须 |"));
  assert.ok(!/已确认|推断|\[\d\d\]/.test(result), "no status or minute left");
  assert.ok(result.includes("| 订单 | 记录数据来源和审核状态 |"), "business table kept whole");
});

test("strip_annotations refuses to overwrite and reports leftover internal words", () => {
  const dir = tempDir();
  const source = path.join(dir, "v0.1.md");
  const target = path.join(dir, "v1.0.md");
  fs.writeFileSync(source, INTERNAL);
  const first = run("strip_annotations.py", [source, target]);
  assert.strictEqual(first.status, 0, first.stderr);
  assert.ok(first.stderr.includes("背景见会议。"), "flags the 会议 line");
  fs.writeFileSync(target, "kept");
  const second = run("strip_annotations.py", [source, target]);
  assert.notStrictEqual(second.status, 0);
  assert.strictEqual(fs.readFileSync(target, "utf8"), "kept");
});

test("--check exits 1 while internal words remain and 0 once they are gone", () => {
  const dir = tempDir();
  const file = path.join(dir, "v1.0.md");
  fs.writeFileSync(file, "| 版本 | V1.0 草稿 |\n");
  assert.strictEqual(run("strip_annotations.py", ["--check", file]).status, 1);
  fs.writeFileSync(file, "| 版本 | V1.0 |\n");
  assert.strictEqual(run("strip_annotations.py", ["--check", file]).status, 0);
});

test("md2docx sizes columns by header and average content, between 4 and 40", () => {
  const markdown = "| 编号 | 需求 |\n|---|---|\n| FR-01 | " + "长".repeat(50) + " |\n| FR-02 | 短 |\n";
  const separator = call("md2docx.py", "set_column_widths", markdown).split("\n")[1];
  assert.strictEqual(separator, `|${"-".repeat(5)}|${"-".repeat(40)}|`);
});

const pandoc = spawnSync("pandoc", ["--version"], { encoding: "utf8" });
if (pandoc.status === 0) {
  test("md2docx writes a Word file whose every table is full width with borders and a tinted header", () => {
    const dir = tempDir();
    const source = path.join(dir, "spec.md");
    fs.writeFileSync(source, "# 标题\n\n| 项目 | 内容 |\n|---|---|\n| 版本 | V1.0 |\n\n" + call("strip_annotations.py", "strip", INTERNAL));
    const result = run("md2docx.py", [source]);
    assert.strictEqual(result.status, 0, result.stderr);
    const unzip = (member) => spawnSync("unzip", ["-p", path.join(dir, "spec.docx"), member], { encoding: "utf8" }).stdout;
    const tables = unzip("word/document.xml").match(/<w:tblPr>.*?<\/w:tblPr>/g) || [];
    assert.strictEqual(tables.length, 3);
    for (const table of tables) {
      assert.ok(table.includes("<w:tblBorders>"), "borders");
      assert.ok(table.includes('<w:tblW w:type="pct" w:w="5000" />'), "full width");
    }
    assert.ok(unzip("word/styles.xml").includes('w:fill="E7EEF7"'), "header fill");
  });
} else {
  console.log("  - skipped the Word export test: pandoc is not installed");
}

test("the zh-CN translation tracks the current SKILL.md", () => {
  const digest = crypto.createHash("sha256").update(fs.readFileSync(skillFile)).digest("hex");
  assert.match(translation, /^---\nname: writing-requirements-spec\ndescription: '[^'\n]+'\nlocale: zh-CN\n/);
  assert.ok(translation.includes(`source_hash: ${digest}`), "re-sync i18n/zh-CN.md after editing SKILL.md");
  const headings = (text) => text.split("\n").filter((line) => /^#{2,3} /.test(line)).length;
  assert.strictEqual(headings(translation), headings(body));
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
