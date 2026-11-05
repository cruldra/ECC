---
name: using-spx-cli
description: 'Use when you need to view or create an issue, update its spec/plan/prototype markers, read or merge the state JSON of an issue, view or open a PR, or post a PR review comment in a GitHub or Gitea repo that uses the spx CLI (the superwork / superpowers-vscode kanban workflow). Covers how spx picks the forge and credentials from the git origin, the hidden state comment, the local fields (session ids, profile paths, worktreePath, prDiffFile) that spx writes to <git common dir>/superwork/local-issue-state.json instead of the issue, and the strict field schema in references/state-json.schema.json.'
---

# Using spx CLI

`spx` is a thin forge wrapper shipped with superwork (the superpowers-vscode kanban) for agents such as Claude Code and Codex. It works the same way on GitHub and Gitea: it reads the git `origin` of the current directory, picks the forge from the host, and talks to that repo. Call it directly as `spx ...`; opencli 2.x no longer passes through external CLIs, so `opencli spx` fails.

## When to Use

You need to do one of these against the forge of the repo:

- Read an issue (title, body, state, author, assignees, link), optionally with its discussion.
- Create an issue with optional `spec`/`plan` markers and/or initial state JSON.
- Update the `<!-- spx:spec=... -->`, `<!-- spx:plan=... -->` or `<!-- spx:prototype=... -->` marker of an existing issue.
- Read or merge the persisted state JSON of an issue (column, pr, branch, session ids, ...).
- Read a PR (title, body, state, merged or not, head/base branch and SHA).
- Open a PR from a pushed branch.
- Post a PR review comment (spx prepends `<!-- spx:review=1 -->`).

Not for: merging PRs, pushing to the default branch, or rewriting issue bodies beyond the `spx:*` markers and the state comment. Those are out of scope.

## How It Works

### 1. Forge and Credentials

| Origin host | Forge | Credentials |
|---|---|---|
| `github.com` | GitHub | `gh auth token --hostname github.com`; run `gh auth login` first |
| anything else | Gitea | the tea login in `~/.config/tea/config.yml` whose URL has the same host; run `tea login add` for that host first |

- For Gitea a tea login for the host is required. `GITEA_TOKEN` only fills in when that login holds no token (tea v0.10+ keeps tokens in the keyring), and spx never sends it to a host that tea has not logged in to.
- GitHub Enterprise is not supported: every host other than `github.com` is treated as Gitea.

### 2. State JSON Lives in a Hidden Comment

The kanban keeps the orchestration state of an issue as a JSON object in a **state comment** on the issue. Every write appends a new state comment; the current state is the **newest valid state comment**, found by scanning comments from the end, so later review notes or chatter do not hide it.

spx hides the state comment from the web page by wrapping compact one-line JSON in an HTML comment, with `<`, `>` and `&` escaped as `\u003c`, `\u003e` and `\u0026` so the body never contains `-->`:

```
<!-- spx-state
{"column":"in-progress","pr":"73"}
-->
```

When reading, spx also accepts two older forms: the YouTrack form (`<!--spx-state-->` followed by JSON) and a bare JSON object. A state comment must hold a JSON object with at least one field from the schema.

Never write or edit this comment by hand; use `issue state merge` (or `issue create --state-json`). spx validates every write against the schema and fails fast with a JSON-pointer field path. `issue view --comments` leaves state comments out.

The schema is the only field reference: `references/state-json.schema.json` next to this SKILL.md, a copy of `vscode/schemas/state-json.schema.json` in the superwork repo, which `spx` also embeds (`make sync-schema` in `vscode/cli` refreshes both copies). It is strict (`additionalProperties: false`). Read it for field names, types, enums and path patterns; to list the fields:

```
jq '.properties | keys' references/state-json.schema.json
```

### 3. Local Fields Go to the Local Issue-State File

Fields marked `"x-local": true` in the schema are **local fields**: `sessionId`, `implementSessionId`, `reviewSessionId`, `testSessionId`, `prototypeSessionId`, `profilePath`, `brainstormProfilePath`, `testProfilePath`, `prototypeProfilePath`, `worktreePath`, `prDiffFile`. They describe this machine (session ids, worktree and profile paths), so they never go into the state comment. They live in a local file shared by the main checkout and every worktree of the repo:

