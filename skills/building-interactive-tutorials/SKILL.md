---
name: building-interactive-tutorials
description: 'Use when asked for an interactive 3D page that explains code in a repository (3D 交互教程, 笔记本式教程, 可视化讲解, 梳理现有机制, 现状和方案, 做一份像 tokenizer.html 这样的教程), or to add a section or demo to such a page. First asks which of two pages to build: a learning page that explains how part of an open-source project works inside, read top to bottom like viz/tokenizer.html in MiniMind (text cells, code cells whose Out is a real run, diagrams, cards, step-by-step three.js demos), or a change page for fixing or improving existing code: the current mechanism and the solution, each one short paragraph and one component-graph demo, the first recorded from a real run, the second taken from the design doc. One offline HTML file; esbuild inlines the scripts, Shiki colors code at build time. Covers the scaffold in assets/viz, both outlines, official links checked with scripts/check_links.py, recording a real run, the step data the 3D views animate, and clicking through every step in agent-browser.'
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
- Building a new 3D view for a concept neither the tile view nor the component graph can show.

Not for slide decks (`frontend-slides`), videos (`manim-video`, `remotion-video-creation`), or a standalone diagram (`diagram-design`).

## How It Works

`${CLAUDE_SKILL_DIR}` is the directory of this SKILL.md. When a path in a command does not start with `/`, replace everything before `/assets/` or `/scripts/` with the absolute path of that directory.

### 1. Ask Which Page

Before anything else, ask the user with `AskUserQuestion` which page to build. Skip the question only when the request already names one.

| Option | Pick it when | The page |
| --- | --- | --- |
| 学习页 | They want to understand how part of a project works inside, often an open-source one they are studying | What it is, why, how it works, subtopics; code cells, diagrams, cards, a demo per point |
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
    │   ├── graph-3d.js       3D view: a component graph whose parts light up step by step
    │   ├── notebook.css      cell layout, diagram and card styles, phase colors
    │   ├── player.js         demo player: paging, autoplay, pauses off-screen
    │   ├── runtime.js        mounts demos, builds the two-level TOC, opens repo links in VS Code
    │   └── tiles-3d.js       3D view: rows of tiles, score bars, a vocabulary shelf
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

When the concept is a system whose state changes as you act on it, write three scripts under `viz/runs/` that record one run, and take everything from it, so the Out blocks, the numbers in the text, and the demo cannot disagree:

- `runs/demo.py` wraps the executor the code runs its commands through (a sandbox class, `subprocess.run`), so each command and its output go into a log; `frame(label)` saves the system's state at that moment (files, refs, rows) with the commands logged since the last frame.
- `runs/run_all.sh` runs every code cell's script in order and copies each output and the frames into `runs/out/`.
- `runs/fill_cells.py` fills the template `runs/notebook.tpl.html`: `<!--CELL:name-->` becomes a code cell with `runs/name.py` as In and `runs/out/name.txt` as Out, only HTML-escaped, or a table Out when that file holds JSON rows; `{{sha:name}}` becomes the value the run saved under that name; the frames become `trace.js`, which `steps.js` imports.

After a rerun, every id and output on the page updates by itself. Edit the template, never the generated `notebook.html` or `trace.js`.

For a change page, record the current mechanism the same way, even though the page shows no code cells: the demo takes its ids, rows, and replies from the run. Then read the design doc (a spec, the issue) for the solution. When a design choice is still open, pick the best option yourself, draw it, mark it 待确认 on the page, and name it in your reply; do not stop the build to ask.

### 4. Outline the Page

A **learning page** has four parts, in this order:

1. **What it is** (`<X> 是什么`): one plain sentence, then a real example from the repository in a code cell.
2. **Why** (`目的和动机`): why it is needed, what goes wrong without it, the trade-offs.
3. **How it works** (`工作原理`): the mainstream method, with a 3D demo.
4. **Subtopics**: one `<h2>` per related point, one `<h3>` per item inside it, each item with a code cell or a demo. A comparison demo may close a subtopic.

- `<h2>` and `<h3>` feed the left TOC, `<h3>` indented under its `<h2>`. Give an `id` to every heading that another cell links to; generated ids change when headings move.
- Reference material about a library (its components, its files) is its own subtopic, not an appendix.
- The title bar carries a breadcrumb back to the index page and names the project the examples come from.

A **change page** has two parts and nothing else: no code cells, tables, cards, or subtopics unless the user asks for them.

1. **Current mechanism** (`<h2 id="now">现状</h2>`): one short paragraph on what the code does now and where it breaks, then one component-graph demo.
2. **Solution** (`<h2 id="next">解决方案</h2>`): one short paragraph on what changes and why that closes the break, then one component-graph demo.

