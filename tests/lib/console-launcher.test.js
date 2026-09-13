'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const launcher = require('../../scripts/lib/console-launcher');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed++;
  }
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-console-'));
}

function fakeRoot() {
  const root = tmpDir();
  fs.mkdirSync(path.join(root, 'console'));
  fs.writeFileSync(path.join(root, 'console', 'pyproject.toml'), '[project]\nname = "ecc-plugin-console"\n');
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[tool.uv.workspace]\nmembers = ["console"]\n');
  return root;
}

function serve(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function freePort() {
  const { server, port } = await serve(() => {});
  await closeServer(server);
  return port;
}

(async () => {
  console.log('\n=== Testing console launcher ===\n');

  await test('resolveRoot prefers ECC_ROOT, then an enclosing checkout, then the plugin root', () => {
    const envRoot = fakeRoot();
    const checkout = fakeRoot();
    const nested = path.join(checkout, 'skills', 'demo');
    fs.mkdirSync(nested, { recursive: true });
    const plugin = fakeRoot();
    assert.deepStrictEqual(launcher.resolveRoot({ env: { ECC_ROOT: envRoot }, cwd: nested, pluginRoot: plugin }), { root: envRoot, source: 'ECC_ROOT' });
    assert.deepStrictEqual(launcher.resolveRoot({ env: {}, cwd: nested, pluginRoot: plugin }), { root: checkout, source: 'cwd' });
    assert.deepStrictEqual(launcher.resolveRoot({ env: {}, cwd: tmpDir(), pluginRoot: plugin }), { root: plugin, source: 'plugin' });
    assert.strictEqual(launcher.resolveRoot({ env: { ECC_ROOT: tmpDir() }, cwd: tmpDir(), pluginRoot: tmpDir() }), null);
  });

  await test('resolvePort falls back to 8765 on junk', () => {
    assert.strictEqual(launcher.resolvePort({}), 8765);
    assert.strictEqual(launcher.resolvePort({ ECC_CONSOLE_PORT: '9000' }), 9000);
    assert.strictEqual(launcher.resolvePort({ ECC_CONSOLE_PORT: 'abc' }), 8765);
    assert.strictEqual(launcher.resolvePort({ ECC_CONSOLE_PORT: '70000' }), 8765);
  });

  await test('probe tells the console apart from a free port and a foreign server', async () => {
    const ours = await serve((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });
    assert.deepStrictEqual(await launcher.probe(ours.port), { state: 'up' });
    await closeServer(ours.server);

    const foreign = await serve((req, res) => { res.statusCode = 404; res.end('nope'); });
    assert.deepStrictEqual(await launcher.probe(foreign.port), { state: 'foreign', status: 404 });
    await closeServer(foreign.server);

    const html = await serve((req, res) => { res.end('<html></html>'); });
    assert.strictEqual((await launcher.probe(html.port)).state, 'foreign');
    await closeServer(html.server);

    assert.deepStrictEqual(await launcher.probe(await freePort()), { state: 'down', status: 'ECONNREFUSED' });
  });

  await test('ensureConsole reuses a running console without spawning', async () => {
    const ours = await serve((req, res) => { res.end(JSON.stringify({ ok: true })); });
    let spawned = 0;
    const result = await launcher.ensureConsole({
      env: { ECC_CONSOLE_PORT: String(ours.port) },
      cwd: tmpDir(),
      logPath: path.join(tmpDir(), 'console.log'),
      spawnFn: () => { spawned++; return { unref() {} }; },
    });
    await closeServer(ours.server);
    assert.strictEqual(spawned, 0);
    assert.deepStrictEqual(result, { ok: true, url: `http://127.0.0.1:${ours.port}`, started: false, port: ours.port });
  });

  await test('ensureConsole refuses a port owned by something else', async () => {
    const foreign = await serve((req, res) => { res.statusCode = 500; res.end(); });
    let spawned = 0;
    const result = await launcher.ensureConsole({
      env: { ECC_CONSOLE_PORT: String(foreign.port) },
      cwd: fakeRoot(),
      logPath: path.join(tmpDir(), 'console.log'),
      spawnFn: () => { spawned++; return { unref() {} }; },
    });
    await closeServer(foreign.server);
    assert.strictEqual(spawned, 0);
    assert.strictEqual(result.ok, false);
    assert.match(result.reason, /被别的进程占着/);
  });

  await test('ensureConsole starts the console detached from the resolved root and waits for it', async () => {
    const root = fakeRoot();
    const port = await freePort();
    const logPath = path.join(tmpDir(), 'nested', 'console.log');
    let server = null;
    const calls = [];
    const spawnFn = (cmd, args, options) => {
      calls.push({ cmd, args, options });
      server = http.createServer((req, res) => { res.end(JSON.stringify({ ok: true })); });
      server.listen(port, '127.0.0.1');
      return { unref() {} };
    };
    const result = await launcher.ensureConsole({
      env: { ECC_CONSOLE_PORT: String(port) },
      cwd: root,
      logPath,
      spawnFn,
      waitOptions: { timeoutMs: 5000, intervalMs: 50 },
    });
    await closeServer(server);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].cmd, 'uv');
    assert.deepStrictEqual(calls[0].args, ['run', '--package', 'ecc-plugin-console', 'ecc-plugin-console']);
    assert.strictEqual(calls[0].options.cwd, root);
    assert.strictEqual(calls[0].options.detached, true);
    assert.strictEqual(calls[0].options.env.ECC_CONSOLE_PORT, String(port));
    assert.ok(fs.existsSync(logPath));
    assert.deepStrictEqual(result, { ok: true, url: `http://127.0.0.1:${port}`, started: true, port, root, rootSource: 'cwd' });
  });

  await test('ensureConsole reports a launch that never comes up', async () => {
    const root = fakeRoot();
    const port = await freePort();
    const result = await launcher.ensureConsole({
      env: { ECC_CONSOLE_PORT: String(port) },
      cwd: root,
      logPath: path.join(tmpDir(), 'console.log'),
      spawnFn: () => ({ unref() {} }),
      waitOptions: { timeoutMs: 300, intervalMs: 50 },
    });
    assert.strictEqual(result.ok, false);
    assert.match(result.reason, /没起来/);
  });

  await test('openCommand picks the platform opener', () => {
    assert.deepStrictEqual(launcher.openCommand('http://x', 'darwin'), { cmd: 'open', args: ['http://x'] });
    assert.deepStrictEqual(launcher.openCommand('http://x', 'linux'), { cmd: 'xdg-open', args: ['http://x'] });
    assert.deepStrictEqual(launcher.openCommand('http://x', 'win32'), { cmd: 'cmd', args: ['/c', 'start', '', 'http://x'] });
  });

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})();
