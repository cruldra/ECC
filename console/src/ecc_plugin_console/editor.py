from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from .catalog import ECC_ROOT, source_hash, _frontmatter, _skill_locales, _command_locales
from .harness import run_argv

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
KINDS = ("skill", "command")
SCRIPT = ECC_ROOT / "skills" / "translate-skill" / "scripts" / "translate_skill.py"


def _check_kind(kind: str) -> str:
    if kind not in KINDS:
        raise ValueError("未知类型")
    return kind


def _source(kind: str, item_id: str) -> Path:
    """Original file, with the path confined to its own directory."""
    _check_kind(kind)
    if not ID_RE.match(item_id):
        raise ValueError(f"非法 {kind} id")
    if kind == "skill":
        root = (ECC_ROOT / "skills").resolve()
        path = (root / item_id / "SKILL.md").resolve()
    else:
        root = (ECC_ROOT / "commands").resolve()
        path = (root / f"{item_id}.md").resolve()
    if root not in path.parents:
        raise ValueError(f"路径逃出 {kind}s/")
    if not path.is_file():
        raise FileNotFoundError(item_id)
    return path


def _locales(kind: str, item_id: str, digest: str) -> list[dict]:
    if kind == "skill":
        return _skill_locales(ECC_ROOT / "skills" / item_id, digest)
    return _command_locales(item_id, digest)


def load_item(kind: str, item_id: str) -> dict:
    path = _source(kind, item_id)
    original = path.read_text(encoding="utf-8")
    digest = source_hash(original)
    locales = {}
    for item in _locales(kind, item_id, digest):
        text = (ECC_ROOT / item["path"]).read_text(encoding="utf-8")
        locales[item["locale"]] = {
            "text": text,
            "stale": item["stale"],
            "path": item["path"],
            "source_hash": _frontmatter(text).get("source_hash") or "",
        }
    return {
        "id": item_id,
        "kind": kind,
        "original": original,
        "hash": digest,
        "path": str(path.relative_to(ECC_ROOT)),
        "locales": locales,
    }


def save_item(kind: str, item_id: str, text: str) -> dict:
    path = _source(kind, item_id)
    if not text.strip():
        raise ValueError("内容是空的")
    path.write_text(text, encoding="utf-8")
    return load_item(kind, item_id)


def translate_item(kind: str, item_id: str, locale: str = "zh-CN", force: bool = False) -> dict:
    if locale != "zh-CN":
        raise ValueError("第一版只支持 zh-CN")
    _source(kind, item_id)
    flag = "--skill" if kind == "skill" else "--command"
    argv = [sys.executable, str(SCRIPT), "--root", str(ECC_ROOT), flag, item_id, "--locale", locale, "--json"]
    if force:
        argv.append("--force")
    result = run_argv(argv, timeout=180)
    try:
        payload = json.loads(result["stdout"]) if result["stdout"].strip() else None
    except json.JSONDecodeError:
        payload = None
    if not result["ok"]:
        return {
            "ok": False,
            "stderr": (result["stderr"] or result["stdout"] or "翻译失败")[-800:],
            "item": load_item(kind, item_id),
        }
    return {
        "ok": True,
        "result": payload,
        "item": load_item(kind, item_id),
        "skipped": bool((payload or {}).get("skipped")),
    }


def load_skill(skill_id: str) -> dict:
    return load_item("skill", skill_id)


def save_original(skill_id: str, text: str) -> dict:
    return save_item("skill", skill_id, text)


def translate_skill(skill_id: str, locale: str = "zh-CN", force: bool = False) -> dict:
    payload = translate_item("skill", skill_id, locale, force)
    if "item" in payload:
        payload["skill"] = payload["item"]
    return payload
