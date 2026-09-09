const assert = require("node:assert/strict");

// 模拟 Figma 文档树与自动排版的尺寸推算, 检查结构、变体配对、实例复用与连线;
// 不模拟真实字体度量、绘制和演示引擎.
function fakeFigma(options = {}) {
  let sequence = 0;
  const nodes = new Map();
  const loaded = new Set();
  const fontKey = (font) => `${font.family}/${font.style}`;
  const cjk = /[　-鿿＀-￯]/;
  const textWidth = (node) => {
    let width = 0;
    for (const char of node._characters) width += cjk.test(char) ? node.fontSize : node.fontSize * 0.55;
    return Math.max(1, Math.round(width));
  };
  const padX = (node) => node.paddingLeft + node.paddingRight;
  const padY = (node) => node.paddingTop + node.paddingBottom;
  const flow = (node) => node.children.filter((child) => child.visible && child.layoutPositioning !== "ABSOLUTE");
  const gaps = (node) => Math.max(0, flow(node).length - 1) * node.itemSpacing;

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
      this.x = this.y = 0;
      this._width = this._height = 100;
      this._characters = "";
      this._horizontal = this._vertical = "FIXED";
      this.fontSize = 14;
      this.lineHeight = { unit: "PIXELS", value: 20 };
      this.textAutoResize = "NONE";
      this.data = {};
      this.reactions = [];
      this.flowStartingPoints = [];
      nodes.set(this.id, this);
    }
    get intrinsicWidth() {
      if (this.type === "TEXT" && this.textAutoResize === "WIDTH_AND_HEIGHT") return textWidth(this);
      if (this.layoutMode === "HORIZONTAL" && this.primaryAxisSizingMode === "AUTO") {
        return padX(this) + flow(this).reduce((sum, child) => sum + child.measuredWidth, 0) + gaps(this);
      }
      if (this.layoutMode === "VERTICAL" && this.counterAxisSizingMode === "AUTO") {
        return padX(this) + Math.max(0, ...flow(this).map((child) => child.measuredWidth));
      }
      return this._width;
    }
    get measuredWidth() { return this._horizontal === "FILL" ? this.intrinsicWidth : this.width; }
    get width() {
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
    }
    get intrinsicHeight() {
      if (this.type === "TEXT") {
        if (this.textAutoResize === "WIDTH_AND_HEIGHT") return this.lineHeight.value;
        if (this.textAutoResize === "HEIGHT") {
          const lines = Math.max(1, Math.ceil(textWidth(this) / Math.max(1, this.width)));
          return Math.min(lines, this.maxLines || Infinity) * this.lineHeight.value;
        }
      }
      if (this.layoutMode === "VERTICAL" && this.primaryAxisSizingMode === "AUTO") {
        return padY(this) + flow(this).reduce((sum, child) => sum + child.measuredHeight, 0) + gaps(this);
      }
      if (this.layoutMode === "HORIZONTAL" && this.counterAxisSizingMode === "AUTO") {
        return padY(this) + Math.max(0, ...flow(this).map((child) => child.measuredHeight));
      }
      return this._height;
    }
    get measuredHeight() { return this._vertical === "FILL" ? this.intrinsicHeight : this.height; }
    get height() {
      if (this._vertical !== "FILL" || !this.parent) return this.intrinsicHeight;
      const parent = this.parent;
      const available = parent.height - padY(parent);
      if (parent.layoutMode === "HORIZONTAL") return available;
      const siblings = flow(parent);
      const fills = siblings.filter((child) => child._vertical === "FILL");
      const taken = siblings.filter((child) => child._vertical !== "FILL").reduce((sum, child) => sum + child.height, 0);
      return (available - taken - gaps(parent)) / fills.length;
    }
    set layoutSizingHorizontal(value) {
      if (value === "FILL") assert.ok(["HORIZONTAL", "VERTICAL"].includes(this.parent?.layoutMode), `FILL needs an auto-layout parent: ${this.name}`);
      this._horizontal = value;
    }
    get layoutSizingHorizontal() { return this._horizontal; }
    set layoutSizingVertical(value) {
      if (value === "FILL") assert.ok(["HORIZONTAL", "VERTICAL"].includes(this.parent?.layoutMode), `FILL needs an auto-layout parent: ${this.name}`);
      this._vertical = value;
    }
    get layoutSizingVertical() { return this._vertical; }
    set characters(value) {
      assert.ok(this.fontName && loaded.has(fontKey(this.fontName)), `Load font before changing text: ${this.name}`);
      this._characters = value;
    }
    get characters() { return this._characters; }
    resize(width, height) {
      assert.ok(width > 0 && height > 0 && Number.isFinite(width + height), `Node dimensions must be positive: ${this.name}`);
      this._width = width;
      this._height = height;
    }
    appendChild(node) {
      if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1);
      node.parent = this;
      this.children.push(node);
    }
    findAll(predicate) {
      return this.children.flatMap((node) => [...(predicate(node) ? [node] : []), ...node.findAll(predicate)]);
    }
    findOne(predicate) { return this.findAll(predicate)[0] || null; }
    setSharedPluginData(namespace, key, value) { this.data[`${namespace}:${key}`] = value; }
    getSharedPluginData(namespace, key) { return this.data[`${namespace}:${key}`] || ""; }
    createInstance() {
      assert.equal(this.type, "COMPONENT");
      const copy = (source) => {
        const node = new Node(source.type);
        for (const key of Object.keys(source)) {
          if (!["id", "parent", "children"].includes(key)) node[key] = structuredClone(source[key]);
        }
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
    nodes, connected: 0, loaded, messages: [],
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
  };
  for (const type of ["Frame", "Component", "Text", "Vector", "Ellipse", "Rectangle"]) {
    api[`create${type}`] = () => {
      const node = new Node(type.toUpperCase());
      api.currentPage.appendChild(node);
      return node;
    };
  }
  api.createNodeFromSvg = (svg) => {
    const node = new Node("FRAME");
    const size = Number((svg.match(/width="([\d.]+)"/) || [])[1] || 24);
    node._width = node._height = size;
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
