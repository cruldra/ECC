---
name: spec
description: Write a design spec after grilling has settled the idea. Use when the user wants a spec, 规格, or says /spec. Do not use when the idea is still open — run grilling first. Do not write implementation plans or code.
---

# Spec

Write the design spec. Stop before the implementation plan.

Chain: `grilling` → **spec** → `writing-plans` → `tdd-workflow` → `/code-review`

**Announce at start:** using spec to write the design.

## Gate

No confirmed grilling consensus this session → follow `grilling` and stop.

Consensus exists → do not re-ask settled decisions.

## Drop path

`.claude/specs/<stem>.md`

`<stem>` is a short kebab of the **feature** (what it does). The matching plan is `.claude/plans/<stem>.md`. Never put `spec` or `plan` in the stem — the folder already says that. Bad: `console-artifacts.plan.md`. Good: `console-artifacts.md` in `plans/`.

Bad: `console-spec-plan.md`. Good: `console-artifacts.md`.

Create `.claude/specs/` if needed. Do not commit this file unless the user asks. Stay in `.claude/`, not `docs/`.

## What to write

Explore the repo first. Then one spec. YAGNI.

**Language:** the written file uses the user's language for the title, meta labels, and every heading. Copying English headings from this skill (`Problem`, `Goals`, `Architecture`) when the user writes 中文 is a bug.

中文用户用下面这份。英文用户把标题译成 Problem / Goals and non-goals / Decisions / Architecture / Data and interfaces / Error handling / Testing / Open questions，元信息用 Date / Status / Source。

```markdown
# <题目>

- 日期：YYYY-MM-DD
- 状态：草稿
- 来源：本轮对齐

## 问题

谁有什么痛。现在代码怎么做。放着不管的代价。

## 目标与非目标

**目标**
- 能看见的结果

**非目标**
- 这次不做，以及为什么

## 决策

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| 1 | | | |

## 架构

块怎么拼。运行路径可以画一小棵树。不要在这里列要改哪些文件，那是计划的事。

## 数据与接口

表、类型、载荷。名字写死。

## 出错时

失败形态，调用方看见什么。

## 测试

主路径失败测试长什么样。不要写任务清单。

## 未决问题

进 `/plan` 前必须空。跟用户拍板，或者划出范围。
```


No TBD, TODO, or "handle later". If unknown, decide or cut.

## Self-review

Placeholders, contradictions, one-plan scope, ambiguity. Fix inline.

Then:

> Spec written to `<path>`. Read it. Say what to change, or say it is good. Next is `/plan <path>`.

Wait. Set 状态 to 已通过 only after they say so. Next skill is only `writing-plans`.
