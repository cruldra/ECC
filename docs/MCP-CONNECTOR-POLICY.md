# MCP Connector Policy

This fork ships three default MCP connectors in `.mcp.json`: `context7`, `searxng`, `firecrawl`. Browser automation is still `opencli browser`, not chrome-devtools.

Secrets stay out of the repo. The host environment must provide `CONTEXT7_API_KEY`, `SEARXNG_URL`, and `FIRECRAWL_API_URL` / `FIRECRAWL_API_KEY`.

## The rule

A default connector earns its slot only if both hold:

1. **This plugin actually uses it every session** — not a catalog of other people's servers.
2. **MCP beats a CLI for that job** — or the operator has chosen to keep the MCP they already run.

Do not add GitHub / Figma / Playwright / chrome-devtools back as defaults.

## Current default set

| Server | Why |
|---|---|
| `context7` | Library docs lookup this operator uses every session. |
| `searxng` | Self-hosted search. |
| `firecrawl` | Page scrape / crawl. |

## Not default

| Server | Replacement |
|---|---|
| `chrome-devtools` | `opencli browser` via `opencli-browser` |
| `github` | `gh` via `github-ops` |
| `playwright` | E2E skills / `opencli browser` |

Opt-in copies remain in `mcp-configs/mcp-servers.json`.
