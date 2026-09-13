// Right-hand detail for the MCP tab: runtime badge, note, install / disable / uninstall.
document.addEventListener("alpine:init", () => {
  "use strict";

  const DIALOGS = {
    install: { title: "安装 MCP", body: "写回插件并启用。新会话才连上。", confirm: "安装", danger: false, done: "已安装。新开会话才连。" },
    uninstall: { title: "卸载 MCP", body: "从插件拿走。新会话才生效。", confirm: "卸载", danger: true, done: "已卸载。新开会话才生效。" },
    disable: { title: "禁用 MCP", body: "本机先停。插件还带着。新会话才生效。", confirm: "禁用", danger: false, done: "已禁用。新开会话才生效。" },
  };

  // Pure helpers shared with the list column, which renders the badge without owning MCP state.
  function badge(item) {
    const runtime = (item && item.runtime) || "unknown";
    if (runtime === "connected") return { text: "正常运行", cls: "ok" };
    if (runtime === "failed") return { text: "连不上", cls: "bad" };
    if (runtime === "disabled") return { text: "已禁用", cls: "miss" };
    if (runtime === "pending") return { text: "待批准", cls: "warn" };
    if (runtime === "missing") return { text: "未随插件", cls: "miss" };
    return { text: "未进会话", cls: "warn" };
  }
  function note(item) {
    if (!item) return "";
    if (item.runtime === "connected") return "当前会话连着。禁用或卸载后要新开会话。";
    if (item.runtime === "failed") return item.error || "进程在，对面没正常回话。";
    if (item.runtime === "disabled") return "本机停了。点安装可再启用。";
    if (item.runtime === "missing") return "插件 .mcp.json 里没有。点安装写回去。";
    return "插件带着，当前会话还没连上。新开会话再看。";
  }
  function actions(item) {
    if (!item) return [];
    if (item.runtime === "missing") return [{ action: "install", label: "安装", cls: "primary" }];
    if (item.runtime === "disabled") {
      return [
        { action: "install", label: "安装", cls: "primary" },
        { action: "uninstall", label: "卸载", cls: "danger" },
      ];
    }
    return [
      { action: "disable", label: "禁用", cls: "outline" },
      { action: "uninstall", label: "卸载", cls: "danger" },
    ];
  }
  window.EccMcp = { badge, note, actions };

  Alpine.data("mcpPanel", () => ({
    badge,
    note,
    actions,
    ask(item, action) {
      const spec = DIALOGS[action];
      const store = this.$store.console;
      store.ask({
        title: `${spec.title} · ${item.id}`,
        body: spec.body,
        confirm: spec.confirm,
        danger: spec.danger,
        run: async () => {
          const res = await EccApi.json(`/api/mcp/${item.id}/${action}`, { method: "POST" });
          if (res.data.mcps) store.applyMcps(res.data.mcps);
          if (!res.ok) throw new Error(res.data.detail || res.data.stderr || "失败");
          return spec.done;
        },
      });
    },
  }));
});
