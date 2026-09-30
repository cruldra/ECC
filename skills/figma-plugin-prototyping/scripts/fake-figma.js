const assert = require("node:assert/strict");

const LAYOUT_KEYS = [
  "layoutMode", "layoutPositioning", "visible",
  "primaryAxisSizingMode", "counterAxisSizingMode",
  "paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "itemSpacing",
  "layoutWrap", "counterAxisSpacing", "primaryAxisAlignItems", "counterAxisAlignItems",
  "fontSize", "lineHeight", "textAutoResize", "maxLines",
];
// 真 Figma 里这些属性只有自动排版容器有、或只有文字有；给别的图层设会抛 "object is not extensible"。
const FRAME_ONLY = new Set(["layoutMode", "primaryAxisSizingMode", "counterAxisSizingMode",
  "paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "itemSpacing",
  "layoutWrap", "counterAxisSpacing", "primaryAxisAlignItems", "counterAxisAlignItems"]);
const TEXT_ONLY = new Set(["fontSize", "lineHeight", "textAutoResize", "maxLines"]);
const FRAME_TYPES = new Set(["FRAME", "COMPONENT", "INSTANCE", "COMPONENT_SET"]);
const SKIP_COPY = new Set(["id", "parent", "children", "_rev", "_cachedRev", "_val", "_mark", "_flowRev", "_flowCache"]);

