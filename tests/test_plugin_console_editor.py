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

    status = module.status_payload(root / "skills" / "demo", "zh-CN")
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
