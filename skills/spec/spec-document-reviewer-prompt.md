# Spec Document Reviewer Prompt

Use when checking a spec is ready for `writing-plans`.

**Spec to review:** [SPEC_FILE_PATH]

## What to Check

| Category | What to Look For |
|----------|------------------|
| Completeness | TODOs, placeholders, TBD, incomplete sections |
| Consistency | Internal contradictions, conflicting requirements |
| Clarity | A requirement that could cause someone to build the wrong thing |
| Scope | Focused enough for a single plan |
| YAGNI | Unrequested features |

Only flag issues that would cause a real problem during planning. Wording nits are not issues.

## Output

**Status:** Approved | Issues Found

**Issues (if any):**
- [Section]: [issue] — [why it matters for planning]
