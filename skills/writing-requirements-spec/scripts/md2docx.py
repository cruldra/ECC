# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""把需求说明书 Markdown 转成给甲方的 Word：表格占满版心、带框线、表头浅蓝底，列宽按每列内容长短分配。

用法：uv run --script md2docx.py 需求说明书.md   → 同目录生成同名 .docx
依赖：pandoc。不生成目录，因为 pandoc 的目录域会让 Word 打开时弹“是否更新域”。
"""
import re
import subprocess
import sys
import tempfile
import unicodedata
import zipfile
from pathlib import Path

MIN_WEIGHT, MAX_WEIGHT = 4, 40
SEPARATOR = re.compile(r"\|(\s*:?-+:?\s*\|)+")

BORDERS = "<w:tblBorders>" + "".join(
    f'<w:{side} w:val="single" w:sz="4" w:space="0" w:color="A6A6A6"/>'
    for side in ("top", "left", "bottom", "right", "insideH", "insideV")
) + "</w:tblBorders>"

# 插入位置遵循 OOXML 元素顺序：style 里 rPr 在 tblPr 前，tblStylePr 里 rPr 在 tcPr 前，
# tcPr 里 shd 在 tcBorders 后、vAlign 前。
STYLE_EDITS = [
    ('<w:qFormat />\n    <w:tblPr>',
     '<w:qFormat />\n    <w:rPr><w:sz w:val="20"/></w:rPr>\n    <w:tblPr>'),
    ('<w:tblStylePr w:type="firstRow">\n      <w:tcPr>',
     '<w:tblStylePr w:type="firstRow">\n      <w:rPr><w:b/></w:rPr>\n      <w:tcPr>'),
    ('        </w:tcBorders>\n        <w:vAlign w:val="bottom"/>',
     '        </w:tcBorders>\n        <w:shd w:val="clear" w:color="auto" w:fill="E7EEF7"/>\n'
     '        <w:vAlign w:val="center"/>'),
]


def display_width(text: str) -> int:
    """中日韩全角字符按 2 个宽度算，其余按 1 个。"""
    return sum(2 if unicodedata.east_asian_width(ch) in "WF" else 1 for ch in text.strip())


def cells(row: str) -> list[str]:
    return row.strip().strip("|").split("|")


def column_weight(header: str, body: list[str]) -> int:
    """列宽取表头宽度和单元格平均宽度中较大的，限制在 4 到 40 之间，个别长单元格不会把整列撑宽。"""
    mean = sum(map(display_width, body)) / len(body) if body else 0
    return round(min(max(display_width(header), mean, MIN_WEIGHT), MAX_WEIGHT))


def set_column_widths(markdown: str) -> str:
    """按列内容长短改写 pipe table 分隔行的破折号数；pandoc 据此分配 Word 列宽。"""
    lines = markdown.split("\n")
    i = 1
    while i < len(lines):
        if SEPARATOR.fullmatch(lines[i].strip()) and lines[i - 1].startswith("|"):
            end = i + 1
            while end < len(lines) and lines[end].startswith("|"):
                end += 1
            header = cells(lines[i - 1])
            body = [cells(row) for row in lines[i + 1:end]]
            weights = [column_weight(name, [row[col] for row in body if col < len(row)])
                       for col, name in enumerate(header)]
            lines[i] = "|" + "|".join("-" * weight for weight in weights) + "|"
            i = end
        else:
            i += 1
    return "\n".join(lines)


def patch_styles(styles: str) -> str:
    for old, new in STYLE_EDITS:
        if styles.count(old) != 1:
            sys.exit(f"pandoc 默认样式和预期不一致，找不到：{old[:50]!r}")
        styles = styles.replace(old, new)
    return styles


def patch_tables(document: str) -> str:
    """每张表直接写框线并占满版心，不认表格样式的预览器（QuickLook、WPS）也能显示框线。"""
    def patch(match: re.Match) -> str:
        tbl_pr = match.group(0).replace('<w:tblW w:type="auto" w:w="0" />', '<w:tblW w:type="pct" w:w="5000" />')
        anchor = "<w:tblLayout" if "<w:tblLayout" in tbl_pr else "<w:tblLook"
        return tbl_pr.replace(anchor, BORDERS + anchor, 1)
    return re.sub(r"<w:tblPr>.*?</w:tblPr>", patch, document)


def rewrite_docx(src: Path, dst: Path, edits: dict) -> None:
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item)
            if item.filename in edits:
                data = edits[item.filename](data.decode("utf-8")).encode("utf-8")
            zout.writestr(item, data)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("用法：md2docx.py 需求说明书.md")
    source = Path(sys.argv[1]).resolve()
    target = source.with_suffix(".docx")
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        default_ref, ref, md, raw = tmp / "default.docx", tmp / "ref.docx", tmp / "in.md", tmp / "raw.docx"
        default_ref.write_bytes(subprocess.run(
            ["pandoc", "--print-default-data-file", "reference.docx"], check=True, capture_output=True).stdout)
        rewrite_docx(default_ref, ref, {"word/styles.xml": patch_styles})
        md.write_text(set_column_widths(source.read_text(encoding="utf-8")), encoding="utf-8")
        subprocess.run(["pandoc", str(md), "-o", str(raw), f"--reference-doc={ref}",
                        f"--resource-path={source.parent}"], check=True)
        rewrite_docx(raw, target, {"word/document.xml": patch_tables})
    print(target)


if __name__ == "__main__":
    main()
