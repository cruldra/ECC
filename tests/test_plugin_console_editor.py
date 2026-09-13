from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "console" / "src"))

from ecc_plugin_console import catalog, editor  # noqa: E402

SCRIPT = ROOT / "skills" / "translate-skill" / "scripts" / "translate_skill.py"


def _load_script():
    spec = importlib.util.spec_from_file_location("translate_skill", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_skill(root: Path, skill_id: str, body: str) -> Path:
    folder = root / "skills" / skill_id
    folder.mkdir(parents=True)
    (folder / "SKILL.md").write_text(body, encoding="utf-8")
    return folder


def _fake_root(tmp_path: Path) -> Path:
    (tmp_path / "VERSION").write_text("0.0.0\n", encoding="utf-8")
    (tmp_path / "manifests").mkdir()
    (tmp_path / "manifests" / "install-modules.json").write_text(
        json.dumps({"modules": [{"id": "demo", "paths": ["skills/demo"]}]}),
        encoding="utf-8",
    )
    _write_skill(
        tmp_path,
        "demo",
        "---\nname: demo\ndescription: Hello skill\n---\n\n# Demo\n\nKeep `grilling`.\n",
    )
    return tmp_path


@pytest.fixture
def isolated_root(tmp_path, monkeypatch):
    root = _fake_root(tmp_path)
    monkeypatch.setattr(catalog, "ECC_ROOT", root)
    monkeypatch.setattr(editor, "ECC_ROOT", root)
    return root


def test_catalog_marks_stale_locale(isolated_root):
    original = (isolated_root / "skills" / "demo" / "SKILL.md").read_text(encoding="utf-8")
    digest = hashlib.sha256(original.encode("utf-8")).hexdigest()
    i18n = isolated_root / "skills" / "demo" / "i18n"
    i18n.mkdir()
    (i18n / "zh-CN.md").write_text(
        "---\nlocale: zh-CN\nsource_hash: deadbeef\n---\n\n演示\n",
        encoding="utf-8",
    )
    payload = catalog.load_catalog()
    skill = next(item for item in payload["skills"] if item["id"] == "demo")
    assert skill["hash"] == digest
    assert skill["locales"][0]["locale"] == "zh-CN"
    assert skill["locales"][0]["stale"] is True


def test_save_original_refreshes_hash(isolated_root):
    updated = "---\nname: demo\ndescription: Hello skill\n---\n\n# Demo\n\nChanged.\n"
    result = editor.save_original("demo", updated)
    assert result["original"] == updated
    assert result["hash"] == hashlib.sha256(updated.encode("utf-8")).hexdigest()
    assert (isolated_root / "skills" / "demo" / "SKILL.md").read_text(encoding="utf-8") == updated


def test_rejects_path_escape():
    with pytest.raises(ValueError, match="非法 skill id"):
        editor.load_skill("../secrets")


def test_translate_rejects_other_locale(isolated_root):
    with pytest.raises(ValueError, match="zh-CN"):
        editor.translate_skill("demo", locale="ja-JP")


def test_script_status_and_skip_without_network(tmp_path, monkeypatch):
    module = _load_script()
    root = _fake_root(tmp_path)
    original = (root / "skills" / "demo" / "SKILL.md").read_text(encoding="utf-8")
    digest = module.sha256_text(original)
    path = root / "skills" / "demo" / "i18n" / "zh-CN.md"
    path.parent.mkdir()
    path.write_text(
        f"---\nlocale: zh-CN\nsource_hash: {digest}\n---\n\n演示\n",
        encoding="utf-8",
    )
    monkeypatch.delenv("ANTHROPIC_BASE_URL", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("GLM53F_PROFILE", str(tmp_path / "missing.json"))

    status = module.status_payload(root, "skill", "demo", "zh-CN")
    assert status["exists"] is True
    assert status["stale"] is False

    skipped = module.translate(root, "demo", "zh-CN", force=False)
    assert skipped["skipped"] is True
    assert skipped["text"].startswith("---")

    with pytest.raises(SystemExit, match="缺少"):
        module.translate(root, "demo", "zh-CN", force=True)


def test_profile_beats_session_env(tmp_path, monkeypatch):
    module = _load_script()
    profile = tmp_path / "glm53f.json"
    profile.write_text(
        json.dumps(
            {
                "env": {
                    "ANTHROPIC_BASE_URL": "https://example.invalid/glm",
                    "ANTHROPIC_AUTH_TOKEN": "profile-token",
                    "ANTHROPIC_MODEL": "z-ai/glm-5.3-flash[1m]",
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("GLM53F_PROFILE", str(profile))
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://example.invalid/grok")
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "session-token")
    monkeypatch.setenv("ANTHROPIC_MODEL", "grok-4.6")
    base, token, model = module.credentials()
    assert base == "https://example.invalid/glm"
    assert token == "profile-token"
    assert model == "z-ai/glm-5.3-flash"


def test_script_rejects_other_locale(tmp_path):
    module = _load_script()
    with pytest.raises(SystemExit, match="zh-CN"):
        module.main(["--root", str(tmp_path), "--skill", "demo", "--locale", "en"])


def test_catalog_mcp_only_from_plugin_file(isolated_root):
    payload = catalog.load_catalog()
    assert payload["mcps"] == []
    assert payload["counts"]["mcp"] == 0
    (isolated_root / "mcp-configs").mkdir()
    (isolated_root / "mcp-configs" / "mcp-servers.json").write_text(
        json.dumps({"mcpServers": {"github": {"command": "npx", "args": ["x"]}}}),
        encoding="utf-8",
    )
    payload = catalog.load_catalog()
    assert payload["mcps"] == []
    (isolated_root / ".mcp.json").write_text(
        json.dumps({"mcpServers": {"chrome-devtools": {"command": "npx", "args": ["-y", "x"]}}}),
        encoding="utf-8",
    )
    payload = catalog.load_catalog()
    assert payload["counts"]["mcp"] == 1
    assert payload["mcps"][0]["id"] == "chrome-devtools"
    assert payload["mcps"][0]["path"] == ".mcp.json"
    assert payload["mcps"][0]["module"] == "stdio"


def test_catalog_workflows_from_markdown(isolated_root):
    payload = catalog.load_catalog()
    assert payload["workflows"] == []
    assert payload["counts"]["workflow"] == 0
    folder = isolated_root / "flows"
    folder.mkdir()
    (folder / "dev.md").write_text(
        "---\nname: dev\ndescription: 主开发链\nmodule: core\n---\n\n# 开发\n\n```mermaid\nflowchart LR\n  a[grilling] --> b[spec]\n```\n",
        encoding="utf-8",
    )
    payload = catalog.load_catalog()
    assert payload["counts"]["workflow"] == 1
    item = payload["workflows"][0]
    assert item["id"] == "dev"
    assert item["path"] == "flows/dev.md"
    assert item["module"] == "core"
    assert "flowchart LR" in item["markdown"]
    assert "---" not in item["markdown"][:10]


def _write_command(root: Path, command_id: str, body: str) -> Path:
    folder = root / "commands"
    folder.mkdir(exist_ok=True)
    path = folder / f"{command_id}.md"
    path.write_text(body, encoding="utf-8")
    return path


def test_catalog_tracks_command_translations(isolated_root):
    _write_command(isolated_root, "demo-cmd", "---\ndescription: Demo command\n---\n\nBody.\n")
    payload = catalog.load_catalog()
    cmd = next(item for item in payload["commands"] if item["id"] == "demo-cmd")
    assert cmd["locales"] == []

    mirror = isolated_root / "docs" / "zh-CN" / "commands" / "demo-cmd.md"
    mirror.parent.mkdir(parents=True)
    mirror.write_text("---\nlocale: zh-CN\nsource_hash: deadbeef\n---\n\n演示\n", encoding="utf-8")
    cmd = next(item for item in catalog.load_catalog()["commands"] if item["id"] == "demo-cmd")
    assert cmd["locales"][0]["locale"] == "zh-CN"
    assert cmd["locales"][0]["stale"] is True

    mirror.write_text(
        f"---\nlocale: zh-CN\nsource_hash: {cmd['hash']}\n---\n\n演示\n", encoding="utf-8"
    )
    cmd = next(item for item in catalog.load_catalog()["commands"] if item["id"] == "demo-cmd")
    assert cmd["locales"][0]["stale"] is False


def test_editor_loads_and_saves_a_command(isolated_root):
    _write_command(isolated_root, "demo-cmd", "---\ndescription: Demo command\n---\n\nBody.\n")
    item = editor.load_item("command", "demo-cmd")
    assert item["kind"] == "command"
    assert item["path"] == "commands/demo-cmd.md"

    updated = "---\ndescription: Demo command\n---\n\nChanged.\n"
    saved = editor.save_item("command", "demo-cmd", updated)
    assert saved["original"] == updated
    assert (isolated_root / "commands" / "demo-cmd.md").read_text(encoding="utf-8") == updated


def test_command_translation_never_lands_under_commands(isolated_root):
    module = _load_script()
    _write_command(isolated_root, "demo-cmd", "---\ndescription: Demo command\n---\n\nBody.\n")
    out = module.output_path(isolated_root, "command", "demo-cmd", "zh-CN")
    assert out == isolated_root / "docs" / "zh-CN" / "commands" / "demo-cmd.md"
    assert (isolated_root / "commands") not in out.parents


def test_editor_rejects_unknown_kind():
    with pytest.raises(ValueError, match="未知类型"):
        editor.load_item("hook", "session-start")


def _write_agent(root: Path, agent_id: str, body: str) -> Path:
    folder = root / "agents"
    folder.mkdir(exist_ok=True)
    path = folder / f"{agent_id}.md"
    path.write_text(body, encoding="utf-8")
    return path


AGENT_MD = "---\nname: demo-agent\ndescription: Reviews demos\ntools: Read, Grep\nmodel: sonnet\n---\n\nBody.\n"


def test_catalog_lists_agents_with_tools_and_docs_locales(isolated_root):
    _write_agent(isolated_root, "demo-agent", AGENT_MD)
    payload = catalog.load_catalog()
    assert payload["counts"]["agent"] == 1
    agent = payload["agents"][0]
    assert agent["id"] == "demo-agent"
    assert agent["path"] == "agents/demo-agent.md"
    assert agent["tools"] == "Read, Grep"
    assert agent["model"] == "sonnet"
    assert agent["blurb"] == "Reviews demos"
    assert agent["locales"] == []

    mirror = isolated_root / "docs" / "zh-CN" / "agents" / "demo-agent.md"
    mirror.parent.mkdir(parents=True)
    mirror.write_text(f"---\nlocale: zh-CN\nsource_hash: {agent['hash']}\n---\n\n演示\n", encoding="utf-8")
    agent = catalog.load_catalog()["agents"][0]
    assert agent["locales"] == [{"locale": "zh-CN", "stale": False, "path": "docs/zh-CN/agents/demo-agent.md"}]


def test_editor_loads_and_saves_an_agent(isolated_root):
    _write_agent(isolated_root, "demo-agent", AGENT_MD)
    item = editor.load_item("agent", "demo-agent")
    assert item["kind"] == "agent"
    assert item["path"] == "agents/demo-agent.md"

    updated = AGENT_MD.replace("Body.", "Changed.")
    saved = editor.save_item("agent", "demo-agent", updated)
    assert saved["original"] == updated
    assert (isolated_root / "agents" / "demo-agent.md").read_text(encoding="utf-8") == updated


def test_agent_translation_lands_in_docs_mirror(isolated_root):
    module = _load_script()
    _write_agent(isolated_root, "demo-agent", AGENT_MD)
    assert module.source_path(isolated_root, "agent", "demo-agent") == isolated_root / "agents" / "demo-agent.md"
    out = module.output_path(isolated_root, "agent", "demo-agent", "zh-CN")
    assert out == isolated_root / "docs" / "zh-CN" / "agents" / "demo-agent.md"
    assert (isolated_root / "agents") not in out.parents
    with pytest.raises(SystemExit, match="路径逃出|非法"):
        module.source_path(isolated_root, "agent", "../secrets", )
