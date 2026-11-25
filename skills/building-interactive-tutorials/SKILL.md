---
name: building-interactive-tutorials
description: 'Use when asked for an interactive 3D page that explains code in a repository (3D 交互教程, 笔记本式教程, 可视化讲解, 梳理现有机制, 现状和方案, 做一份像 tokenizer.html 这样的教程), or to add a section or demo to such a page. First asks which of two pages to build: a learning page that explains how part of an open-source project works inside, read top to bottom like viz/tokenizer.html in MiniMind (text cells, code cells whose Out is a real run, diagrams, cards, a step-by-step three.js demo for every mechanism), or a change page for fixing or improving existing code: the current mechanism and the solution, each one short paragraph and one component-graph demo, the first recorded from a real run, the second taken from the design doc. One offline HTML file built with esbuild and Shiki. Covers the scaffold in assets/viz, both outlines, official links checked with scripts/check_links.py, recording a real run, the step data the two 3D views (data flow, component graph) animate, and clicking through every step in agent-browser.'
---

# Building Interactive Tutorials

One topic, one page: a single HTML file that carries its own scripts and styles and opens offline with a double-click. The page comes in two kinds, for two jobs:

- **Learning page** (学习页): you want to understand how part of a project, often an open-source one, works inside. It reads top to bottom like a Jupyter notebook: text cells, code cells, and 3D demo cells take turns, with subtopics.
- **Change page** (改造页): you are about to fix or improve existing code, so the current mechanism may be replaced. It holds two sections, the current mechanism and the solution, each one short paragraph and one 3D demo, and nothing more.

Two rules hold both together: every number on the page comes from running the repository's own code, or, for a solution, from the design doc; and every outside term links to an official page that was opened before it went in.

## When to Use

- The user asks for an interactive, 3D, or notebook-style tutorial that explains a concept in the repository: 3D 交互教程, 可视化讲解, "做一份像 tokenizer.html 这样的教程".
- Adding a subtopic, section, code cell, diagram, card group, or demo to an existing page under `viz/`.
- Explaining how the parts of a system act on each other while it runs (a sync process, a Git server, a database): a component graph fed by one recorded run.
- Before a fix or an optimization: lay out how the current code works and where it breaks, then the solution, as a change page (梳理现有机制再给方案, 现状和方案).
- Building a new 3D view for a concept neither 3D view (data flow, component graph) can show.

Not for slide decks (`frontend-slides`), videos (`manim-video`, `remotion-video-creation`), or a standalone diagram (`diagram-design`).

## How It Works

`${CLAUDE_SKILL_DIR}` is the directory of this SKILL.md. When a path in a command does not start with `/`, replace everything before `/assets/` or `/scripts/` with the absolute path of that directory.

### 1. Ask Which Page

Before anything else, ask the user with `AskUserQuestion` which page to build. Skip the question only when the request already names one.

| Option | Pick it when | The page |
| --- | --- | --- |
| 学习页 | They want to understand how part of a project works inside, often an open-source one they are studying | Introduction (what it is and why it is needed), core concepts, one chapter per concept; code cells, diagrams, cards, a demo per point |
| 改造页 | They are about to change existing code: a bug, an optimization, a redesign, usually tied to an issue | 现状 and 解决方案, one short paragraph and one component-graph demo each |

Put the option that fits the request first and mark it recommended. When the project's `viz/README.md` says which kind its pages are, recommend that kind. The choice decides steps 4 and 7; every other step is the same for both.

### 2. Set Up viz/ Once

If the project already has the scaffold (`viz/README.md`, sometimes under `docs/`), read that README first: it is the project's copy of these rules and lists the pages already built. Otherwise copy the scaffold and add the dependencies with commands, without versions:

```bash
cp -R ${CLAUDE_SKILL_DIR}/assets/viz ./viz
cd viz
pnpm init
pnpm pkg set type=module scripts.build="node build.mjs"
pnpm add three
pnpm add -D esbuild shiki
pnpm approve-builds esbuild
pnpm build
```

pnpm refuses to run esbuild's install script until `approve-builds` allows it. `pnpm build` writes `example.html`, a learning page, and `example-change.html`, a change page, to compare against. Copy the one that matches the chosen page to the topic's name, delete both examples once a real page exists, and update the page table in `viz/README.md`.

