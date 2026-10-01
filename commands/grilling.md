---
description: Front door for requirements, brainstorming, and design discussion — one AskUserQuestion round at a time until shared understanding, then stop. Does not write code, specs, or implementation plans. Next is /spec.
argument-hint: "[plan, decision, or idea to stress-test]"
---

# Grilling Command

Thin entry over the `ecc:grilling` skill. Invoke it with `Skill(ecc:grilling)` and follow it for the full workflow.

**Input**: `$ARGUMENTS`

If arguments are present, treat them as the idea under test. If empty, ask what to grill.

Do not implement. Do not write a spec or plan until grilling reaches confirmed shared understanding. Next is `/ecc:spec`.
