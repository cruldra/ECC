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
  };
  return {
    kind: "skill",
    query: "",
    chip: "全部",
    selectedId: "",
    catalog: { skills: [], hooks: [], commands: [], counts: { skill: 0, hook: 0, command: 0 }, latest: "" },
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
    ],
    async init() {
      await Promise.all([this.refreshCatalog(), this.refreshStatus()]);
    },
    items() {
      const all = this.catalog[this.kind === "skill" ? "skills" : this.kind === "hook" ? "hooks" : "commands"] || [];
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
      return this.catalog[this.kind === "skill" ? "skills" : this.kind === "hook" ? "hooks" : "commands"] || [];
    },
    selected() {
      return this.items().find((item) => item.id === this.selectedId) || this.items()[0] || null;
    },
    selectKind(kind) {
      this.kind = kind;
      this.chip = "全部";
      this.selectedId = "";
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
      const { harness, action } = this.dialog;
      this.busy = true;
      this.toast = "";
      try {
        const res = await fetch(`/api/harness/${harness}/${action}`, { method: "POST" });
        const data = await res.json();
        if (data.status) this.status = data.status;
        if (!res.ok || !data.ok) this.toast = data.stderr || data.detail || "失败";
        else this.toast = action === "install" ? "已安装" : action === "uninstall" ? "已卸载" : "已更新";
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
    async refreshStatus() {
      this.status = await (await fetch("/api/status")).json();
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
    async openEditor() {
      const item = this.selected();
      if (!item || this.kind !== "skill") return;
      this.busy = true;
      this.toast = "";
      try {
        const res = await fetch(`/api/skills/${item.id}`);
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
        const res = await fetch(`/api/skills/${this.editor.id}`, {
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
        this.toast = "已保存原版";
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
        const res = await fetch(`/api/skills/${this.editor.id}/translate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ locale: "zh-CN", force: Boolean(force) }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.toast = data.detail || "翻译失败";
          return;
        }
        const skill = data.skill;
        this.editor = this.applySource({ ...this.editor, ...skill }, "zh-CN", skill.locales["zh-CN"] ? skill.locales["zh-CN"].text : "");
        await this.refreshCatalog();
        await this.$nextTick();
        this.mountMarkdown();
        this.toast = data.skipped ? "已有最新译文" : "已写入 i18n/zh-CN.md";
      } catch (err) {
        this.toast = String(err);
      } finally {
        this.busy = false;
      }
    },
  };
}
