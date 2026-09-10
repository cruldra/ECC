from __future__ import annotations

import json
import re
from pathlib import Path

from .catalog import ECC_ROOT, load_catalog
from .harness import latest_version, run_argv

PLUGIN_NAME = "ecc"
PLUGIN_PREFIX = f"plugin:{PLUGIN_NAME}:"
CLAUDE_JSON = Path.home() / ".claude.json"
SETTINGS_JSON = Path.home() / ".claude" / "settings.json"
CACHE_ROOT = Path.home() / ".claude" / "plugins" / "cache" / "ecc" / "ecc"

DEFAULT_SPECS = {
    "context7": {"command": "npx", "args": ["-y", "@upstash/context7-mcp"]},
    "firecrawl": {"command": "npx", "args": ["-y", "firecrawl-mcp@latest"]},
    "searxng": {"command": "npx", "args": ["-y", "mcp-searxng"]},
}

RUNTIME_LABELS = {
    "connected": "正常运行",
    "failed": "连不上",
    "disabled": "已禁用",
    "pending": "待批准",
    "missing": "未随插件",
    "unknown": "未进会话",
}


def plugin_server_name(server_id: str) -> str:
    return f"{PLUGIN_PREFIX}{server_id}"


def parse_mcp_list(text: str) -> dict[str, dict]:
    rows: dict[str, dict] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if " - " not in line or ": " not in line:
            continue
        left, status_raw = line.rsplit(" - ", 1)
        name, command = left.split(": ", 1)
        name = name.strip()
        if not name:
            continue
        rows[name] = {
            "name": name,
            "command": command.strip(),
            "status_raw": status_raw.strip(),
            "runtime": classify_status(status_raw),
        }
    return rows


def classify_status(status_raw: str) -> str:
    text = status_raw.lower()
    if "connected" in text or "✔" in status_raw:
        return "connected"
    if "pending" in text:
        return "pending"
    if "disabled" in text:
        return "disabled"
    if any(token in text for token in ("fail", "error", "timeout", "hang")):
        return "failed"
    if "✘" in status_raw or "✗" in status_raw:
        return "failed"
    return "unknown"


def _load_json(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def _project_entry(data: dict) -> dict:
    projects = data.setdefault("projects", {})
    if not isinstance(projects, dict):
        projects = {}
        data["projects"] = projects
    key = str(ECC_ROOT)
    entry = projects.get(key)
    if not isinstance(entry, dict):
        entry = {}
        projects[key] = entry
    return entry


def _as_str_list(value) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if isinstance(item, str)]


def disabled_names() -> set[str]:
    names: set[str] = set()
    settings = _load_json(SETTINGS_JSON)
    names.update(_as_str_list(settings.get("disabledMcpServers")))
    claude = _load_json(CLAUDE_JSON)
    names.update(_as_str_list(claude.get("disabledMcpServers")))
    names.update(_as_str_list(_project_entry(claude).get("disabledMcpServers")))
    return names


def server_disabled(server_id: str) -> bool:
    names = disabled_names()
    return server_id in names or plugin_server_name(server_id) in names


def _toggle_list(values: list[str], name: str, disabled: bool) -> list[str]:
    seen: list[str] = []
    for item in values:
        if item == name:
            continue
        if item not in seen:
            seen.append(item)
    if disabled and name not in seen:
        seen.append(name)
    return seen


def set_disabled(server_id: str, disabled: bool) -> None:
    aliases = [plugin_server_name(server_id), server_id]
    settings = _load_json(SETTINGS_JSON)
    current = _as_str_list(settings.get("disabledMcpServers"))
    for alias in aliases:
        current = _toggle_list(current, alias, disabled)
    if current:
        settings["disabledMcpServers"] = current
    else:
        settings.pop("disabledMcpServers", None)
    _save_json(SETTINGS_JSON, settings)

    claude = _load_json(CLAUDE_JSON)
    top = _as_str_list(claude.get("disabledMcpServers"))
    for alias in aliases:
        top = _toggle_list(top, alias, disabled)
    if top:
        claude["disabledMcpServers"] = top
    else:
        claude.pop("disabledMcpServers", None)
    entry = _project_entry(claude)
    project = _as_str_list(entry.get("disabledMcpServers"))
    for alias in aliases:
        project = _toggle_list(project, alias, disabled)
    if project:
        entry["disabledMcpServers"] = project
    else:
        entry.pop("disabledMcpServers", None)
    _save_json(CLAUDE_JSON, claude)


