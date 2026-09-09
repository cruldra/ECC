# MCP Connector Policy

ECC ships **zero** default MCP connectors. Browser work is the `opencli browser` CLI via the `opencli-browser` skill. Everything else is a skill wrapping a CLI or REST API, or an opt-in entry in `mcp-configs/mcp-servers.json`.

## The rule

A default connector earns its slot only if both hold:

1. **Universal** — it applies to essentially every user of a coding agent, on every harness ECC targets.
2. **MCP beats a CLI/API wrapped in a skill** — the job genuinely needs what MCP provides: interactive session state, streaming, an auth handshake, or structured browsing. Stateless request/response work is a skill, not a server. Tool schemas load into every session; each default connector taxes every user's context window whether they use it or not.

The default set stays well under ten. In practice the 2026 field default across serious harnesses is zero to two connectors plus native built-ins. ECC chooses zero.

## Current default set

None. `.mcp.json` `mcpServers` is empty.

## Retired defaults

| Former default | Verdict | Replacement |
|---|---|---|
| `chrome-devtools` | drop for skill | `opencli browser <session> …` via the `opencli-browser` skill. Same live-tab job, no MCP schema tax. Opt-in copy remains in `mcp-configs/mcp-servers.json`. |
| `github` | drop for skill | `gh` CLI via the `github-ops` skill. |
| `context7` | drop for skill | The `documentation-lookup` skill targeting Context7's public REST API. |
| `exa` | drop for skill | Harness-native search by default; the `exa-search` skill remains for API-key holders. |
| `memory` | drop entirely | Native harness memory plus ECC's instinct/continuous-learning system. |
| `playwright` | drop for skill | E2E skills drive the Playwright CLI. Interactive browsing is `opencli browser`. |
| `sequential-thinking` | drop entirely | Native extended thinking. |

All remain available as opt-in entries in `mcp-configs/mcp-servers.json` except where noted as dropped entirely.

## Opt-out

`ECC_DISABLED_MCPS` still filters ECC-generated MCP configs at install/sync time. With an empty default set it only affects a re-add if a connector returns to `ECC_SERVERS`.

```bash
export ECC_DISABLED_MCPS="chrome-devtools"
```

## Adding a connector

Open a PR that argues both prongs of the rule explicitly. "Popular" is not an argument; "the job is stateful and universal **and** a CLI cannot hold the session" is.
