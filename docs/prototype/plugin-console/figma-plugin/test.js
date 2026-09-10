const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  build, run, nextPageName, stateCopy, applyRow,
  PAGE_NAME, SKILLS, HOOKS, COMMANDS, MCPS, KINDS, DIALOGS,
} = require("./code.js");
const { fakeFigma } = require("../../figma-lab/fake-figma");

function action(node) { return node.reactions[0].actions[0]; }
function named(parent, name) {
  const node = parent.findOne((item) => item.name === name);
  assert.ok(node, `Missing node: ${name}`);
  return node;
}
const EXPECTED_LINKS = 39;

test("state copy matches harness install semantics", () => {
  assert.equal(stateCopy("missing").cta, "安装");
  assert.equal(stateCopy("installed", "Claude Code").extra, "卸载");
  assert.equal(stateCopy("installed", "Claude Code").cta, null);
  assert.equal(stateCopy("update").cta, "更新");
  assert.match(stateCopy("update").status, /2\.2\.1/);
});

test("catalog samples are real ECC names", () => {
  assert.equal(SKILLS[0].id, "grilling");
  assert.equal(SKILLS[0].module, "workflow-quality");
  assert.equal(HOOKS.length, 7);
  assert.equal(HOOKS[0].id, "SessionStart");
  assert.ok(COMMANDS.some((item) => item.id === "plan-prd"));
  assert.deepEqual(KINDS.map((item) => item.count), ["287", "7", "95", "0"]);
  assert.equal(MCPS.length, 0);
});

test("manifest stays local, without a fabricated plugin ID", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.json"), "utf8"));
  assert.equal(manifest.main, "code.js");
  assert.equal(manifest.api, "1.0.0");
  assert.equal(manifest.documentAccess, "dynamic-page");
  assert.deepEqual(manifest.editorType, ["figma"]);
  assert.deepEqual(manifest.networkAccess.allowedDomains, ["none"]);
  assert.equal("id" in manifest, false);
});

test("build creates variant sets, reuses them as instances and wires the demo flows", async () => {
  const api = fakeFigma();
  const result = await build(api);
  assert.equal(result.page.name, PAGE_NAME);
  assert.equal(api.connected, EXPECTED_LINKS);

  const sets = Object.fromEntries(result.page.children.filter((node) => node.type === "COMPONENT_SET").map((set) => [set.name, set]));
  assert.deepEqual(Object.fromEntries(Object.entries(sets).map(([name, set]) => [name, set.children.length])), {
    "Harness / Card": 6, "Type / Nav": 8, "Filter / Chip": 2, "Catalog / Row": 8, "Dialog / Confirm": 3,
  });
  assert.equal(result.screens.length, 16);

  const grilling = named(result.skillNone.screen, "Row / grilling");
  assert.equal(grilling.type, "INSTANCE");
  assert.equal(named(grilling, "Name").characters, "grilling");
  assert.equal(named(result.skillNone.screen, "Detail name").characters, "grilling");
  assert.equal(named(result.skillNone.screen, "Harness / claude").type, "INSTANCE");

  assert.equal(action(result.skillNone.nav.hook).destinationId, result.hookNone.screen.id);
  assert.equal(action(result.skillNone.nav.command).destinationId, result.commandNone.screen.id);
  assert.equal(action(result.hookNone.nav.skill).destinationId, result.skillNone.screen.id);
  assert.equal(action(named(named(result.skillNone.screen, "Harness / claude"), "CTA / install")).destinationId, result.dialogInstallClaude.screen.id);
  assert.equal(action(result.dialogInstallClaude.confirm).destinationId, result.skillClaude.screen.id);
  assert.equal(action(result.dialogInstallClaude.cancel).destinationId, result.skillNone.screen.id);
  assert.equal(action(named(named(result.skillClaude.screen, "Harness / codex"), "CTA / install")).destinationId, result.dialogInstallCodex.screen.id);
  assert.equal(action(result.dialogInstallCodex.confirm).destinationId, result.skillBoth.screen.id);
  assert.equal(action(named(named(result.skillClaude.screen, "Harness / claude"), "CTA / uninstall")).destinationId, result.dialogUninstall.screen.id);
  assert.equal(action(named(named(result.skillUpdate.screen, "Harness / claude"), "CTA / update")).destinationId, result.dialogUpdate.screen.id);
  assert.equal(action(result.dialogUpdate.confirm).destinationId, result.skillBoth.screen.id);
  assert.ok(result.skillNone.edit);
  assert.equal(result.hookNone.edit, null);
  assert.equal(result.commandNone.edit, null);
  assert.equal(action(result.skillNone.nav.mcp).destinationId, result.mcpEmpty.screen.id);
  assert.equal(named(result.mcpEmpty.screen, "Detail name").characters, "没有自带 MCP");
  assert.match(named(result.mcpEmpty.screen, "Empty").characters, /只列自己带的 MCP/);
  assert.equal(result.mcpEmpty.mcpToggle, null);
  assert.equal(action(result.skillNone.edit).destinationId, result.editorEnNoZh.screen.id);
  assert.equal(action(result.editorEnNoZh.translate).destinationId, result.editorZh.screen.id);
  assert.equal(action(result.editorZh.langEn).destinationId, result.editorEnHasZh.screen.id);
  assert.equal(action(result.editorEnHasZh.langZh).destinationId, result.editorZh.screen.id);
  assert.equal(action(result.editorZhStale.retranslate).destinationId, result.editorZh.screen.id);
  assert.equal(action(result.editorEnNoZh.cancel).destinationId, result.skillNone.screen.id);
  assert.equal(action(result.editorEnNoZh.save).destinationId, result.skillNone.screen.id);
  assert.match(named(result.editorEnNoZh.screen, "Skill markdown").characters, /name: grilling/);
  assert.match(named(result.editorZh.screen, "Skill markdown").characters, /拷问到共识/);
  assert.match(named(result.editorZhStale.screen, "Stale copy").characters, /译本已过时/);
  assert.equal(result.editorZh.save, null);
  assert.equal(named(result.hookNone.screen, "Detail").findOne((node) => node.name === "CTA / edit"), null);

  assert.equal(named(result.dialogInstallClaude.screen, "Title").characters, "安装 ECC · Claude Code");
  assert.equal(Object.keys(DIALOGS).length, 3);
  assert.deepEqual(result.page.flowStartingPoints.map((flow) => flow.name), ["控制台", "过时译本"]);
  for (const reaction of [...api.nodes.values()].filter((node) => node.reactions.length).map(action)) {
    if (reaction.navigation === "NAVIGATE") assert.equal(reaction.resetInteractiveComponents, true);
  }
});

