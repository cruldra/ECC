from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "console" / "src"))

from ecc_plugin_console import catalog, mcpctl  # noqa: E402

LIST_SAMPLE = """
Checking MCP server health…

plugin:ecc:context7: npx -y @upstash/context7-mcp - ✔ Connected
plugin:ecc:firecrawl: npx -y firecrawl-mcp@latest - socket hang up
plugin:ecc:searxng: npx -y mcp-searxng - Network Error: fetch failed
context7: npx -y @upstash/context7-mcp - ⏸ Pending approval (run `claude` to approve)
"""


@pytest.fixture
def isolated(tmp_path, monkeypatch):
    root = tmp_path / "ecc"
    root.mkdir()
    (root / "VERSION").write_text("0.0.0\n", encoding="utf-8")
    (root / "manifests").mkdir()
    (root / "manifests" / "install-modules.json").write_text(json.dumps({"modules": []}), encoding="utf-8")
    (root / ".mcp.json").write_text(
        json.dumps(
            {
                "mcpServers": {
                    "context7": {"command": "npx", "args": ["-y", "@upstash/context7-mcp"]},
                    "searxng": {"command": "npx", "args": ["-y", "mcp-searxng"]},
                }
            }
        ),
        encoding="utf-8",
    )
    claude_json = tmp_path / "claude.json"
    settings_json = tmp_path / "settings.json"
    claude_json.write_text("{}\n", encoding="utf-8")
    settings_json.write_text("{}\n", encoding="utf-8")
    monkeypatch.setattr(catalog, "ECC_ROOT", root)
    monkeypatch.setattr(mcpctl, "ECC_ROOT", root)
    monkeypatch.setattr(mcpctl, "CLAUDE_JSON", claude_json)
    monkeypatch.setattr(mcpctl, "SETTINGS_JSON", settings_json)
    monkeypatch.setattr(mcpctl, "CACHE_ROOT", tmp_path / "cache")
    monkeypatch.setattr(
        mcpctl,
        "live_rows",
        lambda: {"ok": True, "rows": mcpctl.parse_mcp_list(LIST_SAMPLE), "stderr": ""},
    )
    return root, claude_json, settings_json


def test_parse_mcp_list_runtime():
    rows = mcpctl.parse_mcp_list(LIST_SAMPLE)
    assert rows["plugin:ecc:context7"]["runtime"] == "connected"
    assert rows["plugin:ecc:firecrawl"]["runtime"] == "failed"
    assert rows["plugin:ecc:searxng"]["runtime"] == "failed"
    assert rows["context7"]["runtime"] == "pending"


def test_snapshot_marks_connected_and_missing_default(isolated):
    payload = mcpctl.snapshot()
    by_id = {item["id"]: item for item in payload["mcps"]}
    assert by_id["context7"]["runtime"] == "connected"
    assert by_id["context7"]["runtime_label"] == "正常运行"
    assert by_id["searxng"]["runtime"] == "failed"
    assert by_id["searxng"]["runtime_label"] == "连不上"
    assert by_id["firecrawl"]["runtime"] == "missing"
    assert by_id["firecrawl"]["shipped"] is False


def test_disable_writes_local_lists(isolated):
    root, claude_json, settings_json = isolated
    mcpctl.set_disabled("searxng", True)
    settings = json.loads(settings_json.read_text(encoding="utf-8"))
    claude = json.loads(claude_json.read_text(encoding="utf-8"))
    assert "plugin:ecc:searxng" in settings["disabledMcpServers"]
    assert "searxng" in settings["disabledMcpServers"]
    project = claude["projects"][str(root)]
    assert "plugin:ecc:searxng" in project["disabledMcpServers"]
    payload = mcpctl.snapshot()
    searxng = next(item for item in payload["mcps"] if item["id"] == "searxng")
    assert searxng["runtime"] == "disabled"
    assert searxng["runtime_label"] == "已禁用"


def test_install_puts_default_back(isolated):
    root, _, _ = isolated
    mcpctl.mutate("firecrawl", "install")
    bundled = json.loads((root / ".mcp.json").read_text(encoding="utf-8"))["mcpServers"]
    assert "firecrawl" in bundled
    payload = mcpctl.snapshot()
    firecrawl = next(item for item in payload["mcps"] if item["id"] == "firecrawl")
    assert firecrawl["shipped"] is True
    assert firecrawl["disabled"] is False


def test_uninstall_drops_from_plugin_file(isolated):
    root, _, settings_json = isolated
    mcpctl.mutate("context7", "uninstall")
    bundled = json.loads((root / ".mcp.json").read_text(encoding="utf-8"))["mcpServers"]
    assert "context7" not in bundled
    settings = json.loads(settings_json.read_text(encoding="utf-8"))
    assert "plugin:ecc:context7" in settings["disabledMcpServers"]
    payload = mcpctl.snapshot()
    context7 = next(item for item in payload["mcps"] if item["id"] == "context7")
    assert context7["runtime"] == "missing"


def test_rejects_unknown_install():
    with pytest.raises(ValueError, match="默认"):
        mcpctl.ensure_bundled("github")
