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
5. **Boards top to bottom, sets on the right.** Screens in reading order, then edge cases (narrow width, long titles). Component sets go in a column to the right of the widest board. No overview board, no notes board — see Boards show the result only.
6. **Wire the demo.** `CHANGE_TO` between sibling variants for in-place state changes; `NAVIGATE` to other top-level boards for page moves; set `flowStartingPoints`. Buttons that would navigate back into their own board get highlight only, no reaction.
7. **Test.** `node --check code.js`, `node --test test.js`, write README.
8. **Ask before opening Figma.** The plugin is finished; ask the user whether to register it with Figma Desktop and launch it, then act on the answer. See Handoff.

## Boards show the result only

A board holds the designed interface and nothing else. Every board should look like a screenshot of the finished product.

Never draw onto the canvas:

- a 问题与改法 / 现状 vs 改法 column, or any before-and-after pair
- an analysis, critique, or list of what is wrong with the current screen
- design rationale, 设计说明, why-this-works captions, spec callouts
- an overview board, a legend, a how-to-demo board, a changelog

The reasoning is the chat reply, not a layer. The user looks at the canvas to judge the design; a wall of red commentary next to it makes them read instead of look, and it ages the moment the design changes.

The only text allowed on a board is text that belongs to the product: labels, values, copy, empty states, error messages. Board names carry the screen name and its state (`Prototype / 报名页 · 报名中`), nothing else.

Reproducing a current screen is fine when the user asks to compare — draw it as its own board named `现状`, still with no annotations on it. Put what is wrong with it in the reply.

## Plugin rules that bite

- **No `id` in `manifest.json`** for a local plugin. Private `setPluginData` throws without an id; use `setSharedPluginData(NAMESPACE, key, value)` for all node metadata. Never fabricate an id.
- `documentAccess: "dynamic-page"`, `editorType: ["figma"]`, `networkAccess.allowedDomains: ["none"]`. No UI, no network, no product data.
- **Fonts before anything else.** `listAvailableFontsAsync()`, pick the first available CJK family from `PingFang SC` → `Noto Sans CJK SC` → `Noto Sans SC` → `Source Han Sans SC`, load only the styles used (Regular, Medium; a display face for big numbers), and throw *before creating the page* when none exists. Never substitute a random font or download one.
- **Text order: `fontName` → `characters` → append → `textAutoResize` → FILL.** Paragraph text: `textAutoResize = "HEIGHT"` + `layoutSizingHorizontal = "FILL"`. Labels and values: `WIDTH_AND_HEIGHT` (hug). Single-line: `textTruncation = "ENDING"`, `maxLines = 1`. Setting `"HEIGHT"` before the characters on a fresh node freezes its width near 0 and every character wraps onto its own line; the fake does not catch this.
- **Latin monospace + Chinese: write in the CJK font first.** A mono font (JetBrains Mono, SF Mono, Menlo) has no Chinese glyphs. Putting Chinese into a text whose font is mono makes Figma look up a fallback for every glyph, tens of milliseconds per text layer. Set the CJK font, set `characters`, then `setRangeFontName` the non-Chinese runs to mono. Route every write — new text and instance overrides — through one `writeText(ctx, node, characters, font)`.
- **Figma scans `code.js` before loading it.** Text that looks like a dynamic import (`import` followed by `(`) or an HTML comment opener/closer anywhere in the file, even inside a string or comment, makes Figma refuse the plugin with a bare "An error occurred". Escape the parenthesis as `\u0028` in source snapshots and keep a test that scans `code.js` for both patterns.
- **Frame-only and text-only properties.** `layoutMode`, `padding*`, `itemSpacing`, the sizing modes exist only on frames; `fontSize`, `lineHeight`, `textAutoResize`, `maxLines` only on text. Setting them on the wrong node throws "object is not extensible". Wrap a text in a frame to pad it. The shared `fake-figma.js` throws the same error.
- **Auto layout everywhere.** Fixed width on the board and on table columns; everything else hugs or fills. Text wrap grows the parent. `clipsContent = false` so badges can overhang.
- **Reactions.** `setReactionsAsync`. `NAVIGATE` only to a frame whose parent is the page, with `resetInteractiveComponents: true`; Figma rejects a jump back into the source's own top-level frame. `CHANGE_TO` only to a sibling inside the same component set; `SMART_ANIMATE` 160 ms.
- **Icons** are inline lucide SVG paths through `createNodeFromSvg`. Keep a small `LUCIDE` map in `code.js`; add paths as needed. When the product itself uses lucide, copy the shape data from its `node_modules/lucide-react/dist/esm/icons/<name>.mjs` (`__iconNode`) so the prototype and the product show the same glyphs.
- **After building, select nothing.** Selecting a board expands it layer by layer in the Layers panel. Set `expanded = false` on every top-level node and only `scrollAndZoomIntoView([start])`.
- **Layer budget.** Keep the page under about 3000 layers outside instances, with a test that counts them. When over, share structure: a whole sidebar, a toolbar, a filter chip, a title bar keyed only by state with text overrides. Never raise the threshold to pass.
- **Never delete or overwrite.** New page every run; suffix a space and `2`, `3` when the name exists. A failed run keeps the partial page and reports the failing stage in `closePlugin`.
- **Page limits.** Starter files cap page count. Report it; do not free space by removing pages.