```
<git common dir>/superwork/local-issue-state.json     # git rev-parse --git-common-dir
{"forge:42": {"implementSessionId": "…", "worktreePath": "/…"}}
```

- **The kanban reads local fields only from this file** and refreshes when it changes. Local fields left in old state comments are ignored, and dropped the next time spx writes a state comment for that issue.
- `issue state merge` splits the input by that list: local fields go to the local file, the rest to a new state comment. Only local fields means no comment is posted. The whole input is still validated against the schema.
- `issue state get` prints the shared fields of the newest state comment with the local record of this issue laid on top.
- `issue create --state-json` splits the same way and writes the local file once it has the issue number.
- The local file is found from `--cwd` (default: current directory), which must be inside the repo or one of its worktrees. Writing a local field outside a git repo (for example with only `--host` / `--repo` given) fails before any request; `get` outside a repo prints only the shared fields.
- spx can set local fields but not delete them (the schema requires non-empty strings); clearing is done from the kanban.
- `jq -r '.properties | to_entries[] | select(.value["x-local"]) | .key' references/state-json.schema.json` lists the local fields.

### 4. Body Markers

spx keeps metadata in HTML comment lines in the issue or PR body:

```
<!-- spx:spec=docs/specs/foo.md -->
<!-- spx:plan=docs/plans/foo.md -->
<!-- spx:prototype=docs/prototype/foo/openpencil/foo.op -->
<!-- spx:review=1 -->
```

`issue marker` replaces the existing marker of that type in place, or appends it; other markers stay. It also merges the value into the state JSON (`specFile` / `planFile` / `prototypeFile`, all shared fields). The value is checked against the pattern of that field in the schema before any request: `specFile` and `planFile` look like `dir/.../name.md`; `prototypeFile` looks like `dir/.../manifest.json` for a Figma plugin or `dir/.../name.op` for an OpenPencil board, and the kanban picks the tool that opens it from that suffix.

### 5. Commands

| Want to do | Command |
|---|---|
| Read issue | `spx issue view --issue N` |
| Read issue + discussion | `spx issue view --issue N --comments` |
| Create issue | `spx issue create --json --title "T" --body-file F [--spec PATH] [--plan PATH]` |
| Create issue + initial state | `spx issue create --json --title "T" --body-file F --state-json '{...}'` |
| Update spec / plan / prototype marker | `spx issue marker --issue N --type spec\|plan\|prototype --value PATH` |
| Read state JSON | `spx issue state get --issue N` |
| Merge state JSON | `spx issue state merge --issue N --state-json '{...}'` |
| Read PR | `spx pr view --pr N` |
| Open PR | `spx pr create --title "T" --body-file F --head BRANCH [--base BRANCH]` |
| Post review comment | `spx pr review-comment --pr N --body-file /tmp/x.md` |

Paired flags are mutually exclusive: `--body` / `--body-file` (`issue create`, `pr create`, `pr review-comment`) and `--state-json` / `--state-file` (`issue create`, `issue state merge`). `pr create` requires a body and `issue state merge` requires a state.

