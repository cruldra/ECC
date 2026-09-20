#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const skillDir = path.join(root, "skills", "closing-custom-dev-deals");
const service = path.join(skillDir, "intake-service");

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

console.log("\n=== Testing closing-custom-dev-deals intake service ===\n");

test("the service ships everything uv sync and the form need", () => {
  for (const file of [
    "pyproject.toml",
    "uv.lock",
    "main.py",
    "config.py",
    "db.py",
    ".env.example",
    ".gitignore",
    "README.md",
    "Dockerfile",
    "models/intake.py",
    "routes/api.py",
    "routes/web.py",
    "templates/form.html",
    "templates/admin.html",
    "templates/detail.html",
    "static/js/components/intake-form.js",
  ]) {
    assert.ok(fs.existsSync(path.join(service, file)), `missing ${file}`);
  }
});

test("build and runtime junk never reaches the repository", () => {
  const ignored = read(service, ".gitignore");
  for (const entry of [".venv/", ".env", "__pycache__/", "storage/*.db", "logs/"]) {
    assert.ok(ignored.includes(entry), `.gitignore misses ${entry}`);
  }
  assert.equal(fs.existsSync(path.join(service, "storage", "intake.db")), false,
    "a populated database was left in the tree");
});

test("only the company name is required — blanks are information", () => {
  const model = read(service, "models", "intake.py");
  assert.match(model, /company: str = Field\(min_length=1/);
  for (const optional of ["city", "business", "industry", "headcount"]) {
    assert.match(model, new RegExp(`${optional}: str = ""`), `${optional} must be optional`);
  }
  assert.match(model, /drop_empty_entries/, "wholly blank cards must not be stored");
});

test("the form keeps the three steps the prototype settled on", () => {
  const component = read(service, "static", "js", "components", "intake-form.js");
  for (const title of ["企业信息", "关键岗位与流程", "期望 AI 赋能的场景"]) {
    assert.ok(component.includes(title), `the form dropped ${title}`);
  }
  assert.match(component, /emptyRole\(\), emptyRole\(\)/, "two role slots are preset");
  assert.match(component, /emptyScene\(\), emptyScene\(\)/, "two scene slots are preset");
  assert.ok(component.includes("添加岗位") && component.includes("添加场景"), "the client must be able to add more");
  assert.match(component, /createRenderRoot/, "Tailwind cannot reach a shadow root; render into light DOM");
  assert.match(component, /localStorage/, "the start screen promises the draft is kept");
});

test("no input carries a prescriptive placeholder, and the copy stays commercial", () => {
  const component = read(service, "static", "js", "components", "intake-form.js");
  assert.equal(/placeholder=/.test(component), false, "placeholders read like fishing for details");
  for (const banned of ["原型", "demo", "你们卖什么", "最烦的"]) {
    assert.equal(component.includes(banned), false, `client-facing copy mentions ${banned}`);
  }
  assert.ok(component.includes("我们想更好地理解您的业务"));
});

test("the admin surface is closed by default and never carries a password in the repo", () => {
  const auth = read(service, "auth.py");
  assert.match(auth, /compare_digest/, "compare the secret in constant time");
  assert.match(auth, /HTTP_503_SERVICE_UNAVAILABLE/, "no password means the admin closes, not opens");
  assert.match(read(service, "config.py"), /admin_password: str = ""/, "the default password must be empty");

  // The repository is public: every tracked file must leave ADMIN_PASSWORD blank.
  for (const file of ["config.py", ".env.example", "README.md", "Dockerfile", "docker-compose.yml"]) {
    const body = read(service, file);
    for (const line of body.split("\n")) {
      if (!line.includes("ADMIN_PASSWORD")) continue;
      assert.equal(/ADMIN_PASSWORD\s*[=:]\s*\S/.test(line), false, `${file} ships a password: ${line.trim()}`);
    }
  }
  assert.equal(fs.existsSync(path.join(service, ".env")) && read(service, ".gitignore").includes(".env"), true,
    ".env holds the real secret and has to stay ignored");

  const api = read(service, "routes", "api.py");
  assert.match(api, /list_submissions[\s\S]{0,160}require_admin/, "reading submissions needs the admin");
  assert.match(api, /read_submission[\s\S]{0,160}require_admin/, "reading one submission needs the admin");
  assert.equal(/create_submission[\s\S]{0,160}require_admin/.test(api), false,
    "clients must be able to submit without credentials");
});

test("SKILL.md sends the operator to the service, not a document", () => {
  const body = read(skillDir, "SKILL.md");
  assert.match(body, /intake-service/);
  assert.match(body, /dify-deploy\.sh/);
  assert.match(body, /HTTP Basic/, "the operator has to be told the admin needs credentials");
  assert.match(body, /不进仓库/, "and that the password never lands in this public repository");
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
