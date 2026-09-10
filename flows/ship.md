---
name: ship
description: 审查过后提交并开 PR。
module: core
---

# 交付

计划落地、测试绿、审查过，再交出去。

```mermaid
flowchart LR
  review["/code-review"] --> commit["/prp-commit 或 git"]
  commit --> pr["/pr 开 PR"]
```

`/pr` 会看 `.claude/specs/` 和 `.claude/plans/`，有就写进 PR 说明。
