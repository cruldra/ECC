#!/usr/bin/env node
// Registers a local development plugin with Figma Desktop and launches it.
//
// Figma has no command line for importing a development plugin — the UI path is
// Plugins > Development > Import plugin from manifest. The list behind that menu
// is just the `localFileExtensions` array in Figma's settings.json, so adding an
// entry there does the same thing.
//
// Figma overwrites settings.json from memory when it quits, so an entry written
// while Figma is running disappears the moment the user closes it. Figma also
// caches plugin code per process, so an already-registered plugin keeps running
// the previous code.js until a restart. Both mean Figma has to be quit first —
// gracefully, never killed, because a SIGKILL loses unsaved canvas work.
//
// macOS only. Everywhere else it prints the path for a manual import.
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const QUIT_TIMEOUT_MS = 10000;
const QUIT_POLL_MS = 400;

function settingsPath() {
  return path.join(os.homedir(), "Library", "Application Support", "Figma", "settings.json");
}

/** Figma mixes other objects into the array; only id + manifestPath entries count. */
function asExtensionEntries(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      typeof entry.id === "number" &&
      typeof entry.manifestPath === "string"
  );
}

/**
 * The id counter is shared across the whole array: a manifest entry takes one id
 * and the code.js entry Figma creates later takes the one reserved in
 * `fileMetadata.codeFileId`. Ignoring the reserved ids hands the new plugin an id
 * that collides with an entry Figma has not written yet.
 */
function nextExtensionId(entries) {
  let max = 0;
  for (const entry of entries) {
    const meta = entry.fileMetadata || {};
    for (const candidate of [entry.id, meta.codeFileId, meta.manifestFileId]) {
      if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > max) {
        max = candidate;
      }
    }
  }
  return max + 1;
}

function findManifestEntry(entries, manifestPath) {
  return entries.find((entry) => entry.manifestPath === manifestPath);
}

/** Only the manifest entry — Figma creates the code entry itself, on the reserved id. */
function buildManifestEntry({ id, manifestPath, name }) {
  return {
    id,
    manifestPath,
    lastKnownName: name,
    lastKnownPluginId: "",
    fileMetadata: { type: "manifest", codeFileId: id + 1, uiFileIds: [] },
  };
}

function appendManifestEntry(entries, { manifestPath, name }) {
  const existing = findManifestEntry(entries, manifestPath);
  if (existing) {
    return { entries, added: false, name: existing.lastKnownName || name };
  }
  const entry = buildManifestEntry({ id: nextExtensionId(entries), manifestPath, name });
  return { entries: [...entries, entry], added: true, name };
}

/** manifest `name`, falling back to the plugin directory name. */
function pluginNameFrom(manifestAbs) {
  const parsed = JSON.parse(fs.readFileSync(manifestAbs, "utf8"));
  const name = parsed && typeof parsed === "object" ? parsed.name : undefined;
  if (typeof name === "string" && name.trim()) return name.trim();
  return path.basename(path.dirname(manifestAbs));
}

function run(cmd, args) {
  try {
    return { code: 0, stdout: execFileSync(cmd, args, { encoding: "utf8", timeout: 15000 }) };
  } catch (error) {
    return { code: error.status === undefined ? 1 : error.status, stdout: error.stdout || "" };
  }
}

function figmaRunning() {
  return run("pgrep", ["-x", "Figma"]).stdout.trim().length > 0;
}

function quitFigmaAndWait() {
  run("osascript", ["-e", 'quit app "Figma"']);
  const deadline = Date.now() + QUIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!figmaRunning()) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, QUIT_POLL_MS);
  }
  return !figmaRunning();
}

function die(message) {
  console.error(message);
  process.exit(1);
}

function main(argv) {
  const input = argv[0];
  if (!input) die("用法: import-into-figma.js <manifest.json 路径>");

  const manifestAbs = path.resolve(input);
  if (!fs.existsSync(manifestAbs)) die(`manifest 不存在：${manifestAbs}`);

  if (process.platform !== "darwin") {
    console.log(`当前系统只能手动导入。在 Figma 里走 Plugins > Development > Import plugin from manifest，选：\n${manifestAbs}`);
    return;
  }

  const file = settingsPath();
  if (!fs.existsSync(file)) die(`没找到 Figma 配置：${file}\n先装 Figma 桌面版并至少启动一次。`);

  const name = pluginNameFrom(manifestAbs);
  const settings = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    die(`Figma 配置顶层不是对象：${file}`);
  }

  const result = appendManifestEntry(asExtensionEntries(settings.localFileExtensions), {
    manifestPath: manifestAbs,
    name,
  });

  if (figmaRunning() && !quitFigmaAndWait()) {
    die(`Figma 在 ${QUIT_TIMEOUT_MS / 1000} 秒内没退出，手动关掉再重试。`);
  }

  if (result.added) {
    const backup = `${file}.bak-${Date.now()}`;
    fs.copyFileSync(file, backup);
    settings.localFileExtensions = result.entries;
    fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    console.log(`已写入 Figma 插件清单：${result.name}\n备份：${backup}`);
  } else {
    console.log(`清单里已有「${result.name}」，重启 Figma 让它读到最新的 code.js`);
  }

  const opened = run("open", ["-a", "Figma"]);
  if (opened.code !== 0) die("拉起 Figma 失败");
  console.log("Figma 已启动。在 Plugins > Development 里跑这个插件。");
}

module.exports = {
  asExtensionEntries,
  nextExtensionId,
  findManifestEntry,
  buildManifestEntry,
  appendManifestEntry,
  pluginNameFrom,
  settingsPath,
};

if (require.main === module) main(process.argv.slice(2));
