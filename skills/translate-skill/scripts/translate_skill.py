#!/usr/bin/env python3
"""Faithfully translate an ECC SKILL.md into skills/<id>/i18n/<locale>.md using GLM 5.3 Flash."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_LOCALE = "zh-CN"
DEFAULT_MODEL = "z-ai/glm-5.3-flash"
DEFAULT_PROFILE = Path.home() / "Sources/cruldra-profile/claude-config/profiles/glm53f.json"
SKILL_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
LOCALE_RE = re.compile(r"^[a-z]{2}(-[A-Z]{2})?$")

SYSTEM = """You translate ECC agent skill markdown into the target locale.

Rules:
- Faithful translation. Do not add, remove, or summarize ideas.
- Keep YAML keys, skill ids, command names, file paths, code fences, and URLs unchanged.
- Keep English identifiers in backticks unchanged.
- Translate prose, headings, and descriptions.
- Return only the translated markdown document. No preface, no fence around the whole file.
- Preserve frontmatter structure. You may add locale: <target> if missing.
"""


def _strip_model(model: str) -> str:
    return re.sub(r"\[[^\]]+\]$", "", model).strip()


def _profile_env(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    env = data.get("env") or {}
    out: dict[str, str] = {}
    for key in ("ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"):
        value = env.get(key)
        if value:
            out[key] = str(value)
    return out


def credentials() -> tuple[str, str, str]:
    profile = Path(os.environ.get("GLM53F_PROFILE") or DEFAULT_PROFILE)
    data = _profile_env(profile)
    base = (data.get("ANTHROPIC_BASE_URL") or os.environ.get("ANTHROPIC_BASE_URL") or "").rstrip("/")
    token = (
        data.get("ANTHROPIC_AUTH_TOKEN")
        or data.get("ANTHROPIC_API_KEY")
        or os.environ.get("ANTHROPIC_AUTH_TOKEN")
        or os.environ.get("ANTHROPIC_API_KEY")
        or ""
    )
    model = _strip_model(data.get("ANTHROPIC_MODEL") or os.environ.get("ANTHROPIC_MODEL") or DEFAULT_MODEL)
    if not base or not token:
        raise SystemExit("缺少 ANTHROPIC_BASE_URL 或 ANTHROPIC_AUTH_TOKEN。可设 GLM53F_PROFILE 指向 glm53f.json。")
    return base, token, model


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def skill_dir(root: Path, skill_id: str) -> Path:
    if not SKILL_ID_RE.match(skill_id):
        raise SystemExit(f"非法 skill id: {skill_id}")
    folder = (root / "skills" / skill_id).resolve()
    skills_root = (root / "skills").resolve()
    if skills_root not in folder.parents and folder != skills_root:
        raise SystemExit("路径逃出 skills/")
    if not (folder / "SKILL.md").is_file():
        raise SystemExit(f"找不到 {folder / 'SKILL.md'}")
    return folder


def i18n_path(folder: Path, locale: str) -> Path:
    if not LOCALE_RE.match(locale):
        raise SystemExit(f"非法 locale: {locale}")
    return folder / "i18n" / f"{locale}.md"


def split_frontmatter(text: str) -> tuple[str, str]:
    if not text.startswith("---"):
        return "", text
    end = text.find("\n---", 3)
    if end < 0:
        return "", text
    return text[3:end], text[end + 4 :].lstrip("\n")


def upsert_frontmatter(text: str, extra: dict[str, str]) -> str:
    fm, body = split_frontmatter(text)
    lines = [line for line in fm.splitlines() if line.strip()]
    keys = {line.split(":", 1)[0].strip() for line in lines if ":" in line}
    for key, value in extra.items():
        prefix = f"{key}:"
        replaced = False
        new_lines = []
        for line in lines:
            if line.startswith(prefix):
                new_lines.append(f"{key}: {value}")
                replaced = True
            else:
                new_lines.append(line)
        if not replaced:
            new_lines.append(f"{key}: {value}")
        lines = new_lines
        keys.add(key)
    packed = "---\n" + "\n".join(lines) + "\n---\n\n"
    return packed + body.lstrip("\n")


def call_model(base: str, token: str, model: str, locale: str, original: str) -> str:
    payload = {
        "model": model,
        "max_tokens": 16000,
        "system": SYSTEM + f"\nTarget locale: {locale}.",
        "messages": [{"role": "user", "content": original}],
    }
    raw = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/v1/messages",
        data=raw,
        method="POST",
        headers={
            "content-type": "application/json",
            "x-api-key": token,
            "authorization": f"Bearer {token}",
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"翻译接口失败 HTTP {exc.code}: {detail[:500]}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"翻译接口连不上: {exc.reason}") from exc
    parts = []
    for block in data.get("content") or []:
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text") or "")
    text = "\n".join(parts).strip()
    if text.startswith("```") and text.endswith("```"):
        text = re.sub(r"^```[a-zA-Z0-9]*\n", "", text)
        text = re.sub(r"\n```$", "", text)
    if not text:
        raise SystemExit("模型没有返回译文")
    return text


def status_payload(folder: Path, locale: str) -> dict:
    original = (folder / "SKILL.md").read_text(encoding="utf-8")
    digest = sha256_text(original)
    path = i18n_path(folder, locale)
    if not path.is_file():
        return {
            "id": folder.name,
            "locale": locale,
            "exists": False,
            "stale": False,
            "source_hash": digest,
            "stored_hash": "",
            "path": str(path.relative_to(folder.parent.parent)),
        }
    stored = path.read_text(encoding="utf-8")
    fm, _ = split_frontmatter(stored)
    stored_hash = ""
    for line in fm.splitlines():
        if line.startswith("source_hash:"):
            stored_hash = line.split(":", 1)[1].strip()
    return {
        "id": folder.name,
        "locale": locale,
        "exists": True,
        "stale": stored_hash != digest,
        "source_hash": digest,
        "stored_hash": stored_hash,
        "path": str(path.relative_to(folder.parent.parent)),
        "text": stored,
    }


def translate(root: Path, skill_id: str, locale: str, force: bool) -> dict:
    folder = skill_dir(root, skill_id)
    original = (folder / "SKILL.md").read_text(encoding="utf-8")
    digest = sha256_text(original)
    path = i18n_path(folder, locale)
    current = status_payload(folder, locale)
    if current["exists"] and not current["stale"] and not force:
        current["skipped"] = True
        return current
    base, token, model = credentials()
    translated = call_model(base, token, model, locale, original)
    translated = upsert_frontmatter(
        translated,
        {
            "locale": locale,
            "source_hash": digest,
            "translated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "model": model,
        },
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(translated, encoding="utf-8")
    return {
        "id": skill_id,
        "locale": locale,
        "exists": True,
        "stale": False,
        "skipped": False,
        "source_hash": digest,
        "stored_hash": digest,
        "path": str(path.relative_to(root)),
        "text": translated,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Translate an ECC SKILL.md for reading")
    parser.add_argument("--root", type=Path, default=None)
    parser.add_argument("--skill", required=True)
    parser.add_argument("--locale", default=DEFAULT_LOCALE)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    root = (args.root or Path(__file__).resolve().parents[3]).resolve()
    if args.locale != DEFAULT_LOCALE:
        raise SystemExit("第一版只支持 zh-CN")
    folder = skill_dir(root, args.skill)
    if args.status:
        payload = status_payload(folder, args.locale)
    else:
        payload = translate(root, args.skill, args.locale, args.force)
    if args.json:
        sys.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    else:
        if payload.get("skipped"):
            sys.stdout.write(f"已有最新译文 {payload['path']}\n")
        elif args.status:
            state = "无译本" if not payload["exists"] else ("过时" if payload["stale"] else "最新")
            sys.stdout.write(f"{args.skill} {args.locale}: {state}\n")
        else:
            sys.stdout.write(f"已写入 {payload['path']}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
