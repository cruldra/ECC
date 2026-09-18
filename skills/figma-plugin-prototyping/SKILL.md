---
name: figma-plugin-prototyping
description: Draw UI prototypes in Figma by writing a local Figma development plugin (manifest.json + code.js on the Plugin API), tested offline against a fake Figma document, instead of driving Figma through the MCP. Use when the user asks for a Figma 原型 / 设计稿 / 画板 / Design Lab / 状态变体 / 点击演示, says "用 figma 插件画", or wants a feature's screens and click-through mocked up in Figma. Not for reading an existing Figma file into code (use figma-design-to-code) and not for OpenPencil (use openpencil-prototyping).
---

# Figma Plugin Prototyping

Prototype = a local Figma development plugin the user imports once and runs. The plugin creates a fresh page with editable component sets, prototype boards built from instances, and click-through wiring. All drawing code lives in the repo, runs offline against a fake document in `node --test`, and is reviewed like any other code.

## Why not the Figma MCP

`use_figma` sends JavaScript chunks into a live file: 50k-character limit per call, no tests, no diff, no rerun, half-finished pages when a chunk throws. The plugin route keeps one file that can be re-run, versioned, and unit-tested. Use the MCP only afterwards to screenshot the result for review (`get_screenshot`), never to draw.

## Layout in the target repo

```
docs/prototype/
  figma-lab/fake-figma.js          # shared mock, one copy per repo
  <feature>/figma-plugin/
    manifest.json                  # from templates/, no plugin id
    code.js                        # the whole plugin, one file
    test.js                        # node:test against fake-figma
    README.md                      # what it draws, how to run, acceptance list
```

Copy `${CLAUDE_PLUGIN_ROOT}/skills/figma-plugin-prototyping/scripts/fake-figma.js` into `docs/prototype/figma-lab/` when the repo does not have it yet. Start `code.js`, `test.js`, and `manifest.json` from `${CLAUDE_PLUGIN_ROOT}/skills/figma-plugin-prototyping/templates/`. If the repo already has a sibling `docs/prototype/*/figma-plugin/code.js`, copy that one instead so colours, fonts, and helpers stay identical.

## Procedure

1. **Pin the decision.** One sentence: what this board set should let the user decide or confirm. If there are competing options, draw each as its own board side by side with the trade-off written on the board. The prototype answers a question; it is not a redraw of the app.
2. **Read the product's tokens.** Colours, radii, and type sizes come from the app's theme file (`globals.css`, a theme module). Put them in `COLORS` as hex. Never invent a palette.
3. **List the data first.** Tier tables, sample balances, states, copy. Keep them in constants at the top of `code.js` with a comment naming the source. The drawing functions read from them; tests assert on them.
4. **Components before boards.** Every repeated block is a component with variants (`State=`, `Kind=`, `Theme=`). Boards only place `createInstance()` of those components. Editing the main component must propagate to every board.
5. **Boards top to bottom, sets on the right.** Overview board first (design notes + how to demo), then screens in reading order, then edge cases (narrow width, long titles). Component sets go in a column to the right of the widest board.
6. **Wire the demo.** `CHANGE_TO` between sibling variants for in-place state changes; `NAVIGATE` to other top-level boards for page moves; set `flowStartingPoints`. Buttons that would navigate back into their own board get highlight only, no reaction.
7. **Test.** `node --check code.js`, `node --test test.js`, write README.
8. **Ask before opening Figma.** The plugin is finished; ask the user whether to register it with Figma Desktop and launch it, then act on the answer. See Handoff.

## Plugin rules that bite

