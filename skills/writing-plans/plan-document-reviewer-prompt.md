# Plan Document Reviewer Prompt

Use when checking a plan is ready for `tdd-workflow`.

**Plan to review:** [PLAN_FILE_PATH]
**Spec for reference:** [SPEC_FILE_PATH]

## What to Check

| Category | What to Look For |
|----------|------------------|
| Completeness | TODOs, placeholders, missing steps |
| Spec alignment | Plan covers spec, no extra scope |
| Task decomposition | Clear boundaries, actionable steps |
| Buildability | An engineer could follow this without getting stuck |

Only flag issues that would cause a wrong build or a stuck implementer.

## Output

**Status:** Approved | Issues Found

**Issues (if any):**
- [Task, Step]: [issue] — [why it matters]