```
viz/
├── build.mjs                 src/topics/<name>/ → <name>.html, everything inlined
├── README.md                 the page list, the writing rules, how to add a topic
└── src/
    ├── notebook/             the shell every page shares
    │   ├── blocks-3d.js      what the block views share: blocks, labels, transitions, stage, camera
    │   ├── flow-3d.js        3D view: data blocks moving across plates joined by arrows
    │   ├── graph-3d.js       3D view: a component graph whose parts light up step by step
    │   ├── notebook.css      cell layout, diagram and card styles, phase colors
    │   ├── pipeline-flow.js  layout for data passing station by station in a straight line
    │   ├── player.js         demo player: paging, autoplay, pauses off-screen
    │   └── runtime.js        mounts demos, builds the two-level TOC, opens repo links in VS Code
    └── topics/
        ├── example/          a learning page
        │   ├── notebook.html     the cells
        │   ├── main.js           registers each demo under its scene name
        │   └── steps.js          computes each demo step
        └── example-change/   a change page
            ├── notebook.html     现状 and 解决方案, a paragraph and a demo each
            ├── main.js           gives each demo its own graph
            └── steps.js          GRAPH_NOW, GRAPH_NEXT, and the steps of both demos
```

Browsers refuse to load local ES modules from a `file://` page, so `build.mjs` bundles each topic's scripts into one inline script with esbuild and colors the code with Shiki at build time. Commit the built `<name>.html` next to its sources so readers open it without building.

### 3. Study the Code and Run It

1. Read the code path that implements the concept: the script that trains or builds it, its config, the data loader, the callers. Note each file and symbol you will mention; you will link them.
2. Run every snippet you will show, from the repository root, with the project's runner (`uv run python ...`). Paste the output verbatim into the Out block. Never write an output from memory or tidy it by hand. When the output is a table, record its rows as JSON instead and lay them out as a table Out (step 5).
3. Record the installed versions of the libraries you will link (`uv pip show <package>`), so the doc links match them.
4. Take every fact the page states (counts, ids, sizes, ranges) from those runs or from the repository files.
5. When a stage cannot be recorded (no model weights on this machine, no access to the server), feed it the nearest real data and say so in the text next to the demo. MiniMind has no weights locally, so its decode step reuses the ids that encoding produced, and the caption says that a real chat would decode the ids the model generates.
6. Back every conclusion the text states with the real Out of a code cell. When the text says a round trip loses nothing, the cell prints the decoded string next to the input (`print(text, ids, tok.decode(ids))`); when no Out shows it, drop the claim.

When the concept is a system whose state changes as you act on it, write three scripts under `viz/runs/` that record one run, and take everything from it, so the Out blocks, the numbers in the text, and the demo cannot disagree:

- `runs/demo.py` wraps the executor the code runs its commands through (a sandbox class, `subprocess.run`), so each command and its output go into a log; `frame(label)` saves the system's state at that moment (files, refs, rows) with the commands logged since the last frame.
- `runs/run_all.sh` runs every code cell's script in order and copies each output and the frames into `runs/out/`.
- `runs/fill_cells.py` fills the template `runs/notebook.tpl.html`: `<!--CELL:name-->` becomes a code cell with `runs/name.py` as In and `runs/out/name.txt` as Out, only HTML-escaped, or a table Out when that file holds JSON rows; `{{sha:name}}` becomes the value the run saved under that name; the frames become `trace.js`, which `steps.js` imports.

After a rerun, every id and output on the page updates by itself. Edit the template, never the generated `notebook.html` or `trace.js`.

For a change page, record the current mechanism the same way, even though the page shows no code cells: the demo takes its ids, rows, and replies from the run. Then read the design doc (a spec, the issue) for the solution. When a design choice is still open, pick the best option yourself, draw it, mark it 待确认 on the page, and name it in your reply; do not stop the build to ask.

### 4. Outline the Page

A **learning page** has three parts, in this order:

1. **Introduction** (`<h2 id="intro">简介</h2>`): what it is and why it is needed, in plain sentences; a model reads only numbers, never text, so text has to become ids first. When this describes a mechanism (a tokenizer encodes text into ids and decodes them back), a demo of it follows, and right under the demo a code cell that runs the same example through the repository's code.
2. **Core concepts** (`<h2 id="concepts">核心概念</h2>`): one 3D concept map of every core concept the topic involves and how they relate, what produces what and what uses what (step 7).
3. **One chapter per core concept**: every concept on the concept map gets its own `<h2>`, except the input and output the introduction already walks through. Variants of one kind (ByteLevel, BertPreTokenizer, Metaspace, Whitespace) get an `<h3>` each. When a concept comes in categories (special tokens: start, end, and padding; chat markers; function markers; reserved slots), the chapter opens with a short introduction and a list of the categories, each with an official example. How the mainstream method works inside, such as how BPE trains and encodes, is an `<h3>` in the chapter it belongs to (算法), never a chapter of its own.

