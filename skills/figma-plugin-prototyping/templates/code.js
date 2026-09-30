// <Feature> Design Lab — local Figma Desktop development plugin.
/* global figma */
// Creates a fresh page in the current Design file and generates editable
// component sets plus prototype boards with click-through flows.
// Uses only the Figma Plugin API: no network, no product data, no MCP.
const PAGE_NAME = "<Feature> · Design Lab";
const NAMESPACE = "lab";
const GENERATOR = "lab.<feature>.design-lab";
const DESKTOP = 1440;
const PANEL = 760;

// Take these from the product's design tokens (globals.css or the theme file).
const COLORS = {
  paper: "#f6f1e8", card: "#fffcf5", surface2: "#f1e9dc", surface3: "#e6dccb",
  ink: "#241d17", ink2: "#4a4035", ink4: "#9c8e7b",
  border: "#e6dccb", borderStrong: "#cbbfae",
  primary: "#c8492b", primarySoft: "#f8e3dc", primaryDeep: "#8f2f1b", onPrimary: "#fffcf5",
  success: "#248a3d", warning: "#b45309", danger: "#b3261e",
};
const FONT_FAMILIES = ["PingFang SC", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC"];
const DISPLAY_FONTS = [{ family: "Fraunces", style: "SemiBold" }, { family: "Inter", style: "Semi Bold" }];

// Demo data lives here, not in the drawing code. Replace with the feature's own.
const STATES = [
  { key: "default", label: "默认", note: "还没有开始。" },
  { key: "active", label: "进行中", note: "第 2 步正在执行。" },
];

// ─── Small helpers ───────────────────────────────────────────────────────────

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

// Pick the first available CJK family; load only the styles that are used.
// Fail before any page is created when no CJK font exists.
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

/**
 * Auto-layout container. With `width` that axis is fixed and the other hugs;
 * without it both axes hug. o: dir / width / height / pad / px / py / gap /
 * align (cross axis) / justify (main axis) / fill / fillOpacity / stroke / radius / component
 */
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

/**
 * Text. Default: fills the parent width and grows in height. `hug`: both axes hug (labels, values).
 * Never read the parent's width here: every geometry read forces Figma to lay out the whole auto-layout tree.
 * Keep this order: fontName → characters → append → textAutoResize → FILL. Setting textAutoResize = "HEIGHT"
 * before the characters freezes the width of the fresh node near 0 and every character wraps onto its own line.
 */
function text(ctx, parent, name, characters, o = {}) {
  const node = ctx.api.createText();
  node.name = name;
  node.fontName = o.display ? ctx.fonts.display : o.medium ? ctx.fonts.medium : ctx.fonts.regular;
  node.fontSize = o.size || 14;
  node.lineHeight = { unit: "PIXELS", value: o.lineHeight || Math.round(node.fontSize * 1.45) };
  node.characters = characters;
  node.fills = paint(o.color || COLORS.ink);
  if (o.align) node.textAlignHorizontal = o.align;
  if (o.strike) node.textDecoration = "STRIKETHROUGH";
  parent.appendChild(node);
  if (o.hug) {
    node.textAutoResize = "WIDTH_AND_HEIGHT";
    return node;
  }
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
    fill: o.fill || COLORS.primarySoft, fillOpacity: o.fillOpacity });
  text(ctx, node, "Label", label, { hug: true, medium: true, size: o.size || 11, color: o.color || COLORS.primaryDeep });
  return append(parent, node);
}

/** Button. style: primary / outline / ghost / disabled / danger. Centers its label when `width` or `fill` is given. */
function button(ctx, parent, name, label, o = {}) {
  const style = o.style || "primary";
  const small = o.size === "sm";
  const fills = { primary: COLORS.primary, danger: COLORS.danger, disabled: COLORS.surface3 };
  const colors = { primary: COLORS.onPrimary, danger: COLORS.onPrimary, disabled: COLORS.ink4, ghost: COLORS.ink2, outline: COLORS.ink };
  const node = frame(ctx, name, { dir: "HORIZONTAL", px: small ? 12 : 18, py: small ? 6 : 11, gap: 6, radius: 999,
    align: "CENTER", justify: "CENTER", width: o.width, fill: fills[style], stroke: style === "outline" ? COLORS.borderStrong : null });
  text(ctx, node, "Label", label, { hug: true, medium: true, size: small ? 12 : 14, color: colors[style] });
  return append(parent, node, o.fill);
}

