from __future__ import annotations

import json
import re
import subprocess

from .catalog import ECC_ROOT

PLUGIN_ID = "ecc@ecc"


def run_argv(argv: list[str], timeout: float = 180) -> dict:
    try:
        proc = subprocess.run(argv, capture_output=True, text=True, timeout=timeout, check=False)
    except FileNotFoundError:
        return {"ok": False, "code": 127, "stdout": "", "stderr": f"找不到命令 {argv[0]}"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "code": 124, "stdout": "", "stderr": "命令超时"}
    return {
        "ok": proc.returncode == 0,
        "code": proc.returncode,
        "stdout": proc.stdout or "",
        "stderr": proc.stderr or "",
    }


def _parse_json(text: str):
    text = text.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        start_arr = text.find("[")
        cuts = [i for i in (start, start_arr) if i >= 0]
        if not cuts:
            return None
        try:
            return json.loads(text[min(cuts) :])
        except json.JSONDecodeError:
            return None


def github_slug() -> str:
    result = run_argv(["git", "-C", str(ECC_ROOT), "remote", "get-url", "origin"], timeout=10)
    url = (result["stdout"] or "").strip()
    match = re.search(r"github\.com[:/]([^/]+)/([^/.]+)(?:\.git)?$", url)
    if match:
        return f"{match.group(1)}/{match.group(2)}"
    return "cruldra/ECC"


def _cmp_version(left: str, right: str) -> int:
    def parts(value: str) -> list[int]:
        nums = re.findall(r"\d+", value)
        return [int(n) for n in nums] or [0]

    a, b = parts(left), parts(right)
    size = max(len(a), len(b))
    a += [0] * (size - len(a))
    b += [0] * (size - len(b))
    return (a > b) - (a < b)


def latest_version() -> str:
    return (ECC_ROOT / "VERSION").read_text(encoding="utf-8").strip()


def _state(installed: bool, version: str, latest: str) -> str:
    if not installed:
        return "missing"
    if version and _cmp_version(latest, version) > 0:
        return "update"
    return "installed"


def claude_status(latest: str) -> dict:
    listed = run_argv(["claude", "plugin", "list", "--json"], timeout=30)
    payload = _parse_json(listed["stdout"]) if listed["ok"] else None
    rows = payload if isinstance(payload, list) else []
    entry = next((row for row in rows if isinstance(row, dict) and row.get("id") == PLUGIN_ID), None)
    version = (entry or {}).get("version") or ""
    installed = bool(entry)
    return {
        "key": "claude",
        "label": "Claude Code",
        "hint": "claude plugin install ecc@ecc",
        "available": listed["code"] != 127,
        "installed": installed,
        "enabled": bool((entry or {}).get("enabled", installed)),
        "version": version,
        "scope": (entry or {}).get("scope") or "",
        "state": _state(installed, version, latest),
        "error": "" if listed["ok"] or listed["code"] == 127 else (listed["stderr"] or listed["stdout"]),
    }


def codex_status(latest: str) -> dict:
    listed = run_argv(["codex", "plugin", "list", "--json"], timeout=30)
    payload = _parse_json(listed["stdout"]) if listed["ok"] else None
    rows = []
    if isinstance(payload, dict):
        rows = payload.get("installed") or []
    elif isinstance(payload, list):
        rows = payload
    entry = None
    for row in rows:
        if not isinstance(row, dict):
            continue
        plugin_id = row.get("pluginId") or row.get("id") or ""
        name = row.get("name") or ""
        if plugin_id == PLUGIN_ID or name == "ecc":
            entry = row
            break
    version = (entry or {}).get("version") or ""
    installed = bool(entry)
    return {
        "key": "codex",
        "label": "Codex",
        "hint": "codex plugin add ecc@ecc",
        "available": listed["code"] != 127,
        "installed": installed,
        "enabled": bool((entry or {}).get("enabled", installed)),
        "version": version,
        "scope": "",
        "state": _state(installed, version, latest),
        "error": "" if listed["ok"] or listed["code"] == 127 else (listed["stderr"] or listed["stdout"]),
    }


def load_status() -> dict:
    latest = latest_version()
    return {"latest": latest, "claude": claude_status(latest), "codex": codex_status(latest)}


def _ensure_claude_marketplace(slug: str) -> dict:
    listed = run_argv(["claude", "plugin", "marketplace", "list", "--json"], timeout=30)
    payload = _parse_json(listed["stdout"])
    names: list[str] = []
    if isinstance(payload, dict):
        names = [row.get("name") for row in (payload.get("marketplaces") or []) if isinstance(row, dict)]
        if not names:
            names = [str(key) for key in payload.keys()]
    elif isinstance(payload, list):
        names = [row.get("name") for row in payload if isinstance(row, dict)]
    if "ecc" in names:
        return {"ok": True, "stdout": "", "stderr": "", "code": 0}
    return run_argv(["claude", "plugin", "marketplace", "add", slug, "--scope", "user"])


def _ensure_codex_marketplace(slug: str) -> dict:
    listed = run_argv(["codex", "plugin", "marketplace", "list", "--json"], timeout=30)
    payload = _parse_json(listed["stdout"])
    names = []
    if isinstance(payload, dict):
        names = [row.get("name") for row in (payload.get("marketplaces") or []) if isinstance(row, dict)]
    if "ecc" in names:
        upgraded = run_argv(["codex", "plugin", "marketplace", "upgrade", "ecc", "--json"], timeout=120)
        if upgraded["ok"]:
            return upgraded
        return {"ok": True, "stdout": upgraded["stdout"], "stderr": upgraded["stderr"], "code": 0}
    return run_argv(["codex", "plugin", "marketplace", "add", slug], timeout=180)


def mutate(harness: str, action: str) -> dict:
    if harness not in {"claude", "codex"}:
        return {"ok": False, "stderr": "未知 harness"}
    if action not in {"install", "uninstall", "update"}:
        return {"ok": False, "stderr": "未知操作"}
    slug = github_slug()
    logs: list[dict] = []
    if harness == "claude":
        if action == "uninstall":
            logs.append(run_argv(["claude", "plugin", "uninstall", PLUGIN_ID, "-s", "user", "-y"]))
        else:
            logs.append(_ensure_claude_marketplace(slug))
            if action == "install":
                logs.append(run_argv(["claude", "plugin", "install", PLUGIN_ID, "-s", "user", "-y"], timeout=180))
            else:
                logs.append(run_argv(["claude", "plugin", "marketplace", "update", "ecc"], timeout=180))
                logs.append(run_argv(["claude", "plugin", "update", PLUGIN_ID, "-s", "user", "-y"], timeout=180))
    else:
        if action == "uninstall":
            logs.append(run_argv(["codex", "plugin", "remove", PLUGIN_ID]))
        else:
            logs.append(_ensure_codex_marketplace(slug))
            logs.append(run_argv(["codex", "plugin", "add", PLUGIN_ID, "--json"], timeout=180))
    ok = all(item.get("ok") for item in logs)
    return {
        "ok": ok,
        "logs": logs,
        "status": load_status(),
        "stderr": "\n".join(item.get("stderr") or "" for item in logs if not item.get("ok")).strip(),
    }
