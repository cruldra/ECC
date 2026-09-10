# Spec / Plan staging

`grilling` → `/spec` → `/plan` → `/tdd` → `/code-review`

Each step writes a file the next step reads. Not a conversation in memory.

```
.claude/
  specs/           # /spec  →  <kebab-name>.md
  plans/           # /plan  →  <kebab-name>.plan.md
```

Do not write these under `docs/`. Do not commit them unless asked.

`/plan` needs an approved spec. The plan's `## 文件结构（创建/修改一览）` is a create/modify tree (🆕 / ✏️), not a second architecture essay.

PRD commands are gone. `/plan-prd`, `/prp-prd`, `/prp-plan` no longer exist.
