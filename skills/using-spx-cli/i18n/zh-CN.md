---
name: using-spx-cli
description: '当你需要在使用 spx CLI（superwork / superpowers-vscode 看板工作流）的 GitHub 或 Gitea 仓库中查看或创建工单、更新其 spec/plan/prototype 标记、读取或合并工单的状态 JSON、查看或创建 PR，或发布 PR 审查评论时使用。涵盖 spx 如何根据 git origin 选择代码托管平台和凭据、隐藏的状态评论、spx 写入 <git common dir>/superwork/local-issue-state.json 而非工单的本机字段（会话 ID、配置文件路径、worktreePath、prDiffFile），以及 references/state-json.schema.json 中严格的字段 schema。'
locale: zh-CN
source_hash: d9de18f47c081981e2d934ffa07e0ef1df4ebcf9a4a1a5f4d9969c4b8210b82a
translated_at: 2026-11-05T09:49:29Z
translation_model: claude-opus-5-5
---

# 使用 spx CLI

`spx` 是随 superwork（superpowers-vscode 看板）一同提供的轻量代码托管平台包装器，供 Claude Code 和 Codex 等代理使用。它在 GitHub 和 Gitea 上的工作方式相同：读取当前目录的 git `origin`，根据主机选择代码托管平台，并与该仓库交互。直接调用 `spx ...`；opencli 2.x 已不再透传外部 CLI，`opencli spx` 会报错。

## 适用场景

你需要针对仓库所用的代码托管平台执行以下任一操作：

- 读取工单（标题、正文、状态、作者、指派人、链接），可选择同时读取讨论。
- 创建工单，可选添加 `spec`/`plan` 标记和/或初始状态 JSON。
- 更新现有工单的 `<!-- spx:spec=... -->`、`<!-- spx:plan=... -->` 或 `<!-- spx:prototype=... -->` 标记。
- 读取或合并工单的持久化状态 JSON（列、pr、分支、会话 ID 等）。
- 读取 PR（标题、正文、状态、是否已合并、head/base 分支和 SHA）。
- 从已推送的分支创建 PR。
- 发布 PR 审查评论（spx 会在评论前加上 `<!-- spx:review=1 -->`）。

不适用于：合并 PR、推送到默认分支，或改写超出 `spx:*` 标记和状态评论范围的工单正文。这些操作不在本工具的范围内。

## 工作方式

### 1. 代码托管平台和凭据

| Origin 主机 | 代码托管平台 | 凭据 |
|---|---|---|
| `github.com` | GitHub | `gh auth token --hostname github.com`；先运行 `gh auth login` |
| 其他任何主机 | Gitea | `~/.config/tea/config.yml` 中 URL 主机名相同的 tea 登录项；先针对该主机运行 `tea login add` |

- 对于 Gitea，必须有针对该主机的 tea 登录项。只有当该登录项没有令牌时才会使用 `GITEA_TOKEN`（tea v0.10+ 会将令牌保存在密钥环中），而且 spx 绝不会向 tea 未登录过的主机发送该令牌。
- 不支持 GitHub Enterprise：除 `github.com` 外的所有主机都视为 Gitea。

### 2. 状态 JSON 存储在隐藏评论中

看板会将工单的编排状态作为 JSON 对象保存在工单的**状态评论**中。每次写入都会追加一条新的状态评论；当前状态是**最新的有效状态评论**，查找时会从末尾向前扫描评论，因此后续的审查备注或闲聊不会将其隐藏。

spx 会把紧凑的单行 JSON 包在 HTML 注释中，以便在网页上隐藏状态评论；其中 `<`、`>` 和 `&` 会转义为 `\u003c`、`\u003e` 和 `\u0026`，确保正文中不会出现 `-->`：

```
<!-- spx-state
{"column":"in-progress","pr":"73"}
-->
```

读取时，spx 也接受两种旧格式：YouTrack 格式（`<!--spx-state-->` 后接 JSON）和裸 JSON 对象。状态评论必须包含一个 JSON 对象，且至少有一个 schema 中定义的字段。

不要手动编写或编辑此评论；请使用 `issue state merge`（或 `issue create --state-json`）。spx 会根据 schema 验证每次写入，并在验证失败时立即给出 JSON Pointer 字段路径。`issue view --comments` 不会显示状态评论。

字段的唯一参考是与此 SKILL.md 同目录下的 `references/state-json.schema.json`，它是 superwork 仓库中 `vscode/schemas/state-json.schema.json` 的副本，spx 也会内嵌该 schema（在 `vscode/cli` 中运行 `make sync-schema` 可刷新这两个副本）。schema 是严格的（`additionalProperties: false`）。查看该文件以了解字段名称、类型、枚举值和路径模式；要列出字段：

```
jq '.properties | keys' references/state-json.schema.json
```

### 3. 本机字段写入本机工单状态文件

