const assert = require("node:assert/strict");
const { test } = require("node:test");
const { fakeFigma } = require("./fake-figma");

test("findOne stops at the first match", async () => {
  const api = fakeFigma();
  const page = api.createPage();
  await api.setCurrentPageAsync(page);
  const keep = api.createFrame();
  keep.name = "keep";
  const target = api.createFrame();
  target.name = "target";
  const extra = api.createFrame();
  extra.name = "target";
  page.appendChild(keep);
  keep.appendChild(target);
  keep.appendChild(extra);
  const hits = [];
  const found = page.findOne((node) => {
    hits.push(node.name);
    return node.name === "target";
  });
  assert.equal(found, target);
  assert.deepEqual(hits, ["keep", "target"]);
});

test("appending a child invalidates cached sizes", async () => {
  const api = fakeFigma();
  const page = api.createPage();
  await api.setCurrentPageAsync(page);
  const row = api.createFrame();
  row.layoutMode = "HORIZONTAL";
  row.primaryAxisSizingMode = "AUTO";
  row.counterAxisSizingMode = "FIXED";
  row.resize(10, 20);
  page.appendChild(row);
  const first = api.createFrame();
  first.resize(50, 20);
  row.appendChild(first);
  const before = row.width;
  const second = api.createFrame();
  second.resize(70, 20);
  row.appendChild(second);
  assert.ok(row.width > before);
});

test("mutating one branch does not recompute a sibling branch", async () => {
  const api = fakeFigma();
  const page = api.createPage();
  await api.setCurrentPageAsync(page);
  const makeRow = async (name, size) => {
    const row = api.createFrame();
    row.name = name;
    row.layoutMode = "HORIZONTAL";
    row.primaryAxisSizingMode = "AUTO";
    row.counterAxisSizingMode = "FIXED";
    row.resize(10, 20);
    page.appendChild(row);
    const child = api.createFrame();
    child.resize(size, 20);
    row.appendChild(child);
    return row;
  };
  const left = await makeRow("left", 50);
  const right = await makeRow("right", 70);
  void left.width;
  void right.width;
  const warmed = api.layoutComputes;
  void right.width;
  assert.equal(api.layoutComputes, warmed);
  const extra = api.createFrame();
  extra.resize(40, 20);
  left.appendChild(extra);
  assert.ok(left.width > 50);
  const afterLeft = api.layoutComputes;
  void right.width;
  assert.equal(api.layoutComputes, afterLeft);
});

test("measuring every node is linear even with nested hug and fill", async () => {
  const api = fakeFigma();
  const page = api.createPage();
  await api.setCurrentPageAsync(page);
  let parent = page;
  const depth = 16;
  for (let level = 0; level < depth; level += 1) {
    const col = api.createFrame();
    col.name = `col-${level}`;
    col.layoutMode = "VERTICAL";
    col.primaryAxisSizingMode = "AUTO";
    col.counterAxisSizingMode = "FIXED";
    col.resize(200, 20);
    parent.appendChild(col);
    const hug = api.createFrame();
    hug.name = `hug-${level}`;
    hug.layoutMode = "VERTICAL";
    hug.primaryAxisSizingMode = "AUTO";
    hug.counterAxisSizingMode = "AUTO";
    hug.resize(40, 10);
    col.appendChild(hug);
    const fill = api.createFrame();
    fill.name = `fill-${level}`;
    fill.layoutMode = "VERTICAL";
    col.appendChild(fill);
    fill.layoutSizingVertical = "FILL";
    fill.resize(40, 10);
    parent = hug;
  }
  const count = (node) => 1 + node.children.reduce((total, child) => total + count(child), 0);
  const nodes = count(page);
  const before = api.layoutComputes;
  const walk = (node) => {
    void node.width;
    void node.height;
    node.children.forEach(walk);
  };
  walk(page);
  const work = api.layoutComputes - before;
  assert.ok(work <= nodes * 8, `layout work ${work} for ${nodes} nodes`);
  assert.ok(Number.isFinite(page.children[0].height));
});
