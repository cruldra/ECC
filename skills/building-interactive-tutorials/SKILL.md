---
name: building-interactive-tutorials
description: 'Use when asked to explain a concept from a code repository as a notebook-style interactive tutorial page like viz/tokenizer.html in MiniMind (3D 交互教程, 笔记本式教程, 可视化讲解, 做一份像 tokenizer.html 这样的教程), or to add a section, subtopic, code cell, diagram, or 3D demo to such a page. The page is one offline HTML file read top to bottom: text cells, code cells whose Out is a real run, step-by-step three.js demos computed from real results, inline SVG diagrams and cards; esbuild inlines the scripts and Shiki colors the code at build time. Covers setting up viz/ from the scaffold in assets/viz, the page outline (what it is, why, how it works, subtopics), linking each term to an official page and checking it with scripts/check_links.py, the step data the 3D view animates, and clicking through every step in agent-browser before finishing.'
---

# Building Interactive Tutorials

One concept, one page, read top to bottom like a Jupyter notebook: text cells, code cells, and 3D demo cells take turns. The output is a single HTML file that carries its own scripts and styles and opens offline with a double-click. Two rules hold the page together: every number on it comes from running the repository's own code, and every outside term links to an official page that was opened before it went in.

## When to Use

- The user asks for an interactive, 3D, or notebook-style tutorial that explains a concept in the repository: 3D 交互教程, 可视化讲解, "做一份像 tokenizer.html 这样的教程".
- Adding a subtopic, section, code cell, diagram, card group, or demo to an existing page under `viz/`.
- Building a new 3D view for a concept the tile view cannot show.

Not for slide decks (`frontend-slides`), videos (`manim-video`, `remotion-video-creation`), or a standalone diagram (`diagram-design`).

## How It Works

`${CLAUDE_SKILL_DIR}` is the directory of this SKILL.md. When a path in a command does not start with `/`, replace everything before `/assets/` or `/scripts/` with the absolute path of that directory.

### 1. Set Up viz/ Once

If `viz/` exists, read `viz/README.md` first: it is the project's copy of these rules and lists the pages already built. Otherwise copy the scaffold and add the dependencies with commands, without versions:

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

pnpm refuses to run esbuild's install script until `approve-builds` allows it. `pnpm build` writes `example.html`, a working page to compare against. Rename `src/topics/example/` to the concept's name once real content replaces it, and update the page table in `viz/README.md`.

```
viz/
├── build.mjs                 src/topics/<name>/ → <name>.html, everything inlined
├── README.md                 the page list, the writing rules, how to add a topic
└── src/
    ├── notebook/             the shell every page shares
    │   ├── notebook.css      cell layout, diagram and card styles, phase colors
    │   ├── player.js         demo player: paging, autoplay, pauses off-screen
    │   ├── runtime.js        mounts demos, builds the two-level TOC, opens repo links in VS Code
    │   └── tiles-3d.js       3D view: rows of tiles, score bars, a vocabulary shelf
    └── topics/example/
        ├── notebook.html     the cells
        ├── main.js           registers each demo under its scene name
        └── steps.js          computes each demo step
```

Browsers refuse to load local ES modules from a `file://` page, so `build.mjs` bundles each topic's scripts into one inline script with esbuild and colors the code with Shiki at build time. Commit the built `<name>.html` next to its sources so readers open it without building.

### 2. Study the Code and Run It

1. Read the code path that implements the concept: the script that trains or builds it, its config, the data loader, the callers. Note each file and symbol you will mention; you will link them.
2. Run every snippet you will show, from the repository root, with the project's runner (`uv run python ...`). Paste the output verbatim into the Out block. Never write an output from memory or tidy it by hand.
3. Record the installed versions of the libraries you will link (`uv pip show <package>`), so the doc links match them.
4. Take every fact the page states (counts, ids, sizes, ranges) from those runs or from the repository files.

### 3. Outline the Page

Four parts, in this order:

