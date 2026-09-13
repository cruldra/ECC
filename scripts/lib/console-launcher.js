'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_PORT = 8765;
const HOST = '127.0.0.1';

function isConsoleRoot(dir) {
  return Boolean(dir)
    && fs.existsSync(path.join(dir, 'console', 'pyproject.toml'))
    && fs.existsSync(path.join(dir, 'pyproject.toml'));
}

/**
 * Root the console runs from. Code and data both come from this directory.
 * Order: ECC_ROOT env, a checkout enclosing cwd, the installed plugin.
 */
function resolveRoot({ env = process.env, cwd = process.cwd(), pluginRoot = env.CLAUDE_PLUGIN_ROOT } = {}) {
  if (env.ECC_ROOT && isConsoleRoot(env.ECC_ROOT)) return { root: env.ECC_ROOT, source: 'ECC_ROOT' };
  let dir = path.resolve(cwd);
  for (;;) {
    if (isConsoleRoot(dir)) return { root: dir, source: 'cwd' };
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (isConsoleRoot(pluginRoot)) return { root: pluginRoot, source: 'plugin' };
  return null;
}

function resolvePort(env = process.env) {
  const raw = Number.parseInt(env.ECC_CONSOLE_PORT || '', 10);
  return Number.isInteger(raw) && raw > 0 && raw < 65536 ? raw : DEFAULT_PORT;
}

function consoleUrl(port) {
  return `http://${HOST}:${port}`;
}

/** 'up' = our console answers; 'foreign' = something else owns the port; 'down' = nothing listening. */
function probe(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port, path: '/api/status', timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve({ state: 'foreign', status: res.statusCode });
        try {
          JSON.parse(body);
          resolve({ state: 'up' });
        } catch {
          resolve({ state: 'foreign', status: res.statusCode });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ state: 'foreign', status: 'timeout' }); });
    req.on('error', (error) => resolve({ state: error.code === 'ECONNREFUSED' ? 'down' : 'foreign', status: error.code }));
  });
}

async function waitReady(port, { timeoutMs = 30000, intervalMs = 400, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await probe(port, 1000);
    if (result.state === 'up') return true;
    await sleep(intervalMs);
  }
  return false;
}

function launchArgs() {
  return ['run', '--package', 'ecc-plugin-console', 'ecc-plugin-console'];
}

/** Start the console detached so it outlives this process; stdout/stderr go to a log file. */
function launch({ root, port, logPath, spawnFn = spawn, env = process.env }) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const log = fs.openSync(logPath, 'a');
  const child = spawnFn('uv', launchArgs(), {
    cwd: root,
    env: { ...env, ECC_CONSOLE_PORT: String(port) },
    detached: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
  fs.closeSync(log);
  return child;
}

function openCommand(url, platform = process.platform) {
  if (platform === 'darwin') return { cmd: 'open', args: [url] };
  if (platform === 'win32') return { cmd: 'cmd', args: ['/c', 'start', '', url] };
  return { cmd: 'xdg-open', args: [url] };
}

function openBrowser(url, { spawnFn = spawn, platform = process.platform } = {}) {
  const { cmd, args } = openCommand(url, platform);
  try {
    const child = spawnFn(cmd, args, { stdio: 'ignore', detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * One console per port. Reuse a running one, start one when the port is free,
 * refuse when a foreign process owns the port.
 */
async function ensureConsole({ env = process.env, cwd = process.cwd(), logPath, spawnFn, waitOptions } = {}) {
  const port = resolvePort(env);
  const url = consoleUrl(port);
  const current = await probe(port);
  if (current.state === 'up') return { ok: true, url, started: false, port };
  if (current.state === 'foreign') {
    return { ok: false, url, port, reason: `端口 ${port} 被别的进程占着（${current.status}），不是控制台。换个端口：ECC_CONSOLE_PORT=8766` };
  }
  const resolved = resolveRoot({ env, cwd });
  if (!resolved) return { ok: false, url, port, reason: '找不到带 console/ 的 ECC 目录。设 ECC_ROOT 指向仓库，或在仓库里运行。' };
  launch({ root: resolved.root, port, logPath, spawnFn, env });
  const ready = await waitReady(port, waitOptions);
  if (!ready) return { ok: false, url, port, root: resolved.root, reason: `控制台 30 秒内没起来，看日志 ${logPath}` };
  return { ok: true, url, started: true, port, root: resolved.root, rootSource: resolved.source };
}

module.exports = {
  DEFAULT_PORT, HOST, isConsoleRoot, resolveRoot, resolvePort, consoleUrl,
  probe, waitReady, launchArgs, launch, openCommand, openBrowser, ensureConsole,
};
