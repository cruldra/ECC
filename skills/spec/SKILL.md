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

`.claude/specs/<kebab-name>.md`

Create `.claude/specs/` if needed. Do not commit unless the user asks. These files stay in the project, not in `docs/`.

## What to write

Explore the repo first. Then one spec. YAGNI. User's language.

```markdown
# <Title>

- Date: YYYY-MM-DD
- Status: draft
- Source: grilling consensus this session

## Problem

Who has what pain. What the code does today. Cost of leaving it.

## Goals and non-goals

**Goals**
- observable outcomes

**Non-goals (YAGNI)**
- what we are not building, and why

## Decisions

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| 1 | | | |

## Architecture

How the pieces fit. A small tree or diagram of the runtime path is fine. No file-by-file implementation list — that belongs in the plan.

## Data and interfaces

Tables, types, payloads. Exact names.

## Error handling

Failure modes and what the caller sees.

## Testing

What a failing test looks like for the main behaviors. No task list.

## Open questions

Must be empty before `/plan`. Decide with the user or cut from scope.
```

No TBD, TODO, or "handle later". If unknown, decide or cut.

## Self-review

Placeholders, contradictions, one-plan scope, ambiguity. Fix inline.

Then:

> Spec written to `<path>`. Read it. Say what to change, or say it is good. Next is `/plan <path>`.

Wait. Set Status to approved only after they say so. Next skill is only `writing-plans`.
