# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""从内部版需求说明书生成甲方版：删掉表格里的“状态”“来源”两列和正文里的 `[mm]` 会议时间标记。

用法：
  uv run --script strip_annotations.py 内部版.md 甲方版.md   生成甲方版，已存在时拒绝覆盖
  uv run --script strip_annotations.py --check 甲方版.md      只检查，有内部用语时退出码为 1
仍含内部用语的行打印到标准错误，这些行要手工改写。
"""
import re
import sys
from pathlib import Path

DROPPED_COLUMNS = {"状态", "来源"}
MARKERS = re.compile(r"(\s*\[\d{1,3}\])+")
INTERNAL_WORDS = re.compile(r"推断|已确认|待提供|会上|会议|录音|转写|草稿|§|ISO|GB/T|模板")


def strip(markdown: str) -> str:
    """删列按表头名定位，同一张表的每一行删同样的列；表格以外的行只删时间标记。"""
    out, keep = [], None
    for line in markdown.split("\n"):
        if line.startswith("|"):
            cells = line.strip().strip("|").split("|")
            if keep is None:
                keep = [i for i, cell in enumerate(cells) if cell.strip() not in DROPPED_COLUMNS]
            line = "|" + "|".join(cells[i] for i in keep if i < len(cells)) + "|"
        else:
            keep = None
        out.append(MARKERS.sub("", line))
    return "\n".join(out)


def leftovers(markdown: str) -> list[str]:
    """返回仍含内部用语的行，带行号。"""
    return [f"{number}: {line}" for number, line in enumerate(markdown.split("\n"), 1)
            if INTERNAL_WORDS.search(line)]


def report(markdown: str) -> bool:
    """打印仍含内部用语的行；没有这样的行时返回 True。"""
    remaining = leftovers(markdown)
    if remaining:
        print("以下行仍含内部用语，请手工改写：", *remaining, sep="\n", file=sys.stderr)
    return not remaining


def main() -> None:
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == "--check":
        sys.exit(0 if report(Path(args[1]).read_text(encoding="utf-8")) else 1)
    if len(args) != 2:
        sys.exit("用法：strip_annotations.py 内部版.md 甲方版.md 或 strip_annotations.py --check 甲方版.md")
    source, target = Path(args[0]), Path(args[1])
    if target.exists():
        sys.exit(f"{target} 已存在，不覆盖；换个文件名或先手动删除")
    result = strip(source.read_text(encoding="utf-8"))
    target.write_text(result, encoding="utf-8")
    print(target)
    report(result)


if __name__ == "__main__":
    main()
