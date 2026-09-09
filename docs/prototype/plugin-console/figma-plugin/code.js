// ECC Plugin Console Design Lab — Figma Desktop 本地开发插件.
// 新建一页, 生成插件控制台: 只读目录 (skill / hook / command) + 顶栏把整份 ECC
// 装到 Claude Code / Codex. 只用 Figma Plugin API, 不联网、不读真实安装状态.
const PAGE_NAME = "ECC 插件控制台 · Design Lab";
const GENERATOR = "ecc.plugin-console.design-lab";
const NS = "ecc";
const DESKTOP = 1440;
const NAV = 220;
const DETAIL = 320;
const COLORS = {
  paper: "#f4f5f7", card: "#ffffff", surface2: "#eef0f3", surface3: "#e5e7eb",
  ink: "#111827", ink2: "#4b5563", ink4: "#9ca3af", muted: "#6b7280",
  border: "#e5e7eb", borderStrong: "#d1d5db",
  primary: "#0f766e", primarySoft: "#ccfbf1", primaryDeep: "#115e59", onPrimary: "#f0fdfa",
  success: "#047857", warning: "#b45309", danger: "#b91c1c",
  claude: "#d97706", codex: "#2563eb",
};
const FONT_FAMILIES = ["PingFang SC", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC"];
const DISPLAY_FONTS = [{ family: "Inter", style: "Medium" }, { family: "Inter", style: "Semi Bold" }];

const SKILLS = [
  { id: "grilling", module: "workflow-quality", blurb: "需求前门。每次一问直到共识。" },
  { id: "product-lens", module: "workflow-quality", blurb: "为什么做。产出 PRODUCT-BRIEF.md。" },
  { id: "intent-driven-development", module: "workflow-quality", blurb: "验收标准 AC-NNN。" },
  { id: "tdd-workflow", module: "workflow-quality", blurb: "先写测试再实现。" },
  { id: "configure-ecc", module: "workflow-quality", blurb: "对话里重装或改范围。" },
  { id: "agentic-os", module: "agentic-patterns", blurb: "持久多 agent 操作系统。" },
  { id: "python-patterns", module: "framework-language", blurb: "Python 惯用法。" },
  { id: "security-review", module: "security", blurb: "安全审查。" },
];
const HOOKS = [
  { id: "SessionStart", module: "hooks-runtime", blurb: "会话开始。" },
  { id: "PreToolUse", module: "hooks-runtime", blurb: "工具调用前。" },
  { id: "PostToolUse", module: "hooks-runtime", blurb: "工具调用后。" },
  { id: "PostToolUseFailure", module: "hooks-runtime", blurb: "工具失败。" },
  { id: "PreCompact", module: "hooks-runtime", blurb: "压缩上下文前。" },
  { id: "Stop", module: "hooks-runtime", blurb: "一轮结束。" },
  { id: "SessionEnd", module: "hooks-runtime", blurb: "会话结束。" },
];
const COMMANDS = [
  { id: "grilling", module: "commands-core", blurb: "打开需求前门。" },
  { id: "plan-prd", module: "commands-core", blurb: "写出 PRD。" },
  { id: "plan", module: "commands-core", blurb: "拆实现步骤。" },
  { id: "code-review", module: "commands-core", blurb: "质量审查。" },
  { id: "feature-dev", module: "commands-core", blurb: "功能开发流程。" },
  { id: "ecc-guide", module: "commands-core", blurb: "查 ECC 能力目录。" },
  { id: "checkpoint", module: "commands-core", blurb: "打检查点。" },
  { id: "pr", module: "commands-core", blurb: "开 Pull Request。" },
];
const KINDS = [
  { key: "skill", label: "Skill", count: "287", items: SKILLS, path: "skills/<id>/SKILL.md" },
  { key: "hook", label: "Hook", count: "7", items: HOOKS, path: "hooks/hooks.json · <id>" },
  { key: "command", label: "Command", count: "95", items: COMMANDS, path: "commands/<id>.md" },
];
const CHIPS = ["全部", "workflow-quality", "agentic-patterns", "security"];
const HARNESS = [
  { key: "claude", label: "Claude Code", hint: "claude plugin install ecc@ecc" },
  { key: "codex", label: "Codex", hint: "codex plugin add ecc@ecc" },
];
const STATES = ["missing", "installed", "update"];
const DIALOGS = {
  install: { title: "安装 ECC", body: "把整份插件装到所选 harness。不按条开关。", confirm: "安装", danger: false },
  uninstall: { title: "卸载 ECC", body: "从该 harness 卸掉整份插件。目录还在仓库里。", confirm: "卸载", danger: true },
  update: { title: "更新 ECC", body: "拉到 2.2.2。新会话才吃到新 skill。", confirm: "更新", danger: false },
};
const SAMPLE_SKILL_MD = `---
name: grilling
description: Front door for requirements. Interview one question at a time until shared understanding exists.
---

# Grilling

Interview until shared understanding. Then stop.
Ask one frontier question per turn with AskUserQuestion.
Never list multiple questions in the chat body.`;
const SAMPLE_SKILL_MD_ZH = `---
name: grilling
locale: zh-CN
source_hash: demo-hash-current
---

# Grilling

拷问到共识为止。然后停下。
每一轮只用 AskUserQuestion 问一个前沿问题。
不要在正文里列出多道题。`;

function nextPageName(pages) {
  const names = new Set(pages.map((page) => page.name));
  let name = PAGE_NAME;
  for (let index = 2; names.has(name); index += 1) name = `${PAGE_NAME} ${index}`;
  return name;
}

function rgb(hex) {
  return { r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 };
}

function paint(color, opacity = 1) {
  return [{ type: "SOLID", color: rgb(color), opacity }];
}

async function chooseFonts(api) {
  const available = (await api.listAvailableFontsAsync()).map((entry) => entry.fontName);
  const has = (font) => available.some((item) => item.family === font.family && item.style === font.style);
  for (const family of FONT_FAMILIES) {
    const styles = available.filter((font) => font.family === family);
    const regular = styles.find((font) => ["Regular", "Normal", "Book"].includes(font.style));
    if (!regular) continue;
    const medium = styles.find((font) => ["Medium", "Semibold", "SemiBold"].includes(font.style)) || regular;
    await api.loadFontAsync(regular);
    if (medium !== regular) await api.loadFontAsync(medium);
    const display = DISPLAY_FONTS.find(has) || medium;
    if (display !== medium) await api.loadFontAsync(display);
    return { regular, medium, display };
  }
  throw new Error(`没有找到可用的中文字体。请在 Figma 中启用 ${FONT_FAMILIES.join("、")} 之一后重试。`);
}

function frame(ctx, name, o = {}) {
  const node = o.component ? ctx.api.createComponent() : ctx.api.createFrame();
  node.name = name;
  node.layoutMode = o.dir || "VERTICAL";
  const horizontal = node.layoutMode === "HORIZONTAL";
  node.fills = o.fill ? paint(o.fill, o.fillOpacity) : [];
  node.strokes = o.stroke ? paint(o.stroke, o.strokeOpacity) : [];
  node.strokeWeight = 1;
  node.clipsContent = false;
  node.cornerRadius = o.radius || 0;
  node.paddingTop = node.paddingBottom = o.py ?? o.pad ?? 0;
  node.paddingLeft = node.paddingRight = o.px ?? o.pad ?? 0;
  node.itemSpacing = o.gap || 0;
  node.counterAxisAlignItems = o.align || "MIN";
  node.primaryAxisAlignItems = o.justify || "MIN";
  if (o.width) {
    node.resize(o.width, o.height || 1);
    node.primaryAxisSizingMode = horizontal ? "FIXED" : o.height ? "FIXED" : "AUTO";
    node.counterAxisSizingMode = horizontal ? (o.height ? "FIXED" : "AUTO") : "FIXED";
  } else {
    node.primaryAxisSizingMode = "AUTO";
    node.counterAxisSizingMode = "AUTO";
  }
  return node;
}

function append(parent, node, fill = false) {
  parent.appendChild(node);
  if (fill) node.layoutSizingHorizontal = "FILL";
  return node;
}

function text(ctx, parent, name, characters, o = {}) {
  const node = ctx.api.createText();
  node.name = name;
  node.fontName = o.display ? ctx.fonts.display : o.medium ? ctx.fonts.medium : ctx.fonts.regular;
  node.fontSize = o.size || 14;
  node.lineHeight = { unit: "PIXELS", value: o.lineHeight || Math.round(node.fontSize * 1.45) };
  node.characters = characters;
  node.fills = paint(o.color || COLORS.ink);
  if (o.align) node.textAlignHorizontal = o.align;
  parent.appendChild(node);
  if (o.hug) {
    node.textAutoResize = "WIDTH_AND_HEIGHT";
    return node;
  }
  node.resize(Math.max(1, parent.width - parent.paddingLeft - parent.paddingRight), node.height);
  node.textAutoResize = "HEIGHT";
  node.layoutSizingHorizontal = "FILL";
  if (o.singleLine) {
    node.textTruncation = "ENDING";
    node.maxLines = 1;
  }
  return node;
}

function badge(ctx, parent, name, label, o = {}) {
  const node = frame(ctx, name, { dir: "HORIZONTAL", px: 8, py: 2, radius: 999, align: "CENTER",
    fill: o.fill || COLORS.primarySoft });
  text(ctx, node, "Label", label, { hug: true, medium: true, size: o.size || 11, color: o.color || COLORS.primaryDeep });
  return append(parent, node);
}

function button(ctx, parent, name, label, o = {}) {
  const style = o.style || "primary";
  const small = o.size === "sm";
  const fills = { primary: COLORS.primary, danger: COLORS.danger, disabled: COLORS.surface3 };
  const colors = { primary: COLORS.onPrimary, danger: COLORS.onPrimary, disabled: COLORS.ink4, ghost: COLORS.ink2, outline: COLORS.ink };
  const node = frame(ctx, name, { dir: "HORIZONTAL", px: small ? 12 : 16, py: small ? 6 : 10, gap: 6, radius: 10,
    align: "CENTER", justify: "CENTER", width: o.width, fill: fills[style], stroke: style === "outline" ? COLORS.borderStrong : null });
  text(ctx, node, "Label", label, { hug: true, medium: true, size: small ? 12 : 13, color: colors[style] });
  return append(parent, node, o.fill);
}

function shadow(node) {
  node.effects = [{ type: "DROP_SHADOW", color: { ...rgb(COLORS.ink), a: 0.06 }, offset: { x: 0, y: 8 },
    radius: 24, spread: -8, visible: true, blendMode: "NORMAL" }];
}

function componentSet(ctx, page, name, components, columns) {
  for (const component of components) page.appendChild(component);
  const set = ctx.api.combineAsVariants(components, page);
  set.name = name;
  set.layoutMode = "NONE";
  set.fills = paint(COLORS.surface2, 0.5);
  set.strokes = paint(COLORS.ink, 0.12);
  set.cornerRadius = 16;
  const gap = 32;
  const width = Math.max(...components.map((node) => node.width));
  let y = gap;
  for (let index = 0; index < components.length; index += columns) {
    const row = components.slice(index, index + columns);
    row.forEach((node, column) => { node.x = gap + column * (width + gap); node.y = y; });
    y += Math.max(...row.map((node) => node.height)) + gap;
  }
  set.resize(columns * (width + gap) + gap, y);
  return set;
}

async function connect(source, destination, navigation) {
  await source.setReactionsAsync([{
    trigger: { type: "ON_CLICK" },
    actions: [{ type: "NODE", destinationId: destination.id, navigation,
      ...(navigation === "NAVIGATE" ? { resetInteractiveComponents: true } : {}),
      transition: { type: navigation === "CHANGE_TO" ? "SMART_ANIMATE" : "DISSOLVE",
        duration: 0.16, easing: { type: "EASE_OUT" } } }],
  }]);
}

function stateCopy(state, label) {
  if (state === "missing") {
    return { status: "未安装", detail: "装上后可用 287 skill / 95 command / 7 类钩子", cta: "安装", extra: null };
  }
  if (state === "installed") {
    return { status: `已安装  ${label} 2.2.2`, detail: "user 范围 · 已是最新", cta: null, extra: "卸载" };
  }
  return { status: "已安装  2.2.1 → 2.2.2", detail: "有新版本。新会话才吃到新 skill。", cta: "更新", extra: "卸载" };
}

function harnessCard(ctx, harness, state) {
  const spec = HARNESS.find((item) => item.key === harness);
  const copy = stateCopy(state, spec.label);
  const accent = harness === "claude" ? COLORS.claude : COLORS.codex;
  const node = frame(ctx, `Harness=${harness}, State=${state}`, { width: 360, px: 16, py: 14, gap: 8, radius: 14,
    fill: COLORS.card, stroke: COLORS.border, component: true });
  node.setSharedPluginData(NS, "harness", harness);
  node.setSharedPluginData(NS, "state", state);
  const head = append(node, frame(ctx, "Head", { dir: "HORIZONTAL", gap: 8, align: "CENTER" }), true);
  const mark = ctx.api.createEllipse();
  mark.name = "Mark";
  mark.resize(10, 10);
  mark.fills = paint(state === "missing" ? COLORS.ink4 : accent);
  head.appendChild(mark);
  text(ctx, head, "Harness", spec.label, { hug: true, medium: true, size: 14 });
  badge(ctx, head, "Status badge", state === "missing" ? "未装" : state === "update" ? "可更新" : "已装", {
    fill: state === "missing" ? COLORS.surface2 : state === "update" ? "#fef3c7" : COLORS.primarySoft,
    color: state === "missing" ? COLORS.ink2 : state === "update" ? COLORS.warning : COLORS.primaryDeep,
  });
  text(ctx, node, "Status", copy.status, { size: 13, color: COLORS.ink2, singleLine: true });
  text(ctx, node, "Detail", copy.detail, { size: 12, color: COLORS.muted });
  text(ctx, node, "Hint", spec.hint, { size: 11, color: COLORS.ink4, singleLine: true });
  const actions = append(node, frame(ctx, "Actions", { dir: "HORIZONTAL", gap: 8 }), true);
  const install = copy.cta ? button(ctx, actions, copy.cta === "更新" ? "CTA / update" : "CTA / install", copy.cta, { size: "sm" }) : null;
  const uninstall = copy.extra ? button(ctx, actions, "CTA / uninstall", copy.extra, { size: "sm", style: "outline" }) : null;
  return { card: node, install, uninstall, update: copy.cta === "更新" ? install : null };
}

function typeNav(ctx, kind, on) {
  const spec = KINDS.find((item) => item.key === kind);
  const node = frame(ctx, `Kind=${kind}, Selected=${on ? "on" : "off"}`, { dir: "HORIZONTAL", width: NAV - 24, px: 12, py: 10,
    gap: 8, radius: 10, align: "CENTER", fill: on ? COLORS.primarySoft : COLORS.card, component: true });
  text(ctx, node, "Label", spec.label, { hug: true, medium: true, size: 13, color: on ? COLORS.primaryDeep : COLORS.ink });
  const count = append(node, frame(ctx, "Count wrap", { dir: "HORIZONTAL", px: 0, py: 0 }), true);
  count.primaryAxisAlignItems = "MAX";
  text(ctx, count, "Count", spec.count, { hug: true, size: 12, color: COLORS.ink4 });
  return node;
}

function filterChip(ctx, selected) {
  const node = frame(ctx, `Selected=${selected ? "on" : "off"}`, { dir: "HORIZONTAL", px: 10, py: 6, radius: 999, align: "CENTER",
    fill: selected ? COLORS.ink : COLORS.card, stroke: selected ? null : COLORS.border, component: true });
  text(ctx, node, "Label", selected ? "全部" : "workflow-quality", { hug: true, medium: true, size: 12,
    color: selected ? COLORS.onPrimary : COLORS.ink2 });
  return node;
}

function catalogRow(ctx, kind, selected) {
  const spec = KINDS.find((item) => item.key === kind);
  const sample = spec.items[0];
  const node = frame(ctx, `Kind=${kind}, Selected=${selected ? "on" : "off"}`, { dir: "HORIZONTAL", width: DESKTOP - NAV - DETAIL - 48,
    px: 14, py: 12, gap: 12, radius: 12, align: "CENTER",
    fill: selected ? COLORS.primarySoft : COLORS.card, stroke: selected ? COLORS.primary : COLORS.border, component: true });
  badge(ctx, node, "Kind badge", spec.label, { fill: COLORS.surface2, color: COLORS.ink2 });
  const body = append(node, frame(ctx, "Body", { gap: 2 }), true);
  text(ctx, body, "Name", sample.id, { hug: true, medium: true, size: 13 });
  text(ctx, body, "Module", sample.module, { hug: true, size: 11, color: COLORS.muted });
  return node;
}

function confirmDialog(ctx, kind) {
  const spec = DIALOGS[kind];
  const node = frame(ctx, `Kind=${kind}`, { width: 420, px: 24, py: 22, gap: 12, radius: 16, fill: COLORS.card, stroke: COLORS.border, component: true });
  shadow(node);
  text(ctx, node, "Title", spec.title, { medium: true, size: 18, display: true });
  text(ctx, node, "Body", spec.body, { size: 14, color: COLORS.ink2 });
  const actions = append(node, frame(ctx, "Actions", { dir: "HORIZONTAL", gap: 8, justify: "MAX" }), true);
  const cancel = button(ctx, actions, "CTA / cancel", "取消", { size: "sm", style: "outline" });
  const confirm = button(ctx, actions, "CTA / confirm", spec.confirm, { size: "sm", style: spec.danger ? "danger" : "primary" });
  return { card: node, cancel, confirm };
}

function createComponents(ctx, page) {
  const harness = new Map();
  const harnessCards = [];
  for (const item of HARNESS) {
    for (const state of STATES) {
      const built = harnessCard(ctx, item.key, state);
      harness.set(`${item.key}:${state}`, built);
      harnessCards.push(built.card);
    }
  }
  const harnessSet = componentSet(ctx, page, "Harness / Card", harnessCards, 3);

  const nav = new Map();
  const navCards = [];
  for (const kind of KINDS) {
    for (const selected of [true, false]) {
      const card = typeNav(ctx, kind.key, selected);
      nav.set(`${kind.key}:${selected ? "on" : "off"}`, card);
      navCards.push(card);
    }
  }
  const navSet = componentSet(ctx, page, "Type / Nav", navCards, 2);

  const chips = {
    on: filterChip(ctx, true),
    off: filterChip(ctx, false),
  };
  const chipSet = componentSet(ctx, page, "Filter / Chip", [chips.on, chips.off], 2);

  const rows = new Map();
  const rowCards = [];
  for (const kind of KINDS) {
    for (const selected of [true, false]) {
      const card = catalogRow(ctx, kind.key, selected);
      rows.set(`${kind.key}:${selected ? "on" : "off"}`, card);
      rowCards.push(card);
    }
  }
  const rowSet = componentSet(ctx, page, "Catalog / Row", rowCards, 2);

  const dialogs = new Map();
  const dialogCards = [];
  for (const kind of Object.keys(DIALOGS)) {
    const built = confirmDialog(ctx, kind);
    dialogs.set(kind, built);
    dialogCards.push(built.card);
  }
  const dialogSet = componentSet(ctx, page, "Dialog / Confirm", dialogCards, 3);

  return {
    harness, nav, chips, rows, dialogs,
    sets: [harnessSet, navSet, chipSet, rowSet, dialogSet],
  };
}

function applyRow(instance, item) {
  const name = instance.findOne((node) => node.name === "Name");
  const moduleNode = instance.findOne((node) => node.name === "Module");
  if (name) name.characters = item.id;
  if (moduleNode) moduleNode.characters = item.module;
}

function topBar(ctx, parent, components, claude, codex) {
  const bar = append(parent, frame(ctx, "Top bar", { dir: "HORIZONTAL", width: DESKTOP, px: 24, py: 16, gap: 16, align: "CENTER",
    fill: COLORS.card, stroke: COLORS.border }), true);
  const brand = append(bar, frame(ctx, "Brand", { gap: 4 }), true);
  text(ctx, brand, "Product", "ECC 插件控制台", { hug: true, medium: true, size: 16, display: true });
  text(ctx, brand, "Version line", "ecc@ecc · 目录只读 · 整插件安装", { hug: true, size: 12, color: COLORS.muted });
  const claudeCard = components.harness.get(`claude:${claude}`).card.createInstance();
  claudeCard.name = "Harness / claude";
  bar.appendChild(claudeCard);
  const codexCard = components.harness.get(`codex:${codex}`).card.createInstance();
  codexCard.name = "Harness / codex";
  bar.appendChild(codexCard);
  return bar;
}

function consoleBoard(ctx, page, components, spec) {
  const kind = KINDS.find((item) => item.key === spec.kind);
  const selected = kind.items.find((item) => item.id === spec.selected) || kind.items[0];
  const screen = frame(ctx, spec.name, { width: DESKTOP, fill: COLORS.paper });
  page.appendChild(screen);
  topBar(ctx, screen, components, spec.claude, spec.codex);

  const body = append(screen, frame(ctx, "Body", { dir: "HORIZONTAL", width: DESKTOP, fill: COLORS.paper }), true);
  const nav = append(body, frame(ctx, "Type nav", { width: NAV, px: 12, py: 16, gap: 6, fill: COLORS.card, stroke: COLORS.border }));
  text(ctx, nav, "Nav title", "类型", { size: 11, color: COLORS.ink4, medium: true });
  const navButtons = {};
  for (const item of KINDS) {
    const card = components.nav.get(`${item.key}:${item.key === spec.kind ? "on" : "off"}`).createInstance();
    card.name = `Nav / ${item.key}`;
    nav.appendChild(card);
    navButtons[item.key] = card;
  }

  const main = append(body, frame(ctx, "Main", { width: DESKTOP - NAV - DETAIL, px: 20, py: 16, gap: 12, fill: COLORS.paper }), true);
  const search = append(main, frame(ctx, "Search", { dir: "HORIZONTAL", px: 12, py: 10, radius: 10, fill: COLORS.card, stroke: COLORS.border }), true);
  text(ctx, search, "Placeholder", "筛选名称或模块", { hug: true, size: 13, color: COLORS.ink4 });
  const chips = append(main, frame(ctx, "Chips", { dir: "HORIZONTAL", gap: 8 }), true);
  for (const label of CHIPS) {
    const on = label === spec.chip;
    const chip = (on ? components.chips.on : components.chips.off).createInstance();
    chip.name = `Chip / ${label}`;
    const chipLabel = chip.findOne((node) => node.name === "Label");
    if (chipLabel) chipLabel.characters = label;
    chips.appendChild(chip);
  }
  const list = append(main, frame(ctx, "List", { gap: 8 }), true);
  const rowRefs = [];
  for (const item of kind.items) {
    const selectedRow = item.id === selected.id;
    const row = components.rows.get(`${spec.kind}:${selectedRow ? "on" : "off"}`).createInstance();
    row.name = `Row / ${item.id}`;
    applyRow(row, item);
    list.appendChild(row);
    rowRefs.push({ item, row });
  }

  const detail = append(body, frame(ctx, "Detail", { width: DETAIL, px: 20, py: 20, gap: 10, fill: COLORS.card, stroke: COLORS.border }));
  badge(ctx, detail, "Type", kind.label);
  text(ctx, detail, "Detail name", selected.id, { medium: true, size: 20, display: true });
  text(ctx, detail, "Detail module", selected.module, { size: 12, color: COLORS.muted });
  text(ctx, detail, "Detail blurb", selected.blurb, { size: 13, color: COLORS.ink2 });
  text(ctx, detail, "Detail path", kind.path.replace("<id>", selected.id), { size: 11, color: COLORS.ink4 });
  text(ctx, detail, "Detail note", "随整份插件安装。此行不能单独装卸。", { size: 12, color: COLORS.muted });
  const edit = spec.kind === "skill" ? button(ctx, detail, "CTA / edit", "编辑", { size: "sm" }) : null;

  return { screen, nav: navButtons, rows: rowRefs, detail, edit };
}

function langChip(ctx, parent, name, label, on) {
  const node = frame(ctx, name, { dir: "HORIZONTAL", px: 10, py: 6, radius: 999, align: "CENTER",
    fill: on ? COLORS.ink : COLORS.card, stroke: on ? null : COLORS.border });
  text(ctx, node, "Label", label, { hug: true, medium: true, size: 12, color: on ? COLORS.onPrimary : COLORS.ink2 });
  return append(parent, node);
}

function editorBoard(ctx, page, spec) {
  const locale = spec.locale;
  const hasZh = spec.hasZh;
  const stale = spec.stale;
  const screen = frame(ctx, spec.name, { width: DESKTOP, fill: COLORS.paper });
  page.appendChild(screen);
  const bar = append(screen, frame(ctx, "Editor bar", { dir: "HORIZONTAL", width: DESKTOP, px: 24, py: 16, gap: 16, align: "CENTER",
    fill: COLORS.card, stroke: COLORS.border }), true);
  const title = append(bar, frame(ctx, "Editor title wrap", { gap: 4 }), true);
  text(ctx, title, "Editor kicker", locale === "en" ? "编辑原版 skill" : "阅读译本", { hug: true, size: 12, color: COLORS.primary, medium: true });
  text(ctx, title, "Editor title", "grilling", { hug: true, medium: true, size: 18, display: true });
  text(ctx, title, "Editor path", locale === "en" ? "skills/grilling/SKILL.md" : "skills/grilling/i18n/zh-CN.md", { hug: true, size: 12, color: COLORS.muted });
  const actions = append(bar, frame(ctx, "Editor actions", { dir: "HORIZONTAL", gap: 8 }));
  const cancel = button(ctx, actions, "CTA / cancel", locale === "en" ? "取消" : "返回", { size: "sm", style: "outline" });
  const save = locale === "en" ? button(ctx, actions, "CTA / save", "保存", { size: "sm" }) : null;
  const body = append(screen, frame(ctx, "Editor body", { width: DESKTOP, px: 24, py: 20, gap: 12, fill: COLORS.paper }), true);
  if (stale) {
    const banner = append(body, frame(ctx, "Stale banner", { dir: "HORIZONTAL", width: DESKTOP - 48, px: 14, py: 10, gap: 12, radius: 10, align: "CENTER",
      fill: "#fef3c7" }), true);
    text(ctx, banner, "Stale copy", "译本已过时。原版 SKILL.md 改过，哈希对不上。", { hug: true, size: 13, color: COLORS.warning, medium: true });
  }
  const langs = append(body, frame(ctx, "Languages", { dir: "HORIZONTAL", gap: 8, align: "CENTER" }), true);
  const langEn = langChip(ctx, langs, "Lang / en", "English（原版）", locale === "en");
  const langZh = hasZh ? langChip(ctx, langs, "Lang / zh-CN", stale ? "简体中文（过时）" : "简体中文", locale === "zh") : null;
  const translate = (!hasZh && locale === "en")
    ? button(ctx, langs, "CTA / translate", "翻译成简体中文", { size: "sm" })
    : null;
  const retranslate = (stale && locale === "zh")
    ? button(ctx, langs, "CTA / retranslate", "重新翻译", { size: "sm" })
    : null;
  if (locale === "zh") {
    text(ctx, body, "Read-only note", "译本只供阅读。安装和保存永远对着原版 SKILL.md。", { size: 12, color: COLORS.muted });
  }
  const paper = append(body, frame(ctx, "Markdown", { width: DESKTOP - 48, px: 20, py: 16, radius: 12, fill: COLORS.card, stroke: COLORS.border }), true);
  text(ctx, paper, "Skill markdown", locale === "en" ? SAMPLE_SKILL_MD : SAMPLE_SKILL_MD_ZH, { size: 13, color: COLORS.ink2, lineHeight: 22 });
  return { screen, save, cancel, langEn, langZh, translate, retranslate };
}

function overlayBoard(ctx, page, components, name, kind, harnessLabel) {
  const screen = frame(ctx, name, { width: DESKTOP, height: 900, fill: COLORS.ink, fillOpacity: 0.32 });
  page.appendChild(screen);
  screen.primaryAxisAlignItems = "CENTER";
  screen.counterAxisAlignItems = "CENTER";
  screen.resize(DESKTOP, 900);
  screen.primaryAxisSizingMode = "FIXED";
  screen.counterAxisSizingMode = "FIXED";
  const dialog = components.dialogs.get(kind).card.createInstance();
  dialog.name = "Confirm";
  const title = dialog.findOne((node) => node.name === "Title");
  if (title && harnessLabel) title.characters = `${DIALOGS[kind].title} · ${harnessLabel}`;
  screen.appendChild(dialog);
  return {
    screen,
    confirm: dialog.findOne((node) => node.name === "CTA / confirm"),
    cancel: dialog.findOne((node) => node.name === "CTA / cancel"),
  };
}

function createOverview(ctx, page) {
  const overview = frame(ctx, "开始 / 设计说明", { width: DESKTOP, px: 48, py: 44, gap: 14, fill: COLORS.card, radius: 24 });
  page.appendChild(overview);
  text(ctx, overview, "Eyebrow", "ECC / PLUGIN CONSOLE", { medium: true, size: 12, color: COLORS.primary });
  text(ctx, overview, "Title", "看见插件里有什么，整份装到 Claude 或 Codex。", { medium: true, size: 32, lineHeight: 40, display: true });
  const notes = [
    "安装 / 卸载 / 更新操作整份 ECC，不按条开关。和 claude plugin / codex plugin 一致。",
    "一屏 1440：左 Skill / Hook / Command，中筛选列表，右详情。无手机版。",
    "顶栏两张卡：未装 / 已装 / 可更新。不画 Claude 钩子档位（off / minimal / standard / strict）。",
    "装、卸、更新都先过确认弹窗。取消回到来源画板。",
    "分类芯片用 install-modules 分组名。列表是真实 ECC 名字的十几条样例，不是 287 条全画。",
    "选中「控制台」画板后点演示：类型切换、安装 Claude、再装 Codex、更新。",
    "Skill 详情有「编辑」，打开原版 SKILL.md。语言：English / 简体中文。没有中文时点「翻译成简体中文」。译本在 i18n/zh-CN.md，只读。哈希不对就提示过时。保存只写原版。",
  ];
  notes.forEach((note, index) => text(ctx, overview, `Note ${index + 1}`, `${index + 1}. ${note}`, { size: 14, color: COLORS.ink2 }));
  return overview;
}

function harnessCta(screen, harness, name) {
  const card = screen.findOne((node) => node.name === `Harness / ${harness}`);
  return card ? card.findOne((node) => node.name === name) : null;
}

async function build(api, stage = () => {}) {
  stage("加载中文字体");
  const ctx = { api, fonts: await chooseFonts(api) };
  stage("新建独立页面");
  const name = nextPageName(api.root.children);
  const page = api.createPage();
  page.name = name;
  await api.setCurrentPageAsync(page);
  page.backgrounds = paint(COLORS.paper);
  page.setSharedPluginData(NS, "generator", GENERATOR);

  stage("生成组件");
  const components = createComponents(ctx, page);

  stage("生成演示画板");
  const overview = createOverview(ctx, page);
  const skillNone = consoleBoard(ctx, page, components, {
    name: "Prototype / Skill · 双未装", kind: "skill", claude: "missing", codex: "missing",
    selected: "grilling", chip: "全部",
  });
  const skillClaude = consoleBoard(ctx, page, components, {
    name: "Prototype / Skill · Claude 已装", kind: "skill", claude: "installed", codex: "missing",
    selected: "grilling", chip: "全部",
  });
  const skillBoth = consoleBoard(ctx, page, components, {
    name: "Prototype / Skill · 双已装", kind: "skill", claude: "installed", codex: "installed",
    selected: "grilling", chip: "全部",
  });
  const skillUpdate = consoleBoard(ctx, page, components, {
    name: "Prototype / Skill · 可更新", kind: "skill", claude: "update", codex: "update",
    selected: "grilling", chip: "全部",
  });
  const hookNone = consoleBoard(ctx, page, components, {
    name: "Prototype / Hook · 双未装", kind: "hook", claude: "missing", codex: "missing",
    selected: "SessionStart", chip: "全部",
  });
  const commandNone = consoleBoard(ctx, page, components, {
    name: "Prototype / Command · 双未装", kind: "command", claude: "missing", codex: "missing",
    selected: "plan", chip: "全部",
  });
  const dialogInstallClaude = overlayBoard(ctx, page, components, "Prototype / 确认 · 安装 Claude", "install", "Claude Code");
  const dialogInstallCodex = overlayBoard(ctx, page, components, "Prototype / 确认 · 安装 Codex", "install", "Codex");
  const dialogUninstall = overlayBoard(ctx, page, components, "Prototype / 确认 · 卸载", "uninstall", "Claude Code");
  const dialogUpdate = overlayBoard(ctx, page, components, "Prototype / 确认 · 更新", "update", "Claude Code");
  const editorEnNoZh = editorBoard(ctx, page, {
    name: "Prototype / 编辑 · 原文（无译本）", locale: "en", hasZh: false, stale: false,
  });
  const editorEnHasZh = editorBoard(ctx, page, {
    name: "Prototype / 编辑 · 原文（有译本）", locale: "en", hasZh: true, stale: false,
  });
  const editorZh = editorBoard(ctx, page, {
    name: "Prototype / 编辑 · 简体中文", locale: "zh", hasZh: true, stale: false,
  });
  const editorZhStale = editorBoard(ctx, page, {
    name: "Prototype / 编辑 · 简体中文已过时", locale: "zh", hasZh: true, stale: true,
  });

  stage("连接演示入口");
  await connect(skillNone.nav.hook, hookNone.screen, "NAVIGATE");
  await connect(skillNone.nav.command, commandNone.screen, "NAVIGATE");
  await connect(hookNone.nav.skill, skillNone.screen, "NAVIGATE");
  await connect(hookNone.nav.command, commandNone.screen, "NAVIGATE");
  await connect(commandNone.nav.skill, skillNone.screen, "NAVIGATE");
  await connect(commandNone.nav.hook, hookNone.screen, "NAVIGATE");
  await connect(harnessCta(skillNone.screen, "claude", "CTA / install"), dialogInstallClaude.screen, "NAVIGATE");
  await connect(dialogInstallClaude.confirm, skillClaude.screen, "NAVIGATE");
  await connect(dialogInstallClaude.cancel, skillNone.screen, "NAVIGATE");
  await connect(harnessCta(skillClaude.screen, "codex", "CTA / install"), dialogInstallCodex.screen, "NAVIGATE");
  await connect(dialogInstallCodex.confirm, skillBoth.screen, "NAVIGATE");
  await connect(dialogInstallCodex.cancel, skillClaude.screen, "NAVIGATE");
  await connect(harnessCta(skillClaude.screen, "claude", "CTA / uninstall"), dialogUninstall.screen, "NAVIGATE");
  await connect(dialogUninstall.confirm, skillNone.screen, "NAVIGATE");
  await connect(dialogUninstall.cancel, skillClaude.screen, "NAVIGATE");
  await connect(harnessCta(skillUpdate.screen, "claude", "CTA / update"), dialogUpdate.screen, "NAVIGATE");
  await connect(dialogUpdate.confirm, skillBoth.screen, "NAVIGATE");
  await connect(dialogUpdate.cancel, skillUpdate.screen, "NAVIGATE");
  for (const board of [skillNone, skillClaude, skillBoth, skillUpdate]) {
    await connect(board.edit, editorEnNoZh.screen, "NAVIGATE");
  }
  await connect(editorEnNoZh.cancel, skillNone.screen, "NAVIGATE");
  await connect(editorEnNoZh.save, skillNone.screen, "NAVIGATE");
  await connect(editorEnNoZh.translate, editorZh.screen, "NAVIGATE");
  await connect(editorZh.langEn, editorEnHasZh.screen, "NAVIGATE");
  await connect(editorZh.cancel, skillNone.screen, "NAVIGATE");
  await connect(editorEnHasZh.langZh, editorZh.screen, "NAVIGATE");
  await connect(editorEnHasZh.cancel, skillNone.screen, "NAVIGATE");
  await connect(editorEnHasZh.save, skillNone.screen, "NAVIGATE");
  await connect(editorZhStale.retranslate, editorZh.screen, "NAVIGATE");
  await connect(editorZhStale.langEn, editorEnHasZh.screen, "NAVIGATE");
  await connect(editorZhStale.cancel, skillNone.screen, "NAVIGATE");

  stage("排布画板");
  const screens = [
    overview, skillNone.screen, skillClaude.screen, skillBoth.screen, skillUpdate.screen,
    hookNone.screen, commandNone.screen, dialogInstallClaude.screen, dialogInstallCodex.screen,
    dialogUninstall.screen, dialogUpdate.screen,
    editorEnNoZh.screen, editorEnHasZh.screen, editorZh.screen, editorZhStale.screen,
  ];
  let y = 0;
  for (const screen of screens) {
    screen.x = 0;
    screen.y = y;
    y += screen.height + 80;
  }
  let setY = 0;
  for (const set of components.sets) {
    set.x = DESKTOP + 120;
    set.y = setY;
    setY += set.height + 64;
  }
  page.flowStartingPoints = [
    { nodeId: skillNone.screen.id, name: "控制台" },
    { nodeId: editorZhStale.screen.id, name: "过时译本" },
  ];
  page.selection = [skillNone.screen];
  api.viewport.scrollAndZoomIntoView(page.selection);
  return {
    page, components, overview, skillNone, skillClaude, skillBoth, skillUpdate,
    hookNone, commandNone, dialogInstallClaude, dialogInstallCodex, dialogUninstall, dialogUpdate,
    editorEnNoZh, editorEnHasZh, editorZh, editorZhStale, screens,
  };
}

async function run(api) {
  let currentStage = "初始化";
  try {
    await build(api, (stage) => { currentStage = stage; });
    api.closePlugin("已生成 ECC 插件控制台的可编辑组件与 15 块演示画板；选中「控制台」后点演示。");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api.closePlugin(`生成失败（${currentStage}）：${message}。已有设计未删除；本次未完成页面保留供检查。`);
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    build, run, nextPageName, stateCopy, applyRow, PAGE_NAME, COLORS, SKILLS, HOOKS, COMMANDS,
    KINDS, CHIPS, HARNESS, STATES, DIALOGS, SAMPLE_SKILL_MD, SAMPLE_SKILL_MD_ZH,
  };
}
if (typeof figma !== "undefined") void run(figma);
