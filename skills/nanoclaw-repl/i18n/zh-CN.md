---
name: nanoclaw-repl
description: 操作和扩展 NanoClaw v2——ECC 构建于 claude -p 之上的零依赖、会话感知 REPL。在操作或扩展 NanoClaw REPL 时使用。
metadata:
  origin: ECC
locale: zh-CN
source_hash: 459d8467dbd6fb475d49f75124c2c92fb2120cfde3418312b77c575ad723d649
translated_at: 2026-09-09T03:36:00Z
model: z-ai/glm-5.3-flash
---

# NanoClaw REPL

在运行或扩展 `scripts/claw.js` 时使用此技能。

## 功能特性

- 基于 markdown 的持久化会话
- 使用 `/model` 切换模型
- 使用 `/load` 动态加载技能
- 使用 `/branch` 创建会话分支
- 使用 `/search` 进行跨会话搜索
- 使用 `/compact` 压缩历史记录
- 使用 `/export` 导出为 md/json/txt
- 使用 `/metrics` 查看会话指标

## 操作指南

1. 保持会话聚焦于单一任务。
2. 在高风险变更之前先创建分支。
3. 在重大里程碑之后执行压缩。
4. 在共享或归档之前先导出。

## 扩展规则

- 保持零外部运行时依赖
- 保持 markdown 即数据库（markdown-as-database）的兼容性
- 保持命令处理器具备确定性和本地化执行