## When generation is slow

Measure in real Figma; the fake cannot tell you. The same build took 1.8 s in the fake and 28 s in Figma, and the one change made on a guess broke the layout without saving time.

1. **Stage timings are always on.** `run()` records a mark per `stage()` and puts `用时 N 秒（stage a、stage b …）` into `closePlugin` (the template does this). Ask the user to paste that line.
2. **When a stage is slow, break it down.** Add an accumulator and wrap the suspects:

   ```js
   let clock = null;                                   // new Map() at the start of build()
   function timed(label, fn) {
     if (!clock) return fn();
     const start = Date.now();
     try { return fn(); } finally { clock.set(label, (clock.get(label) || 0) + Date.now() - start); }
   }
   const measured = (label, fn) => function (...args) { return timed(`操作 · ${label}`, () => fn.apply(this, args)); };
   const text = measured("建文字层", function text(ctx, parent, name, characters, o = {}) { /* … */ });
   ```

   Wrap each component set (`make(name, …)`) and each board with `timed(name, …)`, and the helpers with `measured`: text creation, range fills, range fonts, find-by-name, `createNodeFromSvg`, `combineAsVariants`. Print the six slowest blocks and every operation in the closing message, then fix what the numbers point at.
3. **What paid off, measured on a 24-board page (27.8 s → 14.5 s):**
   - Chinese written into a mono font was the largest cost: text creation 10.6 s → 2.5 s after writing in the CJK font first (see Plugin rules).
   - `setRangeFills` re-lays out the whole text on every call: about 7 ms per call on a 4000-character source against 0.7 ms on a short one. Split long code into text chunks of about 8 lines, stacked with no gap, so it still looks like one block. Compute the highlighting once on the whole source, so multi-line comments stay coloured, then slice the ranges per chunk. Range fills fell from 4.6 s to 1.6 s.
   - Merge adjacent same-colour ranges, including across whitespace, and skip ranges in the base colour: fewer calls for the same picture.
   - Send all `setReactionsAsync` calls, then `await Promise.all`, instead of awaiting each one.
   - Never read `width` / `height` / `x` / `y` inside helpers. Each read forces a full auto-layout pass. Read geometry once, when placing boards.
4. **What did not pay off:** reordering text property writes. It saved nothing and, done wrong, collapsed every filled text to one character per line.

## Tests (`test.js`)

`fake-figma.js` mocks the document tree, auto-layout sizing, variants, instances, and reaction validation. It does not measure real fonts or render. Assert:

- manifest has no `id`, `main` is `code.js`, network is `none`;
- data constants match the source table (prices, rows, copy);
- each component set has the expected variant count;
- boards contain instances whose `mainComponentId` points into a set;
- link count equals the design (count them in a comment), `NAVIGATE` targets the right board, `CHANGE_TO` targets the sibling;
- no two top-level blocks overlap;
- running twice numbers the page and leaves user edits alone;
- missing CJK font fails before a page exists; page limit and reaction failures name their stage;
- `code.js` passes the load-time scan (no dynamic-import-looking text, no HTML comment markers);
- the page stays under the layer budget;
- mixed Chinese/code text is written in the CJK font with only the non-Chinese runs in mono (run the fake with a mono font in its font list).

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
