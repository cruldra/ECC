---
description: Faithfully translate an ECC SKILL.md into skills/<id>/i18n/zh-CN.md for reading. Original remains the installed skill.
argument-hint: "[skill-id]"
---

# Translate Skill Command

Thin entry over the `translate-skill` skill. Follow that skill.

**Input**: `$ARGUMENTS` is the skill folder name (for example `grilling`).

Run:

```sh
python3 skills/translate-skill/scripts/translate_skill.py --skill "$ARGUMENTS" --locale zh-CN --json
```

If `$ARGUMENTS` is empty, ask which skill. Do not overwrite `SKILL.md`.
