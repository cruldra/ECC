# ECC 插件控制台

浏览器里看 skill / agent / hook / command / MCP / 工作流，并把整份 `ecc@ecc` 装到 Claude Code 或 Codex。
工作流来自仓库 `flows/*.md`，正文是 markdown，图用 mermaid。只预览装上插件会带哪些链。
MCP 只列插件自己的 `.mcp.json`，不管别人的。每条能看当前连没连上，并能安装 / 卸载 / 禁用。禁用只停这台机器；卸载从插件拿走。新会话才生效。
也能打开现有 skill 的原版编辑器，并把阅读用简体中文译本写到 `skills/<id>/i18n/zh-CN.md`。

```sh
uv run --package ecc-plugin-console ecc-plugin-console
```

打开 <http://127.0.0.1:8765>

会话里直接 `/console`：跑 `scripts/console.js`，端口上已经有控制台就只开浏览器，没有才起一个（后台常驻，日志在 `~/.claude/ecc-console.log`）。多个会话共用同一个实例，不会开一堆。端口改 `ECC_CONSOLE_PORT`；跑哪份仓库按 `ECC_ROOT`、当前目录所在的仓库、已装插件的顺序找。

只绑本机。安装 / 卸载 / 更新会跑本机 `claude plugin` / `codex plugin`。

## 编辑器（skill、command 与 agent）

- 只改已有 skill / command / agent，不新建。
- 原文落 `skills/<id>/SKILL.md`、`commands/<id>.md` 或 `agents/<id>.md`；译本落 `skills/<id>/i18n/zh-CN.md`、`docs/zh-CN/commands/<id>.md` 或 `docs/zh-CN/agents/<id>.md`。
- command / agent 的译本不能放 `commands/`、`agents/` 下——那两个目录会被 harness 扫，子目录会注册成假条目。
- agent 详情里显示 YAML 头的 `tools` 和 `model`。
- 正文用 Vditor 所见即所得；YAML 头折在详情里。译本只渲染，不给源码。
- 保存只写原文那一份。安装永远对着原文。
- 译本只读。语言：English / 简体中文。
- 原文 SHA-256 对不上译本里的 `source_hash` 时，界面标「译本过时」，可重新翻译。

## 前端结构

页面状态只放一个 Alpine store（`static/js/store.js`）：当前类型、筛选、选中项、目录、harness 状态、弹框、正在编辑的条目。
各面板是独立的 `Alpine.data` 组件，只读 store、通过 store 的方法改状态，互相不引用：

- `components/harness.js` 顶部 Claude Code / Codex 卡片
- `components/catalog.js` 中间列表与工作流预览
- `components/mcp.js` MCP 徽章、说明、装卸禁用
- `components/editor.js` 全屏编辑器（原文 / 译本 / 保存 / 翻译）
- `lib/api.js` 一个 fetch 封装；`lib/markdown.js` YAML 头拆合与 Vditor 挂载

模板按面板拆在 `templates/partials/`，`index.html` 只做布局。静态文件地址带内容哈希，改完不吃旧缓存。

命令行同等入口：

```sh
python3 skills/translate-skill/scripts/translate_skill.py --skill grilling --locale zh-CN
python3 skills/translate-skill/scripts/translate_skill.py --command plan --locale zh-CN
python3 skills/translate-skill/scripts/translate_skill.py --agent code-reviewer --locale zh-CN
```
