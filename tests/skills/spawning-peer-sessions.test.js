#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");
const skillDir = path.join(root, "skills", "spawning-peer-sessions");
const script = path.join(skillDir, "scripts", "spawn-session.sh");

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

function run(args, env) {
  try {
    const stdout = execFileSync("bash", [script, ...args], {
      encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      code: error.status,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
    };
  }
}

console.log("\n=== Testing spawning-peer-sessions ===\n");

test("skill and script are present and executable", () => {
  assert.ok(fs.existsSync(path.join(skillDir, "SKILL.md")), "SKILL.md missing");
  assert.ok(fs.existsSync(script), "spawn-session.sh missing");
  assert.ok(fs.statSync(script).mode & 0o111, "spawn-session.sh is not executable");
});

test("script parses under bash", () => {
  execFileSync("bash", ["-n", script], { stdio: "ignore" });
});

test("missing required arguments print usage", () => {
  const result = run(["--profile", "opus"]);
  assert.strictEqual(result.code, 2);
  assert.match(result.stderr, /用法: spawn-session\.sh/);
});

test("an unknown backend is rejected", () => {
  const result = run(["--profile", "opus", "--name", "x", "--prompt", "y", "--backend", "carrier-pigeon"]);
  assert.strictEqual(result.code, 1);
  assert.match(result.stderr, /--backend 只能是 tab 或 bg/);
});

test("a missing profile names the directory it searched", () => {
  const result = run(["--profile", "no-such-profile", "--name", "x", "--prompt", "y"], {
    ECC_PROFILES_DIR: path.join(root, "tests", "fixtures", "does-not-exist"),
  });
  assert.strictEqual(result.code, 1);
  assert.match(result.stderr, /找不到 profile/);
});

test("a prompt containing a single quote is refused before spawning", () => {
  const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "spawn-profiles-"));
  fs.writeFileSync(path.join(dir, "opus.json"), "{}\n");
  const result = run(["--profile", "opus", "--name", "x", "--prompt", "don't"], {
    ECC_PROFILES_DIR: dir,
  });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.strictEqual(result.code, 1);
  assert.match(result.stderr, /prompt 里不能有单引号/);
});

test("a cwd that does not exist is refused before spawning", () => {
  const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "spawn-profiles-"));
  fs.writeFileSync(path.join(dir, "opus.json"), "{}\n");
  const result = run(
    ["--profile", "opus", "--name", "x", "--prompt", "y", "--cwd", "/definitely/not/here"],
    { ECC_PROFILES_DIR: dir }
  );
  fs.rmSync(dir, { recursive: true, force: true });
  assert.strictEqual(result.code, 1);
  assert.match(result.stderr, /cwd 不存在或不是目录/);
});

test("the tab backend refuses to run outside a VS Code terminal", () => {
  const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "spawn-profiles-"));
  fs.writeFileSync(path.join(dir, "opus.json"), "{}\n");
  const result = run(["--profile", "opus", "--name", "x", "--prompt", "y"], {
    ECC_PROFILES_DIR: dir,
    TERM_PROGRAM: "Apple_Terminal",
  });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.strictEqual(result.code, 1);
  assert.match(result.stderr, /不在 VS Code 终端里/);
});

test("SKILL.md tells the agent to address the resolved name, not --name", () => {
  const body = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
  assert.match(body, /Use the printed name/);
  assert.match(body, /ListAgents/);
  assert.match(body, /notify_when_idle/);
  assert.match(body, /SendMessage/);
});

test("the skill is registered for install, packaging, and the agent manifest", () => {
  const modules = JSON.parse(fs.readFileSync(path.join(root, "manifests", "install-modules.json"), "utf8"));
  const paths = modules.modules.flatMap((module) => module.paths || []);
  assert.ok(paths.includes("skills/spawning-peer-sessions"), "not in install-modules.json");

  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(pkg.files.includes("skills/spawning-peer-sessions/"), "not in package.json files");

  const agentYaml = fs.readFileSync(path.join(root, "agent.yaml"), "utf8");
  assert.match(agentYaml, /^ {2}- spawning-peer-sessions$/m, "not in agent.yaml");
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
