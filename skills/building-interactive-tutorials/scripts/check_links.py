# /// script
# requires-python = ">=3.10"
# ///
"""检查一页打包好的教程里每个链接都能打开：页内锚点要有对应的 `id`，仓库文件要存在，外部网页要返回 200 且锚点在页面里。

用法：`uv run check_links.py viz/<名字>.html`；加 `--offline` 只查页内锚点和仓库文件，不联网。
有坏链接时逐条打印 `FAIL` 并以状态码 1 退出。只用标准库，不用装依赖。

GitHub 这类网站会限流脚本：请求带浏览器的 User-Agent，遇到 429、503 退避重试两次；还是被拒的链接打印成 `LIMITED`，
意思是可能被限流、要用浏览器打开确认，不算坏链接，不影响退出状态。
"""

from __future__ import annotations

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urldefrag, urlsplit
from urllib.request import Request, urlopen

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
RATE_LIMITED = {429, 503}
RETRIES = 2
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


def fetch_once(url: str) -> tuple[int | None, str]:
    """取一个网页，返回状态码和正文；连不上时状态码是 `None`，正文是出错原因。"""
    try:
        with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=30) as response:
            return response.status, response.read().decode("utf-8", "replace")
    except HTTPError as error:
        return error.code, ""
    except (URLError, TimeoutError, OSError) as error:
        return None, str(error)


def fetch(url: str, retry_delay: float) -> tuple[int | None, str]:
    """取一个网页；遇到 429、503 先等 `retry_delay` 秒、再等两倍重试，最多重试 [RETRIES] 次，返回最后一次的结果。"""
    status, body = fetch_once(url)
    for attempt in range(RETRIES):
        if status not in RATE_LIMITED:
            break
        time.sleep(retry_delay * 2**attempt)
        status, body = fetch_once(url)
    return status, body


def check(page: Path, offline: bool, retry_delay: float = 2.0) -> tuple[list[str], list[str]]:
    """检查 `page` 里的全部链接，同一个网页只取一次。

    @return 坏链接各一行的 `FAIL` 说明，以及重试后仍被 429、503 拒绝、可能被限流的链接各一行的 `LIMITED` 说明
    """
    found = collect(page.read_text(encoding="utf-8"))
    problems: list[str] = []
    limited: list[str] = []
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
        return problems, limited

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = dict(zip(remote, pool.map(partial(fetch, retry_delay=retry_delay), remote)))
    for url, fragments in remote.items():
        status, body = results[url]
        if status in RATE_LIMITED:
            limited.append(f"LIMITED {status} {url} 可能被限流，用浏览器打开确认")
            continue
        if status != 200:
            problems.append(f"FAIL {status or body} {url}")
            continue
        anchors = collect(body).anchors
        problems += [f"FAIL 锚点不存在 {url}#{f}" for f in sorted(fragments) if f not in anchors]
    return problems, limited


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("page", type=Path, help="打包好的页面，如 viz/tokenizer.html")
    parser.add_argument("--offline", action="store_true", help="只查页内锚点和仓库文件")
    parser.add_argument("--retry-delay", type=float, default=2.0, help="遇到 429、503 时第一次重试前等几秒，之后每次翻倍")
    args = parser.parse_args()
    problems, limited = check(args.page, args.offline, args.retry_delay)
    print("\n".join(problems + limited + ([] if problems else [f"OK {args.page}"])))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
