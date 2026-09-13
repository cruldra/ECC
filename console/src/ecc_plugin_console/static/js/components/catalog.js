// Middle column: search, module chips, the list, and the workflow preview.
// All state is in $store.console; this component only renders it.
document.addEventListener("alpine:init", () => {
  "use strict";

  Alpine.data("catalogBrowser", () => ({
    init() {
      Alpine.effect(() => {
        const store = this.$store.console;
        const item = store.kind === "workflow" ? store.selected() : null;
        const markdown = item ? item.markdown : "";
        this.$nextTick(() => this.renderWorkflow(markdown));
      });
    },
    emptyCopy() {
      const store = this.$store.console;
      if (store.kind === "mcp" && !store.query.trim()) return "插件 .mcp.json 是空的。只列自己带的 MCP，不管别人的。";
      if (store.kind === "workflow" && !store.query.trim()) return "没有工作流。写在仓库 flows/*.md。";
      return "没有匹配项";
    },
    isSelected(item) {
      const current = this.$store.console.selected();
      return Boolean(current && current.id === item.id);
    },
    mcpBadge(item) {
      return EccMcp.badge(item);
    },
    localeBadge(item) {
      const locales = item.locales || [];
      if (!locales.length) return null;
      const stale = locales.some((l) => l.stale);
      return { text: stale ? "译本过时" : "有译本", cls: stale ? "warn" : "" };
    },
    renderWorkflow(markdown) {
      const host = this.$refs.workflowMd;
      if (!host) return;
      if (!markdown) {
        host.innerHTML = "";
        return;
      }
      EccMarkdown.preview(host, markdown);
    },
  }));
});
