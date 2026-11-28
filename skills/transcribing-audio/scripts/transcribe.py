# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "mlx-whisper",
#     "opencc",
#     "silero-vad",
# ]
# ///
"""Turn an audio or video file into a line-per-sentence Markdown transcript or an SRT subtitle file, on this Mac's GPU.

Runs [mlx-whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper) with the Whisper large-v3 model, so
nothing leaves the machine; `uv` builds the environment from the header above on first use:

    uv run --script transcribe.py <file> [--format md|srt|all] [--language zh] [--output-dir DIR]

[Silero VAD](https://github.com/snakers4/silero-vad) finds the speech first, and Whisper reads it in chunks of up to
30 seconds, one at a time, which keeps it from inventing text in silences or repeating itself on long recordings.

Adapted from [whisper-transcribe](https://github.com/pamler1004/whisper-transcribe) (MIT, see `LICENSE-UPSTREAM`).
"""

import argparse
import re
import sys
from pathlib import Path

DEFAULT_MODEL = "mlx-community/whisper-large-v3-mlx"

SAMPLE_RATE = 16000
CHUNK_SECONDS = 30
MAX_SPEECH_SECONDS = 28
SPEECH_PAD_SECONDS = 0.2

FULL_WIDTH_LANGUAGES = {"zh", "yue"}
CJK = "[\u3400-\u9fff\uf900-\ufaff]"
ASCII_PUNCTUATION = re.compile(rf"(?<={CJK})\s*([,?!:;])\s*|\s*([,?!:;])\s*(?={CJK})")
FULL_WIDTH = str.maketrans({",": "，", "?": "？", "!": "！", ":": "：", ";": "；"})


def to_simplified(text: str) -> str:
    """Write Mandarin in simplified characters with [OpenCC](https://github.com/BYVoid/OpenCC), because Whisper switches to traditional ones for some stretches."""
    import opencc

    return opencc.OpenCC("t2s").convert(text)


def to_full_width_punctuation(text: str) -> str:
    """Turn the half-width `,` `?` `!` `:` `;` Whisper writes next to Chinese characters into their full-width forms, dropping the spaces around them.

    Punctuation between Latin letters or digits, as in `3:30` or `A,B`, stays as it is.
    """
    return ASCII_PUNCTUATION.sub(lambda m: (m.group(1) or m.group(2)).translate(FULL_WIDTH), text)


class OutputWriteError(Exception):
    """A transcript file could not be created; `written_paths` lists the files this run did create, which stay on disk."""

    def __init__(self, message, written_paths=()):
        super().__init__(message)
        self.written_paths = tuple(written_paths)


def format_ts(seconds: float) -> str:
    """Write a time in seconds as an SRT timestamp, `HH:MM:SS,mmm`."""
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def segments_to_srt(segments) -> str:
    """Number the segments as SRT cues, each with its start and end time."""
    lines = []
    for i, seg in enumerate(segments, 1):
        lines.append(str(i))
        lines.append(f"{format_ts(seg['start'])} --> {format_ts(seg['end'])}")
        lines.append(seg["text"].strip())
        lines.append("")
    return "\n".join(lines)


def write_outputs(output_dir: Path, base_name: str, output_format: str, segments):
    """Write the transcript files without ever overwriting one, trying `name-2`, `name-3` and so on until every format is free.

    For `all` the Markdown and SRT files share one name. If another writer takes the second file's name after the first
    file is written, the first file stays and the error names it; nothing is deleted.

    @return the name used and the paths written
    @throws [OutputWriteError] when a file cannot be created after this run already wrote one, or the directory refuses writes
    """
    outputs = {}
    if output_format in ("md", "all"):
        outputs[".md"] = "\n".join(s["text"].strip() for s in segments if s["text"].strip()) + "\n"
    if output_format in ("srt", "all"):
        outputs[".srt"] = segments_to_srt(segments)

    candidate = base_name
    suffix = 2
    while True:
        paths = [output_dir / f"{candidate}{extension}" for extension in outputs]
        if any(path.exists() for path in paths):
            candidate = f"{base_name}-{suffix}"
            suffix += 1
            continue
        created = []
        for (extension, content), path in zip(outputs.items(), paths):
            try:
                with path.open("x", encoding="utf-8", newline="") as f:
                    created.append(path)
                    f.write(content)
            except FileExistsError as e:
                if created:
                    raise OutputWriteError(
                        f"{path} appeared while writing; kept this run's {', '.join(map(str, created))}", created,
                    ) from e
                break  # nothing written yet under this name, so the next name is still safe
            except OSError as e:
                if created:
                    raise OutputWriteError(
                        f"could not write {path}; kept this run's {', '.join(map(str, created))}", created,
                    ) from e
                raise OutputWriteError(f"could not write {path}: {e}") from e
        else:
            return candidate, created
        candidate = f"{base_name}-{suffix}"
        suffix += 1


def load_wav(audio_path: str):
    """Decode the file into 16 kHz mono samples, the rate both Whisper and Silero VAD expect."""
    import numpy as np
    from mlx_whisper.audio import load_audio

    return np.asarray(load_audio(audio_path, sr=SAMPLE_RATE))