1. **What it is** (`<X> 是什么`): one plain sentence, then a real example from the repository in a code cell.
2. **Why** (`目的和动机`): why it is needed, what goes wrong without it, the trade-offs.
3. **How it works** (`工作原理`): the mainstream method, with a 3D demo.
4. **Subtopics**: one `<h2>` per related point, one `<h3>` per item inside it, each item with a code cell or a demo. A comparison demo may close a subtopic.

- `<h2>` and `<h3>` feed the left TOC, `<h3>` indented under its `<h2>`. Give an `id` to every heading that another cell links to; generated ids change when headings move.
- Reference material about a library (its components, its files) is its own subtopic, not an appendix.
- The title bar carries a breadcrumb back to the index page and names the project the examples come from.

### 4. Write the Cells

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
- A text cell may also hold a `<table>`, a `<p class="note">`, and two layouts styled in `notebook.css`:
  - `<svg class="diagram">`, drawn by hand, `viewBox` 1000 wide. Boxes are `box`; add `used` for what this project uses and `optional` for optional parts; `end` for inputs and outputs; connectors are `edge` with an arrow `<marker>` whose id is unique on the page; text classes `name`, `role`, `mono`, `lane`. Wrap a box in `<a href="#card-id">` to jump to its card.
  - `<div class="cards">`, one `.card` per item with its own `id`: an `<h4>` with a `<small>` code name, a `<p>`, and a `<ul>` whose `<li>` holds two children, the name and what it means. `li.pick` marks what this project uses.
- Accent (`used`, `pick`) only what this project uses.
- Write in Simplified Chinese: short plain sentences, one fact each. Explain a term in everyday words the first time it appears. Say why, not only what.
- Comments in `steps.js`, `main.js`, and any new view follow `writing-code-comments`.

### 5. Link Every Term to an Official Page

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

### 6. Compute the Demo From Real Results

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
- Compute the steps in a data module (`steps.js`, or one module per subtopic) from the outputs of step 2: either reimplement a small algorithm in JavaScript and check its result against the library's output, or copy the real ids and pieces into constants with a comment naming where they came from.
- Register each scene in `main.js` as `startNotebook({ [id]: { name, tagline, steps, createView } })`; the demo cell's `data-scene` is that `id`.
- When the tile view cannot show the concept, write another view that returns `mount(stage)`, `render(step, { reset })`, and `setActive(active)`, and keep the player.

### 7. Build and Click Through Every Step

```bash
pnpm build
```

Run it in `viz/`, then check the built page with `agent-browser` (see that skill), in its own `--session`:

1. Open `file://<absolute path>/viz/<name>.html`. `agent-browser errors` and `agent-browser console` print nothing.
2. For each demo: scroll it into view, step through every step, and confirm the counter reaches the last one and each caption matches its scene. A demo builds its 3D view only after it scrolls into view.
3. Screenshot each new diagram, card group, and table; every text stays inside its box.
4. The TOC lists every new `<h2>` and `<h3>`, and its highlight follows the scroll.

The page sets `scroll-behavior: smooth`, so a screenshot taken right after a jump catches the page mid-scroll. Jump instantly first:

```bash
agent-browser --session tutorial eval "document.getElementById('how').scrollIntoView({ behavior: 'instant' })"
```

### 8. Update the Index

- `viz/README.md`: the page table, the directory tree for new data modules, any new cell markup.
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

## Before You Finish

- [ ] Every Out block is a real run, pasted verbatim, and every number in the text matches the runs or the repository.
- [ ] `check_links.py` prints `OK` for the built page.
- [ ] Every demo steps from first to last without errors, and each new phase has a color.
- [ ] Every new diagram, card group, and table was screenshot, and nothing overflows.
- [ ] `viz/README.md` and any index page list the new page or subtopic, and the built HTML is rebuilt from the sources.

## Source

Distilled from building the tokenizer tutorial (`viz/tokenizer.html`) for [MiniMind](https://github.com/jingyaogong/minimind). The scaffold in `assets/viz` is that page's shell, with the tokenizer content replaced by a small example.
