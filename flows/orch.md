---
name: orch
description: 按任务类型走闸门：研究、计划、先测后写、审查、提交。挑一条 orch-* 即可。
module: orch
---

# 编排

按要做的事挑一条命令。它自己跑完阶段，不要另拼一套。

```mermaid
flowchart TD
  pick["挑一条 orch-*"] --> research[研究]
  research --> plan[计划]
  plan --> tdd[先测后写]
  tdd --> review[审查]
  review --> commit[提交]
```

| 命令 | 干什么 |
|------|--------|
| `/orch-fix-defect` | 修缺陷 |
| `/orch-add-feature` | 加功能 |
| `/orch-change-feature` | 改功能 |
| `/orch-build-mvp` | 从零搭 MVP |
| `/orch-refine-code` | 收代码 |

主开发链（grilling → spec → plan → tdd → review）优先。这条给已经能说清任务类型的时候。
