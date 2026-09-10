/**
 * Tests for scripts/lib/shell-invocations.js
 *
 * Run with: node tests/lib/shell-invocations.test.js
 */

const assert = require('assert');

const {
  tokenizeShellWords,
  parseInvocations,
  findInvocations,
  gitSubcommand,
  gitSubcommands,
  commandName,
} = require('../../scripts/lib/shell-invocations');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed++;
  }
}

function names(command) {
  return parseInvocations(command).map(invocation => invocation.name);
}

console.log('\n=== shell-invocations ===\n');

test('tokenizes quoted words into their unquoted values', () => {
  const values = tokenizeShellWords('grep -rn "git commit" vendor/').map(t => t.value);
  assert.deepStrictEqual(values, ['grep', '-rn', 'git commit', 'vendor/']);
});

test('tokenizes backslash escapes outside quotes', () => {
  const values = tokenizeShellWords('cat my\\ file.txt').map(t => t.value);
  assert.deepStrictEqual(values, ['cat', 'my file.txt']);
});

test('parses a single invocation', () => {
  assert.deepStrictEqual(parseInvocations('git status --short'), [
    { name: 'git', args: ['status', '--short'] },
  ]);
});

test('splits on operators', () => {
  assert.deepStrictEqual(names('cd foo && git commit -m x'), ['cd', 'git']);
  assert.deepStrictEqual(names('npm test; git push'), ['npm', 'git']);
  assert.deepStrictEqual(names('cat log | grep error'), ['cat', 'grep']);
  assert.deepStrictEqual(names('build || git reset'), ['build', 'git']);
});

test('quoted operators do not split segments', () => {
  const invocations = parseInvocations('grep -rn "git add|git commit" vendor/');
  assert.deepStrictEqual(invocations, [
    { name: 'grep', args: ['-rn', 'git add|git commit', 'vendor/'] },
  ]);
});

test('a quoted command name is an argument, not an invocation', () => {
  assert.deepStrictEqual(names('echo "run git commit later"'), ['echo']);
  assert.deepStrictEqual(names("rg 'git commit --no-verify' docs/"), ['rg']);
});

test('steps past environment assignments', () => {
  assert.deepStrictEqual(parseInvocations('FOO=bar BAZ=1 git commit'), [
    { name: 'git', args: ['commit'] },
  ]);
});

test('steps past wrapper commands', () => {
  assert.deepStrictEqual(names('sudo git commit'), ['git']);
  assert.deepStrictEqual(names('env -i git status'), ['git']);
  assert.deepStrictEqual(names('nohup time git push'), ['git']);
});

test('resolves program paths and .exe to a bare name', () => {
  assert.strictEqual(commandName('/usr/bin/git'), 'git');
  assert.strictEqual(commandName('C:\\Program Files\\Git\\git.exe'), 'git');
  assert.deepStrictEqual(names('/usr/local/bin/git commit'), ['git']);
});

test('parses command substitutions', () => {
  assert.deepStrictEqual(names('echo $(git rev-parse HEAD)'), ['echo', 'git']);
  assert.deepStrictEqual(names('echo "on $(git branch --show-current)"'), ['echo', 'git']);
  assert.deepStrictEqual(names('echo `git status`'), ['echo', 'git']);
});

test('single quotes suppress command substitution', () => {
  assert.deepStrictEqual(names("echo '$(git commit)'"), ['echo']);
});

test('parses sh -c payloads', () => {
  assert.deepStrictEqual(names('bash -c "git commit -m x"'), ['bash', 'git']);
  assert.deepStrictEqual(names("sh -c 'cd repo && git push'"), ['sh', 'cd', 'git']);
});

test('ignores shell comments', () => {
  assert.deepStrictEqual(names('ls # git commit'), ['ls']);
  assert.deepStrictEqual(names('ls\n# git commit\npwd'), ['ls', 'pwd']);
});

test('redirection does not hide the program', () => {
  assert.deepStrictEqual(parseInvocations('git commit 2>&1')[0].name, 'git');
  assert.deepStrictEqual(names('> out.txt git status'), ['git']);
});

test('findInvocations filters by program name', () => {
  const found = findInvocations('ls && git commit -m x && npm test', 'git');
  assert.deepStrictEqual(found, [{ name: 'git', args: ['commit', '-m', 'x'] }]);
});

test('gitSubcommand skips global flags and their values', () => {
  assert.deepStrictEqual(gitSubcommand(['commit', '-m', 'x']), { name: 'commit', args: ['-m', 'x'] });
  assert.deepStrictEqual(gitSubcommand(['-c', 'user.name=x', 'commit']), { name: 'commit', args: [] });
  assert.deepStrictEqual(gitSubcommand(['--git-dir', '/tmp/r', 'push']), { name: 'push', args: [] });
  assert.strictEqual(gitSubcommand(['--version']), null);
});

test('gitSubcommands reads every git call in a chain', () => {
  const subs = gitSubcommands('git add -A && git commit -m x && npm test');
  assert.deepStrictEqual(subs.map(s => s.name), ['add', 'commit']);
});

test('gitSubcommands ignores git named inside arguments', () => {
  assert.deepStrictEqual(gitSubcommands('grep -rn "git add|git commit" vendor/'), []);
});

test('empty and malformed input parse to nothing', () => {
  assert.deepStrictEqual(parseInvocations(''), []);
  assert.deepStrictEqual(parseInvocations(null), []);
  assert.deepStrictEqual(names('echo "unterminated'), ['echo']);
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed ? 1 : 0);
