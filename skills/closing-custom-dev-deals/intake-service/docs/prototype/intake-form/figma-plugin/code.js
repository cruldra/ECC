// Intake Form Design Lab — local Figma Desktop development plugin.
// Draws the client-facing intake form: a phone flow the client opens from one
// link, plus the desktop single-page alternative, as editable component sets
// and click-through boards. Plugin API only: no network, no product data.
const PAGE_NAME = "业务信息收集表 · Design Lab";
const NAMESPACE = "lab";
const GENERATOR = "lab.intake-form.design-lab";
const PHONE = 390;
const DESKTOP = 1200;

// Tokens follow the prototype starter in closing-custom-dev-deals
// (Tailwind slate/blue defaults), so the built form matches these boards.
const COLORS = {
  paper: "#f1f5f9", card: "#ffffff", surface2: "#f8fafc", surface3: "#e2e8f0",
  ink: "#0f172a", ink2: "#475569", ink4: "#94a3b8",
  border: "#e2e8f0", borderStrong: "#cbd5e1",
  primary: "#2563eb", primarySoft: "#dbeafe", primaryDeep: "#1d4ed8", onPrimary: "#ffffff",
  success: "#16a34a", successSoft: "#dcfce7", warning: "#b45309", danger: "#dc2626", dangerSoft: "#fee2e2",
};
const FONT_FAMILIES = ["PingFang SC", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC"];
const DISPLAY_FONTS = [{ family: "Inter", style: "Semi Bold" }];

// ─── Form content ────────────────────────────────────────────────────────────
// The questionnaire is generic on purpose: it runs before we know the client's
// industry, so every question is about facts any company can answer without
// preparation. Keep it to four steps — past that people abandon the form.

const STEPS = [
  { key: "company", index: 1, title: "企业信息", lead: "用于了解贵司的业务方向。" },
  { key: "roles", index: 2, title: "关键岗位与流程", lead: "请列出与本次业务相关的关键岗位及其日常流程。" },
  { key: "scenes", index: 3, title: "期望 AI 赋能的场景", lead: "请填写您希望借助 AI 改善的环节，可自行添加。" },
];

const HEADCOUNT = ["1–10 人", "11–50 人", "51–200 人", "200 人以上"];
const INDUSTRIES = ["装修建材", "教育培训", "医疗健康", "生产制造", "零售电商", "餐饮连锁", "物流仓储", "专业服务", "其他"];

const COMPANY_FIELDS = [
  { label: "公司名称", value: "远行装饰工程有限公司" },
  { label: "所在城市", value: "北京" },
  { label: "主营业务", value: "别墅整装，设计、施工与主材一体交付" },
];
// 预置两个岗位，客户可以自己加。岗位和它的流程是出原型最直接的养料：
// 有了角色，才知道界面该分成谁看什么。
const ROLE_SLOTS = [
  { title: "岗位 1", name: "设计师", flow: "接待业主 → 量房 → 出方案 → 报价 → 交底给项目经理" },
  { title: "岗位 2", name: "项目经理", flow: "开工交底 → 排施工队 → 每日巡场 → 验收 → 交付业主" },
];
// 场景 = 名称 + 现状 + 预期。现状写实际怎么做的，预期写希望变成什么样，
// 两边对着写，我们才知道要做的是哪一段。同样预置两个，客户自己加。
const SCENE_SLOTS = [
  { title: "场景 1", name: "报价汇总",
    now: "预算员逐项核对图纸与材料清单，出一份报价约两天。",
    want: "上传图纸后自动生成报价初稿，人工只做复核。" },
  { title: "场景 2", name: "工地进度同步",
    now: "工长拍照发微信群，业主常常没看到，变更传达不到位。",
    want: "业主在手机上看到每日进度与变更确认记录。" },
];
const FIELD_STATES = [
  { key: "empty", label: "未填", helper: "" },
  { key: "filled", label: "已填", helper: "" },
  { key: "error", label: "有错", helper: "此项为必填。" },
];
const CHIP_STATES = [{ key: "off" }, { key: "on" }];

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
  const fills = { primary: COLORS.primary, disabled: COLORS.surface3, ghost: null, outline: COLORS.card };
  const colors = { primary: COLORS.onPrimary, disabled: COLORS.ink4, ghost: COLORS.ink2, outline: COLORS.ink };
  const node = frame(ctx, name, { dir: "HORIZONTAL", px: small ? 12 : 18, py: small ? 8 : 13, gap: 6, radius: 12,
    align: "CENTER", justify: "CENTER", width: o.width, fill: fills[style], stroke: style === "outline" ? COLORS.borderStrong : null });
  text(ctx, node, "Label", label, { hug: true, medium: true, size: small ? 13 : 15, color: colors[style] });
  return append(parent, node, o.fill);
}