def find_speech(wav):
    """Find where people speak with [Silero VAD](https://github.com/snakers4/silero-vad), as start and end seconds.

    A stretch longer than [MAX_SPEECH_SECONDS] is cut at its last pause, so with the padding added around it every
    stretch still fits one Whisper window.
    """
    import torch
    from silero_vad import get_speech_timestamps, load_silero_vad

    return get_speech_timestamps(
        torch.from_numpy(wav), load_silero_vad(), sampling_rate=SAMPLE_RATE, return_seconds=True,
        min_speech_duration_ms=250, min_silence_duration_ms=500, speech_pad_ms=int(SPEECH_PAD_SECONDS * 1000),
        max_speech_duration_s=MAX_SPEECH_SECONDS,
    )


def pack_chunks(speech, limit=CHUNK_SECONDS):
    """Group consecutive speech stretches into chunks that span at most `limit` seconds, so each chunk is one Whisper window read on its own.

    Reading one window at a time keeps a misheard phrase from being fed back into the next window, which is how Whisper
    ends up repeating the same word for minutes. A short stretch joins its
    neighbours instead of standing alone, because a window that is almost all silence is where Whisper invents text.
    """
    chunks = []
    for seg in speech:
        if chunks and seg["end"] - chunks[-1]["start"] <= limit:
            chunks[-1]["end"] = seg["end"]
        else:
            chunks.append({"start": seg["start"], "end": seg["end"]})
    return chunks


def transcribe_chunks(wav, chunks, model: str, language, prompt):
    """Transcribe each chunk separately and place its segments on the recording's timeline.

    With `language` unset, the first chunk's detected language is kept for the rest, so a short chunk is not read as
    another language. A segment that starts in the chunk's last [SPEECH_PAD_SECONDS] or after it is dropped: the VAD
    added that much silence after the last speech, and the rest of the window is padding, so nothing was said there.

    @param prompt names and terms that will come up, given to every chunk; `None` gives none
    @return the segments and the language they were read in
    """
    import mlx_whisper

    segments = []
    for i, chunk in enumerate(chunks, 1):
        samples = wav[int(chunk["start"] * SAMPLE_RATE):int(chunk["end"] * SAMPLE_RATE)]
        length = len(samples) / SAMPLE_RATE
        if length < 0.1:
            continue
        if i == 1 or i % 10 == 0 or i == len(chunks):
            print(f"  [{i}/{len(chunks)}] {chunk['start']:.0f}s", file=sys.stderr)
        res = mlx_whisper.transcribe(samples, path_or_hf_repo=model, language=language, initial_prompt=prompt)
        language = language or res.get("language")
        for seg in res.get("segments", []):
            if seg["start"] >= length - SPEECH_PAD_SECONDS:
                continue
            segments.append({
                "start": round(chunk["start"] + seg["start"], 3),
                "end": round(chunk["start"] + min(seg["end"], length), 3),
                "text": seg["text"],
            })
    return segments, language


def main():
    p = argparse.ArgumentParser(description="Transcribe audio or video locally with mlx-whisper")
    p.add_argument("input", help="audio or video file")
    p.add_argument("--model", default=DEFAULT_MODEL, help=f"Hugging Face repo or local path (default {DEFAULT_MODEL})")
    p.add_argument("--language", default="zh", help="language code such as zh, en, ja, yue; auto detects it (default zh)")
    p.add_argument("--format", default="md", choices=["md", "srt", "all"],
                   help="md: one sentence per line; srt: timed subtitles; all: both (default md)")
    p.add_argument("--output-dir", default=None, help="directory for the transcript (default: next to the input)")
    p.add_argument("--output-name", default=None, help="file name without extension (default: the input's)")
    p.add_argument("--prompt", default=None, help="names and terms that will come up, to spell them right (default: none)")
    args = p.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.exists():
        print(f"File not found: {input_path}", file=sys.stderr)
        sys.exit(1)
    if not input_path.is_file():
        print(f"Not a file: {input_path}", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output_dir).expanduser() if args.output_dir else input_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)
    base_name = args.output_name or input_path.stem

    try:
        wav = load_wav(str(input_path))
    except RuntimeError as e:
        print(f"ffmpeg could not decode {input_path.name}: {e}", file=sys.stderr)
        sys.exit(1)

    print("Finding speech...", file=sys.stderr)
    chunks = pack_chunks(find_speech(wav))
    duration = len(wav) / SAMPLE_RATE
    print(f"  {duration:.0f}s of audio, {len(chunks)} chunks of up to {CHUNK_SECONDS}s", file=sys.stderr)
    print(f"Transcribing with {args.model}, language {args.language}", file=sys.stderr)
    lang = args.language if args.language and args.language != "auto" else None
    segments, language = transcribe_chunks(wav, chunks, args.model, lang, args.prompt)

    segments = [seg for seg in segments if seg["text"].strip()]
    for seg in segments:
        if language == "zh":
            seg["text"] = to_simplified(seg["text"])
        if language in FULL_WIDTH_LANGUAGES:
            seg["text"] = to_full_width_punctuation(seg["text"])

    try:
        actual_name, output_paths = write_outputs(output_dir, base_name, args.format, segments)
    except OutputWriteError as e:
        print(f"{e} (nothing was deleted or overwritten)", file=sys.stderr)
        sys.exit(1)
    if actual_name != base_name:
        print(f"{base_name} was taken, wrote {actual_name} instead", file=sys.stderr)
    for path in output_paths:
        print(path)


if __name__ == "__main__":
    main()
