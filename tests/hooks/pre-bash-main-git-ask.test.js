'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const hook = require('../../scripts/hooks/pre-bash-main-git-ask');
const dispatcher = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'pre-bash-dispatcher.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }
}

function initRepo(branch) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'main-git-ask-'));
  const init = spawnSync('git', ['init', '-b', branch], { cwd: dir, encoding: 'utf8' });
  if (init.status !== 0) {
    spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
    spawnSync('git', ['checkout', '-b', branch], { cwd: dir, encoding: 'utf8' });
  }
  spawnSync('git', ['config', 'user.email', 't@t.t'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 't'], { cwd: dir });
  return dir;
}

function decision(result) {
  if (!result.stdout) return '';
  return JSON.parse(result.stdout).hookSpecificOutput.permissionDecision;
}

function runDispatcher(input, env = {}) {
  return spawnSync(process.execPath, [dispatcher], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ECC_HOOK_PROFILE: 'standard', ...env },
    timeout: 10000,
  });
}

console.log('\n=== pre-bash-main-git-ask ===\n');

test('detects git commit', () => {
  assert.strictEqual(hook.isGitCommit('git commit -m "x"'), true);
  assert.strictEqual(hook.isGitCommit('cd foo && git commit'), true);
  assert.strictEqual(hook.isGitCommit('git status'), false);
});

test('ignores git words inside quoted arguments', () => {
  assert.strictEqual(hook.isGitCommit('grep -rn "git add|git commit" vendor/'), false);
  assert.strictEqual(hook.isGitCommit('echo "run git commit later"'), false);
  assert.strictEqual(hook.isGitCommit('rg "git commit" --files-with-matches'), false);
  assert.strictEqual(hook.isBranchCreate('grep -rn "git checkout -b" docs/'), false);
});

test('still detects commits behind wrappers and substitutions', () => {
  assert.strictEqual(hook.isGitCommit('sudo git commit -m x'), true);
  assert.strictEqual(hook.isGitCommit('bash -c "git commit -m x"'), true);
  assert.strictEqual(hook.isGitCommit('git -c user.name=x commit -m y'), true);
  assert.strictEqual(hook.isGitCommit('git push origin commit'), false);
});

test('detects branch create', () => {
  assert.strictEqual(hook.isBranchCreate('git checkout -b feat'), true);
  assert.strictEqual(hook.isBranchCreate('git switch -c feat'), true);
  assert.strictEqual(hook.isBranchCreate('git branch feat'), true);
  assert.strictEqual(hook.isBranchCreate('git worktree add ../wt feat'), true);
  assert.strictEqual(hook.isBranchCreate('git checkout main'), false);
  assert.strictEqual(hook.isBranchCreate('git branch -d feat'), false);
  assert.strictEqual(hook.isBranchCreate('git branch -m old new'), false);
  assert.strictEqual(hook.isBranchCreate('git branch --merged main'), false);
  assert.strictEqual(hook.isBranchCreate('git branch'), false);
  assert.strictEqual(hook.isBranchCreate('git worktree list'), false);
});

test('asks before commit on main', () => {
  const cwd = initRepo('main');
  const result = hook.run({ tool_input: { command: 'git commit -m "x"' }, cwd });
  assert.strictEqual(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'ask');
  assert.ok(result.stdout.includes(hook.COMMIT_REASON));
});

test('allows commit on other branches', () => {
  const cwd = initRepo('feat');
  const result = hook.run({ tool_input: { command: 'git commit -m "x"' }, cwd });
  assert.ok(!result.stdout);
  assert.strictEqual(result.exitCode, 0);
});

test('asks before creating a branch in the primary worktree', () => {
  const cwd = initRepo('main');
  const result = hook.run({ tool_input: { command: 'git checkout -b feat' }, cwd });
  assert.strictEqual(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'ask');
  assert.ok(result.stdout.includes(hook.BRANCH_REASON));
});

test('allows branch create inside a linked worktree', () => {
  const root = initRepo('main');
  fs.writeFileSync(path.join(root, 'README'), 'x');
  spawnSync('git', ['add', 'README'], { cwd: root });
  spawnSync('git', ['commit', '-m', 'init'], { cwd: root });
  const wt = path.join(os.tmpdir(), `main-git-ask-wt-${process.pid}`);
  spawnSync('git', ['worktree', 'add', '-b', 'feat', wt], { cwd: root, encoding: 'utf8' });
  const result = hook.run({ tool_input: { command: 'git checkout -b other' }, cwd: wt });
  assert.ok(!result.stdout, `linked worktree should pass, got: ${result.stdout}`);
});

test('read-only search on main is not treated as a commit', () => {
  const cwd = initRepo('main');
  const result = hook.run({
    tool_input: { command: 'grep -rn "ensure_rewind_git|REWIND_GIT_AUTHOR|git add|git commit" vendor/' },
    cwd,
  });
  assert.ok(!result.stdout, `read-only grep should pass, got: ${result.stdout}`);
});

test('dispatcher surfaces ask for main commit', () => {
  const cwd = initRepo('main');
  const result = runDispatcher({ tool_input: { command: 'git commit -m "x"' }, cwd });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(decision(result), 'ask');
});

test('plugin configure option CLAUDE_PLUGIN_OPTION_MAIN_GIT_ASK=false skips ask', () => {
  const cwd = initRepo('main');
  const prev = process.env.CLAUDE_PLUGIN_OPTION_MAIN_GIT_ASK;
  delete process.env.ECC_MAIN_GIT_ASK;
  process.env.CLAUDE_PLUGIN_OPTION_MAIN_GIT_ASK = 'false';
  try {
    const result = hook.run({ tool_input: { command: 'git commit -m "x"' }, cwd });
    assert.ok(!result.stdout);
    assert.strictEqual(result.exitCode, 0);
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_PLUGIN_OPTION_MAIN_GIT_ASK;
    else process.env.CLAUDE_PLUGIN_OPTION_MAIN_GIT_ASK = prev;
  }
});

test('ECC_MAIN_GIT_ASK=off skips ask on main commit', () => {
  const cwd = initRepo('main');
  const prev = process.env.ECC_MAIN_GIT_ASK;
  process.env.ECC_MAIN_GIT_ASK = 'off';
  try {
    const result = hook.run({ tool_input: { command: 'git commit -m "x"' }, cwd });
    assert.ok(!result.stdout);
    assert.strictEqual(result.exitCode, 0);
  } finally {
    if (prev === undefined) delete process.env.ECC_MAIN_GIT_ASK;
    else process.env.ECC_MAIN_GIT_ASK = prev;
  }
});

test('dispatcher skip when hook disabled', () => {
  const cwd = initRepo('main');
  const result = runDispatcher(
    { tool_input: { command: 'git commit -m "x"' }, cwd },
    { ECC_DISABLED_HOOKS: 'pre:bash:main-git-ask' }
  );
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout, '');
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed ? 1 : 0);