- An `<h3>` about a variant (an algorithm, a pre-tokenizer, a decoder) runs in this order: a general introduction that does not center on this project (what it is, where it comes from with its paper, why it helps, which class implements it in the library); then a `<p><b>使用场景</b></p>` list, name and link only, this project first; then one demo whose step captions carry how it works. No list of how-it-works points and no note box: their content goes into the captions, and a side topic (how ByteLevel turns text into bytes) is left to the section that teaches it. Drop a paragraph after the demo that repeats its last caption. An `<h3>` that explains a mechanism rather than a variant (整段认出, 聊天模板) has no 使用场景 list.
- How something works never goes into a code cell, a list of points, a note box, a key-value table, or an SVG diagram; it goes into a demo's captions. The introduction's code cell is the one that backs its demo.
- Sibling items of one chapter, such as its four algorithms, follow the same template and draw their demos with the same layout: all on the data flow view with training along the back and encoding along the front, never one drawn another way. No comparison section closes the chapter; each item's demo already shows how it differs.
- Why it is needed belongs in the introduction, not in a chapter of its own. A comparison of the ways to do it (byte, word, subword) is not a motivation either; each way's own chapter item shows how it differs.

- Every section or item that explains a mechanism (data going in and coming out changed, parts acting on each other) has a demo cell. Text alone does not count, nor two bullet points that say "encoding turns text into ids, decoding turns them back".
- The title bar holds the `<h1>` and nothing else: no breadcrumb, no subtitle. The TOC follows it.
- `<h2>` and `<h3>` feed the left TOC, `<h3>` indented under its `<h2>`. Give an `id` to every heading that another cell links to; generated ids change when headings move.
- A library's files and components (tokenizer.json) are core concepts too: each gets a chapter whose demo shows how they are made and used (train → save → load → encode), not an appendix of key tables or diagrams.

A **change page** has two parts and nothing else: no code cells, tables, cards, or subtopics unless the user asks for them.

1. **Current mechanism** (`<h2 id="now">现状</h2>`): one short paragraph on what the code does now and where it breaks, then one component-graph demo.
2. **Solution** (`<h2 id="next">解决方案</h2>`): one short paragraph on what changes and why that closes the break, then one component-graph demo.

- The title bar names the issue and the problem in one line.
- The demos carry the detail. Each caption is one or two short sentences; commands, rows, and ids go into `details`, which the reader opens with a click.

### 5. Write the Cells

```html
<section class="cell text">
  <h2 id="intro">简介</h2>
  <p>…</p>
</section>

<section class="cell code">
  <div class="cell-gutter">In</div>
  <pre class="code-in" data-lang="python">print(tok.convert_ids_to_tokens([1]))</pre>
  <div class="cell-gutter">Out</div>
  <pre class="code-out">['&lt;|im_start|&gt;']</pre>
</section>

<section class="cell demo" data-scene="special-tokens"></section>
```