test("top-level boards and component variants do not overlap", async () => {
  const result = await build(fakeFigma());
  const assertSeparated = (list) => {
    for (let index = 0; index < list.length; index += 1) {
      for (const other of list.slice(index + 1)) {
        const node = list[index];
        assert.ok(node.x + node.width <= other.x || other.x + other.width <= node.x
          || node.y + node.height <= other.y || other.y + other.height <= node.y,
        `Overlapping nodes: ${node.name}, ${other.name}`);
      }
    }
  };
  assertSeparated(result.page.children);
  for (const set of result.page.children.filter((node) => node.type === "COMPONENT_SET")) {
    assertSeparated(set.children);
    for (const node of set.children) {
      assert.ok(node.x >= 0 && node.y >= 0 && node.x + node.width <= set.width && node.y + node.height <= set.height, `${node.name} inside ${set.name}`);
    }
  }
  for (const screen of result.screens) assert.ok(screen.height > 0 && screen.width > 0);
});

test("a second run preserves previous pages and user edits", async () => {
  const api = fakeFigma();
  const original = api.root.children[0];
  const first = await build(api);
  const edited = named(first.skillNone.screen, "Product");
  edited.characters = "用户改过的标题";
  const children = [...first.page.children];
  const second = await build(api);
  assert.equal(api.root.children.length, 3);
  assert.equal(api.root.children[0], original);
  assert.equal(first.page.name, PAGE_NAME);
  assert.equal(second.page.name, `${PAGE_NAME} 2`);
  assert.equal(edited.characters, "用户改过的标题");
  assert.deepEqual(first.page.children, children);
  assert.equal(nextPageName([{ name: PAGE_NAME }, { name: `${PAGE_NAME} 2` }]), `${PAGE_NAME} 3`);
});

test("font failure happens before creating a page; display font is optional", async () => {
  const api = fakeFigma({ fonts: [{ family: "Inter", style: "Regular" }] });
  await assert.rejects(build(api), /没有找到可用的中文字体/);
  assert.equal(api.root.children.length, 1);
  const noDisplay = fakeFigma({ fonts: [{ family: "Noto Sans SC", style: "Regular" }] });
  const result = await build(noDisplay);
  assert.equal(named(result.overview, "Title").fontName.family, "Noto Sans SC");
});

test("page limits and rejected links report failure, never success", async () => {
  for (const [options, expected, pages] of [
    [{ rejectPages: true }, /新建独立页面.*page limit reached/, 1],
    [{ rejectReactions: true }, /连接演示入口.*reaction rejected/, 2],
  ]) {
    const api = fakeFigma(options);
    await run(api);
    assert.equal(api.messages.length, 1);
    assert.match(api.messages[0], expected);
    assert.ok(api.messages[0].startsWith("生成失败"));
    assert.equal(api.root.children.length, pages);
    assert.equal(api.root.children[0].name, "Existing design");
  }
});

test("success is reported only after building and connecting the document", async () => {
  const api = fakeFigma();
  await run(api);
  assert.equal(api.connected, EXPECTED_LINKS);
  assert.match(api.messages[0], /已生成 ECC 插件控制台的可编辑组件与 16 块演示画板/);
});

test("applyRow overwrites catalog instance labels", () => {
  const node = {
    findOne(predicate) {
      return this.children.find(predicate);
    },
    children: [{ name: "Name", characters: "old" }, { name: "Module", characters: "old-mod" }],
  };
  applyRow(node, { id: "tdd-workflow", module: "workflow-quality" });
  assert.equal(node.children[0].characters, "tdd-workflow");
  assert.equal(node.children[1].characters, "workflow-quality");
});
