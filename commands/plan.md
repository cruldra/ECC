---
description: Write a bite-sized TDD implementation plan from an approved spec. WAIT for confirmation before code. If the idea is open, grilling first. If there is no spec, /spec first.
argument-hint: "[path/to/spec.md]"
---

# Plan Command

Thin entry over the `ecc:writing-plans` skill. Invoke it with `Skill(ecc:writing-plans)` and follow it.

**Input**: `$ARGUMENTS`

If `$ARGUMENTS` is a spec path, use it. If this session already has an approved spec, use that.

If the idea is still open, follow `ecc:grilling`. If consensus exists but no spec, follow `ecc:spec`.

Do not write a PRD. Do not write code. Save to `.claude/plans/<stem>.md`. After the plan is saved, next is `/ecc:tdd <plan-path>`.