function divider(ctx, parent, width) {
  const node = ctx.api.createFrame();
  node.name = "Divider";
  node.resize(width, 1);
  node.fills = paint(COLORS.border);
  return append(parent, node);
}

function shadow(node) {
  node.effects = [{ type: "DROP_SHADOW", color: { ...rgb(COLORS.ink), a: 0.08 }, offset: { x: 0, y: 12 },
    radius: 32, spread: -12, visible: true, blendMode: "NORMAL" }];
}

// Inline lucide paths. Add icons here; never fetch them.
const LUCIDE = {
  "check": [["path", { "d": "M20 6 9 17l-5-5" }]],
  "chevron-right": [["path", { "d": "m9 18 6-6-6-6" }]],
  "x": [["path", { "d": "M18 6 6 18" }], ["path", { "d": "m6 6 12 12" }]],
};

function icon(ctx, name, color, size, o = {}) {
  const shapes = LUCIDE[name];
  if (!shapes) throw new Error(`未收录的图标: ${name}`);
  const body = shapes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(" ")}/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${o.weight || 2}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const node = ctx.api.createNodeFromSvg(svg);
  node.name = o.name || `Icon / ${name}`;
  return node;
}

/** Combine components into a variant set and lay them out in a grid. */
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

/**
 * Click wiring. NAVIGATE: only to a top-level frame on the page, never back
 * into the source's own board (Figma rejects it). CHANGE_TO: only to a sibling variant.
 */
async function connect(source, destination, navigation) {
  await source.setReactionsAsync([{
    trigger: { type: "ON_CLICK" },
    actions: [{ type: "NODE", destinationId: destination.id, navigation,
      ...(navigation === "NAVIGATE" ? { resetInteractiveComponents: true } : {}),
      transition: { type: navigation === "CHANGE_TO" ? "SMART_ANIMATE" : "DISSOLVE",
        duration: 0.16, easing: { type: "EASE_OUT" } } }],
  }]);
}

// ─── Components ──────────────────────────────────────────────────────────────

/** Demo / Card — State=default | active. Replace with the feature's real components. */
function card(ctx, state) {
  const active = state.key === "active";
  const node = frame(ctx, `State=${state.key}`, { component: true, width: 360, px: 20, py: 18, gap: 12,
    fill: COLORS.card, stroke: active ? COLORS.primary : COLORS.border, radius: 16 });
  node.setSharedPluginData(NAMESPACE, "state", state.key);
  const head = append(node, frame(ctx, "Head", { dir: "HORIZONTAL", gap: 8, align: "CENTER", justify: "SPACE_BETWEEN" }), true);
  text(ctx, head, "Title", "任务卡片", { hug: true, medium: true, size: 15 });
  badge(ctx, head, "Status", state.label, active ? {} : { fill: COLORS.surface2, color: COLORS.ink2 });
  text(ctx, node, "Note", state.note, { size: 13, color: COLORS.ink2 });
  divider(ctx, node, 320);
  const actions = append(node, frame(ctx, "Actions", { dir: "HORIZONTAL", gap: 8, justify: "MAX" }), true);
  const toggle = button(ctx, actions, "Toggle", active ? "暂停" : "开始", { size: "sm", style: active ? "outline" : "primary" });
  const open = button(ctx, actions, "Open", "查看详情", { size: "sm", style: "ghost" });
  shadow(node);
  return { node, toggle, open };
}

function createComponents(ctx, page) {
  const cards = new Map(STATES.map((state) => [state.key, card(ctx, state)]));
  const set = componentSet(ctx, page, "Demo / Card", [...cards.values()].map((item) => item.node), 2);
  return { cards, sets: [set] };
}

// ─── Boards ──────────────────────────────────────────────────────────────────