- `issue create`: **always pass `--json`**; without it stdout is just `#42` and you lose `html_url`. With it, stdout is `number`, `html_url` and `state`. Never re-run `create` to "see the format"; it is a write op and duplicates the issue. The new issue is assigned to the current forge login (the kanban webhook routes on the assignee; if the login cannot be resolved, spx warns and creates it unassigned). `--body-file` is deleted once the issue exists, so write a fresh file for every issue. Only `--spec` and `--plan` exist here; set a prototype with `issue marker --type prototype`.
- `issue view`: `--json` prints `number`, `title`, `body`, `state`, `author`, `assignees`, `html_url`, plus `comments` (`id`, `author`, `body`, `created_at`, `html_url`) with `--comments`.
- `issue marker`: see [Body Markers](#4-body-markers). `--json` prints `number`, `type`, `value` and the merged `state`.
- `issue state get` / `issue state merge`: always print JSON, one line by default and indented with `--json`. `merge` is shallow: incoming fields override existing ones, untouched fields remain. Local fields go to the local file, not the comment (see [Local Fields](#3-local-fields-go-to-the-local-issue-state-file)); the output is the combined state.
- `pr view`: `--json` prints `number`, `title`, `body`, `state`, `merged`, `author`, `head` / `base` (each `{branch, sha}`), `html_url`. Use `base.branch` as the diff base: `git fetch origin <base>` then `git diff origin/<base>...HEAD`.
- `pr create`: push the branch first. `--base` defaults to the default branch of the repo. The body **must** contain `Closes #N` (N = the issue number): the kanban links the PR to the issue through it. `--json` prints `number`, `html_url`.
- `pr review-comment`: posted through the issue-comment API on both forges (a PR shares its number with issues). `--json` prints `id`, `html_url`.

### 6. Global Flags

- `--repo OWNER/REPO`: defaults to the current git origin.
- `--host HOST`: for example `github.com` or `https://gitea.example.com`; defaults to the host of the current git origin. With both `--host` and `--repo`, no git repo is needed to reach the forge (local fields still need one).
- `--json`: JSON output instead of human text (indented JSON for `issue state`).
- `--cwd PATH`: directory used for repo auto-detection and for finding the local issue-state file (default `.`).

## Examples

Read the issue you are working on, with its discussion:

```
spx issue view --issue 42 --comments
```

Create an issue with markers and initial state in one shot:

```
spx issue create --json \
  --title "看板加 .env 锁定开关" \
  --body-file /tmp/issue-body.md \
  --spec .claude/specs/env-lock.md \
  --plan .claude/plans/env-lock.md \
  --state-json '{"column":"todo","autoReview":true}'
```

stdout: `{"number":42,"html_url":"https://.../issues/42","state":{...}}`. `/tmp/issue-body.md` is gone afterwards.

Update the plan marker on an existing issue:

```
spx issue marker --issue 42 --type plan \
  --value .claude/plans/env-lock.md
```

Read the current state, then merge new fields. `reviewPassed` goes to a new state comment; `implementSessionId` and `worktreePath` go to the local file only:

```
spx issue state get --issue 42
# {"branch":"feature/x","column":"in-progress","implementStatus":"running","pr":"73"}

spx issue state merge --issue 42 \
  --state-json '{"reviewPassed":true}'

spx issue state merge --issue 42 \
  --state-json '{"implementSessionId":"5a749776-d1c8-4cf0-8f85-3b8d7b804498","worktreePath":".claude/worktrees/42"}'
```

Open a PR that closes issue 42:

```
git push -u origin feature/env-lock
spx pr create --json \
  --title "看板加 .env 锁定开关" \
  --body-file /tmp/pr-42.md \
  --head feature/env-lock
# /tmp/pr-42.md contains the line: Closes #42
```

Review a PR against its own base branch, then post the review from a file (avoids shell-escaping large markdown):

```
spx pr view --pr 73 --json     # base.branch → e.g. master
git fetch origin master && git diff origin/master...HEAD
spx pr review-comment --pr 73 --body-file /tmp/review-73.md
```

## Common Mistakes

- Forgetting `--json` on `issue create`: default stdout is just `#42`, no URL.
- Reusing a `--body-file` after `issue create`: spx deleted it once the issue existed.
- Hard-coding `origin/main` as the diff base: repos use `master`, `main` or something else; read `base.branch` from `pr view`.
- Opening a PR without `Closes #N` in the body: the kanban cannot find the issue.
- Picking a spec/plan path from the examples above. Write the spec/plan with the spec/plan skill (`ecc:spec` / `ecc:plan`) and pass the path it wrote.
- Hand-writing `<!-- spx:* -->` lines or the `<!-- spx-state ... -->` comment: use `issue marker` / `issue state merge`.
- Copying field lists from anywhere but the schema: unknown fields (for example `coloum` for `column`) fail with a `/coloum` field-path error.
- Writing local fields with only `--host` / `--repo` and no repo checkout: they need the local file of a git repo; run inside the repo or point `--cwd` at it.
- Missing credentials: on GitHub run `gh auth login`; on Gitea run `tea login add` for that host (setting `GITEA_TOKEN` alone is not enough; it only fills in for a tea login without a token).
