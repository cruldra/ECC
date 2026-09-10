# ECC 插件控制台

浏览器里看 skill / hook / command / MCP / 工作流，并把整份 `ecc@ecc` 装到 Claude Code 或 Codex。
工作流来自仓库 `flows/*.md`，正文是 markdown，图用 mermaid。只预览装上插件会带哪些链。
MCP 只列插件自己的 `.mcp.json`，不管别人的。每条能看当前连没连上，并能安装 / 卸载 / 禁用。禁用只停这台机器；卸载从插件拿走。新会话才生效。
也能打开现有 skill 的原版编辑器，并把阅读用简体中文译本写到 `skills/<id>/i18n/zh-CN.md`。

```sh
uv run --package ecc-plugin-console ecc-plugin-console
```

打开 http://127.0.0.1:8765

只绑本机。安装 / 卸载 / 更新会跑本机 `claude plugin` / `codex plugin`。

## 编辑器（skill 与 command）

- 只改已有 skill / command，不新建。
- 原文落 `skills/<id>/SKILL.md` 或 `commands/<id>.md`；译本落 `skills/<id>/i18n/zh-CN.md` 或 `docs/zh-CN/commands/<id>.md`。
- command 的译本不能放 `commands/` 下——那目录会被 harness 扫，子目录会注册成假命令。
- 正文用 Vditor 所见即所得；YAML 头折在详情里。译本只渲染，不给源码。
- 保存只写原文那一份。安装永远对着原文。
- 译本只读。语言：English / 简体中文。
- 原文 SHA-256 对不上译本里的 `source_hash` 时，界面标「译本过时」，可重新翻译。

命令行同等入口：

```sh
python3 skills/translate-skill/scripts/translate_skill.py --skill grilling --locale zh-CN
python3 skills/translate-skill/scripts/translate_skill.py --command plan --locale zh-CN
```
