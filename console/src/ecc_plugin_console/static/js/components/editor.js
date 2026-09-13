// Full-page editor for one skill / command / agent. Opens when
// $store.console.editing is set; owns its draft, locale switch, save, translate.
document.addEventListener("alpine:init", () => {
  "use strict";

  const { splitFrontmatter, joinFrontmatter } = EccMarkdown;

  Alpine.data("itemEditor", () => {
    let vditor = null;

    return {
      editor: null,

      init() {
        Alpine.effect(() => {
          const target = this.$store.console.editing;
          if (!target) {
            this.$nextTick(() => this.teardown());
            return;
          }
          if (this.editor && this.editor.kind === target.kind && this.editor.id === target.id) return;
          this.$nextTick(() => this.load(target.kind, target.id));
        });
      },

      // ── derived ──────────────────────────────────────────────────────
      kicker() {
        if (!this.editor) return "";
        return this.editor.locale === "zh-CN" ? "阅读译本" : `编辑原文 ${this.editor.kind}`;
      },
      localeMeta(locale) {
        return this.editor ? this.editor.locales[locale] || null : null;
      },
      hasZh() {
        return Boolean(this.localeMeta("zh-CN"));
      },
      zhStale() {
        const meta = this.localeMeta("zh-CN");
        return Boolean(meta && meta.stale);
      },
      zhPath() {
        const meta = this.localeMeta("zh-CN");
        if (meta && meta.path) return meta.path;
        if (!this.editor) return "";
        return this.editor.kind === "skill"
          ? `skills/${this.editor.id}/i18n/zh-CN.md`
          : `docs/zh-CN/${this.editor.kind}s/${this.editor.id}.md`;
      },
      fmEntries() {
        return this.editor ? EccMarkdown.frontmatterEntries(this.editor.frontmatter) : [];
      },
      shownPath() {
        return this.editor.locale === "zh-CN" ? this.zhPath() : this.editor.path;
      },
      source() {
        if (!this.editor) return "";
        if (this.editor.locale === "zh-CN") {
          const meta = this.localeMeta("zh-CN");
          return meta ? meta.text : "";
        }
        return this.editor.draft || "";
      },

      // ── lifecycle ────────────────────────────────────────────────────
      async load(kind, id) {
        const store = this.$store.console;
        store.busy = true;
        store.notify("");
        const res = await EccApi.json(`/api/${store.bucket(kind)}/${id}`);
        store.busy = false;
        if (!res.ok) {
          store.notify(res.data.detail || "打不开");
          store.closeEditor();
          return;
        }
        this.editor = this.withSource({ ...res.data, locales: res.data.locales || {} }, "en", res.data.original);
        await this.$nextTick();
        this.mount();
      },
      close() {
        this.$store.console.closeEditor();
      },
      teardown() {
        if (vditor) {
          vditor.destroy();
          vditor = null;
        }
        this.editor = null;
      },
      withSource(editor, locale, text) {
        const parts = splitFrontmatter(text || "");
        return { ...editor, locale, frontmatter: parts.frontmatter, draft: locale === "en" ? (text || "") : editor.draft };
      },
      syncDraft() {
        if (!this.editor || this.editor.locale !== "en") return;
        const body = vditor ? vditor.getValue() : splitFrontmatter(this.editor.draft).body;
        this.editor.draft = joinFrontmatter(this.editor.frontmatter, body);
      },
      mount() {
        if (vditor) {
          vditor.destroy();
          vditor = null;
        }
        const wrap = this.$refs.mdWrap;
        if (!wrap || !this.editor) return;
        wrap.innerHTML = "";
        const host = document.createElement("div");
        wrap.appendChild(host);
        const parts = splitFrontmatter(this.source());
        this.editor.frontmatter = parts.frontmatter;
        if (this.editor.locale === "zh-CN") {
          EccMarkdown.preview(host, parts.body);
          return;
        }
        vditor = EccMarkdown.editor(host, parts.body, (value) => {
          if (this.editor && this.editor.locale === "en") this.editor.draft = joinFrontmatter(this.editor.frontmatter, value);
        });
      },
      async setLocale(locale) {
        if (!this.editor) return;
        if (locale === "zh-CN" && !this.hasZh()) return;
        if (this.editor.locale === "en") this.syncDraft();
        const next = { ...this.editor, locale };
        this.editor = this.withSource(next, locale, locale === "zh-CN" ? this.localeMeta("zh-CN").text : next.draft);
        await this.$nextTick();
        this.mount();
      },

      // ── actions ──────────────────────────────────────────────────────
      async save() {
        const store = this.$store.console;
        if (!this.editor || this.editor.locale !== "en" || store.busy) return;
        this.syncDraft();
        store.busy = true;
        store.notify("");
        const res = await EccApi.json(`/api/${store.bucket(this.editor.kind)}/${this.editor.id}`, {
          method: "PUT",
          body: { text: this.editor.draft },
        });
        store.busy = false;
        if (!res.ok) {
          store.notify(res.data.detail || "保存失败");
          return;
        }
        this.editor = this.withSource({ ...this.editor, ...res.data }, "en", res.data.original);
        await store.refreshCatalog();
        await this.$nextTick();
        this.mount();
        store.notify("已保存原文");
      },
      async translate(force) {
        const store = this.$store.console;
        if (!this.editor || store.busy) return;
        if (this.editor.locale === "en") this.syncDraft();
        store.busy = true;
        store.notify("");
        const res = await EccApi.json(`/api/${store.bucket(this.editor.kind)}/${this.editor.id}/translate`, {
          method: "POST",
          body: { locale: "zh-CN", force: Boolean(force) },
        });
        store.busy = false;
        if (!res.ok) {
          store.notify(res.data.detail || "翻译失败");
          return;
        }
        const updated = res.data.item || res.data.skill;
        const zh = updated.locales["zh-CN"];
        this.editor = this.withSource({ ...this.editor, ...updated }, "zh-CN", zh ? zh.text : "");
        await store.refreshCatalog();
        await this.$nextTick();
        this.mount();
        store.notify(res.data.skipped ? "已有最新译文" : `已写入 ${this.zhPath()}`);
      },
    };
  });
});
