---
name: transcribing-audio
description: 'Use when the user gives an audio or video file and wants the words in it: 转文字, 语音转文字, 识别录音里的文字, 转写会议录音, 转字幕, 生成 SRT, transcribe, speech to text, subtitles. Runs Whisper large-v3 locally through mlx-whisper on the Apple Silicon GPU, so nothing is uploaded, and writes a Markdown transcript with one spoken phrase per line, a timed SRT file, or both. The bundled script carries its dependencies in a PEP 723 header, so `uv run --script` builds the environment on first use. Silero VAD finds the speech and Whisper reads it in chunks of up to 30 seconds, one at a time, so silences do not turn into invented text and long recordings do not get stuck repeating a word. Chinese is the default language; Mandarin comes out in simplified characters through OpenCC, with full-width punctuation. Never overwrites a transcript; a proofread copy, when asked for, goes into a separate file that keeps every line and timestamp of the original.'
---

# Transcribing Audio

Turn the speech in an audio or video file into text on this Mac, with Whisper large-v3 running on the GPU through [mlx-whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper). Adapted from [whisper-transcribe](https://github.com/pamler1004/whisper-transcribe) (MIT, `LICENSE-UPSTREAM`).

## When to Use

- The user gives an audio or video file and wants what is said in it: a transcript, subtitles, or an SRT file.
- Meeting recordings, interviews, voice memos, podcasts, lectures, screen recordings with narration.
- Not for live dictation, and not on Intel Macs or other systems: MLX needs Apple Silicon.

## How It Works

### 1. Check the File

Confirm the path exists and read its length with `ffprobe`; the length sets the expected run time:

```bash
ffprobe -hide_banner "<file>" 2>&1 | grep Duration
```

Requirements: `uv` and `ffmpeg` on the `PATH` (`brew install uv ffmpeg`). Nothing else is installed by hand.

### 2. Choose Only What the Request Leaves Open

| Choice | Default | Change it when |
|---|---|---|
| Format | `--format all`: Markdown and SRT | The user names one format |
| Language | `--language zh` | The speech is clearly another language: `en`, `ja`, `yue`, or `auto` to detect |
| Output directory | Next to the input | The input sits inside another app's data, such as `~/Library/Containers/...` (WeChat files): use `--output-dir ~/Documents/transcripts` |
| Proofreading | None | The user asks for it; see step 5 |

Do not ask about a choice the default settles. Ask once, in one question, only when the request is ambiguous about something that changes the result.

### 3. Run the Script

```bash
uv run --script ${CLAUDE_SKILL_DIR}/scripts/transcribe.py "<file>" --format all --output-dir ~/Documents/transcripts
```

`${CLAUDE_SKILL_DIR}` is the directory of this SKILL.md. When the script path in a command does not start with `/`, replace everything before `/scripts/` with the absolute path of that directory.

- The first run builds the environment (about a minute) and downloads the model, about 3 GB, into `~/.cache/huggingface/hub`. Later runs reuse both.
- `ffmpeg` decodes any audio or video it can read into 16 kHz mono samples. [Silero VAD](https://github.com/snakers4/silero-vad) then finds the speech, and the speech is packed into chunks of up to 30 seconds that Whisper reads one at a time. Reading the whole recording in one go lets one misheard window feed the next, which is how Whisper ends up writing the same word for a minute or inventing subtitle credits in a silence.
- Run recordings longer than a few minutes in the background and wait for it to finish. On an M1 Max it runs at about 9 times real time: a 44-minute meeting took under 5 minutes. Smaller chips take longer.
- One file at a time. Each run loads the model into unified memory and uses the whole GPU; parallel runs are slower and can run out of memory.
- No prompt is sent unless the user gives names or terms. A built-in priming sentence made Whisper replace whole 30-second chunks of a real meeting with a caption line it had memorised (请不吝点赞 订阅 转发 打赏支持明镜与点点栏目), losing what was said; without one Whisper writes short phrases with little punctuation, which is the expected look of the Markdown file.
- Mandarin is converted to simplified characters with [OpenCC](https://github.com/BYVoid/OpenCC), since Whisper writes some stretches in traditional ones. Cantonese (`yue`) keeps the characters Whisper chose.
- Chinese and Cantonese transcripts get full-width punctuation: Whisper writes `,` and `?` next to Chinese characters, and the script turns them into `，` and `？`; punctuation between Latin letters or digits, as in `3:30`, stays.
- The script prints each file it wrote on stdout and its progress on stderr. It never overwrites: when `name.md` or `name.srt` exists it writes `name-2`, `name-3`, and so on, with both formats under one name.

| Option | Meaning | Default |
|---|---|---|
| `--format` | `md` one spoken phrase per line, `srt` timed cues, `all` both | `md` |
| `--language` | Language code, or `auto` | `zh` |
| `--prompt` | Names and terms that will come up, given to every chunk; keep it to a short list | none |
| `--output-dir` / `--output-name` | Where to write and under what name | next to the input, same name |
| `--model` | Hugging Face repo or local path | `mlx-community/whisper-large-v3-mlx` |

Faster or smaller models: `mlx-community/whisper-large-v3-turbo` (about 1.6 GB, faster, a little less accurate) and `mlx-community/whisper-large-v3-mlx-4bit` (for 16 GB machines).

### 4. Report the Result

Give the absolute paths of the files written, the recording's length, and the first few lines of the transcript, so the user sees it worked. Do not summarise the content unless asked.

### 5. Proofread Only on Request

When the user asks for a proofread version:

- Read the whole raw transcript, then write the corrected copy in one `Write` to `<name>-proofread.md` (and `<name>-proofread.srt`) next to it. The raw file stays unchanged.
- Fix only what the context settles: homophone characters, broken words, product and brand names in mixed Chinese and English, plainly wrong numbers and units.
- Stay faithful: keep the tone, filler words, and repetitions; do not summarise, reorder, or guess what cannot be told from the text.
- The Markdown copy keeps the same number and order of lines as the raw one. The SRT copy changes only cue text; cue numbers and timestamps stay identical.

### Troubleshooting

- **Model download stays at 0 bytes**: put `HF_HUB_DISABLE_XET=1` in front of the command; the weights then come over plain HTTPS instead of the Xet protocol, which can hang behind a proxy.
- **No route to `huggingface.co`**: put `HF_ENDPOINT=https://hf-mirror.com` in front of the command.
- **Out of memory**: `--model mlx-community/whisper-large-v3-mlx-4bit`.
- **Wrong language or nonsense text**: set `--language` explicitly; `auto` takes the language of the first chunk and keeps it for the rest.
- **Names spelled wrong throughout**: rerun with `--prompt` listing the names and terms.
- **A caption-like line instead of speech** (请不吝点赞, 字幕志愿者, 感谢观看): Whisper invented it; when it appears after adding `--prompt`, shorten the prompt or drop it.

## Examples

A 44-minute WeChat voice recording, in Chinese, to both formats:

```bash
uv run --script ${CLAUDE_SKILL_DIR}/scripts/transcribe.py \
  ~/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<id>/msg/file/2026-11/20261128_135027.m4a \
  --format all --output-dir ~/Documents/transcripts
# stdout:
# /Users/<you>/Documents/transcripts/20261128_135027.md
# /Users/<you>/Documents/transcripts/20261128_135027.srt
```

An English talk, subtitles only, with the speaker's product names primed:

```bash
uv run --script ${CLAUDE_SKILL_DIR}/scripts/transcribe.py talk.mp4 --language en --format srt \
  --prompt "Speakers discuss Kubernetes, Argo CD, and Grafana."
```
