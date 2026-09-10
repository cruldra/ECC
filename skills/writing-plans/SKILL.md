---
name: writing-plans
description: Write a bite-sized TDD implementation plan from an approved spec, before touching code. Use when the user wants /plan, an implementation plan, or after spec is approved. Do not use when the idea is still open (grilling) or the spec is missing (spec).
---

# Writing Plans

Write the implementation plan from an approved spec. Assume the implementer has no repo context. Each step is one action with real file paths, real test code, real commands. DRY. YAGNI. TDD.

This skill is **step 3** of the development chain:

`grilling` → `spec` → **writing-plans** → `tdd-workflow` → `/code-review`

**Announce at start:** using writing-plans to write the implementation plan.

**Save plans to:** `.claude/plans/<stem>.md`

`<stem>` matches the spec file: `.claude/specs/<stem>.md`. Short kebab of the feature. Never put `spec` or `plan` in the stem, and never use a `.plan.md` suffix — the folder already says plan.

Bad: `console-artifacts.plan.md`. Good: `plans/console-artifacts.md` next to `specs/console-artifacts.md`.

Create `.claude/plans/` if needed. Do not write these under `docs/`. Saving the plan markdown does not need a commit. **Implementing** the plan does: every task ends with its own commit. That is not optional.

**Spec path:** `.claude/specs/<stem>.md` — the plan points at it. Both stay in `.claude/`.

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
- Commit that task (required — one commit per task, like the original writing-plans)

## Header

**Language:** title, labels, headings, and step names follow the user's language. English `Goal` / `Task` / `Step` when the user writes 中文 is a bug.

中文用户用下面这份。

Every plan starts with:

```markdown
# <题目> 实施计划

> 按 `tdd-workflow` 执行本文件，然后 `/code-review`。步骤用 `- [ ]`。

**目标：** [一句话]

**架构：** [两三句]

**技术栈：** [关键库]

**规格：** [本计划对应的规格路径]

## 全局约束

[从规格逐字抄过来的项目级约束。每个任务都带上。]

---
```

## Task shape

````markdown
### 任务 N: [组件名]

**文件：**
- 新建：`exact/path/to/file.py`
- 修改：`exact/path/to/existing.py`
- 测试：`tests/exact/path/to/test.py`

**接口：**
- 消费：[前面任务给出的签名]
- 产出：[后面任务要用的名字和类型]

- [ ] **步骤 1：写会失败的测试**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **步骤 2：跑测试，确认失败**

Run: `uv run pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **步骤 3：写刚好能过的实现**

```python
def function(input):
    return expected
```

- [ ] **步骤 4：跑测试，确认通过**

Run: `uv run pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **步骤 5：提交**

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
2. **Placeholder scan:** fix any red flags above
3. **Type consistency:** later tasks use the names earlier tasks produced

Fix inline.

## Handoff

Plan saved to `.claude/plans/<filename>.md`.

Next: `tdd-workflow` / `/tdd <path>`. After green: `/code-review`.

Wait for the user to say start. Do not write production code in this skill.
