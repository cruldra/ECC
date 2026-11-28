# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""把 SRT 字幕压成每分钟一行的文本，行首 `[mm]` 是第几分钟，同一分钟里的字幕用 ` / ` 隔开。

用法：uv run --script condense_srt.py 会议.srt [-o 输出.txt]，不给 `-o` 就打印到标准输出。
"""
import argparse
import re
import sys
from pathlib import Path

TIMING = re.compile(r"^(\d+):(\d{2}):\d{2}[,.]\d+\s*-->")


def condense(srt_text: str) -> str:
    """返回压缩后的文本；字幕序号行、时间行和空行都不进结果。"""
    lines, minute, current = [], None, None
    for raw in srt_text.lstrip("\ufeff").splitlines():
        line = raw.strip()
        timing = TIMING.match(line)
        if timing:
            minute = int(timing.group(1)) * 60 + int(timing.group(2))
            continue
        if not line or line.isdigit() or minute is None:
            continue
        if minute != current:
            lines.append(f"[{minute:02d}] {line}")
            current = minute
        else:
            lines[-1] += f" / {line}"
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("srt", type=Path)
    parser.add_argument("-o", "--output", type=Path)
    args = parser.parse_args()
    text = condense(args.srt.read_text(encoding="utf-8"))
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
