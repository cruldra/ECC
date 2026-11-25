#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { spawn, spawnSync } = require("child_process");
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const skillDir = path.join(path.resolve(__dirname, "..", ".."), "skills", "building-interactive-tutorials");
const skillFile = path.join(skillDir, "SKILL.md");
const body = fs.readFileSync(skillFile, "utf8");
const translation = fs.readFileSync(path.join(skillDir, "i18n", "zh-CN.md"), "utf8");
const vizDir = path.join(skillDir, "assets", "viz");
const exampleDir = path.join(vizDir, "src", "topics", "example");
const changeDir = path.join(vizDir, "src", "topics", "example-change");
const notebookHtml = fs.readFileSync(path.join(exampleDir, "notebook.html"), "utf8");
const changeHtml = fs.readFileSync(path.join(changeDir, "notebook.html"), "utf8");
const notebookCss = fs.readFileSync(path.join(vizDir, "src", "notebook", "notebook.css"), "utf8");
const viewSource = (name) => fs.readFileSync(path.join(vizDir, "src", "notebook", name), "utf8");
const TAGS = new Set(["base", "focus", "new", "done", "muted", "unk", "removed"]);
const checkLinks = path.join(skillDir, "scripts", "check_links.py");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message}`);
    failed++;
  }
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [path.relative(vizDir, full)];
  });
}

/** 从 SKILL.md 的目录树代码块里取出文件名（带扩展名的那些）。 */
function treeFiles(text) {
  const tree = text.match(/```\nviz\/\n([\s\S]*?)```/);
  assert.ok(tree, "SKILL.md must draw the viz/ tree");
  return [...tree[1].matchAll(/[─ ]([\w-]+\.(?:mjs|md|css|js|html))\s/g)].map((m) => m[1]).sort();
}

/** 把 `src/` 整棵拷到临时目录并标成 ES 模块再导入 `steps.js`，它引用的布局函数（如 pipeline-flow.js）跟着能找到；不加载 three.js。 */
async function loadSteps(dir = exampleDir) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tutorial-steps-"));
  fs.cpSync(path.join(vizDir, "src"), path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
  return import(pathToFileURL(path.join(root, path.relative(vizDir, dir), "steps.js")).href);
}

/** 从 graph-3d.js 的源码里读出 `export const <name> = { ... }` 这张表的键，测试不用加载 three.js。 */
function tableKeys(name) {
  const source = fs.readFileSync(path.join(vizDir, "src", "notebook", "graph-3d.js"), "utf8");
  const table = source.match(new RegExp(`export const ${name} = (\\{[\\s\\S]*?\\});`));
  assert.ok(table, `graph-3d.js must export ${name}`);
  // 表里只有字符串字面量，按对象字面量求值即可。
  return new Set(Object.keys(new Function(`return ${table[1]};`)()));
}

/** `<h2 id="...">` 这一节的 HTML：从这个标题到下一个 `<h2>` 之前。 */
function sectionOf(html, id) {
  const start = html.indexOf(`<h2 id="${id}">`);
  assert.ok(start >= 0, `no <h2 id="${id}">`);
  const next = html.indexOf("<h2", start + 1);
  return html.slice(start, next < 0 ? undefined : next);
}

/** 一张数据流转图和用它的演示：平台、slot、箭头都得存在，方块的 id、标签、来源都守方块的规矩。 */
function checkFlow(flow, scenes) {
  const plates = new Set(flow.plates.map((p) => p.id));
  const arrows = new Set(flow.arrows.map((a) => a.id));
  assert.strictEqual(plates.size, flow.plates.length, "duplicate plate id");
  assert.strictEqual(arrows.size, flow.arrows.length, "duplicate arrow id");
  for (const a of flow.arrows) assert.ok(plates.has(a.from) && plates.has(a.to), `arrow ${a.id} joins a missing plate`);
  for (const [name, slot] of Object.entries(flow.slots)) {
    if (slot.alignWith) assert.ok(flow.slots[slot.alignWith], `slot ${name} aligns with missing slot ${slot.alignWith}`);
  }
  let aligned = 0;
  for (const scene of scenes) {
    let before = new Set();
    for (const step of scene.steps) {
      for (const field of ["phase", "title", "text"]) assert.ok(step[field], `a step has no ${field}`);
      for (const id of step.plates ?? []) assert.ok(plates.has(id), `${step.title} lights missing plate ${id}`);
      for (const id of step.arrows ?? []) assert.ok(arrows.has(id), `${step.title} lights missing arrow ${id}`);
      const ids = step.blocks.map((b) => b.id);
      assert.strictEqual(new Set(ids).size, ids.length, `duplicate block id in ${step.title}`);
      const count = (slot) => step.blocks.filter((b) => b.at === slot).length;
      // 来源可以是上一步的方块，也可以是这一步排在前面、先建出来的方块（规则长出词表的一项）。
      const earlier = new Set();
      for (const b of step.blocks) {
        assert.ok(flow.slots[b.at], `${b.id} sits in missing slot ${b.at}`);
        assert.ok(TAGS.has(b.tag), `unknown tag ${b.tag}`);
        for (const source of b.from ?? []) assert.ok(before.has(source) || earlier.has(source), `${b.id} grows from missing ${source}`);
        earlier.add(b.id);
      }
      for (const [name, slot] of Object.entries(flow.slots)) {
        if (slot.alignWith && count(name) > 0 && count(name) === count(slot.alignWith)) aligned++;
      }
      before = new Set(ids);
    }
  }
  return aligned;
}

/** 一张组件图和用它的演示：组件、连线、种类、状态色都得是画面认识的。 */
function checkGraph(graph, scenes, kinds, tones) {
  const nodes = new Set(graph.nodes.map((n) => n.id));
  const edges = new Set(graph.edges.map((e) => e.id));
  assert.strictEqual(nodes.size, graph.nodes.length, "duplicate node id");
  assert.strictEqual(edges.size, graph.edges.length, "duplicate edge id");
  for (const n of graph.nodes) assert.ok(kinds.has(n.kind), `node ${n.id} has unknown kind ${n.kind}`);
  for (const e of graph.edges) assert.ok(nodes.has(e.from) && nodes.has(e.to), `edge ${e.id} joins a missing node`);
  for (const scene of scenes) {
    for (const step of scene.steps) {
      for (const field of ["phase", "title", "text"]) assert.ok(step[field], `a step has no ${field}`);
      for (const [id, tone] of Object.entries(step.nodes)) {
        assert.ok(nodes.has(id), `${step.title} lights missing node ${id}`);
        assert.ok(tones.has(tone), `${step.title} gives ${id} unknown tone ${tone}`);
      }
      for (const edge of step.edges ?? []) {
        assert.ok(edges.has(edge.id), `${step.title} lights missing edge ${edge.id}`);
        if (edge.tone) assert.ok(tones.has(edge.tone), `${step.title} gives ${edge.id} unknown tone ${edge.tone}`);
      }
      for (const field of ["badges", "details"]) {
        for (const id of Object.keys(step[field] ?? {})) assert.ok(nodes.has(id), `${step.title} ${field} name missing node ${id}`);
      }
      for (const id of step.focus ?? []) assert.ok(nodes.has(id), `${step.title} focuses missing node ${id}`);
    }
  }
}

async function main() {
  console.log("\n=== Testing building-interactive-tutorials skill ===\n");

  await test("frontmatter names the skill with a quoted one-line description under 1024 characters", () => {
    const match = body.match(/^---\nname: building-interactive-tutorials\ndescription: '([^'\n]+)'\n---\n/);
    assert.ok(match, "frontmatter must hold name and a single-quoted description");
    assert.ok(match[1].length <= 1024, `description is ${match[1].length} characters`);
    assert.ok(match[1].includes("assets/viz") && match[1].includes("scripts/check_links.py"));
  });

  await test("keeps the sections and the eight steps in order", () => {
    const sections = body.split("\n").filter((line) => line.startsWith("## "));
    assert.deepStrictEqual(sections, [
      "## When to Use",
      "## How It Works",
      "## Examples",
      "## Common Mistakes",
      "## Before You Finish",
      "## Source",
    ]);
    const steps = body.split("\n").filter((line) => /^### \d\./.test(line));
    assert.deepStrictEqual(steps, [
      "### 1. Ask Which Page",
      "### 2. Set Up viz/ Once",
      "### 3. Study the Code and Run It",
      "### 4. Outline the Page",
      "### 5. Write the Cells",
      "### 6. Link Every Term to an Official Page",
      "### 7. Compute the Demo From Real Results",
      "### 8. Build and Click Through Every Step",
      "### 9. Update the Index",
    ]);
  });

  await test("every path under the skill directory that SKILL.md names exists", () => {
    const named = [...body.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w./-]+)/g)].map((m) => m[1]);
    assert.ok(named.length >= 2);
    for (const rel of named) assert.ok(fs.existsSync(path.join(skillDir, rel)), `missing ${rel}`);
  });

  await test("the viz/ tree in SKILL.md and in the scaffold README lists exactly the scaffold files", () => {
    const files = listFiles(vizDir).map((f) => path.basename(f)).sort();
    assert.deepStrictEqual(treeFiles(body), files);
    const readme = fs.readFileSync(path.join(vizDir, "README.md"), "utf8");
    const readmeTree = readme.match(/```\nviz\/\n([\s\S]*?)```/)[1];
    for (const file of files.filter((f) => f !== "README.md")) {
      assert.ok(readmeTree.includes(file), `scaffold README tree is missing ${file}`);
    }
  });

  await test("the example page keeps the build placeholders and links only to ids it has", () => {
    assert.ok(notebookHtml.includes("<style>{{STYLE}}</style>"));
    assert.ok(notebookHtml.includes("<script>{{SCRIPT}}</script>"));
    const ids = new Set([...notebookHtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const [, id] of notebookHtml.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(id), `no id ${id}`);
  });

  await test("notebook.css styles every diagram and card class SKILL.md tells you to use", () => {
    for (const cls of ["box", "end", "edge", "name", "role", "mono", "lane"]) {
      assert.ok(notebookCss.includes(`.diagram .${cls}`), `.diagram .${cls} is not styled`);
    }
    for (const cls of ["used", "optional"]) assert.ok(notebookCss.includes(`.diagram .box.${cls}`));
    assert.ok(notebookCss.includes(".cards") && notebookCss.includes(".card li.pick"));
  });

  await test("a table Out is a styled HTML table, shown in the example page and taught in SKILL.md", () => {
    assert.ok(notebookCss.includes(".code-out.out-table") && notebookCss.includes(".out-table td"), ".out-table is not styled");
    assert.match(notebookCss, /\.out-table td \{[^}]*white-space: pre-wrap/, "line breaks inside a value must stay");
    assert.ok(notebookHtml.includes('<div class="code-out out-table"><table>'), "the example page needs a table Out");
    assert.ok(body.includes('<div class="code-out out-table"><table>') && body.includes("--json"), "SKILL.md must teach the table Out");
  });

  await test("the example demos are registered under their data-scene in page order, every mechanism on a data flow view", async () => {
    const steps = await loadSteps();
    const sceneIds = [...notebookHtml.matchAll(/data-scene="([^"]+)"/g)].map((m) => m[1]);
    const order = [steps.buildFlowScenes, steps.buildConceptScenes, steps.buildPreSplitScenes, steps.buildMergeScenes, steps.buildGraphScenes];
    assert.deepStrictEqual(order.flatMap((build) => build()).map((scene) => scene.id), sceneIds);
    checkFlow(steps.FLOW, steps.buildFlowScenes());
    checkFlow(steps.PRE_SPLIT_FLOW, steps.buildPreSplitScenes());
    assert.ok(!fs.existsSync(path.join(vizDir, "src", "notebook", "tiles-3d.js")), "the tile view is gone; a mechanism is drawn on the data flow view");
  });

  await test("the component graph example names only nodes, edges, kinds, and tones the graph view knows", async () => {
    const { GRAPH, buildGraphScenes } = await loadSteps();
    const kinds = tableKeys("KINDS");
    const tones = tableKeys("TONES");
    assert.deepStrictEqual([...kinds].sort(), ["process", "ref", "store", "table"]);
    assert.deepStrictEqual([...tones].sort(), ["active", "base", "gap", "new", "off"]);
    checkGraph(GRAPH, buildGraphScenes(), kinds, tones);
    for (const cls of [".graph-tip", ".graph-panel"]) assert.ok(notebookCss.includes(cls), `${cls} is not styled`);
    assert.ok(notebookCss.includes("var(--stage-height, 460px)"), "the demo stage height must be adjustable per cell");
  });

  await test("the block views share blocks-3d.js instead of copying the stage, blocks, and transitions", () => {
    const shared = viewSource("blocks-3d.js");
    for (const name of ["createBlockScene", "makeBlock", "makeLabel", "setLabel"]) {
      assert.match(shared, new RegExp(`export function ${name}\\b`), `blocks-3d.js must export ${name}`);
    }
    assert.ok(shared.includes("syncBlocks,"), "createBlockScene must hand out syncBlocks");
    for (const view of ["flow-3d.js"]) {
      const source = viewSource(view);
      assert.match(source, /from '\.\/blocks-3d\.js'/, `${view} must import blocks-3d.js`);
      assert.ok(source.includes("createBlockScene("), `${view} must build on createBlockScene`);
      for (const copy of ["OrbitControls", "function tween", "function makeBlock", "const PALETTE", "new THREE.WebGLRenderer"]) {
        assert.ok(!source.includes(copy), `${view} copies ${copy} from blocks-3d.js`);
      }
    }
    const graph = viewSource("graph-3d.js");
    assert.match(graph, /import \{ canvasTexture, makeControls, measureText \} from '\.\/blocks-3d\.js'/, "graph-3d.js must take text measuring and camera controls from blocks-3d.js");
    assert.match(shared, /mouseButtons = \{ LEFT: THREE\.MOUSE\.PAN, MIDDLE: THREE\.MOUSE\.DOLLY, RIGHT: THREE\.MOUSE\.ROTATE \}/, "left drag pans, right drag rotates");
    assert.match(viewSource("player.js"), /拖动平移 · 右键旋转 · 双击复位/, "the corner hint names the swapped buttons");
    for (const copy of ["OrbitControls", "function canvasTexture", "function textWidth", "const measure ="]) {
      assert.ok(!graph.includes(copy), `graph-3d.js copies ${copy} from blocks-3d.js`);
    }
  });

  await test("both examples keep only the h1 under their title, and nothing styles a line beneath it", () => {
    const title = (html) => html.match(/<header class="nb-title">([\s\S]*?)<\/header>/)[1].trim();
    assert.strictEqual(title(notebookHtml), "<h1>示例</h1>", "no breadcrumb or subtitle on a learning page");
    assert.strictEqual(title(changeHtml), "<h1>次数表更新</h1>", "no breadcrumb or issue line on a change page");
    assert.ok(!notebookCss.includes(".nb-title p"), "no page puts a line under the h1, so its style is gone");
    assert.ok(body.includes("On both pages the title bar holds the `<h1>` and nothing else"), "the h1-only rule covers both pages");
    assert.ok(!body.includes("names the issue and the problem in one line"), "the change page's issue line rule is gone");
  });

  await test("the data flow example follows the flow contract, lines a lookup up with its rows, and matches the real Out", async () => {
    const { FLOW, buildFlowScenes } = await loadSteps();
    const scenes = buildFlowScenes();
    assert.ok(checkFlow(FLOW, scenes) > 0, "some step must line a lookup up with its table rows");
    const what = sectionOf(notebookHtml, "intro");
    const demoAt = what.indexOf('data-scene="example-flow"');
    assert.ok(demoAt >= 0 && demoAt < what.indexOf('class="cell code"'), "the what-it-is section shows its mechanism in a demo before the code cell");
    const out = what.match(/<pre class="code-out">([^<]+)<\/pre>/)[1];
    const last = scenes[0].steps.at(-1);
    const ids = last.blocks.filter((b) => b.at === "out").map((b) => b.text);
    assert.ok(out.includes(`[${ids.join(", ")}]`), `the demo hands out ${ids} but the Out says ${out}`);
    assert.ok(out.trim().endsWith("hello"), "the Out must show the round trip the caption claims");
  });

  await test("a code cell that backs a demo follows it with no text between, comments each part on its own line, and shows every number the demo uses", async () => {
    const { buildFlowScenes } = await loadSteps();
    const what = sectionOf(notebookHtml, "intro");
    assert.match(what, /data-scene="example-flow"><\/section>\s*<section class="cell code">/, "no lead-in between the demo and the code cell that backs it");
    assert.ok(!what.includes("复现"), "no reproduce-it lead-in around the code cell");
    const code = what.match(/<pre class="code-in" data-lang="python">([\s\S]*?)<\/pre>/)[1];
    const comments = code.split("\n").filter((line) => line.includes("#"));
    assert.ok(comments.length >= 3, "one comment per part of the demo");
    for (const line of comments) assert.ok(line.trim().startsWith("#"), `comment at the end of a line: ${line}`);
    const out = what.match(/<pre class="code-out">([^<]+)<\/pre>/)[1];
    const strip = (html) => html.replace(/<[^>]+>/g, "");
    const shown = buildFlowScenes()[0].steps.flatMap((step) => [strip(step.text), ...step.blocks.map((b) => b.text)]);
    for (const n of new Set(shown.join(" ").match(/\d+/g))) {
      assert.match(out, new RegExp(`\\b${n}\\b`), `the demo uses ${n} but the Out never shows it`);
    }
    const write = body.split("### 5. Write the Cells")[1].split("### 6.")[0];
    assert.ok(write.includes("one of two kinds") && write.includes("No lead-in or preview"), "step 5 must limit code cells and ban lead-ins");
    assert.ok(body.split("## Common Mistakes")[1].includes("A lead-in or a preview around a code cell"));
    assert.ok(body.split("## Before You Finish")[1].includes("Every code cell backs the demo above it"));
  });

  await test("a learning page opens with 简介, which says what it is and why it is needed, and has no motivation chapter", () => {
    const headings = [...notebookHtml.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)].map((m) => `${m[1]}:${m[2]}`);
    assert.deepStrictEqual(headings.slice(0, 2), ["intro:简介", "concepts:核心概念"], "简介 comes first, then 核心概念");
    for (const text of [notebookHtml, body, translation]) assert.ok(!text.includes("目的和动机"), "no separate motivation chapter");
    const outline = body.split("### 4. Outline the Page")[1].split("### 5.")[0];
    assert.ok(outline.includes('<h2 id="intro">简介</h2>') && outline.includes("why it is needed"), "the introduction says why it is needed");
    assert.ok(body.split("### 6.")[1].split("### 7.")[0].includes("When you delete a section"), "step 6 must move a deleted section's first links");
    assert.ok(body.split("## Common Mistakes")[1].includes("A motivation chapter that actually compares the ways"));
  });

  await test("the 核心概念 concept map links every concept to its section, starts on the whole map, and lights one block per later step", async () => {
    const { CONCEPTS, buildConceptScenes } = await loadSteps();
    const [scene] = buildConceptScenes();
    checkGraph(CONCEPTS, [scene], tableKeys("KINDS"), tableKeys("TONES"));
    const ids = new Set([...notebookHtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const n of CONCEPTS.nodes) assert.ok(n.href && ids.has(n.href.slice(1)), `concept ${n.id} must link a section on the page, got ${n.href}`);
    const [first, ...rest] = scene.steps;
    const all = CONCEPTS.nodes.map((n) => n.id).sort();
    assert.deepStrictEqual(Object.keys(first.nodes).sort(), all, "step 1 shows every concept");
    assert.deepStrictEqual([...first.focus].sort(), all, "step 1 frames the whole map");
    for (const step of rest) {
      const link = step.text.match(/→ <a href="#([^"]+)">[^<]+<\/a>$/);
      assert.ok(link && ids.has(link[1]), `${step.title} must end with a link to its section`);
    }
    assert.match(sectionOf(notebookHtml, "concepts"), /data-scene="example-concepts" style="--stage-height: 600px"/);
    assert.ok(!/<h2[^>]*>工作原理<\/h2>/.test(notebookHtml), "no 工作原理 chapter on a learning page");
    assert.match(sectionOf(notebookHtml, "split-merge"), /<h3 id="bpe">/, "the method's internals sit in its chapter as an h3");
    assert.ok(viewSource("graph-3d.js").includes('class="goto"') && notebookCss.includes(".graph-panel .goto"), "a pinned panel links to the concept's section");
    const outline = body.split("### 4. Outline the Page")[1].split("### 5.")[0];
    assert.ok(outline.includes('<h2 id="concepts">核心概念</h2>') && !outline.includes("工作原理"), "the second chapter is 核心概念");
    assert.ok(body.split("### 7.")[1].split("### 8.")[0].includes("concept map"), "step 7 must teach the concept map");
    assert.ok(body.split("## Common Mistakes")[1].includes("A 工作原理 chapter that explains one algorithm"));
  });

  await test("the learning example has no operating instructions, and its method subtopic opens with a general intro and a 使用场景 list", async () => {
    const steps = await loadSteps();
    const captions = [steps.buildFlowScenes, steps.buildConceptScenes, steps.buildPreSplitScenes, steps.buildMergeScenes, steps.buildGraphScenes]
      .flatMap((build) => build().flatMap((scene) => scene.steps.map((step) => step.text)));
    const prose = notebookHtml.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<pre[\s\S]*?<\/pre>/g, "");
    for (const text of [prose, ...captions]) {
      const hint = text.match(/悬停|点一下|点一个|点开|点击|双击|拖动|翻页|方向键/);
      assert.ok(!hint, `operating instruction "${hint}" in: ${text.slice(0, 60)}`);
    }
    const item = sectionOf(notebookHtml, "split-merge").split('<h3 id="bpe">')[1];
    const [intro, rest] = item.split("<p><b>使用场景</b></p>");
    assert.ok(rest, "the subtopic needs a 使用场景 list");
    assert.match(intro, /arxiv\.org\/abs\//, "the general intro links the method's paper");
    assert.ok(!intro.includes("本示例"), "the general intro does not center on this project");
    const links = [...rest.split("</ul>")[0].matchAll(/<li><a href="([^"]+)">[^<]+<\/a><\/li>/g)].map((m) => m[1]);
    assert.ok(links.length >= 2, "使用场景 lists several projects, one per item, name and link only");
    assert.ok(!/^https?:/.test(links[0]) && links.slice(1).every((href) => href.startsWith("https://")), "this project links its source, outside projects an official page");
    assert.match(rest, /<\/ul>\s*<\/section>\s*<section class="cell demo" data-scene="example-merge">/, "one demo right after the list carries how it works, no list or note box of its own");
    const write = body.split("### 5. Write the Cells")[1].split("### 6.")[0];
    assert.ok(write.includes("no operating instructions") && write.includes("go in a list") && write.includes("使用场景"), "step 5 must carry the three writing rules");
    assert.ok(body.split("### 4.")[1].split("### 5.")[0].includes("<p><b>使用场景</b></p>"), "step 4 must give the subtopic template");
    const mistakes = body.split("## Common Mistakes")[1];
    assert.ok(mistakes.includes("Operating instructions in the text") && mistakes.includes("A method subtopic that opens on this project"));
  });

  await test("a staged process is drawn in two titled rows sharing one plate, computed once and drawn by each view", async () => {
    const { FLOW, MERGE_FLOW, buildMergeScenes } = await loadSteps();
    const [scene] = buildMergeScenes();
    checkFlow(MERGE_FLOW, [scene]);
    const plateOf = (flow, slot) => flow.plates.find((p) => Math.abs(slot.x - p.x) <= p.w / 2 && Math.abs(slot.z - p.z) <= p.d / 2);
    for (const flow of [FLOW, MERGE_FLOW]) {
      for (const p of flow.plates) assert.ok(p.label, `plate ${p.id} needs a title`);
      for (const [name, slot] of Object.entries(flow.slots)) {
        const plate = plateOf(flow, slot);
        assert.ok(plate, `slot ${name} sits on no plate`);
        assert.ok(slot.z >= plate.z - plate.d / 2 + 1.5, `slot ${name} covers the title of plate ${plate.id}`);
      }
    }
    const zs = Object.values(MERGE_FLOW.slots).map((slot) => slot.z);
    const [back, front] = [Math.min(...zs), Math.max(...zs)];
    const shared = MERGE_FLOW.plates.find((p) => p.z - p.d / 2 < back && p.z + p.d / 2 > front);
    assert.ok(shared, "the stages share one plate that spans both rows");
    const phases = scene.steps.map((step) => step.phase);
    assert.deepStrictEqual([...new Set(phases)], ["训练", "编码"], "training first, then encoding");
    const written = scene.steps.find((step) => step.blocks.some((b) => b.from && plateOf(MERGE_FLOW, MERGE_FLOW.slots[b.at]) === shared));
    assert.ok(written && written.phase === "训练", "training writes its product onto the shared plate as blocks");
    const source = fs.readFileSync(path.join(exampleDir, "steps.js"), "utf8");
    assert.ok(source.match(/= splitAndMerge\(WORD\)/g).length >= 4, "every demo of the split and merge reads the one record splitAndMerge computes");
    assert.ok(/function encodeByRules\(/.test(source) && source.includes("encodeByRules(rules, SAMPLE)"), "encoding is computed by a pure function and drawn from its records");
    const demo = body.split("### 7. Compute the Demo From Real Results")[1].split("### 8.")[0];
    for (const rule of ["two rows", "Keep computing and drawing apart", "Leave room for each plate's title"]) assert.ok(demo.includes(rule), `step 7 must teach: ${rule}`);
    const mistakes = body.split("## Common Mistakes")[1];
    assert.ok(mistakes.includes("How it works written as a list of points") && mistakes.includes("A demo without zones"));
  });

  await test("sibling subtopics share one template and one layout with no comparison section", () => {
    assert.ok(!/<h[23][^>]*>[^<]*对比[^<]*<\/h[23]>/.test(notebookHtml), "no comparison section on a learning page");
    const outline = body.split("### 4. Outline the Page")[1].split("### 5.")[0];
    assert.ok(outline.includes("Sibling items of one chapter") && !body.includes("A comparison demo may close"), "siblings share a template; no closing comparison");
    const demo = body.split("### 7. Compute the Demo From Real Results")[1].split("### 8.")[0];
    assert.ok(demo.includes("trainEncodeFlow"), "sibling demos share one layout function");
    assert.ok(body.split("### 5. Write the Cells")[1].split("### 6.")[0].includes("search it for the method's name"), "使用场景 links must be checked for the method's name");
    const mistakes = body.split("## Common Mistakes")[1];
    assert.ok(mistakes.includes("Sibling subtopics drawn differently") && mistakes.includes("never names the method"));
  });

  await test("every concept on the map has its own chapter and its own step, stations keep their blocks, and straight lines use pipelineFlow", async () => {
    const steps = await loadSteps();
    const chapters = [...notebookHtml.matchAll(/<h2 id="([^"]+)">/g)].map((m) => m[1]).filter((id) => !["intro", "concepts", "markup"].includes(id));
    const linked = new Set(steps.buildConceptScenes()[0].steps.slice(1).map((step) => step.text.match(/href="#([^"]+)"/)[1]));
    for (const id of chapters) assert.ok(linked.has(id), `chapter ${id} has no step on the concept map`);
    for (const n of steps.CONCEPTS.nodes) {
      assert.ok(["intro", ...chapters].includes(n.href.slice(1)), `concept ${n.id} links ${n.href}, which is no chapter`);
    }
    for (const [flow, build] of [[steps.FLOW, steps.buildFlowScenes], [steps.PRE_SPLIT_FLOW, steps.buildPreSplitScenes], [steps.MERGE_FLOW, steps.buildMergeScenes]]) {
      const last = build()[0].steps.at(-1);
      const plateOf = (slot) => flow.plates.find((p) => Math.abs(slot.x - p.x) <= p.w / 2 && Math.abs(slot.z - p.z) <= p.d / 2).id;
      const filled = new Set(last.blocks.map((b) => plateOf(flow.slots[b.at])));
      for (const p of flow.plates) assert.ok(filled.has(p.id), `the last step of ${build.name} leaves plate ${p.id} empty`);
    }
    const pipeline = viewSource("pipeline-flow.js");
    assert.ok(/export function pipelineFlow\(/.test(pipeline) && !pipeline.includes("from 'three'"), "pipelineFlow only lays out, it draws nothing");
    const { slots, arrows } = steps.PRE_SPLIT_FLOW;
    assert.ok("letters0" in slots && "letters1" in slots && arrows.some((a) => a.id === "chunks>letters"), "slots are plate id plus row, arrows from>to");
    const outline = body.split("### 4. Outline the Page")[1].split("### 5.")[0];
    assert.ok(outline.includes("One chapter per core concept") && outline.includes("has no 使用场景 list"), "step 4 must give every concept a chapter");
    const demo = body.split("### 7. Compute the Demo From Real Results")[1].split("### 8.")[0];
    for (const rule of ["pipelineFlow({ stages, rows, arrows, labels })", "Later steps keep the blocks of earlier stations", "Every chapter has its step"]) {
      assert.ok(demo.includes(rule), `step 7 must teach: ${rule}`);
    }
    assert.ok(!body.includes("createTilesView") && !body.includes("tiles-3d.js"), "the tile view is gone from SKILL.md");
    assert.ok(body.split("### 5. Write the Cells")[1].split("### 6.")[0].includes("convert_slow_tokenizer.py"), "step 5 must show one source file proving several 使用场景 items");
    const mistakes = body.split("## Common Mistakes")[1];
    assert.ok(mistakes.includes("A concept on the concept map with no chapter of its own") && mistakes.includes("Plates left empty by the last step"));
  });

  await test("SKILL.md teaches the learning-page rules and when to pick each view and layout", () => {
    const outline = body.split("### 4. Outline the Page")[1].split("### 5.")[0];
    assert.ok(outline.includes("no breadcrumb, no subtitle") && !body.includes("carries a breadcrumb"), "the title bar holds only the h1");
    assert.ok(outline.includes("has a demo cell"), "every mechanism on a learning page needs a demo");
    const run = body.split("### 3. Study the Code and Run It")[1].split("### 4.")[0];
    assert.ok(run.includes("cannot be recorded") && run.includes("tok.decode(ids)"), "step 3 must cover unrecorded stages and evidence");
    assert.ok(body.split("### 6.")[1].split("### 7.")[0].includes("this is required"), "official links are required on a learning page");
    const demo = body.split("### 7. Compute the Demo From Real Results")[1].split("### 8.")[0];
    for (const view of ["pipelineFlow(", "createFlowView(FLOW)", "createGraphView(GRAPH)", "alignWith", "createBlockScene"]) {
      assert.ok(demo.includes(view), `step 7 must cover ${view}`);
    }
    const mistakes = body.split("## Common Mistakes")[1].split("## Before You Finish")[0];
    for (const row of ["breadcrumb", "no demo", "data flow view", "tok.decode(ids)"]) assert.ok(mistakes.includes(row), `Common Mistakes must cover ${row}`);
  });

  await test("SKILL.md asks which page to build before anything else and names both kinds", () => {
    const ask = body.split("### 1. Ask Which Page")[1].split("### 2.")[0];
    assert.ok(ask.includes("AskUserQuestion"), "step 1 must ask with AskUserQuestion");
    for (const kind of ["学习页", "改造页"]) assert.ok(ask.includes(`| ${kind} |`), `step 1 must offer ${kind}`);
    assert.ok(body.includes('<h2 id="now">现状</h2>') && body.includes('<h2 id="next">解决方案</h2>'));
  });

  await test("the change-page example has two sections and two demos, each on its own graph with shared components in place", async () => {
    const { GRAPH_NOW, GRAPH_NEXT, buildChangeScenes } = await loadSteps(changeDir);
    assert.ok(changeHtml.includes("<style>{{STYLE}}</style>") && changeHtml.includes("<script>{{SCRIPT}}</script>"));
    const headings = [...changeHtml.matchAll(/<h2 id="([^"]+)">/g)].map((m) => m[1]);
    assert.deepStrictEqual(headings, ["now", "next"]);
    assert.ok(!changeHtml.includes('class="cell code"'), "a change page has no code cells");
    const [now, next] = buildChangeScenes();
    const sceneIds = [...changeHtml.matchAll(/data-scene="([^"]+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual([now.id, next.id], sceneIds);
    const kinds = tableKeys("KINDS");
    const tones = tableKeys("TONES");
    checkGraph(GRAPH_NOW, [now], kinds, tones);
    checkGraph(GRAPH_NEXT, [next], kinds, tones);
    const place = new Map(GRAPH_NOW.nodes.map((n) => [n.id, `${n.x},${n.z}`]));
    for (const n of GRAPH_NEXT.nodes) {
      if (place.has(n.id)) assert.strictEqual(`${n.x},${n.z}`, place.get(n.id), `${n.id} moved between the two graphs`);
    }
    assert.ok(now.steps.some((s) => Object.values(s.nodes).includes("gap")), "the current demo marks a gap");
    assert.ok(next.steps.some((s) => Object.values(s.nodes).includes("new")), "the solution demo marks what is new");
  });

  await test("check_links.py --offline flags a missing #id and a missing file, and ignores script text", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tutorial-links-"));
    fs.writeFileSync(path.join(dir, "real.py"), "");
    fs.writeFileSync(
      path.join(dir, "page.html"),
      [
        '<h2 id="here">x</h2><a href="#here">ok</a><a href="#nowhere">bad</a>',
        '<a href="real.py">ok</a><a href="gone.py">bad</a><a href="vscode://file/x">skip</a>',
        "<script>const a = '<a href=\"#fake\">';</script>",
      ].join("\n"),
    );
    const run = spawnSync("python3", [checkLinks, "--offline", path.join(dir, "page.html")], { encoding: "utf8" });
    assert.strictEqual(run.status, 1, run.stderr);
    assert.deepStrictEqual(run.stdout.trim().split("\n"), ["FAIL 页内没有 id #nowhere", "FAIL 文件不存在 gone.py"]);
  });

  await test("check_links.py sends a browser User-Agent, retries 429 and 503 twice, and lists a still-refused link as LIMITED without failing", async () => {
    const hits = { limited: 0 };
    const agents = new Set();
    const server = http.createServer((req, res) => {
      agents.add(req.headers["user-agent"]);
      if (req.url === "/ok") return res.end('<h2 id="here">x</h2>');
      if (req.url === "/limited") {
        hits.limited++;
        res.statusCode = 503;
        return res.end();
      }
      res.statusCode = 404;
      res.end();
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tutorial-remote-"));
    const run = (name, links) => {
      const page = path.join(dir, `${name}.html`);
      fs.writeFileSync(page, links.map((href) => `<a href="${base}${href}">x</a>`).join("\n"));
      const env = { ...process.env, NO_PROXY: "127.0.0.1", no_proxy: "127.0.0.1" };
      return new Promise((resolve) => {
        const child = spawn("python3", [checkLinks, "--retry-delay", "0", page], { env });
        let stdout = "";
        child.stdout.on("data", (chunk) => (stdout += chunk));
        child.on("close", (status) => resolve({ status, lines: stdout.trim().split("\n") }));
      });
    };
    try {
      const broken = await run("broken", ["/ok#here", "/limited", "/gone"]);
      assert.strictEqual(broken.status, 1, "a 404 still fails the run");
      assert.deepStrictEqual(broken.lines, [`FAIL 404 ${base}/gone`, `LIMITED 503 ${base}/limited 可能被限流，用浏览器打开确认`]);
      assert.strictEqual(hits.limited, 3, "one request and two retries");
      const throttled = await run("throttled", ["/ok#here", "/limited"]);
      assert.strictEqual(throttled.status, 0, "a rate-limited link alone does not fail the run");
      assert.strictEqual(throttled.lines.at(-1), `OK ${path.join(dir, "throttled.html")}`);
      assert.ok([...agents].every((agent) => /Chrome\/\d+/.test(agent)), `requests must look like a browser, got ${[...agents]}`);
    } finally {
      server.close();
    }
    assert.ok(body.split("### 6.")[1].split("### 7.")[0].includes("LIMITED"), "step 6 must explain LIMITED");
  });

  await test("a brand-new page of either kind opens in the system's default browser", () => {
    const verify = body.slice(body.indexOf("### 8. Build and Click Through Every Step"), body.indexOf("### 9. Update the Index"));
    assert.match(verify, /brand-new page[\s\S]*system's default browser[\s\S]*`open viz\/<name>\.html`[\s\S]*`xdg-open[\s\S]*`start ""[\s\S]*both page kinds/);
    assert.match(body.slice(body.indexOf("## Before You Finish")), /- \[ \] A brand-new page is open in the system's default browser\./);
    assert.match(translation, /全新页面通过以上检查后，用系统默认浏览器打开它/);
  });

  await test("every demo can go fullscreen: header, stage, and caption fill the screen and in-page links leave it first", () => {
    const player = viewSource("player.js");
    assert.match(player, /<button data-act="fullscreen" title="全屏（F）">全屏<\/button>/);
    assert.match(player, /fullscreen: toggleFullscreen/);
    assert.match(player, /body\.requestFullscreen\(\)/, "the whole cell body goes fullscreen, not only the canvas");
    assert.match(player, /f: 'fullscreen', F: 'fullscreen'/);
    assert.match(player, /e\.metaKey \|\| e\.ctrlKey \|\| e\.altKey/, "Cmd+F and Ctrl+F stay with the browser");
    assert.match(player, /document\.exitFullscreen\(\)\.then\(\(\) => link\.click\(\)\)/, "a .goto link leaves fullscreen before it jumps");
    assert.match(player, /else if \(view && document\.fullscreenElement !== body\)/, "fullscreen never pauses the view");
    assert.match(viewSource("graph-3d.js"), /camera\.updateProjectionMatrix\(\);\s*\/\/[^\n]*\n\s*if \(step\) frameCamera\(step\.focus, true\);/, "the component graph refits when the stage changes shape");
    assert.match(viewSource("blocks-3d.js"), /if \(fit\) frameFit\(\);/, "the data flow view refits when the stage changes shape");
    assert.match(notebookCss, /\.cell-body:fullscreen \{[^}]*flex-direction: column/);
    assert.match(notebookCss, /\.cell-body:fullscreen \.demo-stage \{[^}]*flex: 1/);
    assert.match(body, /5\. Click 全屏 on one demo/);
    assert.match(translation, /5\. 在一个演示上点「全屏」/);
  });

  await test("the zh-CN translation tracks the current SKILL.md", () => {
    const digest = crypto.createHash("sha256").update(fs.readFileSync(skillFile)).digest("hex");
    assert.match(translation, /^---\nname: building-interactive-tutorials\ndescription: '[^'\n]+'\nlocale: zh-CN\n/);
    assert.ok(translation.includes(`source_hash: ${digest}`), "re-sync i18n/zh-CN.md after editing SKILL.md");
    const count = (text) => text.split("\n").filter((line) => /^#{2,3} /.test(line)).length;
    assert.strictEqual(count(translation), count(body));
  });

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
