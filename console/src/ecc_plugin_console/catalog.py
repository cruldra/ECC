from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ECC_ROOT = Path(__file__).resolve().parents[3]


def _frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    data: dict[str, str] = {}
    key: str | None = None
    acc: list[str] = []
    for line in text[3:end].splitlines():
        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if match and not line.startswith(" "):
            if key is not None:
                data[key] = "\n".join(acc).strip().strip("\"'")
            key = match.group(1)
            rest = match.group(2).strip()
            acc = [] if rest in {">", "|", ">-", "|-"} else [rest]
        elif key is not None:
            acc.append(line.strip())
    if key is not None:
        data[key] = "\n".join(acc).strip().strip("\"'")
    return data


def _module_index() -> dict[str, str]:
    manifest = json.loads((ECC_ROOT / "manifests" / "install-modules.json").read_text(encoding="utf-8"))
    index: dict[str, str] = {}
    for module in manifest.get("modules") or []:
        module_id = module.get("id") or ""
        for raw in module.get("paths") or []:
            path = str(raw).replace("\\", "/").rstrip("/")
            index[path] = module_id
            if path.startswith("./"):
                index[path[2:]] = module_id
    return index


def _lookup_module(index: dict[str, str], rel: str) -> str:
    rel = rel.replace("\\", "/")
    if rel in index:
        return index[rel]
    parent = str(Path(rel).parent).replace("\\", "/")
    if parent in index:
        return index[parent]
    top = rel.split("/", 1)[0]
    return index.get(top, "")


def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def _markdown_body(text: str) -> str:
    if not text.startswith("---"):
        return text
    end = text.find("\n---", 3)
    if end < 0:
        return text
    return text[end + 4 :].lstrip("\n")


def source_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _skill_locales(folder: Path, digest: str) -> list[dict]:
    i18n = folder / "i18n"
    if not i18n.is_dir():
        return []
    locales: list[dict] = []
    for file in sorted(i18n.glob("*.md")):
        meta = _frontmatter(_read(file))
        stored = meta.get("source_hash") or ""
        locales.append(
            {
                "locale": file.stem,
                "stale": stored != digest,
                "path": f"skills/{folder.name}/i18n/{file.name}",
            }
        )
    return locales


def load_catalog() -> dict:
    index = _module_index()
    skills: list[dict] = []
    skills_dir = ECC_ROOT / "skills"
    if skills_dir.is_dir():
        for folder in sorted(p for p in skills_dir.iterdir() if p.is_dir()):
            skill_md = folder / "SKILL.md"
            if not skill_md.is_file():
                continue
            original = _read(skill_md)
            meta = _frontmatter(original)
            digest = source_hash(original)
            rel = f"skills/{folder.name}"
            skills.append(
                {
                    "id": folder.name,
                    "kind": "skill",
                    "module": _lookup_module(index, rel),
                    "blurb": (meta.get("description") or "").split("\n", 1)[0],
                    "path": rel + "/SKILL.md",
                    "hash": digest,
                    "locales": _skill_locales(folder, digest),
                }
            )

    commands: list[dict] = []
    commands_dir = ECC_ROOT / "commands"
    if commands_dir.is_dir():
        for file in sorted(commands_dir.glob("*.md")):
            meta = _frontmatter(_read(file))
            stem = file.stem
            commands.append(
                {
                    "id": stem,
                    "kind": "command",
                    "module": _lookup_module(index, f"commands/{file.name}") or "commands-core",
                    "blurb": (meta.get("description") or "").split("\n", 1)[0],
                    "path": f"commands/{file.name}",
                }
            )

    hooks: list[dict] = []
    hooks_file = ECC_ROOT / "hooks" / "hooks.json"
    if hooks_file.is_file():
        payload = json.loads(_read(hooks_file) or "{}")
        events = payload.get("hooks") or {}
        for event, groups in events.items():
            if not isinstance(groups, list):
                continue
            for group in groups:
                if not isinstance(group, dict):
                    continue
                hook_id = group.get("id") or event
                hooks.append(
                    {
                        "id": hook_id,
                        "kind": "hook",
                        "module": "hooks-runtime",
                        "blurb": (group.get("description") or event).split("\n", 1)[0],
                        "path": f"hooks/hooks.json · {event}",
                        "event": event,
                    }
                )

    mcps: list[dict] = []
    bundled = json.loads(_read(ECC_ROOT / ".mcp.json") or "{}")
    servers = bundled.get("mcpServers") or {}
    if isinstance(servers, dict):
        for name in sorted(servers):
            spec = servers.get(name)
            if not isinstance(spec, dict):
                continue
            http = bool(spec.get("url") or spec.get("type") == "http")
            launch = str(spec.get("url") or "")
            if not launch:
                cmd = spec.get("command") or ""
                args = spec.get("args") or []
                launch = " ".join([str(cmd), *[str(a) for a in args]]).strip() if isinstance(args, list) else str(cmd)
            mcps.append(
                {
                    "id": name,
                    "kind": "mcp",
                    "module": "http" if http else "stdio",
                    "blurb": launch,
                    "path": ".mcp.json",
                }
            )

    workflows: list[dict] = []
    flows_dir = ECC_ROOT / "flows"
    if flows_dir.is_dir():
        for file in sorted(flows_dir.glob("*.md")):
            if file.name.lower() == "readme.md":
                continue
            original = _read(file)
            meta = _frontmatter(original)
            workflows.append(
                {
                    "id": file.stem,
                    "kind": "workflow",
                    "module": meta.get("module") or "core",
                    "blurb": (meta.get("description") or meta.get("name") or "").split("\n", 1)[0],
                    "path": f"flows/{file.name}",
                    "markdown": _markdown_body(original),
                }
            )

    latest = (ECC_ROOT / "VERSION").read_text(encoding="utf-8").strip()
    return {
        "latest": latest,
        "skills": skills,
        "hooks": hooks,
        "commands": commands,
        "mcps": mcps,
        "workflows": workflows,
        "counts": {
            "skill": len(skills),
            "hook": len(hooks),
            "command": len(commands),
            "mcp": len(mcps),
            "workflow": len(workflows),
        },
    }
