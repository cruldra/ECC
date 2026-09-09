from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from .catalog import ECC_ROOT, source_hash, _frontmatter, _skill_locales
from .harness import run_argv

SKILL_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
SCRIPT = ECC_ROOT / "skills" / "translate-skill" / "scripts" / "translate_skill.py"


def _folder(skill_id: str) -> Path:
    if not SKILL_ID_RE.match(skill_id):
        raise ValueError("非法 skill id")
    folder = (ECC_ROOT / "skills" / skill_id).resolve()
    root = (ECC_ROOT / "skills").resolve()
    if root not in folder.parents:
        raise ValueError("路径逃出 skills/")
    if not (folder / "SKILL.md").is_file():
        raise FileNotFoundError(skill_id)
    return folder


def load_skill(skill_id: str) -> dict:
    folder = _folder(skill_id)
    original = (folder / "SKILL.md").read_text(encoding="utf-8")
    digest = source_hash(original)
    locales = {}
    for item in _skill_locales(folder, digest):
        text = (ECC_ROOT / item["path"]).read_text(encoding="utf-8")
        locales[item["locale"]] = {
            "text": text,
            "stale": item["stale"],
            "path": item["path"],
            "source_hash": _frontmatter(text).get("source_hash") or "",
        }
    return {
        "id": skill_id,
        "original": original,
        "hash": digest,
        "path": f"skills/{skill_id}/SKILL.md",
        "locales": locales,
    }


def save_original(skill_id: str, text: str) -> dict:
    folder = _folder(skill_id)
    if not text.strip():
        raise ValueError("内容是空的")
    (folder / "SKILL.md").write_text(text, encoding="utf-8")
    return load_skill(skill_id)


def translate_skill(skill_id: str, locale: str = "zh-CN", force: bool = False) -> dict:
    if locale != "zh-CN":
        raise ValueError("第一版只支持 zh-CN")
    _folder(skill_id)
    argv = [sys.executable, str(SCRIPT), "--root", str(ECC_ROOT), "--skill", skill_id, "--locale", locale, "--json"]
    if force:
        argv.append("--force")
    result = run_argv(argv, timeout=180)
    payload = None
    try:
        payload = json.loads(result["stdout"]) if result["stdout"].strip() else None
    except json.JSONDecodeError:
        payload = None
    if not result["ok"]:
        return {
            "ok": False,
            "stderr": (result["stderr"] or result["stdout"] or "翻译失败")[-800],
            "skill": load_skill(skill_id),
        }
    return {"ok": True, "result": payload, "skill": load_skill(skill_id), "skipped": bool((payload or {}).get("skipped"))}