// 模拟 Figma 文档树与自动排版的尺寸、位置推算（含折行）, 检查结构、变体配对、实例复用与连线;
// 不模拟真实字体度量、绘制和演示引擎: 字宽按中文一个字号、其余 0.55 个字号估算.
// 尺寸记在节点上. 改一个节点只作废它、祖先、以及祖先底下靠父尺寸吃饭的 FILL 孩子.
function fakeFigma(options = {}) {
  let sequence = 0;
  let stamp = 0;
  const nodes = new Map();
  const loaded = new Set();
  const mark = (node, token) => {
    if (!node || node._mark === token) return;
    node._mark = token;
    node._rev += 1;
    for (const child of node.children) {
      if (child._horizontal === "FILL" || child._vertical === "FILL") mark(child, token);
    }
    mark(node.parent, token);
  };
  const dirty = (node) => { mark(node, ++stamp); };
  const fontKey = (font) => `${font.family}/${font.style}`;
  const cjk = /[\u3000-\u9fff\uff00-\uffef]/;
  // 每个换行符另起一行：宽取最长的一行，高按行数算
  const lineWidths = (node) => node._characters.split("\n").map((line) => {
    let width = 0;
    for (const char of line) width += cjk.test(char) ? node.fontSize : node.fontSize * 0.55;
    return Math.max(1, Math.round(width));
  });
  const textWidth = (node) => Math.max(...lineWidths(node));
  const textLines = (node, width) => lineWidths(node).reduce((sum, line) => sum + Math.max(1, Math.ceil(line / Math.max(1, width))), 0);
  const padX = (node) => node.paddingLeft + node.paddingRight;
  const padY = (node) => node.paddingTop + node.paddingBottom;
  const flow = (node) => {
    if (node._flowRev === node._rev) return node._flowCache;
    node._flowCache = node.children.filter((child) => child.visible && child.layoutPositioning !== "ABSOLUTE");
    node._flowRev = node._rev;
    return node._flowCache;
  };
  const gaps = (node) => Math.max(0, flow(node).length - 1) * node.itemSpacing;
  // 定宽的横排设了折行才折：从左往右排，放不下的换到下一行
  const wraps = (node) => node.layoutMode === "HORIZONTAL" && node.layoutWrap === "WRAP" && node.primaryAxisSizingMode === "FIXED";
  const wrapLines = (node) => {
    const limit = node.width - padX(node);
    const lines = [];
    let line = [];
    let used = 0;
    for (const child of flow(node)) {
      if (line.length && used + node.itemSpacing + child.width > limit + 0.01) {
        lines.push(line);
        line = [];
        used = 0;
      }
      used += (line.length ? node.itemSpacing : 0) + child.width;
      line.push(child);
    }
    if (line.length) lines.push(line);
    return lines;
  };
  const shift = (align, free) => (align === "CENTER" ? free / 2 : align === "MAX" ? free : 0);
  // 自动排版容器里每个跟着排的子项相对容器左上角的位置：内边距、间距、主轴 / 交叉轴对齐、折行
  const offsets = (node) => node._memo("pos", () => {
    const horizontal = node.layoutMode === "HORIZONTAL";
    const along = (child) => (horizontal ? child.width : child.height);
    const across = (child) => (horizontal ? child.height : child.width);
    const mainStart = horizontal ? node.paddingLeft : node.paddingTop;
    const crossStart = horizontal ? node.paddingTop : node.paddingLeft;
    const mainRoom = horizontal ? node.width - padX(node) : node.height - padY(node);
    const crossRoom = horizontal ? node.height - padY(node) : node.width - padX(node);
    const lines = wraps(node) ? wrapLines(node) : [flow(node)];
    const placed = new Map();
    let cross = crossStart;
    for (const line of lines) {
      const size = line.reduce((sum, child) => sum + along(child), 0);
      const spread = node.primaryAxisAlignItems === "SPACE_BETWEEN" && line.length > 1;
      const gap = spread ? Math.max(0, (mainRoom - size) / (line.length - 1)) : node.itemSpacing;
      const lineCross = lines.length > 1 ? Math.max(...line.map(across)) : crossRoom;
      let at = mainStart + (spread ? 0 : shift(node.primaryAxisAlignItems, mainRoom - size - gap * (line.length - 1)));
      for (const child of line) {
        const side = cross + shift(node.counterAxisAlignItems, lineCross - across(child));
        placed.set(child, horizontal ? { x: at, y: side } : { x: side, y: at });
        at += along(child) + gap;
      }
      cross += lineCross + node.counterAxisSpacing;
    }
    return placed;
  });

  class Node {
    constructor(type) {
      this.id = String(++sequence);
      this.type = type;
      this.name = type;
      this.children = [];
      this.parent = null;
      this.visible = true;
      this.layoutMode = "NONE";
      this.layoutPositioning = "AUTO";
      this.primaryAxisSizingMode = this.counterAxisSizingMode = "FIXED";
      this.paddingLeft = this.paddingRight = this.paddingTop = this.paddingBottom = 0;
      this.itemSpacing = 0;
      this.layoutWrap = "NO_WRAP";
      this.counterAxisSpacing = 0;
      this.primaryAxisAlignItems = this.counterAxisAlignItems = "MIN";
      this.x = this.y = 0;
      this._width = this._height = 100;
      this._characters = "";
      this._horizontal = this._vertical = "FIXED";
      this.fontSize = 14;
      this.lineHeight = { unit: "PIXELS", value: 20 };
      this.textAutoResize = "NONE";
      this.maxLines = undefined;
      this.data = {};
      this.reactions = [];
      this.rangeFills = [];
      this.rangeFonts = [];
      this.flowStartingPoints = [];
      this._rev = 0;
      this._mark = 0;
      this._cachedRev = { w: -1, h: -1, iw: -1, ih: -1, mw: -1, mh: -1, pos: -1 };
      this._val = { w: 0, h: 0, iw: 0, ih: 0, mw: 0, mh: 0, pos: null };
      this._flowRev = -1;
      this._flowCache = [];
      for (const key of LAYOUT_KEYS) {
        let value = this[key];
        Object.defineProperty(this, key, {
          get() { return value; },
          set(next) {
            if (value === next) return;
            if (this._sealed && ((FRAME_ONLY.has(key) && !FRAME_TYPES.has(this.type)) || (TEXT_ONLY.has(key) && this.type !== "TEXT")))
              throw new TypeError(`object is not extensible: ${this.type} has no ${key} (${this.name})`);
            value = next;
            dirty(this);
          },
          enumerable: true,
          configurable: true,
        });
      }
      nodes.set(this.id, this);
      this._sealed = true;
    }
    _memo(slot, compute) {
      if (this._cachedRev[slot] === this._rev) return this._val[slot];
      this._cachedRev[slot] = this._rev;
      const value = compute();
      this._val[slot] = value;
      api.layoutComputes += 1;
      return value;
    }
    get intrinsicWidth() {
      return this._memo("iw", () => {
        if (this.type === "TEXT" && this.textAutoResize === "WIDTH_AND_HEIGHT") return textWidth(this);
        if (this.layoutMode === "HORIZONTAL" && this.primaryAxisSizingMode === "AUTO") {
          return padX(this) + flow(this).reduce((sum, child) => sum + child.measuredWidth, 0) + gaps(this);
        }
        if (this.layoutMode === "VERTICAL" && this.counterAxisSizingMode === "AUTO") {
          return padX(this) + Math.max(0, ...flow(this).map((child) => child.measuredWidth));
        }
        return this._width;
      });
    }
    get measuredWidth() {
      return this._memo("mw", () => (this._horizontal === "FILL" ? this.intrinsicWidth : this.width));
    }
    get width() {
      return this._memo("w", () => {
        if (this._horizontal !== "FILL" || !this.parent) return this.intrinsicWidth;
        const parent = this.parent;
        const fixed = parent.layoutMode === "HORIZONTAL" ? parent.primaryAxisSizingMode : parent.counterAxisSizingMode;
        assert.equal(fixed, "FIXED", `FILL width needs a fixed-width parent: ${this.name} in ${parent.name}`);
        const available = parent.width - padX(parent);
        if (parent.layoutMode === "VERTICAL") return available;
        const siblings = flow(parent);
        const fills = siblings.filter((child) => child._horizontal === "FILL");
        const taken = siblings.filter((child) => child._horizontal !== "FILL").reduce((sum, child) => sum + child.width, 0);
        return (available - taken - gaps(parent)) / fills.length;
      });
    }
    get intrinsicHeight() {
      return this._memo("ih", () => {
        if (this.type === "TEXT") {
          if (this.textAutoResize === "WIDTH_AND_HEIGHT") return Math.min(textLines(this, Infinity), this.maxLines || Infinity) * this.lineHeight.value;
          if (this.textAutoResize === "HEIGHT") return Math.min(textLines(this, this.width), this.maxLines || Infinity) * this.lineHeight.value;
        }
        if (this.layoutMode === "VERTICAL" && this.primaryAxisSizingMode === "AUTO") {
          return padY(this) + flow(this).reduce((sum, child) => sum + child.measuredHeight, 0) + gaps(this);
        }
        if (wraps(this) && this.counterAxisSizingMode === "AUTO") {
          const lines = wrapLines(this);
          return padY(this) + lines.reduce((sum, line) => sum + Math.max(...line.map((child) => child.measuredHeight)), 0)
            + Math.max(0, lines.length - 1) * this.counterAxisSpacing;
        }
        if (this.layoutMode === "HORIZONTAL" && this.counterAxisSizingMode === "AUTO") {
          return padY(this) + Math.max(0, ...flow(this).map((child) => child.measuredHeight));
        }
        return this._height;
      });
    }
    get measuredHeight() {
      return this._memo("mh", () => (this._vertical === "FILL" ? this.intrinsicHeight : this.height));
    }
    get height() {
      return this._memo("h", () => {
        if (this._vertical !== "FILL" || !this.parent) return this.intrinsicHeight;
        const parent = this.parent;
        const available = parent.height - padY(parent);
        if (parent.layoutMode === "HORIZONTAL") return available;
        const siblings = flow(parent);
        const fills = siblings.filter((child) => child._vertical === "FILL");
        const taken = siblings.filter((child) => child._vertical !== "FILL").reduce((sum, child) => sum + child.height, 0);
        return (available - taken - gaps(parent)) / fills.length;
      });
    }
    set layoutSizingHorizontal(value) {
      if (value === "FILL") assert.ok(["HORIZONTAL", "VERTICAL"].includes(this.parent?.layoutMode), `FILL needs an auto-layout parent: ${this.name}`);
      if (this._horizontal !== value) { this._horizontal = value; dirty(this); }
    }
    get layoutSizingHorizontal() { return this._horizontal; }
    set layoutSizingVertical(value) {
      if (value === "FILL") assert.ok(["HORIZONTAL", "VERTICAL"].includes(this.parent?.layoutMode), `FILL needs an auto-layout parent: ${this.name}`);
      if (this._vertical !== value) { this._vertical = value; dirty(this); }
    }
    get layoutSizingVertical() { return this._vertical; }
    // 在页面上的位置和大小：跟着自动排版排的子项由容器算位置，其余用自己的 x / y（相对父节点）
    get absoluteBoundingBox() {
      const parent = this.parent;
      const box = { width: this.width, height: this.height };
      if (!parent || parent.type === "PAGE" || parent.type === "DOCUMENT") return { x: this.x, y: this.y, ...box };
      const origin = parent.absoluteBoundingBox;
      const laid = parent.layoutMode !== "NONE" && this.visible && this.layoutPositioning !== "ABSOLUTE";
      const at = laid ? offsets(parent).get(this) : this;
      return { x: origin.x + at.x, y: origin.y + at.y, ...box };
    }
    set characters(value) {
      assert.ok(this.fontName && loaded.has(fontKey(this.fontName)), `Load font before changing text: ${this.name}`);
      if (this._characters !== value) { this._characters = value; dirty(this); }
    }
    get characters() { return this._characters; }
    setRangeFills(start, end, fills) {
      assert.ok(this.type === "TEXT" && start >= 0 && start < end && end <= this._characters.length, `Text range out of bounds: ${this.name}`);
      this.rangeFills.push({ start, end, fills });
    }
    setRangeFontName(start, end, font) {
      assert.ok(this.type === "TEXT" && start >= 0 && start < end && end <= this._characters.length, `Text range out of bounds: ${this.name}`);
      assert.ok(loaded.has(fontKey(font)), `Load font before setting a text range: ${this.name}`);
      this.rangeFonts.push({ start, end, font });
    }
    resize(width, height) {
      assert.ok(width > 0 && height > 0 && Number.isFinite(width + height), `Node dimensions must be positive: ${this.name}`);
      if (this._width !== width || this._height !== height) { this._width = width; this._height = height; dirty(this); }
    }
    appendChild(node) {
      const previous = node.parent;
      if (previous) previous.children.splice(previous.children.indexOf(node), 1);
      node.parent = this;
      this.children.push(node);
      if (previous && previous !== this) dirty(previous);
      dirty(this);
    }
    findAll(predicate) {
      const found = [];
      const walk = (node) => {
        for (const child of node.children) {
          if (predicate(child)) found.push(child);
          walk(child);
        }
      };
      walk(this);
      return found;
    }
    findOne(predicate) {
      for (const node of this.children) {
        if (predicate(node)) return node;
        const found = node.findOne(predicate);
        if (found) return found;
      }
      return null;
    }
    setSharedPluginData(namespace, key, value) { this.data[`${namespace}:${key}`] = value; }
    getSharedPluginData(namespace, key) { return this.data[`${namespace}:${key}`] || ""; }
    createInstance() {
      assert.equal(this.type, "COMPONENT");
      const copy = (source) => {
        const node = new Node(source.type);
        node._sealed = false;
        for (const key of Object.keys(source)) {
          if (SKIP_COPY.has(key)) continue;
          node[key] = structuredClone(source[key]);
        }
        node._sealed = true;
        for (const child of source.children) node.appendChild(copy(child));
        return node;
      };
      const instance = copy(this);
      instance.type = "INSTANCE";
      instance.mainComponentId = this.id;
      return instance;
    }
    async setReactionsAsync(reactions) {
      await Promise.resolve();
      if (options.rejectReactions) throw new Error("reaction rejected");
      for (const reaction of reactions) {
        const action = reaction.actions[0];
        const target = nodes.get(action.destinationId);
        assert.ok(target, "Reaction destination exists");
        if (action.navigation === "NAVIGATE") {
          assert.equal(target.type, "FRAME");
          assert.equal(target.parent.type, "PAGE", "Navigate only to a top-level frame");
          let top = this;
          while (top.parent && top.parent.type !== "PAGE") top = top.parent;
          assert.notEqual(target, top, "Navigate must leave the source's own top-level frame");
        } else {
          assert.equal(action.navigation, "CHANGE_TO");
          let ancestor = this;
          while (ancestor && ancestor.type !== "COMPONENT") ancestor = ancestor.parent;
          assert.equal(ancestor?.parent?.type, "COMPONENT_SET");
          assert.equal(target.parent, ancestor.parent, "Change only to a sibling variant");
        }
      }
      this.reactions = structuredClone(reactions);
      api.connected += 1;
    }
  }

  const api = {
    nodes, connected: 0, loaded, messages: [], notices: [], layoutComputes: 0,
    root: new Node("DOCUMENT"),
    async listAvailableFontsAsync() {
      return (options.fonts || [{ family: "Inter", style: "Regular" },
        { family: "Noto Sans SC", style: "Regular" }, { family: "Noto Sans SC", style: "Medium" },
        { family: "Fraunces", style: "SemiBold" }]).map((fontName) => ({ fontName }));
    },
    async loadFontAsync(font) { loaded.add(fontKey(font)); },
    createPage() {
      if (options.rejectPages) throw new Error("page limit reached");
      const page = new Node("PAGE");
      this.root.appendChild(page);
      return page;
    },
    async setCurrentPageAsync(page) { this.currentPage = page; },
    combineAsVariants(components, parent) {
      const set = new Node("COMPONENT_SET");
      parent.appendChild(set);
      for (const component of components) {
        assert.equal(component.type, "COMPONENT");
        set.appendChild(component);
      }
      return set;
    },
    viewport: { scrollAndZoomIntoView(selection) { assert.ok(selection.length > 0); } },
    closePlugin(message) { this.messages.push(message); },
    notify(message) {
      this.notices.push(message);
      return { cancel() {} };
    },
  };
  for (const type of ["Frame", "Component", "Text", "Vector", "Ellipse", "Rectangle"]) {
    api[`create${type}`] = () => {
      const node = new Node(type.toUpperCase());
      // 真 Figma 新建的框默认裁掉超出的内容
      if (type === "Frame" || type === "Component") node.clipsContent = true;
      api.currentPage.appendChild(node);
      return node;
    };
  }
  api.createNodeFromSvg = (svg) => {
    const node = new Node("FRAME");
    const size = Number((svg.match(/width="([\d.]+)"/) || [])[1] || 24);
    node._width = node._height = Math.max(size, 1);
    api.currentPage.appendChild(node);
    return node;
  };
  const original = new Node("PAGE");
  original.name = "Existing design";
  api.root.appendChild(original);
  api.currentPage = original;
  return api;
}

module.exports = { fakeFigma };