schema 中标记为 `"x-local": true` 的字段是**本机字段**：`sessionId`、`implementSessionId`、`reviewSessionId`、`testSessionId`、`prototypeSessionId`、`profilePath`、`brainstormProfilePath`、`testProfilePath`、`prototypeProfilePath`、`worktreePath`、`prDiffFile`。这些字段描述当前机器的信息（会话 ID、工作树和配置文件路径），因此绝不会写入状态评论。它们保存在一个由仓库的主检出目录和所有工作树共享的本机文件中：

```
<git common dir>/superwork/local-issue-state.json     # git rev-parse --git-common-dir
{"forge:42": {"implementSessionId": "…", "worktreePath": "/…"}}
```

- **看板只从此文件读取本机字段**，并会在文件更改时刷新。旧状态评论中残留的本机字段会被忽略；spx 下次为该工单写入状态评论时会将其移除。
- `issue state merge` 会根据该字段列表拆分输入：本机字段写入本机文件，其余字段写入新的状态评论。若输入只包含本机字段，则不会发布评论。整个输入仍会根据 schema 进行验证。
- `issue state get` 会输出最新状态评论中的共享字段，并在其上叠加此工单的本机记录。
- `issue create --state-json` 以相同方式拆分字段，并在获取工单编号后写入本机文件。
- 根据 `--cwd`（默认为当前目录）查找本机文件；该目录必须位于仓库或其某个工作树中。在 git 仓库外写入本机字段（例如只提供 `--host` / `--repo`）会在发送任何请求前失败；在仓库外执行 `get` 时只会输出共享字段。
- spx 可以设置本机字段，但不能删除它们（schema 要求这些字段为非空字符串）；清除操作需在看板中完成。
- `jq -r '.properties | to_entries[] | select(.value["x-local"]) | .key' references/state-json.schema.json` 可列出本机字段。

### 4. 正文标记

spx 会在工单或 PR 正文的 HTML 注释行中保存元数据：

```
<!-- spx:spec=docs/specs/foo.md -->
<!-- spx:plan=docs/plans/foo.md -->
<!-- spx:prototype=docs/prototype/foo/openpencil/foo.op -->
<!-- spx:review=1 -->
```

`issue marker` 会在原位替换该类型的现有标记；若不存在，则追加标记。其他标记保持不变。它还会将值合并到状态 JSON 中（`specFile` / `planFile` / `prototypeFile`，均为共享字段）。在发送任何请求之前，会根据 schema 中对应字段的模式检查该值：`specFile` 和 `planFile` 的格式类似 `dir/.../name.md`；`prototypeFile` 对 Figma 插件类似 `dir/.../manifest.json`，对 OpenPencil 画板类似 `dir/.../name.op`，看板按这个后缀选打开它的工具。

### 5. 命令

| 操作 | 命令 |
|---|---|
| 读取工单 | `spx issue view --issue N` |
| 读取工单和讨论 | `spx issue view --issue N --comments` |
| 创建工单 | `spx issue create --json --title "T" --body-file F [--spec PATH] [--plan PATH]` |
| 创建工单并设置初始状态 | `spx issue create --json --title "T" --body-file F --state-json '{...}'` |
| 更新 spec / plan / prototype 标记 | `spx issue marker --issue N --type spec\|plan\|prototype --value PATH` |
| 读取状态 JSON | `spx issue state get --issue N` |
| 合并状态 JSON | `spx issue state merge --issue N --state-json '{...}'` |
| 读取 PR | `spx pr view --pr N` |
| 创建 PR | `spx pr create --title "T" --body-file F --head BRANCH [--base BRANCH]` |
| 发布审查评论 | `spx pr review-comment --pr N --body-file /tmp/x.md` |

成对的标志不能同时使用：`--body` / `--body-file`（`issue create`、`pr create`、`pr review-comment`）以及 `--state-json` / `--state-file`（`issue create`、`issue state merge`）。`pr create` 必须提供正文，`issue state merge` 必须提供状态。