function board(ctx, page, name, o = {}) {
  const node = frame(ctx, `Prototype / ${name}`, { width: o.width || PANEL, px: o.px ?? 40, py: o.py ?? 40, gap: o.gap ?? 24, fill: COLORS.paper });
  page.appendChild(node);
  return node;
}

function createOverview(ctx, page, notes) {
  const overview = frame(ctx, "开始 / 设计说明", { width: DESKTOP, px: 48, py: 44, gap: 14, fill: COLORS.card, radius: 24 });
  page.appendChild(overview);
  text(ctx, overview, "Eyebrow", "<FEATURE> / DESIGN LAB", { medium: true, size: 12, color: COLORS.primary });
  text(ctx, overview, "Title", "<一句话说清这版设计决定了什么。>", { medium: true, size: 34, lineHeight: 42 });
  notes.forEach((note, index) => text(ctx, overview, `Note ${index + 1}`, `${index + 1}. ${note}`, { size: 14, color: COLORS.ink2 }));
  return overview;
}

function listBoard(ctx, page, components) {
  const screen = board(ctx, page, "列表 · 桌面", { width: DESKTOP, px: 120, py: 56, gap: 16 });
  text(ctx, screen, "Headline", "任务列表", { medium: true, size: 28, lineHeight: 36 });
  const row = append(screen, frame(ctx, "Cards", { dir: "HORIZONTAL", gap: 24 }));
  const instances = STATES.map((state) => {
    const instance = components.cards.get(state.key).node.createInstance();
    instance.name = `Card / ${state.key}`;
    return append(row, instance);
  });
  return { screen, instances };
}

function detailBoard(ctx, page) {
  const screen = board(ctx, page, "详情", { gap: 16 });
  const back = append(screen, frame(ctx, "Back", { dir: "HORIZONTAL", gap: 6, align: "CENTER" }));
  append(back, icon(ctx, "chevron-right", COLORS.ink2, 14));
  text(ctx, back, "Back label", "返回列表", { hug: true, size: 13, color: COLORS.ink2 });
  text(ctx, screen, "Headline", "任务详情", { medium: true, size: 24, lineHeight: 32 });
  text(ctx, screen, "Body", "这里放详情页的正文。文字会换行，画板高度随内容增长。", { size: 14, color: COLORS.ink2 });
  return { screen, back };
}

// ─── Entry ───────────────────────────────────────────────────────────────────

async function build(api, stage = () => {}) {
  stage("加载中文字体");
  const ctx = { api, fonts: await chooseFonts(api) };
  stage("新建独立页面");
  const name = nextPageName(api.root.children);
  const page = api.createPage();
  page.name = name;
  await api.setCurrentPageAsync(page);
  page.backgrounds = paint(COLORS.paper);
  page.setSharedPluginData(NAMESPACE, "generator", GENERATOR);

  stage("生成组件");
  const components = createComponents(ctx, page);

  stage("生成演示画板");
  const overview = createOverview(ctx, page, [
    "<设计决定 1>",
    "<设计决定 2>",
    "下方画板可选中后点演示：卡片「开始 / 暂停」切换状态，「查看详情」进详情页，「返回列表」回来。",
  ]);
  const list = listBoard(ctx, page, components);
  const detail = detailBoard(ctx, page);

  stage("连接演示入口");
  // Reactions are independent: send them all, then wait once, instead of one round trip each
  const [first, second] = STATES.map((state) => components.cards.get(state.key));
  await Promise.all([
    connect(first.toggle, second.node, "CHANGE_TO"),
    connect(second.toggle, first.node, "CHANGE_TO"),
    ...[...components.cards.values()].map((item) => connect(item.open, detail.screen, "NAVIGATE")),
    connect(detail.back, list.screen, "NAVIGATE"),
  ]);

  stage("排布画板");
  const screens = [overview, list.screen, detail.screen];
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
  page.flowStartingPoints = [{ nodeId: list.screen.id, name: "从列表进入" }];
  // Selecting a board expands it layer by layer in the Layers panel: select nothing and collapse the top level
  for (const node of page.children) node.expanded = false;
  api.viewport.scrollAndZoomIntoView([list.screen]);
  return { page, components, overview, list, detail, screens };
}

