---
name: writing-plans
description: Write a bite-sized TDD implementation plan from an approved spec, before touching code. Use when the user wants /plan, an implementation plan, or after spec is approved. Do not use when the idea is still open (grilling) or the spec is missing (spec).
---

# Writing Plans

Write the implementation plan from an approved spec. Assume the implementer has no repo context. Each step is one action with real file paths, real test code, real commands. DRY. YAGNI. TDD.

This skill is **step 3** of the development chain:

`grilling` → `spec` → **writing-plans** → `tdd-workflow` → `/code-review`

**Announce at start:** using writing-plans to write the implementation plan.

**Save plans to:** `.claude/plans/<kebab-name>.plan.md`

Create `.claude/plans/` if needed. Do not commit unless the user asks. Do not write these under `docs/`.

**Spec path:** `.claude/specs/<kebab-name>.md` — the plan points at it. Both stay in `.claude/`.

## Gate

Need an approved spec. Look for:

- `$ARGUMENTS` pointing at `.claude/specs/*.md`
- A spec written and approved this session

If the idea is still open, follow `grilling`. If there is consensus but no spec, follow `spec`. Do not invent the spec inside the plan.

If the spec covers multiple independent subsystems, split into one plan per subsystem. Each plan must produce working, testable software on its own.

## 文件结构

After the header, before tasks, put one section titled `## 文件结构（创建/修改一览）`.

This is the file map. Not an architecture essay. A tree of every file this plan creates or edits, each line one reason.

Marker: 🆕 create · ✏️ modify

````markdown
## 文件结构（创建/修改一览）

标记：🆕 新建 · ✏️ 修改

```
project-root/
├── src/
│   └── feature/
│       ├── service.py  🆕 编排
│       └── routes.py  ✏️ 挂入口
└── tests/
    └── test_feature.py  🆕 主路径失败用例
```
````

Rules:

- Every file a task will touch appears here
- One short reason per file, on the same line
- No file that is only "mentioned" — if it is in the tree, a task owns it
- Do not add a second file-structure chapter, table, or prose map. This tree is the map.

## Task size

A task is the smallest unit with its own test cycle. Fold setup into the task that needs it. Split only where a reviewer could reject one task and keep the neighbor.

**Each step is one action (2–5 minutes):**

- Write the failing test
- Run it and see it fail
- Minimal code to pass
- Run tests and see them pass
- Commit (only if the user asked to commit)

## Header

Every plan starts with:

```markdown
# [Feature Name] Implementation Plan

> **For implementers:** follow `tdd-workflow` with this file, then `/code-review`. Steps use `- [ ]`.

**Goal:** [one sentence]

**Architecture:** [2–3 sentences]

**Tech Stack:** [key libraries]

**Spec:** [path to the spec this plan implements]

## Global Constraints

[Copy exact constraint lines from the spec. Every task inherits them.]

---
```

## Task shape

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py`
- Test: `tests/exact/path/to/test.py`

**Interfaces:**
- Consumes: [exact signatures from earlier tasks]
- Produces: [exact names and types later tasks need]

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit** (skip unless the user asked)
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
2. **Placeholder scan:** fix any red flags above
3. **Type consistency:** later tasks use the names earlier tasks produced

Fix inline.

## Handoff

Plan saved to `.claude/plans/<filename>.md`.

Next: `tdd-workflow` / `/tdd <path>`. After green: `/code-review`.

Wait for the user to say start. Do not write production code in this skill.
