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

async function freshPage() {
  const api = fakeFigma();
  const page = api.createPage();
  await api.setCurrentPageAsync(page);
  return { api, page };
}

function box(api, parent, name, width, height) {
  const node = api.createFrame();
  node.name = name;
  node.resize(width, height);
  parent.appendChild(node);
  return node;
}

test("absoluteBoundingBox places auto-layout children by padding, gap and alignment", async () => {
  const { api, page } = await freshPage();
  const column = box(api, page, "column", 200, 10);
  column.x = 100;
  column.y = 50;
  column.layoutMode = "VERTICAL";
  column.primaryAxisSizingMode = "AUTO";
  column.paddingTop = column.paddingLeft = column.paddingRight = column.paddingBottom = 10;
  column.itemSpacing = 8;
  column.counterAxisAlignItems = "CENTER";
  const first = box(api, column, "first", 50, 20);
  const second = box(api, column, "second", 80, 30);
  const pinned = box(api, column, "pinned", 10, 10);
  pinned.layoutPositioning = "ABSOLUTE";
  pinned.x = 190;
  pinned.y = -5;
  assert.deepEqual(column.absoluteBoundingBox, { x: 100, y: 50, width: 200, height: 78 });
  assert.deepEqual(first.absoluteBoundingBox, { x: 175, y: 60, width: 50, height: 20 });
  assert.deepEqual(second.absoluteBoundingBox, { x: 160, y: 88, width: 80, height: 30 });
  assert.deepEqual(pinned.absoluteBoundingBox, { x: 290, y: 45, width: 10, height: 10 });

  const row = box(api, page, "row", 300, 40);
  row.layoutMode = "HORIZONTAL";
  row.primaryAxisAlignItems = "SPACE_BETWEEN";
  row.counterAxisAlignItems = "MAX";
  box(api, row, "left", 60, 10);
  const right = box(api, row, "right", 40, 20);
  assert.deepEqual(right.absoluteBoundingBox, { x: 260, y: 20, width: 40, height: 20 });
});

test("a fixed-width row with wrap breaks into lines and grows in height", async () => {
  const { api, page } = await freshPage();
  const row = box(api, page, "row", 100, 1);
  row.layoutMode = "HORIZONTAL";
  row.counterAxisSizingMode = "AUTO";
  row.layoutWrap = "WRAP";
  row.itemSpacing = 10;
  row.counterAxisSpacing = 4;
  const chips = ["a", "b", "c"].map((name) => box(api, row, name, 40, 20));
  assert.equal(row.height, 44);
  assert.deepEqual(chips.map((chip) => [chip.absoluteBoundingBox.x, chip.absoluteBoundingBox.y]), [[0, 0], [50, 0], [0, 24]]);
});

test("new frames clip their content, as in Figma", async () => {
  const { api } = await freshPage();
  assert.equal(api.createFrame().clipsContent, true);
  assert.equal(api.createComponent().clipsContent, true);
  assert.equal(api.createText().clipsContent, undefined);
});

test("wrap and alignment are frame-only, like the rest of auto layout", async () => {
  const { api } = await freshPage();
  const label = api.createText();
  assert.throws(() => { label.layoutWrap = "WRAP"; }, /object is not extensible/);
  assert.throws(() => { label.counterAxisAlignItems = "CENTER"; }, /object is not extensible/);
});

test("text with line breaks is as wide as its longest line and one line taller per break", async () => {
  const { api, page } = await freshPage();
  await api.loadFontAsync({ family: "Inter", style: "Regular" });
  const make = (autoResize) => {
    const node = api.createText();
    node.fontName = { family: "Inter", style: "Regular" };
    node.characters = "ab\nabcd\n中文";
    page.appendChild(node);
    node.textAutoResize = autoResize;
    return node;
  };
  const hug = make("WIDTH_AND_HEIGHT");
  assert.equal(hug.width, Math.round(4 * 14 * 0.55));
  assert.equal(hug.height, 3 * 20);
  const wrapped = make("HEIGHT");
  wrapped.resize(20, 20);
  assert.equal(wrapped.height, (1 + 2 + 2) * 20);
});
