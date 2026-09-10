# ECC 插件控制台

浏览器里看 skill / hook / command / MCP，并把整份 `ecc@ecc` 装到 Claude Code 或 Codex。
MCP 只列插件自己的 `.mcp.json`，不管别人的。
也能打开现有 skill 的原版编辑器，并把阅读用简体中文译本写到 `skills/<id>/i18n/zh-CN.md`。

```sh
uv run --package ecc-plugin-console ecc-plugin-console
```

打开 http://127.0.0.1:8765

只绑本机。安装 / 卸载 / 更新会跑本机 `claude plugin` / `codex plugin`。

## 技能编辑器

- 只改已有 skill，不新建。
- 正文用 Vditor 所见即所得；YAML 头折在详情里。译本只渲染，不给源码。
- 保存只写 `skills/<id>/SKILL.md`。安装永远对着原版。
- 译本只读。语言：English / 简体中文。
- 原版 SHA-256 对不上 `source_hash` 时，界面标「译本过时」，可重新翻译。

命令行同等入口：

```sh
python3 skills/translate-skill/scripts/translate_skill.py --skill grilling --locale zh-CN
```
