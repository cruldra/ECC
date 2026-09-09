---
name: translate-skill
description: >
  Faithfully translate an ECC plugin SKILL.md into a reading-only locale file
  under skills/<id>/i18n/<locale>.md using GLM 5.3 Flash. Use when the user
  wants to read a skill in 中文 / Chinese, refresh a stale translation, or run
  the translate-skill script. Do not use this to edit or install a translated
  copy — the original SKILL.md remains the source of truth.
---

# Translate Skill

Turn an English ECC `SKILL.md` into a reading copy. Install and edit always use the original file.

## When to Use

- User wants to read a plugin skill in Simplified Chinese
- Console or user says a translation is stale
- User explicitly runs `/translate-skill`

Do not replace `SKILL.md`. Do not install `i18n/` files as skills.

## How It Works

1. Hash `skills/<id>/SKILL.md` with SHA-256.
2. If `skills/<id>/i18n/zh-CN.md` exists and `source_hash` matches, skip (unless `--force`).
3. Call GLM 5.3 Flash (`z-ai/glm-5.3-flash`) through the Anthropic-compatible endpoint in `ANTHROPIC_BASE_URL`. Token from `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY`. If those are unset, the script reads `GLM53F_PROFILE` or `~/Sources/cruldra-profile/claude-config/profiles/glm53f.json`.
4. Write `skills/<id>/i18n/zh-CN.md` with `locale`, `source_hash`, `translated_at`, `model`.
5. If hashes later disagree, the copy is stale — translate again.

## Command

From the ECC repo root:

```sh
python3 skills/translate-skill/scripts/translate_skill.py --skill grilling --locale zh-CN --json
python3 skills/translate-skill/scripts/translate_skill.py --skill grilling --status --json
python3 skills/translate-skill/scripts/translate_skill.py --skill grilling --force --json
```

`--root` defaults to the ECC repository that contains this skill.

## Output

- Fresh or forced run: writes `i18n/zh-CN.md`
- Already current: `{ "skipped": true }`
- Missing credentials: exit non-zero, no file write
