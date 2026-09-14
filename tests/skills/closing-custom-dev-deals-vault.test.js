'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const skillDir = path.join(repoRoot, 'skills', 'closing-custom-dev-deals');
const vaultSh = path.join(skillDir, 'scripts', 'vault.sh');

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

// Every run gets its own vault path and its own keyring entry, so the suite
// never reads, writes, or clears the operator's real passphrase.
function vault(args, { vaultPath, input, home }) {
  return spawnSync('bash', [vaultSh, ...args], {
    encoding: 'utf8',
    input,
    env: {
      ...process.env,
      CCDD_VAULT: vaultPath,
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, '.config'),
      // file-backed keyring and silent reads, so the suite never touches the real
      // macOS keychain and never pops an askpass dialog
      CCDD_KEYRING: 'file',
      CCDD_ASKPASS: 'tty',
    },
  });
}

console.log('\n=== Testing closing-custom-dev-deals vault ===\n');

test('the tracked skill carries no company plain text', () => {
  // Shapes, not values: spelling the real strings out here would publish them
  // in this very file, which is the leak the test exists to prevent.
  const shapes = [
    [/1[3-9]\d{9}/, 'mainland mobile number'],
    [/\b\d{16,21}\b/, 'bank account number'],
    [/\b9[12]\d{6}[0-9A-Z]{10}\b/, 'unified social credit code'],
    [/[¥￥]\s?\d{1,3},\d{3}\s*\/\s*(?:真实)?人月/, 'per-capacity-month price'],
    [/\d+(?:\.\d+)?\s*万[^\n]{0,8}(?:成交|总价|签)/, 'signed deal value'],
    [/\b\d{1,3},\d{3}\s*元?\/月/, 'staff monthly cost'],
  ];
  for (const file of fs.readdirSync(skillDir).filter(f => f.endsWith('.md'))) {
    const body = fs.readFileSync(path.join(skillDir, file), 'utf8');
    for (const [re, what] of shapes) {
      assert.ok(!re.test(body), `${file} looks like it still contains a ${what}`);
    }
  }
});

test('gitignore keeps the plain-text sources out of the repo', () => {
  const ignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
  for (const p of ['skills/closing-custom-dev-deals/company-profile.md',
                   'skills/closing-custom-dev-deals/pricing-model.md']) {
    assert.ok(ignore.includes(p), `${p} is not ignored`);
  }
});

test('seal then show round-trips, and the cipher text leaks nothing', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ccdd-home-'));
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'ccdd-plain-'));
  const vaultPath = path.join(home, 'secrets.enc');
  fs.writeFileSync(path.join(plain, 'a.md'), '# 甲\n账号 123456\n');
  fs.writeFileSync(path.join(plain, 'b.md'), '# 乙\n底线 999\n');

  const sealed = vault(['seal', plain], { vaultPath, home, input: 'pw-abc\npw-abc\n' });
  assert.strictEqual(sealed.status, 0, sealed.stderr);
  assert.ok(fs.existsSync(vaultPath), 'vault was not written');

  const cipher = fs.readFileSync(vaultPath);
  assert.ok(!cipher.includes(Buffer.from('账号')), 'plain text survived into the cipher text');
  assert.ok(!cipher.includes(Buffer.from('999')), 'plain text survived into the cipher text');

  const listed = vault(['list'], { vaultPath, home });
  assert.strictEqual(listed.status, 0, listed.stderr);
  assert.deepStrictEqual(listed.stdout.trim().split('\n').sort(), ['a.md', 'b.md']);

  const one = vault(['show', 'b.md'], { vaultPath, home });
  assert.strictEqual(one.status, 0, one.stderr);
  assert.ok(one.stdout.includes('底线 999'));

  const all = vault(['show'], { vaultPath, home });
  assert.ok(all.stdout.includes('账号 123456') && all.stdout.includes('底线 999'));
});

test('a wrong passphrase is refused and a locked vault asks for unlock', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ccdd-home-'));
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'ccdd-plain-'));
  const vaultPath = path.join(home, 'secrets.enc');
  fs.writeFileSync(path.join(plain, 'a.md'), '# 甲\n');
  vault(['seal', plain], { vaultPath, home, input: 'right-pw\nright-pw\n' });

  vault(['lock'], { vaultPath, home });
  const locked = vault(['show'], { vaultPath, home });
  assert.notStrictEqual(locked.status, 0);
  assert.match(locked.stderr, /还没存口令/);

  const bad = vault(['unlock'], { vaultPath, home, input: 'wrong-pw\n' });
  assert.notStrictEqual(bad.status, 0);
  assert.match(bad.stderr, /口令不对/);

  const good = vault(['unlock'], { vaultPath, home, input: 'right-pw\n' });
  assert.strictEqual(good.status, 0, good.stderr);
  assert.strictEqual(vault(['show'], { vaultPath, home }).status, 0);
});

test('a missing vault points the operator at seal', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ccdd-home-'));
  const missing = vault(['show'], { vaultPath: path.join(home, 'nope.enc'), home });
  assert.notStrictEqual(missing.status, 0);
  assert.match(missing.stderr, /还没有保险箱/);
});

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
