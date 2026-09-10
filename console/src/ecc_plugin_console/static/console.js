const VDITOR_CDN = "https://cdn.jsdelivr.net/npm/vditor@3.11.3";
const VDITOR_TOOLBAR = [
  "headings", "bold", "italic", "strike", "|",
  "list", "ordered-list", "check", "quote", "line", "|",
  "link", "code", "inline-code", "table", "|",
  "undo", "redo", "fullscreen",
];

let vditor = null;

function splitFrontmatter(text) {
  const src = text || "";
  if (!src.startsWith("---")) return { frontmatter: "", body: src };
  const end = src.indexOf("\n---", 3);
  if (end < 0) return { frontmatter: "", body: src };
  return {
    frontmatter: src.slice(3, end).replace(/^\n/, "").replace(/\n$/, ""),
    body: src.slice(end + 4).replace(/^\n+/, ""),
  };
}

function joinFrontmatter(frontmatter, body) {
  const fm = (frontmatter || "").replace(/^\n+|\n+$/g, "");
  const rest = (body || "").replace(/^\n+/, "");
  if (!fm) return rest;
  return `---\n${fm}\n---\n\n${rest}`;
}

function markdownSource(editor) {
  if (!editor) return "";
  if (editor.locale === "zh-CN") {
    const meta = editor.locales && editor.locales["zh-CN"];
    return meta ? meta.text : "";
  }
  return editor.draft || "";
}

function destroyMarkdown() {
  if (vditor) {
    vditor.destroy();
    vditor = null;
  }
  const wrap = document.getElementById("skill-md-wrap");
  if (wrap) wrap.innerHTML = "";
}

function resetMarkdownHost() {
  const wrap = document.getElementById("skill-md-wrap");
  if (!wrap) return null;
  wrap.innerHTML = "";
  const host = document.createElement("div");
  host.id = "skill-md";
  wrap.appendChild(host);
  return host;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { splitFrontmatter, joinFrontmatter };
}

