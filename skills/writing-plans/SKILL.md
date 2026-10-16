---
name: writing-plans
description: Write a bite-sized TDD implementation plan from an approved spec, before touching code. Use when the user wants /plan, an implementation plan, 实施计划, or after a spec is approved. Do not use when the idea is still open (grilling) or the spec is missing (spec).
---

# Writing Plans

Write the implementation plan from an approved spec. Assume the implementer has no repo context. Each step is one action with real file paths, real test code, real commands. DRY. YAGNI. TDD.

Chain: `grilling` → `spec` → **writing-plans** → `tdd-workflow` → `/code-review`

**Announce at start:** using writing-plans to write the implementation plan.

## Drop path

`.claude/plans/<stem>.md`

`<stem>` matches the spec file: `.claude/specs/<stem>.md`. Short kebab of the feature. Never put `spec` or `plan` in the stem, and never use a `.plan.md` suffix — the folder already says plan. Bad: `console-artifacts.plan.md`. Good: `plans/console-artifacts.md` beside `specs/console-artifacts.md`.

Create `.claude/plans/` if needed. Never under `docs/`.

Saving the plan markdown needs no commit. **Implementing** it does: every task ends with its own commit. Not optional.

## Gate

Need an approved spec. Look for:

- `$ARGUMENTS` pointing at `.claude/specs/*.md`
- A spec written and approved this session

Idea still open → follow `grilling`. Consensus but no spec → follow `spec`. Never invent the spec inside the plan.

If the spec covers multiple independent subsystems, split into one plan per subsystem. Each plan must produce working, testable software on its own.

## Language

**The plan file is written in the user's language** — title, labels, headings, section names, and step names. The English headings below are the canonical structure, not literal strings to copy. A user writing 中文 who gets `Goal` / `Task 1` / `Step 1` headings is a bug; translate them. Code, paths, and commands stay verbatim.

## File structure section

After the header, before the tasks, put exactly one section whose title means "files created and modified".

It is a map, not an architecture essay: a tree of every non-test file this plan creates or edits, one short reason per line.

Marker: 🆕 create · ✏️ modify

````markdown
## File structure (created / modified)

Markers: 🆕 new · ✏️ changed

```
project-root/
├── src/
│   ├── billing/
│   │   ├── service.py  🆕 orchestration
│   │   └── routes.py  ✏️ mount the entry point
│   ├── api/schema.py  ✏️ quote request model
│   └── settings.py  ✏️ feature flag
└── web/src/
    ├── lib/billing.ts  🆕 fetch the quote
    └── app/
        ├── billing/page.tsx  🆕 quote page
        └── layout.tsx  ✏️ link to the quote page
```
````

Tree shape:

- A directory holding two or more listed files gets its own line, with its files indented beneath it. Never list `lib/desktop/a.ts` and `lib/desktop/b.ts` as two flat lines; that hides the folder they share.
- A directory holding exactly one listed file folds into that file's line: `api/schema.py`.
- A directory whose only listed content is one subdirectory merges with it on one line: `web/src/`.

Rules:

- Leave test files out: test code, test fixtures, snapshots. The reader opens this tree to see what the feature changes; tests are listed under each task's **Files:**.
- Every other file a task touches appears here
- One short reason per file, on the same line
- Nothing merely "mentioned" — if it is in the tree, a task owns it
- No second file map anywhere: no extra chapter, table, or prose list. This tree is the map.

## Task size

A task is the smallest unit with its own test cycle. Fold setup into the task that needs it. Split only where a reviewer could reject one task and keep the neighbor.

**Each step is one action (2–5 minutes):**

- Write the failing test
- Run it and see it fail
- Minimal code to pass
- Run tests and see them pass
- Commit that task — one commit per task, required

## Header

Every plan starts with:

```markdown
# <Title> Implementation Plan

> Execute this file with `tdd-workflow`, then `/code-review`. Steps use `- [ ]`.

**Goal:** [one sentence]

**Architecture:** [2–3 sentences]

**Tech stack:** [key libraries]

**Spec:** [path to the spec this plan implements]

## Global constraints

[Project-wide requirements copied verbatim from the spec. Every task inherits them.]

---
```

## Task shape

````markdown
### Task N: [Component]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py`
- Test: `tests/exact/path/to/test.py`

**Interfaces:**
- Consumes: [exact signatures from earlier tasks]
- Produces: [exact names and types later tasks rely on]

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `uv run pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write the minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `uv run pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

Use the repo's real test runner, not a guessed one. Match existing test style.

## No placeholders

Plan failures — never write:

- TBD, TODO, implement later, fill in details
- Add appropriate error handling / add validation / handle edge cases
- Write tests for the above (without the actual test code)
- Similar to Task N (repeat the code)
- Steps that say what without showing how
- Types or functions not defined in any task

## Self-review

1. **Spec coverage:** every spec requirement has a task
2. **Placeholder scan:** fix any red flag above
3. **Type consistency:** later tasks use the names earlier tasks produced
4. **File tree:** no test files, and no two sibling lines whose paths start with the same directory

Fix inline.

## Handoff

Plan saved to `.claude/plans/<stem>.md`.

Next: `tdd-workflow` / `/tdd <path>`. After green: `/code-review`.

Wait for the user to say start. Never write production code in this skill.