- The title bar names the issue and the problem in one line.
- The demos carry the detail. Each caption is one or two short sentences; commands, rows, and ids go into `details`, which the reader opens with a click.

### 5. Write the Cells

```html
<section class="cell text">
  <h2 id="how">工作原理</h2>
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
- A text cell may also hold a `<table>`, a `<p class="note">`, and two layouts styled in `notebook.css`:
  - `<svg class="diagram">`, drawn by hand, `viewBox` 1000 wide. Boxes are `box`; add `used` for what this project uses and `optional` for optional parts; `end` for inputs and outputs; connectors are `edge` with an arrow `<marker>` whose id is unique on the page; text classes `name`, `role`, `mono`, `lane`. Wrap a box in `<a href="#card-id">` to jump to its card.
  - `<div class="cards">`, one `.card` per item with its own `id`: an `<h4>` with a `<small>` code name, a `<p>`, and a `<ul>` whose `<li>` holds two children, the name and what it means. `li.pick` marks what this project uses.
- Accent (`used`, `pick`) only what this project uses.
- A change page uses only text cells and demo cells.
- Write in Simplified Chinese: short plain sentences, one fact each. Explain a term in everyday words the first time it appears. Say why, not only what.
- Comments in `steps.js`, `main.js`, and any new view follow `writing-code-comments`.

### 6. Link Every Term to an Official Page

The first mention of another concept or an outside product links to an official page:

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

It fetches each outside page once and checks its status and every anchor used on it, checks that each repository path exists and each `#id` is on the page, prints one `FAIL` line per broken link, and exits 1 when there is one. `--offline` skips the network.

### 7. Compute the Demo From Real Results

A demo is a list of steps, and one step shows one change. The tile view reads these fields:

```js
{
  phase: '合并',                       // caption tag; a new phase needs a color in notebook.css
  title: '并成一块',
  text: '把挨着的两个 <code>l</code> 并成 <code>ll</code>。',  // HTML, one to three sentences
  rowsTitle: '输入',                    // optional heading over the rows
  rows: [{ key: 'word', label: '「hello」', tiles: [
    { id: 'c0', text: 'h', tag: 'base' },
    { id: 'merged', text: 'll', tag: 'new', from: ['c2', 'c3'] },
  ] }],
  bars: { title: '每个字母出现几次', items: [{ key: 'l', label: 'l', value: 2, display: '2 次', tag: 'focus' }] },  // optional
  vocab: { title: '词表', items: [{ key: 'll', text: 'll', tag: 'new' }] },  // optional
}
```

- A tile keeps its `id` across steps, so it slides to its new place. A new tile with `from` grows out of those tiles; a tile that disappears and is named in a `from` flies into the new one; any other tile that disappears sinks away.
- Tags: `base` plain, `focus` what this step is about, `new` just created, `done` finished, `muted` not involved, `unk` unknown, `removed` about to go.
- Compute the steps in a data module (`steps.js`, or one module per subtopic) from the outputs of step 3: either reimplement a small algorithm in JavaScript and check its result against the library's output, or copy the real ids and pieces into constants with a comment naming where they came from.
- Register each scene in `main.js` as `startNotebook({ [id]: { name, tagline, steps, createView } })`; the demo cell's `data-scene` is that `id`.

The tile view fits a concept that turns one sequence into another (text into pieces, pieces into ids). When the concept is several components that call, write, or point at each other, and the ones at work change from step to step, use the component graph view in `graph-3d.js`. One `GRAPH` lays out the whole system, and each demo lights up parts of it:

```js
export const GRAPH = {
  groups: [{ id: 'data', label: '数据', color: '#e2b93b', x: 0, z: 3.5, w: 25, d: 5.2 }],  // a ground plate with a title
  nodes: [{ id: 'counts', kind: 'table', label: '次数表', sub: 'counts', x: -2.75, z: 3.5,
            desc: '一个字母一行，记它出现几次。', code: 'src/topics/example/steps.js' }],
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
- When neither view can show the concept, write another view that returns `mount(stage)`, `render(step, { reset })`, and `setActive(active)`, and keep the player.

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
2. For each demo: scroll it into view, step through every step, and confirm the counter reaches the last one and each caption matches its scene. A demo builds its 3D view only after it scrolls into view. In a component graph, hover a node and click it (`agent-browser mouse move`, `mouse down`, `mouse up`): `.graph-tip` and then `.graph-panel` show.
3. Screenshot each new diagram, card group, table, and table Out; every text stays inside its box, and every column of a table Out lines up.
4. The TOC lists every new `<h2>` and `<h3>`, and its highlight follows the scroll.

The page sets `scroll-behavior: smooth`, so a screenshot taken right after a jump catches the page mid-scroll. Jump instantly first:

```bash
agent-browser --session tutorial eval "document.getElementById('how').scrollIntoView({ behavior: 'instant' })"
```

### 9. Update the Index

- `viz/README.md`: the page table, the directory tree for new data modules and `runs/`, any new cell markup.
- Any index page that links the tutorials (a roadmap, a docs home): add the new page or subtopic.

## Examples

**A whole page.** The MiniMind tokenizer page, outlined:

```
分词器是什么      code: encode two sentences, real ids and pieces
目的和动机
工作原理          demo: BPE training, then encoding
算法              h3 per algorithm (WordPiece, Unigram, WordLevel), a demo each, a comparison demo
预分词器          h3 per pre-tokenizer, demo
特殊 token        h3: one token per marker / what the three groups do / use in training and inference, demo
tokenizers        h3: common components (SVG diagram + cards), tokenizer.json (flow diagram + key table)
```

**A subtopic.** Request: "加一个子主题讲解这几个 special tokens".

1. Read where the token lists are defined in `train_tokenizer.py`, then where they are used: the dataset code, the chat template, the inference server.
2. Run three snippets: the 36 added tokens in their three groups, one registered marker against an unregistered look-alike, and a chat-template round trip through encode and decode.
3. Add `<h2 id="special-tokens">` with three `<h3>`, one code cell each.
4. Copy the real chat-template pieces into `special-tokens.js` and compute an eight-step demo from them; add colors for the new phases `模板` and `解码`.
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
| Tile ids that change between steps, so tiles jump instead of sliding | Give each piece one id for the whole demo |
| Several changes in one step | Split it; one step, one change |
| A screenshot caught mid-scroll | Scroll with `behavior: 'instant'` first |
| Text spilling out of a diagram box | Widen the box and screenshot again |
| A link to a heading without an `id` | Give the heading an `id` |
| Library reference material filed as an appendix | Make it a subtopic with its own `<h2>` |
| Editing the built `<name>.html` | Edit the sources and rebuild |
| A CLI's table pasted into `<pre class="code-out">`: Chinese text pushes columns out of line, a multi-line value splits its row | Record the rows as JSON and write a table Out (step 5) |
| Out blocks, text, and demo taken from different runs, so their numbers disagree | Record one run and generate all three from it (step 3) |
| A name laid flat on a node's top face, unreadable from the oblique camera | Draw the name tag as a sprite that always faces the camera |
| Step data in a second sprite stacked over the name tag; seen from above, the two overlap | Put the data on the same name tag, as its third line |
| A wide-angle camera, so near nodes look huge and far ones tiny | A narrow field of view (24°) from farther away |
| `check_links.py` keeps getting 503 from a GitHub file (`/blob/`) page | Link the directory page (`/tree/<tag>/<dir>`) of the same official repository at the same version tag |
| Building before asking which page | Ask first (step 1); the two outlines differ |
| A change page that grows code cells, tables, and subtopics | Keep two paragraphs and two demos; move the detail into `details` |
| The solution graph laid out anew, so nothing lines up with the current one | Keep every shared component's `id` and position |
| Solution numbers made up for the demo | Take them from the design doc, reuse the ids of the current run |
| Stopping to ask about an open design choice before anything is drawn | Pick the best option, mark it 待确认, and name it in the reply |

## Before You Finish

- [ ] The user chose the page kind, or named it in the request.
- [ ] Every Out block is a real run, pasted verbatim, and every number in the text matches the runs or the repository.
- [ ] On a change page: two paragraphs and two demos only, shared components sit in the same place in both graphs, and every 待确认 choice is named in the reply.
- [ ] `check_links.py` prints `OK` for the built page.
- [ ] Every demo steps from first to last without errors, each new phase has a color, and each component graph shows its tip and panel on a node.
- [ ] Every new diagram, card group, table, and table Out was screenshot, and nothing overflows.
- [ ] `viz/README.md` and any index page list the new page or subtopic, and the built HTML is rebuilt from the sources.

## Source

Distilled from building the tokenizer tutorial (`viz/tokenizer.html`) for [MiniMind](https://github.com/jingyaogong/minimind). The scaffold in `assets/viz` is that page's shell, with the tokenizer content replaced by a small example. The component graph view and the recorded run come from a later tutorial on a web platform's automatic code versioning, where a sync process, a Git server, and a database change state turn by turn. The change page comes from turning that tutorial, and one on a chat platform that revealed its real image model, into before-and-after pages for the fixes that followed.
