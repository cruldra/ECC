---
description: Analyze the errors behind a Bugsink link with the bundled bugsink-cli. Never opens the browser.
argument-hint: "<bugsink url> [how many issues]"
---

# Bugsink Command

Thin entry over the `bugsink` skill. Follow that skill.

**Input**: `$ARGUMENTS`

The first token is the Bugsink URL. An optional second token caps how many issues to dig into (default 3–5).

If the input is empty, ask for the link. If `bugsink-cli` is missing, build it from `${CLAUDE_PLUGIN_ROOT}/skills/bugsink/bugsink-cli` first.
