---
name: ui-prototyping
description: 'Draw UI prototypes, design boards, state variants, and click-through demos. First ask which tool to use, the Figma development plugin or OpenPencil, unless the user already named one, then follow that tool''s reference. When the issue is known from context, attaches the finished prototype to it with spx. Use when the user asks for a 原型 / 设计稿 / 画板 / Design Lab / 状态变体 / 点击演示, says 用 figma 插件画 or 用 openpencil 画, or wants a feature''s screens mocked up. Not for reading an existing Figma file into code (use figma-design-to-code).'
---

# UI Prototyping

A prototype answers one design question with boards that look like the finished product. Two tools can draw it. Both keep the drawing source in the repo, so a prototype can be re-run, diffed, and reviewed.

## When to Use

- The user asks for a 原型, 设计稿, 画板, 状态变体, or 点击演示 of a feature.
- The user wants to compare design options side by side before building.
- The user names Figma or OpenPencil for a mock-up.

## How It Works

### 1. Pick the tool

If the user already named the tool, use it. Otherwise ask with `AskUserQuestion`, one question, two options:

- **Figma 插件**: a local Figma development plugin. Editable component sets, click-through wiring, unit-tested offline. Needs Figma Desktop.
- **OpenPencil**: the `op` command line drives the OpenPencil editor. Boards are drawn headless and checked as exported images.

Then read only that tool's reference:

| Tool | Reference |
| --- | --- |
| Figma 插件 | `references/figma-plugin.md` |
| OpenPencil | `references/openpencil.md` |

### 2. Shared steps, before drawing

1. **Pin the decision.** One sentence: what this board set should let the user decide or confirm. If there are competing options, draw each as its own board side by side. The prototype answers a question; it is not a redraw of the app.
2. **Read the product's tokens.** Colours, radii, and type sizes come from the app's theme file (`globals.css`, a theme module). Put them in constants as hex. Never invent a palette.
3. **List the data first.** Tier tables, sample balances, states, copy. Keep them in constants at the top of the drawing source with a comment naming the source. The drawing code reads from them.
4. **Boards in reading order.** Screens top to bottom or left to right, then edge cases (narrow width, long titles). No overview board, no notes board.
5. **Opening the app.** OpenPencil: when the boards are done and saved, open the `.op` in OpenPencil without asking (see `references/openpencil.md`). Figma: ask whether to open it. OpenPencil editor already open when work starts: close it first (`op` runs much slower against the desktop editor), draw headless, then reopen the file when done. Never quit or restart Figma unasked.

### 3. Boards show the result only

A board holds the designed interface and nothing else. Every board should look like a screenshot of the finished product.

Never draw onto the canvas:

- a 问题与改法 / 现状 vs 改法 column, or any before-and-after pair
- an analysis, critique, or list of what is wrong with the current screen
- design rationale, 设计说明, why-this-works captions, spec callouts
- an overview board, a legend, a how-to-demo board, a changelog

The reasoning is the chat reply, not a layer. The user looks at the canvas to judge the design; a wall of red commentary next to it makes them read instead of look, and it ages the moment the design changes.

The only text allowed on a board is text that belongs to the product: labels, values, copy, empty states, error messages. Board names carry the screen name and its state (`Prototype / 报名页 · 报名中`), nothing else.

Reproducing a current screen is fine when the user asks to compare — draw it as its own board named `现状`, still with no annotations on it. Put what is wrong with it in the reply.

### 4. Attach the prototype to its issue

The superwork kanban shows each issue's 原型路径 and opens it in the tool that drew it. When the boards are done and the issue number is known, attach the prototype without asking.

1. **Find the issue number.** The first source that names one wins:
   - The user's message or the session prompt: `#521`, `521 号工单`, `issue 521`.
   - The worktree the session runs in. The kanban records each issue's worktree in the local issue-state file of the repo:

     ```bash
     jq -r --arg w "$(git rev-parse --show-toplevel)" \
       'to_entries[] | select(.key | startswith("forge:")) | select(.value.worktreePath == $w) | .key | ltrimstr("forge:")' \
       "$(git rev-parse --git-common-dir)/superwork/local-issue-state.json"
     ```

   Never guess the number from a branch name or an issue title. No number found: skip the next step and say in the reply that the prototype is not attached to any issue.
2. **Attach it.** Run from inside the repo, with the path relative to the repo root. The path points at the file the tool opens:

   | Tool | `--value` |
   | --- | --- |
   | Figma 插件 | the plugin's `manifest.json` |
   | OpenPencil | the `.op` file |

   ```bash
   opencli spx issue marker --issue <N> --type prototype --value docs/prototype/<feature>/openpencil/<feature>.op
   ```

   The command replaces the issue's existing prototype marker, so a redraw at the same path needs no second run. When it fails, report the error; do not hand-edit the issue body. The `ecc:using-spx-cli` skill covers spx.
3. **Report it.** Name the issue number and the attached path in the reply.

## Examples

**Tool not named.** User: "会员中心要加个额度进度条，会员 / 非会员 / 扣款失败三种，画个原型看看。" Ask Figma 插件 or OpenPencil. On Figma 插件, follow `references/figma-plugin.md`. On OpenPencil, follow `references/openpencil.md`: `build.js` draws three boards, each exported to PNG and checked, then open `membership.op` in OpenPencil.

**Tool named.** User: "用 openpencil 画一下报名页的报名中和已截止两个状态。" Skip the question and follow `references/openpencil.md`.

**Issue known.** The session prompt says "给 521 号工单画原型" and the user picks OpenPencil. After the boards are saved and opened, run `opencli spx issue marker --issue 521 --type prototype --value docs/prototype/desktop-settings/openpencil/desktop-settings.op` and report the issue number and path.
