---
description: 使用内置的 bugsink-cli 分析 Bugsink 链接背后的错误。绝不打开浏览器。
argument-hint: "<bugsink url> [问题数量]"
locale: zh-CN
source_hash: 1caef4746500b23fac09e7e84cc218ed4d366671e7cd53f70a2e58feede9a654
translated_at: 2026-10-31T06:04:28Z
model: glm-5.3-flash
---

# Bugsink 命令

`bugsink` 技能的轻量入口。请遵循该技能的指引。

**输入**：`$ARGUMENTS`

第一个 token 是 Bugsink URL。可选的第二个 token 用于限制要深入排查的 issue 数量（默认 3–5 个）。

如果输入为空，请向用户索取链接。如果缺少 `bugsink-cli`，请先从 `${CLAUDE_PLUGIN_ROOT}/skills/bugsink/bugsink-cli` 构建它。