#!/usr/bin/env node
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const skillDir = path.join(path.resolve(__dirname, "..", ".."), "skills", "transcribing-audio");
const skillFile = path.join(skillDir, "SKILL.md");
const script = path.join(skillDir, "scripts", "transcribe.py");
const body = fs.readFileSync(skillFile, "utf8");
const translation = fs.readFileSync(path.join(skillDir, "i18n", "zh-CN.md"), "utf8");
const source = fs.readFileSync(script, "utf8");

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

// Runs `main` with stand-ins for the model, the VAD, and OpenCC: a 3700-second recording at 10 samples a second,
// speech where `SPEECH` says, a `mlx_whisper` that records each call and answers every chunk with the same five
// segments (one blank, one with a traditional character, one in the chunk's last 0.2 seconds, one after its
// 4-second end), and a simplifier that only knows that one character.
const HARNESS = `
import importlib.util, json, os, sys, types
calls = []
def transcribe(audio, **kwargs):
    calls.append({k: v for k, v in kwargs.items() if k in ("language", "initial_prompt")})
    return {"language": "zh", "segments": [
        {"text": " 第一句, 对?", "start": 0, "end": 1.25}, {"text": " ", "start": 1.25, "end": 2},
        {"text": "第二個。", "start": 2.5, "end": 6.0}, {"text": "请不吝点赞", "start": 3.85, "end": 3.9}, {"text": "字幕志愿者", "start": 4.5, "end": 30}]}
sys.modules["mlx_whisper"] = types.SimpleNamespace(transcribe=transcribe)
spec = importlib.util.spec_from_file_location("transcribe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.SAMPLE_RATE = 10
module.load_wav = lambda path: [0.0] * 37000
module.to_simplified = lambda text: text.replace("個", "个")
module.find_speech = lambda wav: json.loads(os.environ.get("SPEECH", '[{"start": 3658.0, "end": 3662.0}]'))
sys.argv = [sys.argv[1], *sys.argv[2:]]
try:
    module.main()
    code = 0
except SystemExit as exc:
    code = exc.code
print(json.dumps({"code": code, "calls": calls}), file=sys.stderr)
`;

function runScript(dir, args, speech) {
  const input = path.join(dir, "talk.m4a");
  if (!fs.existsSync(input)) fs.writeFileSync(input, "placeholder, never decoded");
  const env = { ...process.env, ...(speech ? { SPEECH: JSON.stringify(speech) } : {}) };
  const run = spawnSync("python3", ["-I", "-c", HARNESS, script, input, ...args], { encoding: "utf8", env });
  const report = JSON.parse(run.stderr.trim().split("\n").pop());
  return { ...report, stdout: run.stdout.trim().split("\n").filter(Boolean) };
}

// Calls one of the script's pure functions with JSON arguments and returns its JSON result.
function callFunction(name, ...args) {
  const run = spawnSync("python3", ["-I", "-c", `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("transcribe", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
print(json.dumps(getattr(module, sys.argv[2])(*json.loads(sys.argv[3])), ensure_ascii=False))
`, script, name, JSON.stringify(args)], { encoding: "utf8" });
  assert.strictEqual(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

function tempDir() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "transcribing-audio-")));
}

console.log("\n=== Testing transcribing-audio skill ===\n");

test("frontmatter names the skill and keeps the description within 1024 characters", () => {
  const match = body.match(/^---\nname: transcribing-audio\ndescription: '([^'\n]+)'\n---\n/);
  assert.ok(match, "frontmatter shape");
  assert.ok(match[1].length <= 1024, `description is ${match[1].length} characters`);
});

test("keeps the sections in order", () => {
  const headings = body.split("\n").filter((line) => line.startsWith("## "));
  assert.deepStrictEqual(headings, ["## When to Use", "## How It Works", "## Examples"]);
});

test("the script declares its dependencies inline and the skill runs it through uv", () => {
  const header = '# /// script\n# requires-python = ">=3.10"\n# dependencies = [\n#     "mlx-whisper",\n#     "opencc",\n#     "silero-vad",\n# ]\n# ///\n';
  assert.ok(source.startsWith(header), "PEP 723 header lists the three dependencies");
  assert.ok(body.includes("uv run --script ${CLAUDE_SKILL_DIR}/scripts/transcribe.py"));
  assert.ok(!/\.venv|pip install|install\.sh/.test(body), "no hand-built environment");
});

test("the upstream MIT notice ships with the adapted script", () => {
  assert.match(fs.readFileSync(path.join(skillDir, "LICENSE-UPSTREAM"), "utf8"), /^MIT License\n\nCopyright \(c\) 2026 pamler1004/);
  assert.ok(source.includes("LICENSE-UPSTREAM"));
});

