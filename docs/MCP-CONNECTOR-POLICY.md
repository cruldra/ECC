# MCP Connector Policy

This fork ships **zero** MCP connectors: `.mcp.json` `mcpServers` is empty. Browser automation is the `agent-browser` CLI, not chrome-devtools.

Shared MCP servers (`context7`, `searxng`, `firecrawl`, …) come from the host, which gives the same set to Claude Code, Codex, and Pi in each agent's own config, with its URLs and keys. A copy in the plugin would load next to the host's in Claude Code and Codex, and Codex would start it without those URLs and keys.

## The rule

A default connector earns its slot only if both hold:

1. **No agent already gets it from the host** — the plugin never ships a second copy of a server.
2. **MCP beats a CLI for that job.**

Do not add GitHub / Figma / Playwright / chrome-devtools back as defaults.

## Not default

| Server | Replacement |
|---|---|
| `context7` / `searxng` / `firecrawl` | The host's shared MCP servers |
| `chrome-devtools` | `agent-browser` CLI via the `agent-browser` skill |
| `github` | `gh` via `github-ops` |
| `playwright` | E2E skills / `agent-browser` |

Opt-in copies remain in `mcp-configs/mcp-servers.json`.
