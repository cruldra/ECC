#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const skillDir = path.join(path.resolve(__dirname, "..", ".."), "skills", "organizing-code");
const body = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
const pythonFile = path.join(skillDir, "references", "python.md");
const python = fs.readFileSync(pythonFile, "utf8");

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

console.log("\n=== Testing organizing-code skill ===\n");

test("frontmatter names the skill and quotes a one-line description", () => {
  assert.match(body, /^---\nname: organizing-code\ndescription: '[^'\n]+'\n---\n/);
  assert.match(body, /^description: '.*references\/<language>\.md; Python is in references\/python\.md\.'$/m);
});

test("keeps the sections in order", () => {
  const headings = body.split("\n").filter((line) => line.startsWith("## "));
  assert.deepStrictEqual(headings, [
    "## When to Use",
    "## Language Rules",
    "## How It Works",
    "## DDD Questions",
    "## Rolling Out: A Guard Test, Not a Big-Bang Refactor",
    "## Examples",
    "## Before You Finish",
  ]);
});

test("language rules live in references/<language>.md, starting with Python", () => {
  assert.ok(body.includes("[Python](references/python.md)"));
  assert.ok(body.includes("Each further language gets its own `references/<language>.md`."));
  assert.ok(fs.existsSync(pythonFile));
  assert.ok(python.includes("[SKILL.md](../SKILL.md)"));
});

test("the seven layout rules are all there", () => {
  for (const heading of [
    "### 1. Business, Then Layer, Then Use Case",
    "### 2. A File Name Says Its Layer or Its Business",
    "### 3. One Name per Concept",
    "### 4. Only Files That Are Used",
    "### 5. A File Becomes a Directory Past 800 Lines or at 3 Use-Case Groups",
    "### 6. A Subdomain With Its Own Tables and Interface Becomes a Subpackage",
    "### 7. Calls Run One Way",
  ]) {
    assert.ok(body.includes(heading), `missing ${heading}`);
  }
  assert.ok(body.includes("Names that say neither are banned: `utils`, `helpers`, `common`, `misc`, `service_helpers`."));
  assert.ok(body.includes("such as `core/`"));
  assert.ok(body.includes("never `service/service.py`"));
  assert.ok(body.includes("`routing_models.py` and `routing_repositories.py` become `routing/models.py` and `routing/repositories.py`"));
  assert.ok(body.includes("Interface (user routes, the admin console, scheduled tasks) → service → repositories → models."));
  assert.ok(body.includes("this skill decides where files go"), "wins over layer-first sample layouts in other skills");
});

test("answers the DDD questions", () => {
  assert.ok(body.includes("**File-name case is not DDD.**"));
  assert.ok(body.includes("A row that is one case is a `Case`, not a `CaseLibrary`"));
  assert.ok(body.includes("DDD's domain, application, and infrastructure are layers too"));
  assert.ok(body.includes("are the anemic model"));
  assert.ok(body.includes("\"only a READY case can be forked\", prefer a method on the entity"));
});

test("rolls out with a guard test whose allowlist only shrinks", () => {
  assert.ok(body.includes("Do not restructure a whole codebase in one go."));
  assert.ok(body.includes("an allowlist that only shrinks"));
  assert.ok(body.includes("An allowlisted entry that has been fixed fails it too"));
  assert.ok(body.includes("migrate one subsystem per ticket"));
});

test("examples use a generic business, not a real project", () => {
  assert.ok(body.includes("order/"));
  assert.doesNotMatch(body + python, /luffy|backend\/src\/app/i);
});

test("Python keeps service singular and every other layer plural", () => {
  assert.ok(python.includes("The service layer is singular, `service`; every other layer is plural."));
  for (const row of ["`models.py`", "`schemas.py`", "`repositories.py`", "`service.py`", "`routes.py`", "`tasks.py`", "`exceptions.py`", "`deps.py`", "`console/`"]) {
    assert.ok(python.includes(`| ${row} |`), `missing layer row ${row}`);
  }
  assert.ok(python.includes("as PEP 8 says"));
  assert.ok(python.includes("Do not re-export the old names from `__init__.py`"));
  assert.ok(python.includes("Alembic autogenerate may emit statements that drop the tables"));
  assert.ok(python.includes("`if TYPE_CHECKING:`"));
  assert.ok(python.includes("`tests/order/service/test_checkout.py`"));
});