function divider(ctx, parent, width) {
  const node = ctx.api.createFrame();
  node.name = "Divider";
  node.resize(width, 1);
  node.fills = paint(COLORS.border);
  return append(parent, node);
}

const LUCIDE = {
  "check": [["path", { "d": "M20 6 9 17l-5-5" }]],
  "chevron-left": [["path", { "d": "m15 18-6-6 6-6" }]],
  "alert-circle": [["circle", { "cx": "12", "cy": "12", "r": "10" }], ["path", { "d": "M12 8v4" }], ["path", { "d": "M12 16h.01" }]],
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

function componentSet(ctx, page, name, components, columns) {
  for (const component of components) page.appendChild(component);
  const set = ctx.api.combineAsVariants(components, page);
  set.name = name;
  set.layoutMode = "NONE";
  set.fills = paint(COLORS.surface2, 0.6);
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

// ─── Components ──────────────────────────────────────────────────────────────

/** Intake / Field — State=empty | filled | error. One labelled text input. */
function field(ctx, state) {
  const node = frame(ctx, `State=${state.key}`, { component: true, width: 326, gap: 6 });
  node.setSharedPluginData(NAMESPACE, "state", state.key);
  text(ctx, node, "Label", "公司名称", { medium: true, size: 13, color: COLORS.ink2 });
  // 子元素一律填满组件宽度。写死 326 的话，实例被放进有内边距的卡片里缩窄后，
  // 白框还是 326，会从卡片右边戳出去。
  const box = append(node, frame(ctx, "Input", { dir: "HORIZONTAL", width: 326, px: 14, py: 12, gap: 8, radius: 12,
    align: "CENTER", fill: COLORS.card, stroke: state.key === "error" ? COLORS.danger : COLORS.border }), true);
  const filled = state.key === "filled";
  // 未填就是空的。输入框里写引导语，客户会觉得我们在套他的信息。
  text(ctx, box, "Value", filled ? "远行装饰工程有限公司" : " ", {
    size: 15, color: filled ? COLORS.ink : COLORS.ink4, singleLine: true,
  });
  if (state.key === "error") {
    const hint = append(node, frame(ctx, "Helper", { dir: "HORIZONTAL", width: 326, gap: 5, align: "CENTER" }), true);
    append(hint, icon(ctx, "alert-circle", COLORS.danger, 13));
    text(ctx, hint, "Text", state.helper, { size: 12, color: COLORS.danger });
  }
  return { node };
}

/** Intake / Chip — State=off | on. Used for industry, headcount, channels, tools. */
function chip(ctx, state) {
  const on = state.key === "on";
  const node = frame(ctx, `State=${state.key}`, { component: true, dir: "HORIZONTAL", px: 13, py: 8, gap: 5, radius: 999,
    align: "CENTER", fill: on ? COLORS.primarySoft : COLORS.card, stroke: on ? COLORS.primary : COLORS.border });
  node.setSharedPluginData(NAMESPACE, "state", state.key);
  if (on) append(node, icon(ctx, "check", COLORS.primaryDeep, 13));
  text(ctx, node, "Label", "装修建材", { hug: true, medium: on, size: 14, color: on ? COLORS.primaryDeep : COLORS.ink2 });
  return { node };
}

/** Intake / Progress — Step=1..4. Tells the client how much is left. */
function progress(ctx, step) {
  const node = frame(ctx, `Step=${step.index}`, { component: true, width: 326, gap: 8 });
  node.setSharedPluginData(NAMESPACE, "step", String(step.index));
  const head = append(node, frame(ctx, "Head", { dir: "HORIZONTAL", width: 326, gap: 8, align: "CENTER", justify: "SPACE_BETWEEN" }));
  text(ctx, head, "Title", `第 ${step.index} 步 · ${step.title}`, { hug: true, medium: true, size: 13, color: COLORS.ink2 });
  text(ctx, head, "Count", `${step.index} / ${STEPS.length}`, { hug: true, size: 12, color: COLORS.ink4 });
  const track = append(node, frame(ctx, "Track", { dir: "HORIZONTAL", width: 326, height: 4, radius: 999, fill: COLORS.surface3 }));
  const done = append(track, frame(ctx, "Done", { width: Math.round(326 * (step.index / STEPS.length)), height: 4, radius: 999, fill: COLORS.primary }));
  done.resize(Math.round(326 * (step.index / STEPS.length)), 4);
  return { node };
}

function createComponents(ctx, page) {
  const fields = new Map(FIELD_STATES.map((state) => [state.key, field(ctx, state)]));
  const chips = new Map(CHIP_STATES.map((state) => [state.key, chip(ctx, state)]));
  const steps = new Map(STEPS.map((step) => [step.index, progress(ctx, step)]));
  const sets = [
    componentSet(ctx, page, "Intake / Field", [...fields.values()].map((item) => item.node), 3),
    componentSet(ctx, page, "Intake / Chip", [...chips.values()].map((item) => item.node), 2),
    componentSet(ctx, page, "Intake / Progress", [...steps.values()].map((item) => item.node), 2),
  ];
  return { fields, chips, steps, sets };
}

// ─── Boards ──────────────────────────────────────────────────────────────────

function board(ctx, page, name, o = {}) {
  const node = frame(ctx, `Prototype / ${name}`, { width: o.width || PHONE, px: o.px ?? 32, py: o.py ?? 36,
    gap: o.gap ?? 20, fill: COLORS.paper });
  page.appendChild(node);
  return node;
}

function chipRow(ctx, parent, components, labels, selected) {
  const row = append(parent, frame(ctx, "Chips", { dir: "HORIZONTAL", width: 326, gap: 8, wrap: true }));
  row.layoutWrap = "WRAP";
  row.counterAxisSpacing = 8;
  for (const label of labels) {
    const on = selected.includes(label);
    const instance = components.chips.get(on ? "on" : "off").node.createInstance();
    instance.name = `Chip / ${label}`;
    const node = instance.findOne ? instance.findOne((child) => child.name === "Label") : null;
    if (node) node.characters = label;
    append(row, instance);
  }
  return row;
}

function fieldRow(ctx, parent, components, spec, state) {
  const instance = components.fields.get(state).node.createInstance();
  instance.name = `Field / ${spec.label}`;
  const label = instance.findOne ? instance.findOne((child) => child.name === "Label") : null;
  if (label) label.characters = spec.label;
  const value = instance.findOne ? instance.findOne((child) => child.name === "Value") : null;
  if (value) value.characters = state === "filled" ? spec.value : " ";
  return append(parent, instance);
}

function stepHead(ctx, parent, components, step) {
  const instance = components.steps.get(step.index).node.createInstance();
  instance.name = `Progress / ${step.index}`;
  append(parent, instance);
  text(ctx, parent, "Lead", step.lead, { size: 13, color: COLORS.ink2 });
  return instance;
}

function startBoard(ctx, page) {
  const screen = board(ctx, page, "开始", { gap: 18 });
  badge(ctx, screen, "Brand", "业务信息收集");
  text(ctx, screen, "Headline", "我们想更好地理解您的业务", { medium: true, size: 26, lineHeight: 36 });
  text(ctx, screen, "Lead", "为此需要向您收集一些基本信息。共三步，约二十分钟。", { size: 14, color: COLORS.ink2 });
  const notes = append(screen, frame(ctx, "Notes", { width: 326, px: 16, py: 14, gap: 8, radius: 14, fill: COLORS.card, stroke: COLORS.border }));
  for (const line of ["不确定的项可以留空，后续沟通时一并确认。", "请按贵司实际情况填写。", "填写内容自动保存，可中断后继续。"]) {
    const row = append(notes, frame(ctx, "Note", { dir: "HORIZONTAL", width: 294, gap: 8, align: "CENTER" }));
    append(row, icon(ctx, "check", COLORS.success, 14));
    text(ctx, row, "Text", line, { size: 13, color: COLORS.ink2 });
  }
  const start = button(ctx, screen, "Start", "开始填写", { width: 326 });
  return { screen, start };
}

function companyBoard(ctx, page, components, filled) {
  const screen = board(ctx, page, filled ? "第 1 步 · 企业信息 · 已填" : "第 1 步 · 企业信息", { gap: 18 });
  stepHead(ctx, screen, components, STEPS[0]);
  for (const spec of COMPANY_FIELDS) fieldRow(ctx, screen, components, spec, filled ? "filled" : "empty");
  text(ctx, screen, "Industry label", "行业", { medium: true, size: 13, color: COLORS.ink2 });
  chipRow(ctx, screen, components, INDUSTRIES, filled ? ["装修建材"] : []);
  text(ctx, screen, "Headcount label", "企业规模", { medium: true, size: 13, color: COLORS.ink2 });
  chipRow(ctx, screen, components, HEADCOUNT, filled ? ["11–50 人"] : []);
  const next = button(ctx, screen, "Next", "下一步", { width: 326, style: filled ? "primary" : "disabled" });
  return { screen, next };
}

function errorBoard(ctx, page, components) {
  const screen = board(ctx, page, "第 1 步 · 企业信息 · 未填必填项", { gap: 18 });
  stepHead(ctx, screen, components, STEPS[0]);
  fieldRow(ctx, screen, components, COMPANY_FIELDS[0], "error");
  for (const spec of COMPANY_FIELDS.slice(1)) fieldRow(ctx, screen, components, spec, "empty");
  text(ctx, screen, "Industry label", "行业", { medium: true, size: 13, color: COLORS.ink2 });
  chipRow(ctx, screen, components, INDUSTRIES, []);
  text(ctx, screen, "Headcount label", "企业规模", { medium: true, size: 13, color: COLORS.ink2 });
  chipRow(ctx, screen, components, HEADCOUNT, []);
  const fix = button(ctx, screen, "Fix", "下一步", { width: 326, style: "disabled" });
  return { screen, fix };
}

/** 可增删的一张卡：标题行 + 若干字段。岗位和场景共用，卡数由客户自己加。 */
function entryCard(ctx, parent, components, title, fields, filled) {
  const card = append(parent, frame(ctx, `Card / ${title}`, { width: 326, px: 14, py: 14, gap: 12, radius: 14,
    fill: COLORS.card, stroke: COLORS.border }));
  const head = append(card, frame(ctx, "Head", { dir: "HORIZONTAL", width: 298, gap: 8, align: "CENTER", justify: "SPACE_BETWEEN" }));
  text(ctx, head, "Title", title, { hug: true, medium: true, size: 13, color: COLORS.ink2 });
  text(ctx, head, "Remove", "移除", { hug: true, size: 12, color: COLORS.ink4 });
  for (const item of fields) {
    if (item.kind === "area") {
      text(ctx, card, `${item.label} label`, item.label, { medium: true, size: 13, color: COLORS.ink2 });
      const box = append(card, frame(ctx, `Area / ${item.label}`, { width: 298, px: 12, py: 11, height: item.height || 70,
        radius: 12, fill: COLORS.surface2, stroke: COLORS.border }));
      text(ctx, box, "Value", filled ? item.value : " ", { size: 13, color: filled ? COLORS.ink : COLORS.ink4, lineHeight: 20 });
      continue;
    }
    const instance = components.fields.get(filled ? "filled" : "empty").node.createInstance();
    instance.name = `Field / ${title} · ${item.label}`;
    const label = instance.findOne ? instance.findOne((child) => child.name === "Label") : null;
    if (label) label.characters = item.label;
    const value = instance.findOne ? instance.findOne((child) => child.name === "Value") : null;
    if (value) value.characters = filled ? item.value : " ";
    append(card, instance, true);
  }
  return card;
}

function roleCard(ctx, parent, components, slot, filled) {
  return entryCard(ctx, parent, components, slot.title, [
    { label: "岗位名称", value: slot.name },
    { label: "日常工作流程", kind: "area", value: slot.flow, height: 76 },
  ], filled);
}

function sceneCard(ctx, parent, components, slot, filled) {
  return entryCard(ctx, parent, components, slot.title, [
    { label: "场景名称", value: slot.name },
    { label: "现状", kind: "area", value: slot.now, height: 70 },
    { label: "预期", kind: "area", value: slot.want, height: 70 },
  ], filled);
}

function rolesBoard(ctx, page, components) {
  const screen = board(ctx, page, "第 2 步 · 关键岗位与流程", { gap: 18 });
  stepHead(ctx, screen, components, STEPS[1]);
  for (const slot of ROLE_SLOTS) roleCard(ctx, screen, components, slot, true);
  const add = button(ctx, screen, "Add role", "添加岗位", { width: 326, style: "outline" });
  const next = button(ctx, screen, "Next", "下一步", { width: 326 });
  return { screen, next, add };
}

function scenesBoard(ctx, page, components) {
  const screen = board(ctx, page, "第 3 步 · 期望 AI 赋能的场景", { gap: 18 });
  stepHead(ctx, screen, components, STEPS[2]);
  for (const slot of SCENE_SLOTS) sceneCard(ctx, screen, components, slot, true);
  const add = button(ctx, screen, "Add scene", "添加场景", { width: 326, style: "outline" });
  const submit = button(ctx, screen, "Submit", "提交", { width: 326 });
  return { screen, submit, add };
}

function doneBoard(ctx, page) {
  const screen = board(ctx, page, "提交完成", { gap: 18, py: 120 });
  const mark = append(screen, frame(ctx, "Mark", { width: 56, height: 56, radius: 999, align: "CENTER", justify: "CENTER", fill: COLORS.successSoft }));
  append(mark, icon(ctx, "check", COLORS.success, 26));
  text(ctx, screen, "Headline", "已提交", { medium: true, size: 24, lineHeight: 32 });
  text(ctx, screen, "Lead", "感谢您的配合。我们会尽快与您联系，就填写内容进一步沟通。", { size: 14, color: COLORS.ink2 });
  const again = button(ctx, screen, "Again", "查看已提交内容", { width: 326, style: "outline" });
  return { screen, again };
}

/** The alternative layout: everything on one desktop page instead of four steps. */
function desktopBoard(ctx, page, components) {
  const screen = board(ctx, page, "桌面 · 单页", { width: DESKTOP, px: 160, py: 64, gap: 28 });
  badge(ctx, screen, "Brand", "业务信息收集");
  text(ctx, screen, "Headline", "我们想更好地理解您的业务", { medium: true, size: 32, lineHeight: 42 });
  const columns = append(screen, frame(ctx, "Columns", { dir: "HORIZONTAL", width: 880, gap: 40 }));
  const left = append(columns, frame(ctx, "Left", { width: 420, gap: 18 }));
  const right = append(columns, frame(ctx, "Right", { width: 420, gap: 18 }));
  text(ctx, left, "Section 1", "企业信息", { medium: true, size: 17 });
  for (const spec of COMPANY_FIELDS) fieldRow(ctx, left, components, spec, "empty");
  text(ctx, left, "Industry label", "行业", { medium: true, size: 13, color: COLORS.ink2 });
  chipRow(ctx, left, components, INDUSTRIES, []);
  text(ctx, left, "Headcount label", "企业规模", { medium: true, size: 13, color: COLORS.ink2 });
  chipRow(ctx, left, components, HEADCOUNT, []);
  text(ctx, right, "Section 2", "关键岗位与流程", { medium: true, size: 17 });
  for (const slot of ROLE_SLOTS) roleCard(ctx, right, components, slot, false);
  button(ctx, right, "Add role", "添加岗位", { width: 420, style: "outline" });
  divider(ctx, screen, 880);
  text(ctx, screen, "Section 3", "期望 AI 赋能的场景", { medium: true, size: 17 });
  const scenes = append(screen, frame(ctx, "Scenes", { dir: "HORIZONTAL", width: 880, gap: 40 }));
  for (const slot of SCENE_SLOTS) sceneCard(ctx, scenes, components, slot, false);
  const submit = button(ctx, screen, "Submit", "提交", { width: 220 });
  return { screen, submit };
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
  const start = startBoard(ctx, page);
  const company = companyBoard(ctx, page, components, false);
  const companyFilled = companyBoard(ctx, page, components, true);
  const error = errorBoard(ctx, page, components);
  const roles = rolesBoard(ctx, page, components);
  const scenes = scenesBoard(ctx, page, components);
  const done = doneBoard(ctx, page);
  const desktop = desktopBoard(ctx, page, components);

  // 7 clicks: start → 1 → 1已填 → 2 → 3 → 完成 → 开始, plus 桌面单页 → 完成.
  stage("连接演示入口");
  await connect(start.start, company.screen, "NAVIGATE");
  await connect(company.next, companyFilled.screen, "NAVIGATE");
  await connect(companyFilled.next, roles.screen, "NAVIGATE");
  await connect(roles.next, scenes.screen, "NAVIGATE");
  await connect(scenes.submit, done.screen, "NAVIGATE");
  await connect(done.again, start.screen, "NAVIGATE");
  await connect(desktop.submit, done.screen, "NAVIGATE");

  stage("排布画板");
  const phones = [start.screen, company.screen, companyFilled.screen, error.screen, roles.screen, scenes.screen, done.screen];
  let x = 0;
  for (const screen of phones) {
    screen.x = x;
    screen.y = 0;
    x += screen.width + 56;
  }
  desktop.screen.x = 0;
  desktop.screen.y = Math.max(...phones.map((screen) => screen.height)) + 96;
  let setY = desktop.screen.y + desktop.screen.height + 96;
  for (const set of components.sets) {
    set.x = 0;
    set.y = setY;
    setY += set.height + 64;
  }
  page.flowStartingPoints = [{ nodeId: start.screen.id, name: "手机端从头填一遍" }];
  page.selection = [start.screen];
  api.viewport.scrollAndZoomIntoView(page.selection);
  return { page, components, start, company, companyFilled, error, roles, scenes, done, desktop,
    screens: [...phones, desktop.screen] };
}

async function run(api) {
  let currentStage = "初始化";
  try {
    await build(api, (stage) => { currentStage = stage; });
    api.closePlugin("已生成信息收集表的组件与演示画板；选中「开始」画板后点演示。");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api.closePlugin(`生成失败（${currentStage}）：${message}。已有设计未删除；本次未完成页面保留供检查。`);
  }
}

if (typeof module !== "undefined") {
  module.exports = { build, run, nextPageName, PAGE_NAME, NAMESPACE, STEPS, INDUSTRIES, HEADCOUNT,
    COMPANY_FIELDS, ROLE_SLOTS, SCENE_SLOTS, FIELD_STATES, CHIP_STATES };
}
if (typeof figma !== "undefined") void run(figma);
