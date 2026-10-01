---
name: grilling
description: >
  Front door for requirements, plans, decisions, product ideas, brainstorming,
  and design discussion. Interview the user in rounds, asking every open
  frontier question at once, until shared understanding exists. Use when the
  user discusses requirements, 需求讨论, 头脑风暴, 设计讨论, a plan, a
  decision, or an idea that is not yet settled, or says grill / grilling / 拷问.
  Do not use after consensus exists, for implementation, code review, debugging,
  or when the user explicitly asks to write a spec or an implementation plan.
metadata:
  origin: community
---

# Grilling

Interview until shared understanding. Then stop. Do not implement. Do not write a spec or plan until the user confirms the understanding.

This skill is **step 1** of the development chain:

**grilling** → `spec` → `writing-plans` → `tdd-workflow` → `/code-review`

After consensus, the next step is `spec` / `/spec` unless the user names something else.

## When to Use

- Requirements, 需求, 头脑风暴, 设计讨论, a plan, a decision, or an idea is still open
- User wants the idea stress-tested before anything is written
- `/spec`, `/plan`, or feature work would otherwise invent missing decisions

## When NOT to Use

- Shared understanding already confirmed this session
- User explicitly invoked a downstream skill or command
- Trivial edits, debugging, code review, or "just do it"

## Method

Map the work as a **design tree**. Every decision branches into the decisions that hang off it.

The **frontier** is every decision whose prerequisites are already settled: questions you can ask *now* without guessing at answers you have not heard.

Work in **rounds**. Each round, ask the whole frontier in a single `AskUserQuestion` call, up to 4 questions. If the frontier holds more than 4, ask the 4 whose answers unblock the most downstream decisions; the rest wait for the next round. A question that depends on another question still open in this round belongs to a later round.

After the user answers, recompute the frontier and start the next round.

Never list questions in the chat body. Questions live in `AskUserQuestion` only.

Finding **facts** is your job, never the user's. If a frontier question needs the filesystem, git, docs, or tools, look it up. Do not block the round on that lookup: only questions downstream of the missing fact wait for a later round.

**Decisions** belong to the user. Put each one to them and wait.

The session of grilling is done when the frontier is empty: every branch visited, nothing silently assumed. Restate the understanding. Wait for the user to confirm. Do not act on it until they confirm.

## AskUserQuestion

One call per round, 1–4 questions in it.

- Each question stands alone: answerable without the other answers in the same round
- 2–4 options, mutually exclusive unless the question is truly multi-select
- Recommended option first, marked in the label
- Each option: one line on what happens if chosen
- Header ≤ 12 characters

If the user types a custom answer to any question, that is the decision. Do not force them back onto the option list.

## After confirmation

Name the settled decisions in a short list. Next is `spec` unless they say otherwise. Do not start coding. Do not start a second interview inside `spec` or `writing-plans`.