// ─── Layout check ────────────────────────────────────────────────────────────

/** How far `inner` sticks out of `outer`; `pad` shrinks `outer` to its content box. 0 when it fits. */
function overhang(outer, inner, pad = [0, 0, 0, 0]) {
  const [top, right, bottom, left] = pad;
  return Math.max(0,
    outer.x + left - inner.x,
    inner.x + inner.width - (outer.x + outer.width - right),
    outer.y + top - inner.y,
    inner.y + inner.height - (outer.y + outer.height - bottom));
}

/**
 * Everything on the finished page that does not fit, one line each:
 * - a clipping frame whose content sticks out of it: Figma hides that part and the canvas never scrolls;
 * - an auto-layout child that sticks out of the room its container leaves (wider than a column, taller than a fixed height).
 * Real Figma measures real text here, the fake only estimates it. Call it once, after the last write:
 * geometry reads between writes force a layout pass each, reads after the last write share one.
 */
function layoutCheck(roots) {
  const found = [];
  const boxes = new Map();
  const box = (node) => {
    if (!boxes.has(node)) boxes.set(node, node.absoluteBoundingBox);
    return boxes.get(node);
  };
  const shown = (node) => (node.children || []).filter((child) => child.visible);
  const report = (root, node, what, px) => found.push(`${node === root ? root.name : `${root.name} › ${node.name}`} ${what} ${Math.round(px)}px`);
  const cut = (frame) => {
    let worst = 0;
    const walk = (node) => {
      for (const child of shown(node)) {
        worst = Math.max(worst, overhang(box(frame), box(child)));
        if (!child.clipsContent) walk(child);
      }
    };
    walk(frame);
    return worst;
  };
  const visit = (root, node) => {
    const kids = shown(node);
    if (node.clipsContent) {
      const px = cut(node);
      if (px > 0.5) report(root, node, "被裁", px);
    } else if (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL") {
      const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft];
      for (const child of kids) {
        if (child.layoutPositioning === "ABSOLUTE") continue;
        const px = overhang(box(node), box(child), pad);
        if (px > 0.5) report(root, child, `超出 ${node.name}`, px);
      }
    }
    for (const child of kids) visit(root, child);
  };
  for (const root of roots) if (root.visible) visit(root, root);
  return found;
}

/** The layout line of the closing message: the count and the first few; every line goes to the console. */
function layoutText(misfits) {
  if (!misfits.length) return "排版检查：没有放不下的";
  return `排版检查：${misfits.length} 处放不下（${misfits.slice(0, 3).join("；")}${misfits.length > 3 ? " …" : ""}），全部明细在开发者控制台`;
}

/** How long each stage took, shown in the closing message: real Figma timings cannot be reproduced offline. */
function timingText(marks, end) {
  const seconds = (ms) => (ms / 1000).toFixed(1);
  const parts = marks.map(([name, at], index) => `${name} ${seconds((marks[index + 1] ? marks[index + 1][1] : end) - at)}`);
  return `用时 ${seconds(end - marks[0][1])} 秒（${parts.join("、")}）`;
}

async function run(api) {
  let currentStage = "初始化";
  const marks = [];
  const stage = (name) => {
    currentStage = name;
    marks.push([name, Date.now()]);
  };
  try {
    const { page } = await build(api, stage);
    stage("排版检查");
    const misfits = layoutCheck(page.children);
    for (const line of misfits) console.warn(`排版检查：${line}`);
    api.closePlugin(`已生成可编辑组件与演示画板，${layoutText(misfits)}；${timingText(marks, Date.now())}；选中画板后点演示按钮。`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api.closePlugin(`生成失败（${currentStage}）：${message}。已有设计未删除；本次未完成页面保留供检查。`);
  }
}

if (typeof module !== "undefined") {
  module.exports = { build, run, layoutCheck, nextPageName, STATES, PAGE_NAME, NAMESPACE };
}
if (typeof figma !== "undefined") void run(figma);
