#!/usr/bin/env node
'use strict';

// Open the ECC plugin console. One instance per port: reuse it when it is
// already up, start it detached when the port is free, refuse otherwise.
//   node scripts/console.js open     # default
//   node scripts/console.js status

const os = require('os');
const path = require('path');
const launcher = require('./lib/console-launcher');

async function main(argv) {
  const action = argv[0] || 'open';
  const logPath = path.join(os.homedir(), '.claude', 'ecc-console.log');
  if (action === 'status') {
    const port = launcher.resolvePort();
    const result = await launcher.probe(port);
    console.log(JSON.stringify({ port, url: launcher.consoleUrl(port), ...result }));
    return 0;
  }
  if (action !== 'open') {
    console.error(`未知动作: ${action}（open | status）`);
    return 2;
  }
  const result = await launcher.ensureConsole({ logPath });
  if (!result.ok) {
    console.error(result.reason);
    return 1;
  }
  const opened = launcher.openBrowser(result.url);
  console.log(JSON.stringify({ url: result.url, port: result.port, started: result.started, root: result.root || null, browser: opened }));
  return 0;
}

main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