- **No `id` in `manifest.json`** for a local plugin. Private `setPluginData` throws without an id; use `setSharedPluginData(NAMESPACE, key, value)` for all node metadata. Never fabricate an id.
- `documentAccess: "dynamic-page"`, `editorType: ["figma"]`, `networkAccess.allowedDomains: ["none"]`. No UI, no network, no product data.
- **Fonts before anything else.** `listAvailableFontsAsync()`, pick the first available CJK family from `PingFang SC` → `Noto Sans CJK SC` → `Noto Sans SC` → `Source Han Sans SC`, load only the styles used (Regular, Medium; a display face for big numbers), and throw *before creating the page* when none exists. Never substitute a random font or download one.
- **Set `fontName` before `characters`.** Paragraph text: `textAutoResize = "HEIGHT"` + `layoutSizingHorizontal = "FILL"`. Labels and values: `WIDTH_AND_HEIGHT` (hug). Single-line: `textTruncation = "ENDING"`, `maxLines = 1`.
- **Auto layout everywhere.** Fixed width on the board and on table columns; everything else hugs or fills. Text wrap grows the parent. `clipsContent = false` so badges can overhang.
- **Reactions.** `setReactionsAsync`. `NAVIGATE` only to a frame whose parent is the page, with `resetInteractiveComponents: true`; Figma rejects a jump back into the source's own top-level frame. `CHANGE_TO` only to a sibling inside the same component set; `SMART_ANIMATE` 160 ms.
- **Icons** are inline lucide SVG paths through `createNodeFromSvg`. Keep a small `LUCIDE` map in `code.js`; add paths as needed.
- **Never delete or overwrite.** New page every run; suffix a space and `2`, `3` when the name exists. A failed run keeps the partial page and reports the failing stage in `closePlugin`.
- **Page limits.** Starter files cap page count. Report it; do not free space by removing pages.

## Tests (`test.js`)

`fake-figma.js` mocks the document tree, auto-layout sizing, variants, instances, and reaction validation. It does not measure real fonts or render. Assert:

- manifest has no `id`, `main` is `code.js`, network is `none`;
- data constants match the source table (prices, rows, copy);
- each component set has the expected variant count;
- boards contain instances whose `mainComponentId` points into a set;
- link count equals the design (count them in a comment), `NAVIGATE` targets the right board, `CHANGE_TO` targets the sibling;
- no two top-level blocks overlap;
- running twice numbers the page and leaves user edits alone;
- missing CJK font fails before a page exists; page limit and reaction failures name their stage.

Update `EXPECTED_LINKS` when wiring changes. Green tests do not prove the visual result; say so in the README.

## README.md for the prototype

Chinese, short. Sections: what it draws (table: board → source component file → design point), 导入与运行 (Figma Desktop → open a Design file → `Plugins > Development > Import plugin from manifest…` → run from `Plugins > Development`), 运行条件 (fonts, page slots), 生成内容 (sets with variant axes, boards in order), 数值来源, 原型交互, 本地检查 (the two node commands), 桌面验收清单 (checkboxes the user ticks in Figma). State that the mock run is not a visual acceptance.

## Handoff

Tell the user: the manifest path, which board to select for the demo, and the acceptance list. Never push nodes through the MCP. If the user then wants a screenshot for review, `get_screenshot` on the page they ran it in is fine.

Then ask whether to open it — a question, never a default. Opening quits their Figma, which is not something to do unasked:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/figma-plugin-prototyping/scripts/import-into-figma.js" <abs path to manifest.json>
```

The script adds the plugin to `localFileExtensions` in Figma Desktop's `settings.json` — the same list the Import-plugin-from-manifest menu writes — backs the file up first, and launches Figma. The user still runs it from Plugins > Development.

Two reasons it quits Figma first, and both are why this cannot be done with Figma open:

- Figma rewrites `settings.json` from memory on quit, so an entry written while it runs is erased when the user closes it.
- Figma caches plugin code per process, so an already-registered plugin keeps running the previous `code.js` until a restart — the user would look at the old prototype and think nothing changed.

It quits gracefully through `osascript` and waits up to 10 seconds, never kills: a killed Figma loses unsaved canvas work. If Figma will not quit, the script says so and stops; do not kill it yourself.

Off macOS the script prints the path for a manual import instead. Re-running on the same manifest skips the write and just restarts Figma, which is the normal way to pick up an edited `code.js`.

## Example

User: "会员中心要加个额度进度条，会员 / 非会员 / 扣款失败三种，画个原型看看。"

- `docs/prototype/membership/figma-plugin/code.js`: `Membership / QuotaBar` (`Level=normal | warn | exhausted`), `Membership / StatusCard` (`Status=active | canceled | past_due`), three `Prototype / 会员中心 · …` boards from instances, `NAVIGATE` from "变更方案" to the pricing board.
- `test.js`: quota values, 3 + 3 variants, 4 links, no overlap, page numbering, font and page-limit failures.
- README with the boards table and the desktop checklist.
- Reply: import path, "select `Prototype / 会员中心 · 会员` and press Present", checklist.
