---
description: Implement test-first from an approved plan. Follow tdd-workflow. After tests pass, next is /code-review.
argument-hint: "[path/to/plan.md]"
---

# TDD Command

Thin entry over the `ecc:tdd-workflow` skill. Invoke it with `Skill(ecc:tdd-workflow)` and follow it.

**Input**: `$ARGUMENTS`

If a plan path under `.claude/plans/` is present, use it as the plan handoff. Also read the spec the plan points at.

Do not skip RED before GREEN. After the plan's tasks are green, next is `/ecc:code-review`.
