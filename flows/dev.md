---
name: dev
description: 装上插件后的主开发链。对齐需求，再写规格和计划，先测后写，最后审查。
module: core
---

# 开发

装 `ecc@ecc` 后走这一条。不要再开一条 PRD 旁路。

落盘：规格 `.claude/specs/<名字>.md`，计划 `.claude/plans/<名字>.plan.md`。

```mermaid
flowchart LR
  grilling["/grilling 对齐需求"] --> spec["/spec 写规格"]
  spec --> plan["/plan 写计划"]
  plan --> tdd["/tdd 先测后写"]
  tdd --> review["/code-review 审查"]
```

1. **grilling** 一次一问，问到共识。不写文件。
2. **spec** 写设计规格。人点头后再计划。
3. **plan** 按规格拆任务。带「文件结构」目录树（🆕 / ✏️）。每步先写失败测试。
4. **tdd** 按计划红灯再绿灯。
5. **code-review** 审未提交改动或 PR。
