const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  build, run, nextPageName, PAGE_NAME, NAMESPACE,
  STEPS, INDUSTRIES, HEADCOUNT, COMPANY_FIELDS, ROLE_SLOTS, SCENE_SLOTS, FIELD_STATES, CHIP_STATES,
} = require("./code.js");
const { fakeFigma } = require("../../figma-lab/fake-figma");

function action(node) { return node.reactions[0].actions[0]; }
function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
// 开始→1，1→1已填，1已填→2，2→3，3→完成，完成→开始，桌面→完成
const EXPECTED_LINKS = 7;

test("manifest stays local, without a fabricated plugin ID", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.json"), "utf8"));
  assert.equal(manifest.main, "code.js");
  assert.equal(manifest.api, "1.0.0");
  assert.equal(manifest.documentAccess, "dynamic-page");
  assert.deepEqual(manifest.editorType, ["figma"]);
  assert.deepEqual(manifest.networkAccess.allowedDomains, ["none"]);
  assert.equal("id" in manifest, false);
});

test("no field carries a prescriptive placeholder — it reads like fishing for details", () => {
  const source = fs.readFileSync(path.join(__dirname, "code.js"), "utf8");
  for (const banned of ["营业执照上的全称", "主要经营城市", "给个区间就行", "去年的实际数", "placeholder:"]) {
    assert.equal(source.includes(banned), false, `code.js still has ${banned}`);
  }
});

test("the copy stays in business register, not chat", () => {
  const source = fs.readFileSync(path.join(__dirname, "code.js"), "utf8");
  for (const banned of ["你们卖什么", "一单大概", "几单", "最烦的", "收到了", "对上号", "张口就能答", "我们靠它", "客户从哪来"]) {
    assert.equal(source.includes(banned), false, `code.js still has the colloquial ${banned}`);
  }
  assert.ok(source.includes("主营业务"));
  assert.ok(source.includes("期望 AI 赋能的场景"));
});

test("the client never reads that this is feeding a prototype", () => {
  const source = fs.readFileSync(path.join(__dirname, "code.js"), "utf8");
  for (const internal of ["原型", "demo", "Demo"]) {
    assert.equal(source.includes(`"${internal}`), false, `client-facing copy mentions ${internal}`);
  }
  for (const line of ["可交互原型", "据此制作"]) {
    assert.equal(source.includes(line), false, `client-facing copy still says ${line}`);
  }
});

test("the roles step ships two slots and a way to add more", async () => {
  const api = fakeFigma();
  const result = await build(api);
  const cards = result.roles.screen.findAll((node) => node.name.startsWith("Card / "));
  assert.equal(cards.length, ROLE_SLOTS.length);
  assert.equal(result.roles.add.findOne((node) => node.name === "Label").characters, "添加岗位");
  for (const card of cards) {
    assert.ok(card.findOne((node) => node.name.startsWith("Area / ")), `${card.name} has no workflow box`);
    // The field component is a fixed 326 wide; inside a padded card both it and
    // everything inside it have to fill, or the white input box juts out the right edge.
    const inner = card.width - card.paddingLeft - card.paddingRight;
    for (const node of card.findAll(() => true)) {
      assert.ok(node.width <= inner, `${card.name} → ${node.name} (${node.width}) overflows ${inner}`);
    }
  }
});

test("the questionnaire stays short enough to finish in one sitting", () => {
  assert.equal(STEPS.length, 3);
  assert.deepEqual(STEPS.map((step) => step.index), [1, 2, 3]);
  assert.equal(COMPANY_FIELDS.length, 3);
  assert.ok(INDUSTRIES.includes("其他"), "industry must have an escape hatch");
  assert.equal(HEADCOUNT.length, 4);
  assert.equal(ROLE_SLOTS.length, 2, "two role slots are preset; the client adds the rest");
  assert.equal(SCENE_SLOTS.length, 2, "two scene slots are preset; the client adds the rest");
});

test("build makes the three sets, reuses them as instances and wires the flow", async () => {
  const api = fakeFigma();
  const result = await build(api);
  assert.equal(result.page.name, PAGE_NAME);
  assert.notEqual(result.page.getSharedPluginData(NAMESPACE, "generator"), "");
  assert.equal(api.connected, EXPECTED_LINKS);

  const sets = result.page.children.filter((node) => node.type === "COMPONENT_SET");
  assert.deepEqual(sets.map((set) => [set.name, set.children.length]), [
    ["Intake / Field", FIELD_STATES.length],
    ["Intake / Chip", CHIP_STATES.length],
    ["Intake / Progress", STEPS.length],
  ]);

  for (const state of FIELD_STATES) {
    assert.equal(result.components.fields.get(state.key).node.getSharedPluginData(NAMESPACE, "state"), state.key);
  }
  for (const step of STEPS) {
    assert.equal(result.components.steps.get(step.index).node.getSharedPluginData(NAMESPACE, "step"), String(step.index));
  }

  const setIds = new Set(sets.flatMap((set) => set.children.map((component) => component.id)));
  const instances = result.company.screen.findAll((node) => node.type === "INSTANCE");
  assert.ok(instances.length >= COMPANY_FIELDS.length + INDUSTRIES.length);
  for (const instance of instances) assert.ok(setIds.has(instance.mainComponentId));
});

test("every step hands off to the next one, and the end loops back to the start", async () => {
  const api = fakeFigma();
  const result = await build(api);
  const hops = [
    [result.start.start, result.company.screen],
    [result.company.next, result.companyFilled.screen],
    [result.companyFilled.next, result.roles.screen],
    [result.roles.next, result.scenes.screen],
    [result.scenes.submit, result.done.screen],
    [result.done.again, result.start.screen],
    [result.desktop.submit, result.done.screen],
  ];
  for (const [source, destination] of hops) {
    assert.equal(action(source).navigation, "NAVIGATE");
    assert.equal(action(source).destinationId, destination.id);
    assert.equal(action(source).resetInteractiveComponents, true);
  }
  assert.equal(result.page.flowStartingPoints[0].nodeId, result.start.screen.id);
});

test("the validation board is a dead end until the required field is filled", async () => {
  const api = fakeFigma();
  const result = await build(api);
  assert.deepEqual(result.error.fix.reactions, []);
  const errored = result.error.screen.findAll((node) => node.name.startsWith("Field / "));
  assert.equal(errored.length, COMPANY_FIELDS.length);
});

test("each scene asks for the name, today, and what it should become", async () => {
  const api = fakeFigma();
  const result = await build(api);
  const cards = result.scenes.screen.findAll((node) => node.name.startsWith("Card / "));
  assert.equal(cards.length, SCENE_SLOTS.length);
  assert.equal(result.scenes.add.findOne((node) => node.name === "Label").characters, "添加场景");
  for (const card of cards) {
    assert.ok(card.findOne((node) => node.name === "Area / 现状"), `${card.name} has no 现状`);
    assert.ok(card.findOne((node) => node.name === "Area / 预期"), `${card.name} has no 预期`);
    const inner = card.width - card.paddingLeft - card.paddingRight;
    for (const node of card.findAll(() => true)) {
      assert.ok(node.width <= inner, `${card.name} → ${node.name} (${node.width}) overflows ${inner}`);
    }
  }
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
});

test("running twice numbers the new page and keeps the old one intact", async () => {
  const api = fakeFigma();
  const first = await build(api);
  const headline = first.start.screen.findOne((node) => node.name === "Headline");
  headline.characters = "用户改过的标题";
  const second = await build(api);
  assert.equal(second.page.name, `${PAGE_NAME} 2`);
  assert.equal(headline.characters, "用户改过的标题");
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
