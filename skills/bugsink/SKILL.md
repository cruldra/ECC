---
name: bugsink
description: Analyze errors from a self-hosted Bugsink instance through the bundled bugsink-cli. Use when the user pastes a Bugsink URL (e.g. bugsink.ailoveworld.cn/issues/...), says /bugsink, or asks to 查 bugsink / 看看这个报错 / 哪些是真 bug. Never open the browser for Bugsink — the CLI answers everything.
---

# Bugsink

Turn a Bugsink link into a root-cause read: which issues are real, where they break, what to change.

The CLI ships with this skill as a git submodule at `bugsink-cli/` (Go). It talks to the Bugsink REST API and prints JSON, except `events stacktrace` which prints Markdown.

## Setup

`bugsink-cli` must be on `PATH`. If it is not:

```bash
cd "${CLAUDE_PLUGIN_ROOT}/skills/bugsink/bugsink-cli" && go build -o ~/.local/bin/bugsink-cli .
```

Credentials come from the environment, never from arguments you type into the transcript:

- `BUGSINK_URL` — instance base URL
- `BUGSINK_TOKEN` — bearer token

If the CLI answers `请通过 --token 或 BUGSINK_TOKEN 环境变量提供认证令牌`, the token is missing from the shell that launched Claude. Tell the user; do not ask them to paste it, and never echo its value.

## URL → ids

Two link shapes matter. Strip the query string, then match the path:

| Path | Meaning | First command |
|---|---|---|
| `/issues/<N>/` | project `N` | `bugsink-cli issues list --project N --sort last_seen --order desc` |
| `/issues/issue/<UUID>/...` | one issue | `bugsink-cli events list --issue UUID --order desc` |

`/api/canonical/...` links are raw API URLs; extract the same ids from them. A `/accounts/login/?next=...` link is a redirect wrapper — decode `next` and use that.

## Procedure

### Project link

1. `issues list --project N --sort last_seen --order desc`. Output has `results[]`; page with `--cursor` from `next` only if the user asks for more than the first page.
2. Drop rows where `is_resolved` is `True` or `is_muted` is `True` unless the user asks about history.
3. Group what is left by `calculated_type` + `calculated_value`. Rank by `digested_event_count`, then by `last_seen`.
4. For the top issues (3–5 unless told otherwise), fetch one stacktrace each — see below.
5. Report.

### Issue link

1. `events list --issue UUID --order desc`. Take the first row's `id` (the internal id, **not** `event_id` — `event_id` is the client-side id and `stacktrace` will 404 on it).
2. `events stacktrace <id>`.
3. Report.

### Reading a stacktrace

`events stacktrace` prints the exception type on line 1, the message next, then frames. Frames tagged `[in-app]` are the project's own code; frames without the tag are dependencies.

- Root cause is the deepest `[in-app]` frame that made the bad call, not the outermost.
- Quote it as `path:line` in `function`.
- Messages that mention context windows, cancelled tasks, upstream 4xx, or ASGI early returns are often symptoms of a caller's decision — say so instead of treating them as the bug.

## Report

One block per issue, most events first:

```
<calculated_type> — <count> events, first <first_seen>, last <last_seen>
Issue: <UUID>
Where: <file>:<line> in <function>
Why:   <one or two sentences on the mechanism>
Fix:   <the concrete change, or "not a bug: <reason>">
```

Finish with a one-line split: which issues are real, which are noise, which need more data.

Write the report in the user's language.

## Do not

- Do not run `issues resolve`, `issues delete`, or `issues clear` unless the user asks for exactly that. `clear` is irreversible and project-wide.
- Do not open the Bugsink web UI. Everything above is answerable from the CLI.
- Do not paginate the whole project by default; the first page sorted by `last_seen` is the signal.
