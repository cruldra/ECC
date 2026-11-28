---
name: transcribing-audio
description: '用于用户给了音频或视频文件、想要里面说的话：转文字、语音转文字、识别录音里的文字、转写会议录音、转字幕、生成 SRT、transcribe、speech to text、subtitles。在本机用 mlx-whisper 在 Apple Silicon 的 GPU 上跑 Whisper large-v3，不上传任何内容，输出每行一个短语的 Markdown 逐字稿、带时间的 SRT，或两者都要。自带脚本用 PEP 723 头写明依赖，`uv run --script` 首次运行时自动建好环境。先用 Silero VAD 找出人声，再切成不超过 30 秒的小块逐块交给 Whisper，静音不会变成编出来的文字，长录音也不会卡在一个词上反复输出。默认中文；普通话用 OpenCC 转成简体字，并统一用全角标点。从不覆盖已有逐字稿；用户要校对版时另存新文件，行数和时间戳与原稿一一对应。'
locale: zh-CN
source_hash: aad5e49a219b7ce7d7febb4bc6109af3fb784789b4187fa5136f0eedf1e42bbd
translated_at: 2026-11-28T11:09:54Z
translation_model: claude-opus-5-5
---

# 音频转文字

在这台 Mac 上把音频或视频里的话转成文字：用 [mlx-whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper) 在 GPU 上跑 Whisper large-v3。改编自 [whisper-transcribe](https://github.com/pamler1004/whisper-transcribe)（MIT，见 `LICENSE-UPSTREAM`）。

## 何时使用

- 用户给了音频或视频文件，想要里面说的内容：逐字稿、字幕或 SRT 文件。
- 会议录音、访谈、语音备忘录、播客、讲座、带解说的录屏。
- 不用于实时听写，也不能在 Intel Mac 或其他系统上用：MLX 需要 Apple Silicon。

## 工作原理

### 1. 检查文件

确认路径存在，用 `ffprobe` 读出时长；时长决定预计耗时：

```bash
ffprobe -hide_banner "<file>" 2>&1 | grep Duration
```

前提：`PATH` 里有 `uv` 和 `ffmpeg`（`brew install uv ffmpeg`），其他都不用手动装。

### 2. 只定请求没说清的选项

| 选项 | 默认 | 什么时候改 |
|---|---|---|
| 格式 | `--format all`：Markdown 加 SRT | 用户点名只要一种 |
| 语言 | `--language zh` | 明显是别的语言：`en`、`ja`、`yue`，或用 `auto` 自动识别 |
| 输出目录 | 输入文件旁边 | 输入在别的应用的数据目录里，比如 `~/Library/Containers/...`（微信文件）：用 `--output-dir ~/Documents/transcripts` |
| 校对 | 不校对 | 用户要求时，见第 5 步 |

默认值能定的就不问。只有请求在会改变结果的地方有歧义时，才用一个问题一次问清。

### 3. 运行脚本

```bash
uv run --script ${CLAUDE_SKILL_DIR}/scripts/transcribe.py "<file>" --format all --output-dir ~/Documents/transcripts
```

`${CLAUDE_SKILL_DIR}` 是这份 SKILL.md 所在目录。命令里的脚本路径不以 `/` 开头时，把 `/scripts/` 之前的部分换成该目录的绝对路径。

- 第一次运行会建环境（约一分钟），并把约 3 GB 的模型下载到 `~/.cache/huggingface/hub`，之后都复用。
- `ffmpeg` 能读的音频和视频都会被解码成 16 kHz 单声道采样。接着 [Silero VAD](https://github.com/snakers4/silero-vad) 找出人声，人声被装进不超过 30 秒的小块，Whisper 逐块识别。整段一次识别时，一个窗口听错会带偏下一个窗口，Whisper 就会一分钟都在写同一个词，或者在静音里编出字幕组署名。
- 超过几分钟的录音放到后台跑，等它结束。M1 Max 上大约是实时的 9 倍：44 分钟的会议不到 5 分钟。芯片小一些会更慢。
- 一次只跑一个文件。每次运行都会把模型载入统一内存、占满 GPU；并行反而更慢，还可能内存不够。
- 用户没给人名或术语时不发提示词。内置的引导句曾让 Whisper 把真实会议里整块 30 秒的内容换成它背下来的字幕台词（请不吝点赞 订阅 转发 打赏支持明镜与点点栏目），说过的话就丢了；不带提示词时 Whisper 写的是标点很少的短句，这就是 Markdown 文件应有的样子。
- 普通话用 [OpenCC](https://github.com/BYVoid/OpenCC) 转成简体字，因为 Whisper 有些段落会写成繁体。粤语（`yue`）保留 Whisper 写的字。
- 中文和粤语逐字稿统一用全角标点：Whisper 在汉字旁写的 `,`、`?` 由脚本换成 `，`、`？`；拉丁字母或数字之间的标点（如 `3:30`）不变。
- 脚本把写出的每个文件路径打印到 stdout，进度打印到 stderr。从不覆盖：`name.md` 或 `name.srt` 已存在时改写 `name-2`、`name-3` 等，两种格式共用一个名字。

| 参数 | 含义 | 默认 |
|---|---|---|
| `--format` | `md` 每行一个短语，`srt` 带时间的字幕，`all` 两者都要 | `md` |
| `--language` | 语言代码，或 `auto` | `zh` |
| `--prompt` | 会出现的人名和术语，发给每一块；只列短短一串 | 无 |
| `--output-dir` / `--output-name` | 写到哪里、叫什么名字 | 输入文件旁边，同名 |
| `--model` | Hugging Face 仓库或本地路径 | `mlx-community/whisper-large-v3-mlx` |

更快或更小的模型：`mlx-community/whisper-large-v3-turbo`（约 1.6 GB，更快，准确度稍低）和 `mlx-community/whisper-large-v3-mlx-4bit`（16 GB 内存的机器用）。

### 4. 报告结果

给出写出文件的绝对路径、录音时长和逐字稿开头几行，让用户看到确实转好了。用户没要求就不总结内容。

### 5. 用户要求时才校对

用户要校对版时：

- 读完整份原始逐字稿，再用一次 `Write` 把校对后的副本写到旁边的 `<name>-proofread.md`（和 `<name>-proofread.srt`）。原始文件不动。
- 只改上下文能确定的错：同音字、断错的词、中英混说里的产品名和品牌名、明显错误的数字和单位。
- 保持忠实：保留语气、口头禅和重复；不总结、不调顺序，文字里判断不了的不猜。
- Markdown 副本的行数和行序与原稿一致。SRT 副本只改字幕文字，序号和时间戳完全不变。

### 常见问题

- **模型下载一直是 0 字节**：在命令前加 `HF_HUB_DISABLE_XET=1`，权重改走普通 HTTPS，不走 Xet 协议（走代理时可能卡住）。
- **连不上 `huggingface.co`**：在命令前加 `HF_ENDPOINT=https://hf-mirror.com`。
- **内存不足**：`--model mlx-community/whisper-large-v3-mlx-4bit`。
- **语言不对或满屏乱码**：明确指定 `--language`；`auto` 用第一块识别出的语言，后面各块沿用。
- **人名一直写错**：用 `--prompt` 列出人名和术语重跑。
- **出现像字幕台词的句子而不是说话内容**（请不吝点赞、字幕志愿者、感谢观看）：这是 Whisper 编的；加了 `--prompt` 之后才出现的，就把提示词缩短或去掉。

## 示例

一段 44 分钟的微信中文录音，输出两种格式：

```bash
uv run --script ${CLAUDE_SKILL_DIR}/scripts/transcribe.py \
  ~/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<id>/msg/file/2026-11/20261128_135027.m4a \
  --format all --output-dir ~/Documents/transcripts
# stdout:
# /Users/<you>/Documents/transcripts/20261128_135027.md
# /Users/<you>/Documents/transcripts/20261128_135027.srt
```

一场英文演讲，只要字幕，先给出讲者会提到的产品名：

```bash
uv run --script ${CLAUDE_SKILL_DIR}/scripts/transcribe.py talk.mp4 --language en --format srt \
  --prompt "Speakers discuss Kubernetes, Argo CD, and Grafana."
```
