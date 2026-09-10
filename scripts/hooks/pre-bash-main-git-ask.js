#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { parseBoolean } = require('../lib/hook-flags');
const { gitSubcommands } = require('../lib/shell-invocations');

const MAX_STDIN = 1024 * 1024;

const COMMIT_REASON = '当前在 main 分支。提交需要你点一次授权，避免未经审查就写入历史。';
const BRANCH_REASON = '在主工作区新建分支或 worktree 需要你点一次授权。小改动可以直接在 main 做完。';

function parseInput(rawInput) {
  if (rawInput && typeof rawInput === 'object') return rawInput;
  try {
    return JSON.parse(String(rawInput || '{}'));
  } catch {
    return {};
  }
}

function extractCommand(data) {
  return String(data?.tool_input?.command || '');
}

function extractCwd(data) {
  const cwd = data?.cwd || data?.tool_input?.cwd;
  return cwd ? String(cwd) : process.cwd();
}

const BRANCH_NON_CREATE_FLAGS = new Set([
  '-d', '-D', '--delete',
  '-m', '-M', '--move',
  '-c', '-C', '--copy',
  '-l', '--list',
  '--show-current',
  '--edit-description',
  '--unset-upstream',
  '-u', '--set-upstream-to',
]);

// `git branch` flags that take the next token as their value; that value is
// not a new branch name.
const BRANCH_FLAGS_WITH_VALUE = new Set([
  '--contains', '--no-contains',
  '--merged', '--no-merged',
  '--sort', '--format', '--points-at',
]);

function commitsOnAny(subcommands) {
  return subcommands.some(sub => sub.name === 'commit');
}

function isGitCommit(command) {
  return commitsOnAny(gitSubcommands(command));
}

function createsBranchRef(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') continue;
    if (arg.startsWith('-')) {
      if (BRANCH_NON_CREATE_FLAGS.has(arg) || arg.startsWith('--set-upstream-to=')) return false;
      if (BRANCH_FLAGS_WITH_VALUE.has(arg)) i++;
      continue;
    }
    return true;
  }
  return false;
}

function hasShortFlag(args, letter) {
  const pattern = new RegExp(`^-[a-zA-Z]*${letter}$`);
  return args.some(arg => !arg.startsWith('--') && pattern.test(arg));
}

function firstPositional(args) {
  return args.find(arg => !arg.startsWith('-'));
}

function createsBranchOnAny(subcommands) {
  return subcommands.some(sub => {
    if (sub.name === 'checkout') return hasShortFlag(sub.args, '[bB]');
    if (sub.name === 'switch') return hasShortFlag(sub.args, '[cC]') || sub.args.includes('--create');
    if (sub.name === 'branch') return createsBranchRef(sub.args);
    if (sub.name === 'worktree') return firstPositional(sub.args) === 'add';
    return false;
  });
}

function isBranchCreate(command) {
  return createsBranchOnAny(gitSubcommands(command));
}

function git(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 3000,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) return '';
  return String(result.stdout || '').trim();
}

function currentBranch(cwd) {
  return git(cwd, ['symbolic-ref', '--short', 'HEAD']) || git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
}

function isPrimaryWorktree(cwd) {
  let common = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  let gitdir = git(cwd, ['rev-parse', '--path-format=absolute', '--git-dir']);
  if (!common || !gitdir) {
    common = git(cwd, ['rev-parse', '--git-common-dir']);
    gitdir = git(cwd, ['rev-parse', '--git-dir']);
    if (common) common = path.resolve(cwd, common);
    if (gitdir) gitdir = path.resolve(cwd, gitdir);
  }
  if (!common || !gitdir) return false;
  return path.resolve(common) === path.resolve(gitdir);
}

function ask(reason) {
  return {
    stdout: JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    }),
    exitCode: 0,
  };
}

function isMainGitAskEnabled(env = process.env) {
  const raw = env.ECC_MAIN_GIT_ASK !== undefined
    ? env.ECC_MAIN_GIT_ASK
    : env.CLAUDE_PLUGIN_OPTION_MAIN_GIT_ASK;
  if (raw === undefined) return true;
  return parseBoolean(raw, true);
}

function run(rawInput) {
  if (!isMainGitAskEnabled()) return { exitCode: 0 };
  const data = parseInput(rawInput);
  const command = extractCommand(data);
  const subcommands = gitSubcommands(command);
  if (subcommands.length === 0) return { exitCode: 0 };

  const cwd = extractCwd(data);
  if (commitsOnAny(subcommands) && currentBranch(cwd) === 'main') {
    return ask(COMMIT_REASON);
  }
  if (createsBranchOnAny(subcommands) && isPrimaryWorktree(cwd)) {
    return ask(BRANCH_REASON);
  }
  return { exitCode: 0 };
}

module.exports = {
  run,
  isGitCommit,
  isBranchCreate,
  isMainGitAskEnabled,
  COMMIT_REASON,
  BRANCH_REASON,
};

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
  });
  process.stdin.on('end', () => {
    const result = run(raw);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.stdout) process.stdout.write(result.stdout);
    process.exitCode = Number.isInteger(result.exitCode) ? result.exitCode : 0;
  });
}