test("writes the segments on the recording's timeline, skipping blanks and text in the padding after the speech", () => {
  const dir = tempDir();
  const run = runScript(dir, ["--format", "all"]);
  assert.strictEqual(run.code, 0);
  assert.deepStrictEqual(run.stdout, [path.join(dir, "talk.md"), path.join(dir, "talk.srt")]);
  assert.strictEqual(fs.readFileSync(path.join(dir, "talk.md"), "utf8"), "第一句，对？\n第二个。\n");
  assert.strictEqual(
    fs.readFileSync(path.join(dir, "talk.srt"), "utf8"),
    "1\n01:00:58,000 --> 01:00:59,250\n第一句，对？\n\n2\n01:01:00,500 --> 01:01:02,000\n第二个。\n",
  );
});

test("packs speech into chunks of at most 30 seconds, joining short stretches to their neighbours", () => {
  const speech = [
    { start: 0, end: 5 }, { start: 6, end: 20 }, { start: 21, end: 29 },
    { start: 29.5, end: 40 }, { start: 100, end: 100.8 },
  ];
  assert.deepStrictEqual(callFunction("pack_chunks", speech), [
    { start: 0, end: 29 }, { start: 29.5, end: 40 }, { start: 100, end: 100.8 },
  ]);
  assert.deepStrictEqual(callFunction("pack_chunks", []), []);
});

test("never overwrites a transcript and keeps both formats under one free name", () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "talk.md"), "old md");
  fs.writeFileSync(path.join(dir, "talk-2.srt"), "old srt");
  const run = runScript(dir, ["--format", "all"]);
  assert.strictEqual(run.code, 0);
  assert.deepStrictEqual(run.stdout, [path.join(dir, "talk-3.md"), path.join(dir, "talk-3.srt")]);
  assert.strictEqual(fs.readFileSync(path.join(dir, "talk.md"), "utf8"), "old md");
  assert.strictEqual(fs.readFileSync(path.join(dir, "talk-2.srt"), "utf8"), "old srt");
});

test("sends no prompt unless asked, and then sends it with every chunk", () => {
  const dir = tempDir();
  const twoChunks = [{ start: 0, end: 4 }, { start: 100, end: 104 }];
  const none = { language: "zh", initial_prompt: null };
  assert.deepStrictEqual(runScript(dir, [], twoChunks).calls, [none, none]);
  const named = { language: "zh", initial_prompt: "Kubernetes, Argo CD" };
  assert.deepStrictEqual(runScript(dir, ["--prompt", "Kubernetes, Argo CD"], twoChunks).calls, [named, named]);
  assert.ok(!source.includes("DEFAULT_PROMPTS"), "a built-in prompt makes Whisper replace whole chunks with caption text");
});

test("with --language auto, the first chunk's language holds for the rest", () => {
  const dir = tempDir();
  const calls = runScript(dir, ["--language", "auto"], [{ start: 0, end: 4 }, { start: 100, end: 104 }]).calls;
  assert.deepStrictEqual(calls, [{ language: null, initial_prompt: null }, { language: "zh", initial_prompt: null }]);
});

test("Mandarin gets simplified characters and full-width punctuation; other languages and Latin text keep theirs", () => {
  const dir = tempDir();
  runScript(dir, ["--language", "en", "--output-name", "en"]);
  assert.strictEqual(fs.readFileSync(path.join(dir, "en.md"), "utf8"), "第一句, 对?\n第二個。\n");
  runScript(dir, ["--language", "yue", "--output-name", "yue"]);
  assert.strictEqual(fs.readFileSync(path.join(dir, "yue.md"), "utf8"), "第一句，对？\n第二個。\n");
  const samples = ["开发AI, 然后", "在 3:30 开会, 好吗?", "A,B 和 C", "注意: 这个"];
  const converted = samples.map((text) => callFunction("to_full_width_punctuation", text));
  assert.deepStrictEqual(converted, ["开发AI，然后", "在 3:30 开会，好吗？", "A,B 和 C", "注意：这个"]);
});

test("a missing input exits with an error and writes nothing", () => {
  const dir = tempDir();
  const run = spawnSync("python3", ["-I", "-c", HARNESS, script, path.join(dir, "missing.m4a")], { encoding: "utf8" });
  assert.strictEqual(JSON.parse(run.stderr.trim().split("\n").pop()).code, 1);
  assert.deepStrictEqual(fs.readdirSync(dir), []);
});

test("the zh-CN translation tracks the current SKILL.md", () => {
  const digest = crypto.createHash("sha256").update(fs.readFileSync(skillFile)).digest("hex");
  assert.match(translation, /^---\nname: transcribing-audio\ndescription: '[^'\n]+'\nlocale: zh-CN\n/);
  assert.ok(translation.includes(`source_hash: ${digest}`), "re-sync i18n/zh-CN.md after editing SKILL.md");
  const headings = (text) => text.split("\n").filter((line) => /^#{2,3} /.test(line)).length;
  assert.strictEqual(headings(translation), headings(body));
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