- Escape `<`, `>`, and `&` inside both `<pre>` blocks. The build unescapes `code-in` before Shiki colors it; `code-out` shows as written.
- When the output is a table (a CLI's list command, query rows), never paste its aligned text into `<pre class="code-out">`. The CLI pads columns by character count while the browser draws a Chinese character two columns wide, so the columns drift; a value with a line break splits its row; a long value runs off the edge. Record the rows instead: run the command with its JSON option (`--json`, `-o json`, `--format json`), or, when it has none, have the cell's script fetch the same rows through the API or library the command calls and print them as JSON. In shows what ran. Out puts each value verbatim, HTML-escaped, in its own `<td>`; line breaks inside a value stay:

  ```html
  <div class="code-out out-table"><table>
    <thead><tr><th>key</th><th>value</th></tr></thead>
    <tbody><tr><td>intent_routing.enabled</td><td>true</td></tr></tbody>
  </table></div>
  ```
- A code cell is one of two kinds: it backs the demo right above it, or it is itself what the section teaches. Delete any other.
- A cell that backs a demo follows the demo with no text between them and runs the demo's own input. Split its code into one part per part of the demo, each under a comment on its own line (`# 编码：切成 token，再查词表换编号`). Never end a line with a comment: a Chinese character is two columns wide, so trailing comments drift out of line. Its Out shows every number the demo uses: the ids, the table size, the restored text.
- No lead-in or preview around a code cell: not "the ids come from a real run; reproduce them with `uv run python`", not "the next sections explain how". When another section needs a number from an Out, it states the number itself instead of pointing back.
- A text cell may also hold a `<table>`, a `<p class="note">`, and two layouts styled in `notebook.css`:
  - `<svg class="diagram">`, drawn by hand, `viewBox` 1000 wide. Boxes are `box`; add `used` for what this project uses and `optional` for optional parts; `end` for inputs and outputs; connectors are `edge` with an arrow `<marker>` whose id is unique on the page; text classes `name`, `role`, `mono`, `lane`. Wrap a box in `<a href="#card-id">` to jump to its card.
  - `<div class="cards">`, one `.card` per item with its own `id`: an `<h4>` with a `<small>` code name, a `<p>`, and a `<ul>` whose `<li>` holds two children, the name and what it means. `li.pick` marks what this project uses.
- Accent (`used`, `pick`) only what this project uses.
- A change page uses only text cells and demo cells.
- Write in Simplified Chinese: short plain sentences, one fact each. Explain a term in everyday words the first time it appears. Say why, not only what.
- Write no operating instructions in the text or a caption: nothing about where to click, how to page, what hovering shows, or what a click opens. The reader knows how to use a page.
- Several items of the same kind (projects, files, options) go in a list, not strung into one sentence.
- In a 使用场景 list, this project links to its source file; an outside project links to an official page, its source or docs, that says in words that it uses the method. Open each page and search it for the method's name before linking. Several items may share one page, such as the section of a docs page that lists the models using it, or one source file that names what each model uses: in HF transformers, `convert_slow_tokenizer.py` gives BertConverter BertPreTokenizer and WordPiece, the GPT2, Roberta, and Qwen2 converters ByteLevel, and SpmConverter, which T5, ALBERT, and XLNet inherit, Metaspace.
- Comments in `steps.js`, `main.js`, and any new view follow `writing-code-comments`.

### 6. Link Every Term to an Official Page

On a learning page this is required: every technical term, and every outside product, links to its official page at its first mention. An unlinked term is a defect, like a wrong number. Where each kind links:

| Term | Link to |
| --- | --- |
| Machine-learning concept | The [Google ML glossary](https://developers.google.com/machine-learning/glossary?hl=zh-cn) in Chinese, with its anchor, such as `#token` |
| NLP concept | The [Hugging Face LLM course](https://huggingface.co/learn/llm-course/zh-CN/chapter1/1) in Chinese |
| Library, model, tool | Its official docs, site, or repository; docs for the installed version |
| Paper | Its arXiv abstract page |
| File in the repository | A path relative to the built page, such as `../trainer/train_tokenizer.py`; opened from `file://`, the runtime turns it into a `vscode://` link |

Never link a blog, tutorial, Q&A answer, or mirror. When the installed version has no docs (a 404), use the nearest published version and keep it for every link into the same docs. When an anchor does not exist, link a nearby anchor that does, or the page itself.

After each build, check every link of the built page:

```bash
uv run ${CLAUDE_SKILL_DIR}/scripts/check_links.py viz/<name>.html
```

It fetches each outside page once and checks its status and every anchor used on it, checks that each repository path exists and each `#id` is on the page, prints one `FAIL` line per broken link, and exits 1 when there is one. `--offline` skips the network. It asks with a browser User-Agent and retries a 429 or 503 twice, waiting longer each time; a link still refused prints as `LIMITED`, which means the site is probably throttling scripts, and does not fail the run. Open each `LIMITED` link in a browser to confirm it loads.

When you delete a section, find the terms whose first, linked mention was in it. Where such a term appears again later, link that mention, since it is now the first.

### 7. Compute the Demo From Real Results

A demo is a list of steps, and one step shows one change. A learning page draws every mechanism on the data flow view and its concept map on the component graph; a change page draws both of its demos on the component graph. Pick the layout by what the reader has to see:

| Layout | Use it when | Example |
| --- | --- | --- |
| Data flow in a straight line, `createFlowView(pipelineFlow({ stages, rows, arrows, labels }))` with `pipeline-flow.js` | One piece of data passes station by station and changes form at each, one sequence turning into another included | ByteLevel: text → chunks → bytes; a decoder: ids → tokens → text; tokenizer.json: train → save → load → encode |
| Data flow in two rows, `createFlowView(FLOW)` in `flow-3d.js`, laid out by hand or by a shared function such as `trainEncodeFlow` | A process in stages that share a product, or two trips over one table | The four tokenizer algorithms, training along the back and encoding along the front; encode and decode reading the same vocabulary |
| Component graph, `createGraphView(GRAPH)` in `graph-3d.js` | Several components call, write, or point at each other, and the ones at work change step by step; on a learning page, the 核心概念 concept map | A sync process, a Git server, and a database during one turn; the ten concepts of a tokenizer and what produces what |

Whatever the view, split the picture into zones. A process in stages (training, then use) is two rows: the first stage along the back, the second along the front, and what both share (the merge rules, the vocabulary) on one plate that spans both rows, written by the first and read by the second. Every plate carries a title. Never crowd several kinds of information into one oblique view without zones, and never leave an intermediate product, such as the rules training writes, only in the captions: put it on a plate as blocks.

A component graph lights up who is connected to whom, but the data never appears on it. When the lesson is what the data turns into, such as one vocabulary read forwards to encode and backwards to decode, use the data flow view.

Every step carries these fields, whatever the view:

```js
{
  phase: '合并',                       // caption tag; a new phase needs a color in notebook.css
  title: '并成一块',
  text: '把挨着的两个 <code>l</code> 并成 <code>ll</code>。',  // HTML, one to three sentences
}
```

- Tags on a block or a node: `base` plain, `focus` what this step is about, `new` just created, `done` finished, `muted` not involved, `unk` unknown, `removed` about to go.
- Compute the steps in a data module (`steps.js`, or one module per subtopic) from the outputs of step 3: either reimplement a small algorithm in JavaScript and check its result against the library's output, or copy the real ids and pieces into constants with a comment naming where they came from.
- Keep computing and drawing apart. A pure function returns one record per round or per step (the pair counted, the rule written, the pieces after it), and each view has its own function that turns those records into its steps. Two demos of the same algorithm read the same records, so their numbers cannot drift. Sibling demos also share one layout function, such as `trainEncodeFlow(...)`, which lays out the training row and the encoding row, takes the optional middle plate and the row names as options, and names the slots and arrows the same way for all of them.
- Register each scene in `main.js` as `startNotebook({ [id]: { name, tagline, steps, createView } })`; the demo cell's `data-scene` is that `id`.

The data flow view lays plates out like the nodes of a flowchart, joins them with arrows on the ground, and moves the real data across them as blocks that split, merge, and change form. One `FLOW` holds the layout of the whole demo:

```js
export const FLOW = {
  plates: [                                          // the stages, in one row from left to right
    { id: 'text', label: '文字', color: '#4fd1c5', x: -10.5, z: 0.6, w: 5, d: 8.4 },
    { id: 'tok', label: '拆分与合并', color: '#6aa8ff', x: 0, z: 0.6, w: 10.5, d: 8.4 },
  ],
  slots: {                                           // where blocks queue up, one centred row each
    word: { x: -10.5, z: -1.6 },
    vocab: { x: 0.6, z: 0.6, label: '词表' },        // the label sits left of the row
    ids: { x: 0, z: 2.8, alignWith: 'vocab' },       // block i sits under block i of vocab
  },
  arrows: [{ id: 'in', from: 'text', to: 'tok', z: -1.6, label: '输入' }],  // along depth z, plate edge to plate edge
};

{                                                    // one step, besides phase, title, text
  plates: ['tok'],                                   // lit plates; the rest dim
  arrows: ['in'],                                    // lit arrows, with dots flowing along
  blocks: [{ id: 'n2', text: '4', tag: 'new', at: 'ids', from: ['merged', 'v2'] }],  // at names a slot
}
```

- A block keeps its `id` for the whole demo, so it slides to its new place. A new block with `from` grows out of those blocks; a source that disappears flies into it; any other block that disappears sinks away. A source listed earlier in the same step counts, so a rule can grow a vocabulary entry in the step that writes it.
- Later steps keep the blocks of earlier stations. The next station's blocks grow out of them, with `from` naming blocks that stay, and only blocks really merged into one fly into it; a split, a lookup, or a hand-over leaves its source in place. Otherwise the last step shows empty plates and the chain is gone.
- `alignWith` makes a lookup visible. Show only the table rows this run uses, in the order of the blocks, so each block and its result sit over their row. A slot whose block count differs from its partner's centres on its own `x`.
- Give each direction its own lane (`z`), such as encoding along the back and decoding along the front with the table in between, so both trips read the same rows.
- Leave room for each plate's title, which lies along the plate's back edge: put the first row of blocks at least 1.5 in front of that edge (`slot.z ≥ plate.z − plate.d / 2 + 1.5`).
- Arrows run left or right, so keep the plates of one stage in one row. The camera frames every plate by itself, from far away with a narrow field of view, and refits when the stage resizes; there are no camera coordinates to tune.
- Register it as `createView: () => createFlowView(FLOW)`.
- For stations in a straight line, let `pipelineFlow({ stages, rows, arrows, labels })` in `pipeline-flow.js` build the `FLOW`. `stages` are `{ id, label, w, rows, color }` from left to right, each with its own number of rows; `arrows` are the words on the arrows between neighbours; `labels` names a stage's rows (`{ letters: ['「hello」', '「hell」'] }`). Slots are named plate id plus row number (`letters0`) and arrows `from>to`; it leaves room for every title and rotates the colors.

The component graph view in `graph-3d.js` lays out the whole system in one `GRAPH`, and each demo lights up parts of it:

```js
export const GRAPH = {
  groups: [{ id: 'data', label: '数据', color: '#e2b93b', x: 0, z: 3.5, w: 25, d: 5.2 }],  // a ground plate with a title
  nodes: [{ id: 'counts', kind: 'table', label: '次数表', sub: 'counts', x: -2.75, z: 3.5,
            desc: '一个字母一行，记它出现几次。', code: 'src/topics/example/steps.js', href: '#split-merge' }],
  edges: [{ id: 'point', from: 'top', to: 'counts', label: '指着', desc: '只是指着一行。', dashed: true }],
};

{                                                 // one step, besides phase, title, text
  nodes: { count: 'active', counts: 'new' },      // active, new, gap, base, off; unlisted nodes dim
  edges: [{ id: 'write', label: '写次数', tone: 'new' }],  // lit, with dots flowing along
  badges: { counts: '4 种字母' },                  // third line of the name tag, or { text, tone }
  details: { counts: ['h  1 次', 'e  1 次'] },    // the lines the tip and the panel show
  focus: ['count', 'counts'],                     // the camera frames these
}
```

- `x` runs right and `z` toward the reader. A node is 3.4 wide and 1.7 deep: space nodes about 5.5 apart, and leave room left of a group's first node for its title.
- Kinds: `process` a rounded box, `store` a cylinder, `table` a ringed cylinder, `ref` a purple box. Add a kind in `GRAPH.kinds` and a tone in `GRAPH.tones`.
- Hovering a node shows its `desc`, `code`, and the first four lines of `details`, and hovering an edge its `label` and `desc`; a click pins a panel with every line; a double click reframes the step.
- Register it as `createView: () => createGraphView(GRAPH)`, and give its demo cell `style="--stage-height: 560px"` so the name tags fit.
- On a learning page the component graph draws the 核心概念 concept map: one node per core concept with a real number in its `sub` (6400 行, 6108 条), and one edge per relation, labelled with it (学出 token, 按顺序套用, 占 0–35 号). Give each node an `href`, the `#id` of the chapter that teaches it; the pinned panel then shows a 去讲它的那一节 → link, which the hover tip leaves out because the pointer cannot reach it.
- A concept map's first step shows the whole map, every node `base` and `focus` on all of them. Each later step lights one block, in the order of the page's chapters, and ends its caption with `→ <a href="#chapter">name</a>`. Every chapter has its step, so adding a chapter adds a step. Give its cell `style="--stage-height: 600px"`, and size each group plate to its nodes: the camera frames the nodes, so a plate much wider than them puts its title out of frame.
- When neither view can show the concept, write another view that returns `mount(stage)`, `render(step, { reset })`, and `setActive(active)`, and keep the player. A view made of blocks builds on `createBlockScene` in `blocks-3d.js`, which already holds the stage, the camera, the transitions, and `syncBlocks`.

A change page draws two graphs, `GRAPH_NOW` for the current mechanism and `GRAPH_NEXT` for the solution, as `example-change/steps.js` does:

- A component in both graphs keeps its `id` and its position, so the reader watches the same place change. A component the solution removes is left out of `GRAPH_NEXT`; a new or changed one gets the tone `new` in the solution steps.
- The solution steps follow the current steps wherever the flows match (one turn, a preview, a restore), so the two demos compare step by step.
- Light each break in the current demo with the tone `gap`, and end it on a step that lights every gap at once. End the solution on the step that closes them.
- Solution data come from the design doc: names, rules, limits. Reuse the ids of the current run (commit hashes, session ids) to make them concrete, and say in the caption that a step shows the design, not a run.
- Register each demo with its own graph: `createView: () => createGraphView(GRAPH_NOW)` and `createView: () => createGraphView(GRAPH_NEXT)`.

### 8. Build and Click Through Every Step

```bash
pnpm build
```

Run it in `viz/`, then check the built page with `agent-browser` (see that skill), in its own `--session`:

1. Open `file://<absolute path>/viz/<name>.html`. `agent-browser errors` and `agent-browser console` print nothing.
2. For each demo: scroll it into view, step through every step, and confirm the counter reaches the last one and each caption matches its scene. A demo builds its 3D view only after it scrolls into view. In a component graph, hover a node and click it (`agent-browser mouse move`, `mouse down`, `mouse up`): `.graph-tip` and then `.graph-panel` show; on a concept map, the panel's `.goto` link jumps to its section. In a data flow view, screenshot each lookup step: every block sits over its table row.
3. Screenshot each new diagram, card group, table, and table Out; every text stays inside its box, and every column of a table Out lines up.
4. The TOC lists every new `<h2>` and `<h3>`, and its highlight follows the scroll.

The page sets `scroll-behavior: smooth`, so a screenshot taken right after a jump catches the page mid-scroll. Jump instantly first:

```bash
agent-browser --session tutorial eval "document.getElementById('how').scrollIntoView({ behavior: 'instant' })"
```

Once a brand-new page passes these checks, open it in the system's default browser so the user sees it right away: `open viz/<name>.html` on macOS, `xdg-open viz/<name>.html` on Linux, `start "" viz\<name>.html` on Windows. This is the user's own browser, not the headless one agent-browser drives, and it applies to both page kinds.

### 9. Update the Index

- `viz/README.md`: the page table, the directory tree for new data modules and `runs/`, any new cell markup.
- Any index page that links the tutorials (a roadmap, a docs home): add the new page or subtopic.

## Examples

**A whole page.** The MiniMind tokenizer page, outlined:

```
简介              what it is, why a model needs it; demo: encode and decode through one vocabulary (data flow);
                  code right under it: same sentence, ids, table size, decoded
核心概念          demo: concept map, one node per concept, one step per chapter; step 1 the whole map
算法              h3 per algorithm (BPE, WordPiece, Unigram, WordLevel): general intro, 使用场景 list, one demo,
                  all four on one layout: training along the back, encoding along the front; no comparison section
预分词器          h3 per pre-tokenizer (ByteLevel, BertPreTokenizer, Metaspace, Whitespace), a pipeline demo each
特殊 token        intro and a list of categories; h3 整段认出 and 聊天模板, a pipeline demo each
解码器            h3 per decoder (ByteLevel, Metaspace, WordPiece), a pipeline demo each
tokenizer.json    one pipeline demo: train → save → load → encode
```

**A subtopic.** Request: "加一个子主题讲解这几个 special tokens".

1. Read where the token lists are defined in `train_tokenizer.py`, then where they are used: the dataset code, the chat template, the inference server.
2. Run three snippets: the 36 added tokens in their three groups, one registered marker against an unregistered look-alike, and a chat-template round trip through encode and decode.
3. Add `<h2 id="special-tokens">`: a short introduction and a list of the categories, then `<h3>` 整段认出 and 聊天模板.
4. Copy the real chat-template pieces into `special-tokens.js`, lay each demo out with `pipelineFlow`, and compute its steps from them; add colors for the new phases `模板` and `解码`, and a step on the concept map for the chapter.
5. Build, run `check_links.py`, step through all eight steps, and add the module to the tree in `viz/README.md`.

**A change page.** Request: "用户问出图模型是什么，智能体说出了真实型号；先梳理现有机制，再给方案".

1. Ask which page; the user picks 改造页.
2. Record three real turns on a test server: the question with an automatic model, the same with a hand-picked model, and a rephrased question. Save each turn's routing record and reply.
3. Draw `GRAPH_NOW` in three rows (routing, the turn, image generation and billing) and one eight-step demo: the judge, the plan, the reply, each route, then the image path, ending on all the gaps.
4. Draw `GRAPH_NEXT` with the same positions, take the solution from the decisions so far, pick the open one yourself and mark it 待确认, and build a demo that follows the same flow.
5. Write one paragraph above each demo, build, click through both demos.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| An Out block written from memory or tidied by hand | Rerun the snippet and paste its output verbatim |
| A link to a blog, or to an anchor nobody opened | Official pages only; run `check_links.py` |
| Docs for the installed version return 404 | Use the nearest published version, the same one everywhere |
| `<` left unescaped in a code cell, so the browser eats it as a tag | Write `&lt;`, `&gt;`, `&amp;` |
| A new phase name with no color | Add `.demo-meta .phase[data-phase="…"]` to `notebook.css` |
| Block ids that change between steps, so blocks jump instead of sliding | Give each piece one id for the whole demo |
| Several changes in one step | Split it; one step, one change |
| A screenshot caught mid-scroll | Scroll with `behavior: 'instant'` first |
| Text spilling out of a diagram box | Widen the box and screenshot again |
| A link to a heading without an `id` | Give the heading an `id` |
| Library reference material filed as an appendix | Make it a chapter whose demo shows how it is made and used |
| Editing the built `<name>.html` | Edit the sources and rebuild |
| A CLI's table pasted into `<pre class="code-out">`: Chinese text pushes columns out of line, a multi-line value splits its row | Record the rows as JSON and write a table Out (step 5) |
| Out blocks, text, and demo taken from different runs, so their numbers disagree | Record one run and generate all three from it (step 3) |
| A name laid flat on a node's top face, unreadable from the oblique camera | Draw the name tag as a sprite that always faces the camera |
| Step data in a second sprite stacked over the name tag; seen from above, the two overlap | Put the data on the same name tag, as its third line |
| A wide-angle camera, so near nodes look huge and far ones tiny | A narrow field of view (24°) from farther away |
| `check_links.py` lists a GitHub file (`/blob/`) page as `LIMITED` | GitHub throttles scripts; open the page in a browser, and keep the link when it loads |
| Building before asking which page | Ask first (step 1); the two outlines differ |
| A change page that grows code cells, tables, and subtopics | Keep two paragraphs and two demos; move the detail into `details` |
| The solution graph laid out anew, so nothing lines up with the current one | Keep every shared component's `id` and position |
| Solution numbers made up for the demo | Take them from the design doc, reuse the ids of the current run |
| Stopping to ask about an open design choice before anything is drawn | Pick the best option, mark it 待确认, and name it in the reply |
| A mechanism told in text or two bullet points, with no demo | Add a demo cell; on a learning page every mechanism has one |
| A breadcrumb or subtitle under a learning page's title | Keep the `<h1>` and the TOC only |
| Data passing through stages drawn as a component graph: the reader sees who talks to whom, not what becomes what | Use the data flow view |
| A lookup whose result sits apart from its table row | Show only the rows used, in block order, and set `alignWith` |
| A stage the run could not record, filled in without a word | Feed it the nearest real data and say so in the text (step 3) |
| A conclusion in the text, such as "the round trip loses nothing", that no Out shows | Print the evidence in the code cell, such as `tok.decode(ids)`, or drop the claim |
| A new block view that copies the stage, camera, or transitions | Build on `createBlockScene` in `blocks-3d.js` |
| A 工作原理 chapter that explains one algorithm, such as how BPE trains and encodes | Make the second chapter 核心概念, a concept map; the algorithm goes under its subtopic as an `<h3>` |
| A motivation chapter that actually compares the ways to do it | Say why it is needed in the introduction; let each way's own chapter item show how it differs |
| A deleted section takes a term's only link with it | Link the term's new first mention (step 6) |
| Operating instructions in the text or a caption, such as 点一个概念看说明 or 用 ← → 翻页 | Delete them; the reader knows how to use the page |
| A method subtopic that opens on this project, or several projects strung into one sentence | Open with a general introduction, then a 使用场景 list, then how it works (step 4) |
| How it works written as a list of points plus a note box next to the demo | Put it into the demo's captions; leave side topics to their own section |
| A demo without zones, with an intermediate product (the merge rules) only named in the captions | Give each stage its own row of titled plates, and put the product on a plate as blocks |
| Sibling subtopics drawn differently, one on the flow view and one another way, or a comparison section closing the chapter | One template and one layout function for all of them; no comparison section |
| A 使用场景 link to a page that never names the method | Open the page, search it for the method's name, and link one that says so |
| A concept on the concept map with no chapter of its own | Add the chapter, then its step on the map |
| Plates left empty by the last step, so the chain is gone | Keep every station's blocks; grow the next station's blocks out of them |
| A lead-in or a preview around a code cell ("reproduce it like this", "later sections explain"), or a code cell that neither backs a demo nor is its section's content | Delete them; a cell that backs a demo sits right under it, one commented part per part of the demo (step 5) |

## Before You Finish

- [ ] The user chose the page kind, or named it in the request.
- [ ] Every Out block is a real run, pasted verbatim, and every number in the text matches the runs or the repository.
- [ ] On a learning page: only the `<h1>` under the title, an introduction that says what it is and why it is needed, no separate motivation chapter, a 核心概念 concept map whose nodes link to their chapters and a chapter for every concept on it, method subtopics in the order general introduction, 使用场景, how it works, no operating instructions, a demo for every mechanism, an official link on every technical term, evidence in an Out for every conclusion, and every stage the run could not record named in the text.
- [ ] Every code cell backs the demo above it or is its section's content, has no lead-in or preview around it, and its Out shows every number its demo uses.
- [ ] On a change page: two paragraphs and two demos only, shared components sit in the same place in both graphs, and every 待确认 choice is named in the reply.
- [ ] `check_links.py` prints `OK` for the built page, and every `LIMITED` link loads in a browser.
- [ ] Every demo steps from first to last without errors, each new phase has a color, and each component graph shows its tip and panel on a node.
- [ ] Every new diagram, card group, table, and table Out was screenshot, and nothing overflows.
- [ ] `viz/README.md` and any index page list the new page or subtopic, and the built HTML is rebuilt from the sources.
- [ ] A brand-new page is open in the system's default browser.

## Source

Distilled from building the tokenizer tutorial (`viz/tokenizer.html`) for [MiniMind](https://github.com/jingyaogong/minimind). The scaffold in `assets/viz` is that page's shell, with the tokenizer content replaced by a small example. The data flow view and the learning-page rules on the title, demos, and evidence come from a section-by-section review of that page. The component graph view and the recorded run come from a later tutorial on a web platform's automatic code versioning, where a sync process, a Git server, and a database change state turn by turn. The change page comes from turning that tutorial, and one on a chat platform that revealed its real image model, into before-and-after pages for the fixes that followed.