function consoleApp() {
  const dialogs = {
    install: { title: "安装 ECC", body: "把整份插件装到所选 harness。不按条开关。", confirm: "安装", danger: false },
    uninstall: { title: "卸载 ECC", body: "从该 harness 卸掉整份插件。目录还在仓库里。", confirm: "卸载", danger: true },
    update: { title: "更新 ECC", body: "拉到仓库 VERSION。新会话才吃到新 skill。", confirm: "更新", danger: false },
    mcpInstall: { title: "安装 MCP", body: "写回插件并启用。新会话才连上。", confirm: "安装", danger: false },
    mcpUninstall: { title: "卸载 MCP", body: "从插件拿走。新会话才生效。", confirm: "卸载", danger: true },
    mcpDisable: { title: "禁用 MCP", body: "本机先停。插件还带着。新会话才生效。", confirm: "禁用", danger: false },
  };
  return {
    kind: "skill",
    query: "",
    chip: "全部",
    selectedId: "",
    catalog: { skills: [], hooks: [], commands: [], mcps: [], workflows: [], counts: { skill: 0, hook: 0, command: 0, mcp: 0, workflow: 0 }, latest: "" },
    status: {
      latest: "",
      claude: { key: "claude", label: "Claude Code", state: "missing", version: "", hint: "", error: "" },
      codex: { key: "codex", label: "Codex", state: "missing", version: "", hint: "", error: "" },
    },
    busy: false,
    toast: "",
    dialog: null,
    editor: null,
    kinds: [
      { key: "skill", label: "Skill" },
      { key: "hook", label: "Hook" },
      { key: "command", label: "Command" },
      { key: "mcp", label: "MCP" },
      { key: "workflow", label: "工作流" },
    ],
    listKey() {
      if (this.kind === "skill") return "skills";
      if (this.kind === "hook") return "hooks";
      if (this.kind === "command") return "commands";
      if (this.kind === "mcp") return "mcps";
      return "workflows";
    },
    kindLabel() {
      if (this.kind === "skill") return "Skill";
      if (this.kind === "hook") return "Hook";
      if (this.kind === "command") return "Command";
      if (this.kind === "mcp") return "MCP";
      return "工作流";
    },
    emptyCopy() {
      if (this.kind === "mcp" && !this.query.trim()) return "插件 .mcp.json 是空的。只列自己带的 MCP，不管别人的。";
      if (this.kind === "workflow" && !this.query.trim()) return "没有工作流。写在仓库 flows/*.md。";
      return "没有匹配项";
    },
    async init() {
      await Promise.all([this.refreshCatalog(), this.refreshStatus()]);
      await this.refreshMcp();
      this.$watch("selectedId", () => this.$nextTick(() => this.mountWorkflow()));
      this.$watch("kind", () => this.$nextTick(() => this.mountWorkflow()));
      this.$nextTick(() => this.mountWorkflow());
    },
    mountWorkflow() {
      const host = document.getElementById("workflow-md");
      if (!host || typeof Vditor === "undefined") return;
      if (this.kind !== "workflow") {
        host.innerHTML = "";
        return;
      }
      const item = this.selected();
      if (!item || !item.markdown) {
        host.innerHTML = "";
        return;
      }
      host.innerHTML = "";
      Vditor.preview(host, item.markdown, { cdn: VDITOR_CDN, mode: "light" });
    },
    items() {
      const all = this.catalog[this.listKey()] || [];
      const q = this.query.trim().toLowerCase();
      return all.filter((item) => {
        if (this.chip !== "全部" && item.module !== this.chip) return false;
        if (!q) return true;
        return [item.id, item.module, item.blurb, item.path, item.event].join(" ").toLowerCase().includes(q);
      });
    },
    chips() {
      const modules = [...new Set(this.itemsUnfiltered().map((item) => item.module).filter(Boolean))];
      return ["全部", ...modules.sort()];
    },
    itemsUnfiltered() {
      return this.catalog[this.listKey()] || [];
    },
    selected() {
      return this.items().find((item) => item.id === this.selectedId) || this.items()[0] || null;
    },
    selectKind(kind) {
      this.kind = kind;
      this.chip = "全部";
      this.selectedId = "";
      if (kind === "mcp") this.refreshMcp();
      this.$nextTick(() => this.mountWorkflow());
    },
    mcpBadge(item) {
      const runtime = (item && item.runtime) || "unknown";
      if (runtime === "connected") return { text: "正常运行", cls: "ok" };
      if (runtime === "failed") return { text: "连不上", cls: "bad" };
      if (runtime === "disabled") return { text: "已禁用", cls: "miss" };
      if (runtime === "pending") return { text: "待批准", cls: "warn" };
      if (runtime === "missing") return { text: "未随插件", cls: "miss" };
      return { text: "未进会话", cls: "warn" };
    },
    mcpNote(item) {
      if (!item) return "";
      if (item.runtime === "connected") return "当前会话连着。禁用或卸载后要新开会话。";
      if (item.runtime === "failed") return item.error || "进程在，对面没正常回话。";
      if (item.runtime === "disabled") return "本机停了。点安装可再启用。";
      if (item.runtime === "missing") return "插件 .mcp.json 里没有。点安装写回去。";
      return "插件带着，当前会话还没连上。新开会话再看。";
    },
    mcpActions(item) {
      if (!item) return [];
      if (item.runtime === "missing") return [{ action: "install", label: "安装", danger: false }];
      if (item.runtime === "disabled") {
        return [
          { action: "install", label: "安装", danger: false },
          { action: "uninstall", label: "卸载", danger: true },
        ];
      }
      return [
        { action: "disable", label: "禁用", danger: false },
        { action: "uninstall", label: "卸载", danger: true },
      ];
    },
    askMcp(action) {
      const item = this.selected();
      if (!item || this.busy) return;
      const spec = action === "install" ? dialogs.mcpInstall : action === "uninstall" ? dialogs.mcpUninstall : dialogs.mcpDisable;
      this.dialog = {
        kind: "mcp",
        harness: "",
        action,
        serverId: item.id,
        title: `${spec.title} · ${item.id}`,
        body: spec.body,
        confirm: spec.confirm,
        danger: spec.danger,
      };
    },
    badge(state) {
      if (state === "missing") return { text: "未装", cls: "miss" };
      if (state === "update") return { text: "可更新", cls: "warn" };
      return { text: "已装", cls: "" };
    },
    statusLine(card) {
      if (card.state === "missing") return "未安装";
      if (card.state === "update") return `已安装  ${card.version} → ${this.status.latest}`;
      return `已安装  ${card.label} ${card.version || this.status.latest}`;
    },
    detailLine(card) {
      if (card.state === "missing") return "装上后可用目录里的 skill / hook / command";
      if (card.state === "update") return "有新版本。新会话才吃到新 skill。";
      return card.scope ? `${card.scope} 范围 · 已是最新` : "已是最新";
    },
    ask(harness, action) {
      const spec = dialogs[action];
      const label = harness === "claude" ? "Claude Code" : "Codex";
      this.dialog = { harness, action, title: `${spec.title} · ${label}`, body: spec.body, confirm: spec.confirm, danger: spec.danger };
    },
    closeDialog() { this.dialog = null; },
    async confirm() {
      if (!this.dialog || this.busy) return;
      const { harness, action, kind, serverId } = this.dialog;
      this.busy = true;
      this.toast = "";
      try {
        if (kind === "mcp") {
          const res = await fetch(`/api/mcp/${serverId}/${action}`, { method: "POST" });
          const data = await res.json();
          if (data.mcps) {
            this.catalog.mcps = data.mcps;
            this.catalog.counts.mcp = data.mcps.length;
          }
          if (!res.ok) this.toast = data.detail || data.stderr || "失败";
          else this.toast = action === "install" ? "已安装。新开会话才连。" : action === "uninstall" ? "已卸载。新开会话才生效。" : "已禁用。新开会话才生效。";
        } else {
          const res = await fetch(`/api/harness/${harness}/${action}`, { method: "POST" });
          const data = await res.json();
          if (data.status) this.status = data.status;
          if (!res.ok || !data.ok) this.toast = data.stderr || data.detail || "失败";
          else this.toast = action === "install" ? "已安装" : action === "uninstall" ? "已卸载" : "已更新";
        }
      } catch (err) {
        this.toast = String(err);
      } finally {
        this.busy = false;
        this.dialog = null;
      }
    },
    async refreshCatalog() {
      const data = await (await fetch("/api/catalog")).json();
      this.catalog = data;
    },
    async refreshMcp() {
      try {
        const data = await (await fetch("/api/mcp")).json();
        if (data.mcps) {
          this.catalog.mcps = data.mcps;
          this.catalog.counts.mcp = data.mcps.length;
        }
      } catch (err) {
        this.toast = String(err);
      }
    },
    async refreshStatus() {
      this.status = await (await fetch("/api/status")).json();
    },
    zhPath() {
      const meta = this.localeMeta("zh-CN");
      if (meta && meta.path) return meta.path;
      if (!this.editor) return "";
      return this.editor.kind === "command"
        ? `docs/zh-CN/commands/${this.editor.id}.md`
        : `skills/${this.editor.id}/i18n/zh-CN.md`;
    },
    localeMeta(locale) {
      if (!this.editor) return null;
      return this.editor.locales[locale] || null;
    },
    hasZh() {
      return Boolean(this.localeMeta("zh-CN"));
    },
    zhStale() {
      const meta = this.localeMeta("zh-CN");
      return Boolean(meta && meta.stale);
    },
    applySource(editor, locale, text) {
      const parts = splitFrontmatter(text || "");
      return { ...editor, locale, frontmatter: parts.frontmatter, draft: locale === "en" ? (text || "") : editor.draft };
    },
    syncDraftFromParts() {
      if (!this.editor || this.editor.locale !== "en") return;
      const body = vditor ? vditor.getValue() : splitFrontmatter(this.editor.draft).body;
      this.editor.draft = joinFrontmatter(this.editor.frontmatter, body);
    },
    mountMarkdown() {
      destroyMarkdown();
      if (!this.editor || typeof Vditor === "undefined") return;
      const host = resetMarkdownHost();
      if (!host) return;
      const parts = splitFrontmatter(markdownSource(this.editor));
      this.editor.frontmatter = parts.frontmatter;
      if (this.editor.locale === "zh-CN") {
        host.className = "md-preview vditor-reset";
        Vditor.preview(host, parts.body, { cdn: VDITOR_CDN, mode: "light" });
        return;
      }
      const app = this;
      vditor = new Vditor(host, {
        cdn: VDITOR_CDN,
        mode: "wysiwyg",
        theme: "classic",
        lang: "zh_CN",
        height: "100%",
        cache: { enable: false },
        toolbar: VDITOR_TOOLBAR,
        toolbarConfig: { pin: true },
        placeholder: "正文",
        after: () => {
          if (vditor) vditor.setValue(parts.body, true);
        },
        input: (value) => {
          if (!app.editor || app.editor.locale !== "en") return;
          app.editor.draft = joinFrontmatter(app.editor.frontmatter, value);
        },
      });
    },
    editable() {
      return this.kind === "skill" || this.kind === "command";
    },
    bucket(kind) {
      return (kind || this.kind) === "skill" ? "skills" : "commands";
    },
    async openEditor() {
      const item = this.selected();
      if (!item || !this.editable()) return;
      this.busy = true;
      this.toast = "";
      try {
        const res = await fetch(`/api/${this.bucket()}/${item.id}`);
        const data = await res.json();
        if (!res.ok) {
          this.toast = data.detail || "打不开";
          return;
        }
        this.editor = this.applySource({ ...data, locales: data.locales || {} }, "en", data.original);
        await this.$nextTick();
        this.mountMarkdown();
      } catch (err) {
        this.toast = String(err);
      } finally {
        this.busy = false;
      }
    },
    closeEditor() {
      destroyMarkdown();
      this.editor = null;
    },
    async setLocale(locale) {
      if (!this.editor) return;
      if (locale === "zh-CN" && !this.hasZh()) return;
      if (this.editor.locale === "en") this.syncDraftFromParts();
      this.editor = this.applySource(this.editor, locale, markdownSource({ ...this.editor, locale }));
      await this.$nextTick();
      this.mountMarkdown();
    },
    async saveEditor() {
      if (!this.editor || this.editor.locale !== "en" || this.busy) return;
      this.syncDraftFromParts();
      this.busy = true;
      this.toast = "";
      try {
        const res = await fetch(`/api/${this.bucket(this.editor.kind)}/${this.editor.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: this.editor.draft }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.toast = data.detail || "保存失败";
          return;
        }
        this.editor = this.applySource({ ...this.editor, ...data }, "en", data.original);
        await this.refreshCatalog();
        await this.$nextTick();
        this.mountMarkdown();
        this.toast = "已保存原文";
      } catch (err) {
        this.toast = String(err);
      } finally {
        this.busy = false;
      }
    },
    async translate(force) {
      if (!this.editor || this.busy) return;
      if (this.editor.locale === "en") this.syncDraftFromParts();
      this.busy = true;
      this.toast = "";
      try {
        const res = await fetch(`/api/${this.bucket(this.editor.kind)}/${this.editor.id}/translate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ locale: "zh-CN", force: Boolean(force) }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.toast = data.detail || "翻译失败";
          return;
        }
        const updated = data.item || data.skill;
        this.editor = this.applySource({ ...this.editor, ...updated }, "zh-CN", updated.locales["zh-CN"] ? updated.locales["zh-CN"].text : "");
        await this.refreshCatalog();
        await this.$nextTick();
        this.mountMarkdown();
        this.toast = data.skipped ? "已有最新译文" : `已写入 ${this.zhPath()}`;
      } catch (err) {
        this.toast = String(err);
      } finally {
        this.busy = false;
      }
    },
  };
}