const guardCode = (python.match(/## Guard Test\n[\s\S]*?```python\n([\s\S]*?)```/) || [])[1];

test("the Python reference carries a guard test to copy", () => {
  assert.ok(guardCode, "no python block under ## Guard Test");
  assert.ok(guardCode.includes("def test_no_new_layout_violations():"));
  assert.ok(guardCode.includes("def test_allowlist_only_shrinks():"));
  assert.ok(guardCode.includes("MAX_LINES = 800"));
});

// The files of a sample layout drawn as a tree, as paths below its root directory.
function treeFiles(text, heading) {
  const tree = text.split(`\n${heading}\n`)[1].match(/```\w*\n([\s\S]*?)```/)[1];
  const parts = [];
  const files = [];
  for (const line of tree.split("\n").filter(Boolean).slice(1)) {
    const start = line.search(/[\w.]/);
    const name = line.slice(start).split(/\s+#/)[0].trim();
    parts.length = start / 4 - 1;
    parts.push(name.replace(/\/$/, ""));
    if (!name.endsWith("/")) files.push(parts.join("/"));
  }
  return files;
}

const samples = [
  ["fastapi-patterns", "## Project Structure", "app"],
  ["python-patterns", "### Standard Project Layout", "src/mypackage"],
].map(([skill, heading, source]) => {
  const text = fs.readFileSync(path.join(skillDir, "..", skill, "SKILL.md"), "utf8");
  return { skill, source, text, files: treeFiles(text, heading) };
});

test("the sample layouts in fastapi-patterns and python-patterns go business first, and their code uses those paths", () => {
  for (const { skill, source, text, files } of samples) {
    assert.ok(files.includes(`${source}/user/models.py`), `${skill}: no user/ business directory`);
    const pkg = path.posix.basename(source);
    const named = [
      ...[...text.matchAll(new RegExp(`^from (${pkg}\\.[\\w.]+) import`, "gm"))].map((match) => match[1].replace(/\./g, "/")),
      ...[...text.matchAll(new RegExp(`^# (${pkg}/\\S+?)\\.py`, "gm"))].map((match) => match[1]),
    ];
    for (const module of named) {
      const file = path.posix.join(path.posix.dirname(source), module);
      assert.ok(files.some((entry) => entry === `${file}.py` || entry.startsWith(`${file}/`)), `${skill}: ${module} is not in the sample layout`);
    }
  }
});

const uv = spawnSync("uv", ["--version"], { encoding: "utf8" });
if (!guardCode || uv.status !== 0) {
  console.log("  - skipped running the guard test: needs uv");
} else {
  const writeIn = (dir, file, text = "") => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  const runGuard = (dir, { source = "app", allowed = [] } = {}) => {
    const sourcePath = source.split("/").map((part) => `"${part}"`).join(" / ");
    writeIn(dir, "tests/test_layout.py", guardCode
      .replace('/ "app"', `/ ${sourcePath}`)
      .replace("ALLOWED = [\n]", `ALLOWED = [\n${allowed.map((line) => `    ${JSON.stringify(line)},`).join("\n")}\n]`));
    return spawnSync("uv", ["run", "--quiet", "--no-project", "--with", "pytest", "pytest", "-q", "-p", "no:cacheprovider", "tests/test_layout.py"], { cwd: dir, encoding: "utf8" });
  };
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "organizing-code-"));
  const write = (file, text) => writeIn(work, file, text);
  const tree = {
    "app/__init__.py": "",
    "app/core/db.py": "",
    "app/core/utils.py": "",
    "app/order/models.py": "",
    "app/order/service/checkout.py": "",
    "app/order/service/service.py": "",
    "app/order/order_helpers.py": "",
    "app/order/routing_models.py": "",
    "app/order/README.md": "",
    "app/services/__init__.py": "",
    "app/catalog/errors.py": "",
    "app/catalog/repositories.py": "x = 1\n".repeat(801),
    "app/migrations/versions/001_add_models.py": "",
    "app/utils.py": "",
  };
  for (const [file, text] of Object.entries(tree)) write(file, text);
  const expected = [
    "named like its directory: order/service/service.py",
    "over 800 lines: catalog/repositories.py",
    "prefixed layer file, make it a subpackage: order/routing_models.py",
    "says neither layer nor business: order/order_helpers.py",
    "says neither layer nor business: utils.py",
    "use exceptions: catalog/errors.py",
    "use service: services",
  ];
  const guard = (allowed) => runGuard(work, { allowed });

  test("the guard test lists every violation and skips core/, migrations, and non-Python files", () => {
    const run = guard([]);
    assert.notStrictEqual(run.status, 0);
    assert.match(run.stdout, /1 failed, 1 passed/);
    const listed = [...run.stdout.matchAll(/^E\s+'([^']+)',$/gm)].map((match) => match[1]);
    assert.deepStrictEqual(listed, expected);
  });

  test("the guard test passes once the existing violations are allowlisted", () => {
    const run = guard(expected);
    assert.strictEqual(run.status, 0, run.stdout);
  });

  test("the guard test fails on a new violation and on an allowlisted one that is fixed", () => {
    fs.rmSync(path.join(work, "app/utils.py"));
    write("app/order/order_utils.py");
    const run = guard(expected);
    assert.match(run.stdout, /2 failed/);
    assert.match(run.stdout, /Move this code where organizing-code puts it:\nE\s+'says neither layer nor business: order\/order_utils\.py',/);
    assert.match(run.stdout, /Already fixed; delete these lines from ALLOWED:\nE\s+'says neither layer nor business: utils\.py',/);
  });

  test("the sample layouts in fastapi-patterns and python-patterns pass the guard test", () => {
    for (const { skill, source, files } of samples) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${skill}-`));
      for (const file of files) writeIn(dir, file);
      const run = runGuard(dir, { source });
      fs.rmSync(dir, { recursive: true, force: true });
      assert.strictEqual(run.status, 0, `${skill}:\n${run.stdout}`);
    }
  });

  fs.rmSync(work, { recursive: true, force: true });
}

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
