---
name: ui-prototyping
description: 'Draw UI prototypes, design boards, state variants, and click-through demos with OpenPencil and the op CLI. Use when the user asks for a 原型 / 设计稿 / 画板 / Design Lab / 状态变体 / 点击演示, says 用 openpencil 画, or wants a feature''s screens mocked up.'
---

# UI Prototyping

A prototype answers one design question with boards that look like the finished product. Use OpenPencil's `op` command line and keep the drawing source in the repo, so a prototype can be re-run, diffed, and reviewed.

## When to Use

- The user asks for a 原型, 设计稿, 画板, 状态变体, or 点击演示 of a feature.
- The user wants to compare design options side by side before building.
- The user names OpenPencil for a mock-up.

## How It Works

### 1. Read the OpenPencil workflow

Read `references/openpencil.md` and its bundled design reference. The `op` command line drives OpenPencil. Draw headless and check the boards as exported images.

### 2. Shared steps, before drawing

1. **Pin the decision.** One sentence: what this board set should let the user decide or confirm. If there are competing options, draw each as its own board side by side. The prototype answers a question; it is not a redraw of the app.
2. **Read the product's tokens.** Colours, radii, and type sizes come from the app's theme file (`globals.css`, a theme module). Put them in constants as hex. Never invent a palette.
3. **List the data first.** Tier tables, sample balances, states, copy. Keep them in constants at the top of the drawing source with a comment naming the source. The drawing code reads from them.
4. **Boards in reading order.** Screens top to bottom or left to right, then edge cases (narrow width, long titles). No overview board, no notes board.
5. **Opening the app.** When the boards are done and saved, open the `.op` in OpenPencil without asking (see `references/openpencil.md`). OpenPencil editor already open when work starts: close it first (`op` runs much slower against the desktop editor), draw headless, then reopen the file when done.

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

## Examples

**Tool not named.** User: "会员中心要加个额度进度条，会员 / 非会员 / 扣款失败三种，画个原型看看。" Follow `references/openpencil.md`: `build.js` draws three boards, each exported to PNG and checked, then open `membership.op` in OpenPencil.

**Tool named.** User: "用 openpencil 画一下报名页的报名中和已截止两个状态。" Follow `references/openpencil.md`.
