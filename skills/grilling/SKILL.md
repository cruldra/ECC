---
name: grilling
description: >
  Front door for requirements, plans, decisions, product ideas, brainstorming,
  and design discussion. Interview the user one question at a time until shared
  understanding exists. Use when the user discusses requirements, 需求讨论,
  头脑风暴, 设计讨论, a plan, a decision, or an idea that is not yet settled,
  or says grill / grilling / 拷问.
  Do not use after consensus exists, for implementation, code review, debugging,
  or when the user explicitly asks to write a PRD, acceptance criteria, or an
  implementation plan.
metadata:
  origin: community
---

# Grilling

Interview until shared understanding. Then stop. Do not implement. Do not write a PRD, acceptance criteria, or an implementation plan until the user confirms the understanding and names the next step.

This skill is the **front door**. Downstream skills write artifacts:

| After consensus, user wants | Use |
| --- | --- |
| Product brief / why-build diagnosis | `product-lens` |
| PRD document | `/plan-prd` or `/prp-prd` |
| Capability contract / constraints | `product-capability` |
| Observable acceptance criteria | `intent-driven-development` |
| Implementation steps | `/plan` |
| Adversarial go/no-go among remaining paths | `council` |

## When to Use

- Requirements, 需求, 头脑风暴, 设计讨论, a plan, a decision, or an idea is still open
- User wants the idea stress-tested before anything is written
- `/plan`, `/plan-prd`, or feature work would otherwise invent missing decisions

## When NOT to Use

- Shared understanding already confirmed this session
- User explicitly invoked a downstream skill or command
- Trivial edits, debugging, code review, or "just do it"

## Method

Map the work as a **design tree**. Every decision branches into the decisions that hang off it.

The **frontier** is every decision whose prerequisites are already settled: questions you can ask *now* without guessing at answers you have not heard.

Ask **one** frontier question per turn with `AskUserQuestion`. After the user answers, recompute the frontier. A question that depends on another still-open question belongs to a later turn.

Never list multiple questions in the chat body. The question lives in `AskUserQuestion` only.

Finding **facts** is your job, never the user's. If a frontier question needs the filesystem, git, docs, or tools, look it up. Do not block the rest of the frontier on that lookup: only questions downstream of the missing fact wait.

**Decisions** belong to the user. Put each one to them and wait.

The session of grilling is done when the frontier is empty: every branch visited, nothing silently assumed. Restate the understanding. Wait for the user to confirm. Do not act on it until they confirm.

## AskUserQuestion

Exactly one question per turn.

- 2–4 options, mutually exclusive unless the question is truly multi-select
- Recommended option first, marked in the label
- Each option: one line on what happens if chosen
- Header ≤ 12 characters

If the user types a custom answer, that is the decision. Do not force them back onto the option list.

## After confirmation

Name the settled decisions in a short list. Ask which downstream to run. Do not start coding, and do not start a second interview inside `/plan-prd` / `/prp-prd` / `intent-driven-development`.
