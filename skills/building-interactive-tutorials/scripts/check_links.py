# /// script
# requires-python = ">=3.10"
# ///
"""检查一页打包好的教程里每个链接都能打开：页内锚点要有对应的 `id`，仓库文件要存在，外部网页要返回 200 且锚点在页面里。

用法：`uv run check_links.py viz/<名字>.html`；加 `--offline` 只查页内锚点和仓库文件，不联网。
有坏链接时逐条打印 `FAIL` 并以状态码 1 退出。只用标准库，不用装依赖。
"""

from __future__ import annotations

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urldefrag, urlsplit
from urllib.request import Request, urlopen

USER_AGENT = "Mozilla/5.0 (compatible; tutorial-link-check)"
SKIPPED_SCHEMES = {"mailto", "vscode", "javascript", "data"}


class LinkCollector(HTMLParser):
    """收集页面里所有 `<a href>` 和所有 `id`、`name` 属性；`<script>` 里的内容不当成标签解析。"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []
        self.anchors: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        for key in ("id", "name"):
            if values.get(key):
                self.anchors.add(values[key])
        if tag == "a" and values.get("href"):
            self.links.append(values["href"])


def collect(html: str) -> LinkCollector:
    """解析一段 HTML，返回其中的链接和锚点。"""
    parser = LinkCollector()
    parser.feed(html)
    return parser


def fetch(url: str) -> tuple[int | None, str]:
    """取一个网页，返回状态码和正文；连不上时状态码是 `None`，正文是出错原因。"""
    try:
        with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=30) as response:
            return response.status, response.read().decode("utf-8", "replace")
    except HTTPError as error:
        return error.code, ""
    except (URLError, TimeoutError, OSError) as error:
        return None, str(error)


def check(page: Path, offline: bool) -> list[str]:
    """检查 `page` 里的全部链接，返回每个坏链接的一行说明；同一个网页只取一次。"""
    found = collect(page.read_text(encoding="utf-8"))
    problems: list[str] = []
    remote: dict[str, set[str]] = {}
    for href in dict.fromkeys(found.links):
        scheme = urlsplit(href).scheme
        url, fragment = urldefrag(href)
        fragment = unquote(fragment)
        if scheme in SKIPPED_SCHEMES:
            continue
        if scheme in ("http", "https"):
            remote.setdefault(url, set()).update([fragment] if fragment else [])
        elif not url:
            if fragment not in found.anchors:
                problems.append(f"FAIL 页内没有 id {href}")
        elif not (page.parent / unquote(url)).exists():
            problems.append(f"FAIL 文件不存在 {href}")
    if offline:
        return problems

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = dict(zip(remote, pool.map(fetch, remote)))
    for url, fragments in remote.items():
        status, body = results[url]
        if status != 200:
            problems.append(f"FAIL {status or body} {url}")
            continue
        anchors = collect(body).anchors
        problems += [f"FAIL 锚点不存在 {url}#{f}" for f in sorted(fragments) if f not in anchors]
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("page", type=Path, help="打包好的页面，如 viz/tokenizer.html")
    parser.add_argument("--offline", action="store_true", help="只查页内锚点和仓库文件")
    args = parser.parse_args()
    problems = check(args.page, args.offline)
    print("\n".join(problems) if problems else f"OK {args.page}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
