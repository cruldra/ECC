---
name: verification-loop
description: 'Use after changing code or configuration and before claiming completion, committing, or opening a PR in Claude Code, Codex, or Pi. Select checks for the changed behavior and risk, honor explicit test limits, and report observed evidence and remaining gaps.'
license: MIT
metadata:
  origin: ECC
---

# Verification Loop

Verify the result of a change in Claude Code, Codex, or Pi before reporting it complete. Use the smallest set of checks that proves the affected behavior; expand only when a change, failure, or unresolved risk requires it.

## When to Use

- After modifying code or configuration, before delivery.
- Before a commit or pull request that contains those changes.
- After a refactor or a fix whose behavior needs confirmation.

Read-only questions and unchanged files do not require a build or test run. Documentation changes need checks appropriate to the documentation.

## Choose the Scope First

1. Read the active project instructions and the existing build, check, and test scripts. Use the project's tools and package manager; do not invent commands or install a checker just to satisfy this skill.
2. Identify what changed, who uses it, and the observable result that must hold. Include failure and recovery paths when the change affects them.
3. Select the relevant checks from the table below. Follow the project's existing coverage requirements when they apply; do not invent coverage numbers or require a full suite for every small change.
4. Respect explicit user limits. If tests, shared simulators, or another environment must not be used, perform only allowed checks and report the relevant behavior as not verified. Do not ask again for a restriction already settled in the session.
5. Reuse completed evidence when the relevant files, configuration, and environment have not changed. Repeat only the checks invalidated by a new change or failure.

| Change | Relevant evidence |
|---|---|
| Documentation or comments | Links and examples affected by the edit, document checks, and the diff |
| Configuration or skill routing | Parse or validate it, inspect the effective configuration, and confirm the affected loader or service sees the intended result |
| Business logic or bug fix | Targeted tests for the affected behavior and any meaningful failure path; for a fixed bug, a reproducible case that protects the fix |
| Interface fields or events | Provider output and affected consumers checked against the same existing contract; use `contract-first` |
| Interactive state | The affected user action through to its final state, including cancellation or recovery where applicable; use `click-path-audit` |
| Authentication, payments, secrets, or personal data | Relevant boundary and regression checks; use `security-review` |
| Broad refactor or shared build configuration | The applicable build, type checks, code checks, and wider tests justified by the affected consumers |

If there is no relevant test yet, choose a small meaningful test or another direct observation that proves the requested result. Do not add tests that only repeat implementation details, or run unrelated checks to make the report look fuller.

## Run and Judge the Checks

- Run the selected project commands and inspect their exit status and results. A command that was proposed, launched, or compiled is not evidence that its assertions passed.
- Preserve failures when reducing output. Do not let a command piped through `head` or `tail` turn a failing check into an apparent success.
- Confirm a test selection actually ran the intended tests. A successful process with no applicable tests does not verify the behavior.
- When a required check fails, investigate and rerun that check after the fix. Do not declare the affected work complete while its failure is unresolved.
- Keep credentials, private payloads, and sensitive logs out of tool output and reports. Secret checks should report redacted findings or filenames, never print the matched values.
- Test live or production behavior only within the user's authorization. Prefer existing isolated fixtures when a check would otherwise change shared data.

## Review the Actual Change

Review the files belonging to this task, including new files. For a pending commit, inspect staged content; for unstaged changes, inspect the working diff; for committed work, use the relevant commit or branch base. Do not assume `HEAD~1` is always the right comparison.

Check for unintended edits, missing failure handling, affected callers, and private data. Keep unrelated user changes outside the task's commit. Use the project's existing review mechanism when required.

For configuration changes, confirm the effective state after applying them. A valid source file alone does not prove a running client has reloaded it; identify any required reload or restart.

## Report What Was Observed

Keep the report proportional to the task. Include:

- what was checked and the observed result;
- relevant checks not run and the resulting uncertainty;
- whether the change is local, installed, committed, pushed, or deployed;
- any reload or restart needed before existing sessions use the new state.

Only mark a check passed after observing it pass. Use not applicable, not run, or blocked for other states; never turn omitted checks into passes. Separate implementation completion from behavior that remains unverified because of an explicit user restriction.

## Recheck at Meaningful Boundaries

Reassess verification before delivery or a commit, and when another change invalidates earlier evidence. Do not restart the whole verification process on a timer or after every function when the relevant evidence remains valid.
