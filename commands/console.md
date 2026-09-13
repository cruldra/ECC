---
description: Open the ECC plugin console in the browser. Reuses the running instance on the shared port instead of starting another.
argument-hint: "[open | status]"
---

# Console Command

Opens the plugin console (skills, commands, hooks, MCP, workflows, editor).

**Input**: `$ARGUMENTS` (default `open`)

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/console.js" $ARGUMENTS
```

The script prints one JSON line. Report the `url` and whether it `started` a new instance or reused one. Never start the console any other way; every session shares port 8765 (or `ECC_CONSOLE_PORT`).

If it fails, show the reason verbatim. A foreign process on the port means the user picks another port; a missing root means `ECC_ROOT` must point at the ECC checkout.