def _read_mcp_file(path: Path) -> dict:
    payload = _load_json(path)
    servers = payload.get("mcpServers")
    return servers if isinstance(servers, dict) else {}


def _write_mcp_file(path: Path, servers: dict) -> None:
    _save_json(path, {"mcpServers": servers})


def _plugin_mcp_files() -> list[Path]:
    files = [ECC_ROOT / ".mcp.json"]
    cache = CACHE_ROOT / latest_version() / ".mcp.json"
    source = files[0].resolve()
    if cache.is_file() and cache.resolve() != source:
        files.append(cache)
    return files


def bundled_ids() -> list[str]:
    servers = _read_mcp_file(ECC_ROOT / ".mcp.json")
    return sorted(str(name) for name in servers)


def ensure_bundled(server_id: str) -> None:
    spec = DEFAULT_SPECS.get(server_id)
    if spec is None:
        raise ValueError("只能安装插件默认的那几个")
    for path in _plugin_mcp_files():
        servers = _read_mcp_file(path)
        servers[server_id] = dict(spec)
        _write_mcp_file(path, servers)


def drop_bundled(server_id: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", server_id):
        raise ValueError("非法 MCP 名")
    for path in _plugin_mcp_files():
        servers = _read_mcp_file(path)
        servers.pop(server_id, None)
        _write_mcp_file(path, servers)


def live_rows() -> dict[str, dict]:
    listed = run_argv(["claude", "mcp", "list"], timeout=45)
    parsed = parse_mcp_list(listed.get("stdout") or "")
    parsed.update(parse_mcp_list(listed.get("stderr") or ""))
    return {
        "ok": bool(listed.get("ok") or parsed),
        "rows": parsed,
        "stderr": listed.get("stderr") or "",
    }


def annotate(mcps: list[dict], rows: dict[str, dict] | None = None, bundled: set[str] | None = None) -> list[dict]:
    live = rows if rows is not None else {}
    shipped_ids = bundled if bundled is not None else set(bundled_ids())
    annotated: list[dict] = []
    for item in mcps:
        server_id = item["id"]
        plugin_name = plugin_server_name(server_id)
        shipped = server_id in shipped_ids
        disabled = server_disabled(server_id)
        hit = live.get(plugin_name) or live.get(server_id) or {}
        if not shipped:
            runtime = "missing"
        elif disabled:
            runtime = "disabled"
        else:
            runtime = hit.get("runtime") or "unknown"
        error = hit.get("status_raw") or "" if runtime == "failed" else ""
        annotated.append(
            {
                **item,
                "shipped": shipped,
                "disabled": disabled,
                "runtime": runtime,
                "runtime_label": RUNTIME_LABELS.get(runtime, RUNTIME_LABELS["unknown"]),
                "status_raw": hit.get("status_raw") or "",
                "error": error,
            }
        )
    return annotated


def snapshot() -> dict:
    catalog = load_catalog()
    live = live_rows()
    bundled = set(bundled_ids())
    mcps = annotate(catalog.get("mcps") or [], live.get("rows") or {}, bundled)
    present = {item["id"] for item in mcps}
    for server_id, spec in DEFAULT_SPECS.items():
        if server_id in present:
            continue
        args = spec.get("args") or []
        launch = " ".join([str(spec.get("command") or ""), *[str(part) for part in args]]).strip()
        mcps.extend(
            annotate(
                [{"id": server_id, "kind": "mcp", "module": "stdio", "blurb": launch, "path": ".mcp.json"}],
                live.get("rows") or {},
                bundled,
            )
        )
    mcps.sort(key=lambda item: str(item.get("id") or ""))
    return {
        "ok": live.get("ok", True),
        "mcps": mcps,
        "counts": {**(catalog.get("counts") or {}), "mcp": len(mcps)},
        "stderr": live.get("stderr") or "",
    }


def mutate(server_id: str, action: str) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", server_id):
        raise ValueError("非法 MCP 名")
    if action not in {"install", "uninstall", "disable"}:
        raise ValueError("未知操作")
    if action == "disable":
        if server_id not in bundled_ids():
            raise ValueError("插件没带这个")
        set_disabled(server_id, True)
    elif action == "install":
        ensure_bundled(server_id)
        set_disabled(server_id, False)
    else:
        drop_bundled(server_id)
        set_disabled(server_id, True)
    return snapshot()
