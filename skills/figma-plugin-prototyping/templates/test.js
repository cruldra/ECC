const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { build, run, nextPageName, STATES, PAGE_NAME, NAMESPACE } = require("./code.js");
const { fakeFigma } = require("../../figma-lab/fake-figma");

function action(node) { return node.reactions[0].actions[0]; }
function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
const EXPECTED_LINKS = 5; // toggle CHANGE_TO ×2 + open NAVIGATE ×2 + back NAVIGATE ×1

test("manifest stays local, without a fabricated plugin ID", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.json"), "utf8"));
  assert.equal(manifest.main, "code.js");
  assert.equal(manifest.api, "1.0.0");
  assert.equal(manifest.documentAccess, "dynamic-page");
  assert.deepEqual(manifest.editorType, ["figma"]);
  assert.deepEqual(manifest.networkAccess.allowedDomains, ["none"]);
  assert.equal("id" in manifest, false);
});

test("build creates a variant set, reuses it as instances and wires the flows", async () => {
  const api = fakeFigma();
  const result = await build(api);
  assert.equal(result.page.name, PAGE_NAME);
  assert.equal(result.page.getSharedPluginData(NAMESPACE, "generator") !== "", true);
  assert.equal(api.connected, EXPECTED_LINKS);

  const sets = result.page.children.filter((node) => node.type === "COMPONENT_SET");
  assert.deepEqual(sets.map((set) => [set.name, set.children.length]), [["Demo / Card", STATES.length]]);

  for (const state of STATES) {
    const item = result.components.cards.get(state.key);
    assert.equal(item.node.getSharedPluginData(NAMESPACE, "state"), state.key);
    assert.equal(action(item.toggle).navigation, "CHANGE_TO");
    assert.equal(action(item.open).navigation, "NAVIGATE");
    assert.equal(action(item.open).destinationId, result.detail.screen.id);
    assert.equal(action(item.open).resetInteractiveComponents, true);
  }
  assert.equal(action(result.detail.back).destinationId, result.list.screen.id);

  const instances = result.list.screen.findAll((node) => node.type === "INSTANCE");
  assert.equal(instances.length, STATES.length);
  for (const instance of instances) assert.ok(sets[0].children.some((component) => component.id === instance.mainComponentId));
});

test("boards and sets sit on the page without overlapping", async () => {
  const api = fakeFigma();
  const result = await build(api);
  const blocks = [...result.screens, ...result.components.sets];
  for (const block of blocks) assert.equal(block.parent, result.page);
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      assert.equal(overlaps(blocks[i], blocks[j]), false, `${blocks[i].name} overlaps ${blocks[j].name}`);
    }
  }
  assert.equal(result.page.flowStartingPoints[0].nodeId, result.list.screen.id);
});

test("running twice numbers the new page and keeps the old one intact", async () => {
  const api = fakeFigma();
  const first = await build(api);
  const title = first.overview.findOne((node) => node.name === "Title");
  title.characters = "用户改过的标题";
  const second = await build(api);
  assert.equal(second.page.name, `${PAGE_NAME} 2`);
  assert.equal(title.characters, "用户改过的标题");
  assert.equal(nextPageName(api.root.children), `${PAGE_NAME} 3`);
});

test("missing CJK font fails before any page is created", async () => {
  const api = fakeFigma({ fonts: [{ family: "Inter", style: "Regular" }] });
  const pages = api.root.children.length;
  await run(api);
  assert.equal(api.root.children.length, pages);
  assert.match(api.messages[0], /加载中文字体/);
});

test("page limit and rejected reactions surface the failing stage", async () => {
  const limited = fakeFigma({ rejectPages: true });
  await run(limited);
  assert.match(limited.messages[0], /新建独立页面/);

  const rejected = fakeFigma({ rejectReactions: true });
  await run(rejected);
  assert.match(rejected.messages[0], /连接演示入口/);
});