- `issue create`：**始终传入 `--json`**；否则标准输出只有 `#42`，你会丢失 `html_url`。传入后，标准输出会包含 `number`、`html_url` 和 `state`。切勿为了“查看格式”而重新运行 `create`；它是写操作，会创建重复工单。新工单会分配给当前代码托管平台登录用户（看板 webhook 根据指派人进行路由；如果无法解析登录用户，spx 会发出警告并创建未分配的工单）。工单创建后，`--body-file` 会被删除，因此每个工单都要创建一个新文件。此处只有 `--spec` 和 `--plan`；如需设置 prototype，请使用 `issue marker --type prototype`。
- `issue view`：`--json` 会输出 `number`、`title`、`body`、`state`、`author`、`assignees`、`html_url`；如果使用 `--comments`，还会包含 `comments`（`id`、`author`、`body`、`created_at`、`html_url`）。
- `issue marker`：参见[正文标记](#4-正文标记)。`--json` 会输出 `number`、`type`、`value` 和合并后的 `state`。
- `issue state get` / `issue state merge`：始终输出 JSON，默认输出一行；使用 `--json` 时会输出缩进格式。`merge` 是浅层合并：传入的字段会覆盖现有字段，未修改的字段保持不变。本机字段写入本机文件，而非评论（参见[本机字段](#3-本机字段写入本机工单状态文件)）；输出的是合并后的状态。
- `pr view`：`--json` 会输出 `number`、`title`、`body`、`state`、`merged`、`author`、`head` / `base`（各自包含 `{branch, sha}`）以及 `html_url`。使用 `base.branch` 作为 diff 基准：`git fetch origin <base>`，然后运行 `git diff origin/<base>...HEAD`。
- `pr create`：先推送分支。`--base` 默认为仓库的默认分支。正文**必须**包含 `Closes #N`（N = 工单编号）：看板通过这行文字将 PR 与工单关联起来。`--json` 会输出 `number`、`html_url`。
- `pr review-comment`：在两个代码托管平台上都通过工单评论 API 发布（PR 与工单共享编号）。`--json` 会输出 `id`、`html_url`。

### 6. 全局标志

- `--repo OWNER/REPO`：默认为当前 git origin。
- `--host HOST`：例如 `github.com` 或 `https://gitea.example.com`；默认为当前 git origin 的主机。若同时使用 `--host` 和 `--repo`，无需 git 仓库即可访问代码托管平台（但本机字段仍需要 git 仓库）。
- `--json`：输出 JSON，而非人类可读文本（`issue state` 输出缩进格式的 JSON）。
- `--cwd PATH`：用于自动检测仓库并查找本机工单状态文件的目录（默认为 `.`）。

## 示例

读取正在处理的工单及其讨论：

```
spx issue view --issue 42 --comments
```

一次性创建工单、添加标记并设置初始状态：

```
spx issue create --json \
  --title "看板加 .env 锁定开关" \
  --body-file /tmp/issue-body.md \
  --spec .claude/specs/env-lock.md \
  --plan .claude/plans/env-lock.md \
  --state-json '{"column":"todo","autoReview":true}'
```

标准输出：`{"number":42,"html_url":"https://.../issues/42","state":{...}}`。之后 `/tmp/issue-body.md` 会被删除。

更新现有工单的 plan 标记：

```
spx issue marker --issue 42 --type plan \
  --value .claude/plans/env-lock.md
```

读取当前状态，然后合并新字段。`reviewPassed` 会写入新的状态评论；`implementSessionId` 和 `worktreePath` 只会写入本机文件：

```
spx issue state get --issue 42
# {"branch":"feature/x","column":"in-progress","implementStatus":"running","pr":"73"}

spx issue state merge --issue 42 \
  --state-json '{"reviewPassed":true}'

spx issue state merge --issue 42 \
  --state-json '{"implementSessionId":"5a749776-d1c8-4cf0-8f85-3b8d7b804498","worktreePath":".claude/worktrees/42"}'
```

创建一个会关闭工单 42 的 PR：

```
git push -u origin feature/env-lock
spx pr create --json \
  --title "看板加 .env 锁定开关" \
  --body-file /tmp/pr-42.md \
  --head feature/env-lock
# /tmp/pr-42.md contains the line: Closes #42
```

根据 PR 自身的 base 分支进行审查，然后从文件发布审查意见（避免对较长的 markdown 进行 shell 转义）：

```
spx pr view --pr 73 --json     # base.branch → 例如 master
git fetch origin master && git diff origin/master...HEAD
spx pr review-comment --pr 73 --body-file /tmp/review-73.md
```

## 常见错误

- 在 `issue create` 中忘记使用 `--json`：默认标准输出只有 `#42`，没有 URL。
- 在 `issue create` 后重复使用 `--body-file`：工单创建后 spx 已将其删除。
- 将 `origin/main` 硬编码为 diff 基准：仓库可能使用 `master`、`main` 或其他分支；请从 `pr view` 读取 `base.branch`。
- 创建 PR 时正文中没有 `Closes #N`：看板无法找到对应工单。
- 从上述示例中直接选取 spec/plan 路径。请使用 spec/plan 技能（`ecc:spec` / `ecc:plan`）编写 spec/plan，并传入该技能生成的路径。
- 手动编写 `<!-- spx:* -->` 行或 `<!-- spx-state ... -->` 评论：请使用 `issue marker` / `issue state merge`。
- 从 schema 以外的来源复制字段列表：未知字段（例如用 `coloum` 代替 `column`）会触发 `/coloum` 字段路径错误。
- 仅使用 `--host` / `--repo`，且未检出仓库，就写入本机字段：本机字段需要写入 git 仓库的本机文件；请在仓库内运行，或将 `--cwd` 指向该仓库。
- 缺少凭据：在 GitHub 上运行 `gh auth login`；在 Gitea 上针对该主机运行 `tea login add`（仅设置 `GITEA_TOKEN` 不够；只有当 tea 登录项没有令牌时才会使用它）。