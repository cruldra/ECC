// Top-right cards: Claude Code / Codex install state and the three actions.
document.addEventListener("alpine:init", () => {
  "use strict";

  const DIALOGS = {
    install: { title: "安装 ECC", body: "把整份插件装到所选 harness。不按条开关。", confirm: "安装", danger: false, done: "已安装" },
    uninstall: { title: "卸载 ECC", body: "从该 harness 卸掉整份插件。目录还在仓库里。", confirm: "卸载", danger: true, done: "已卸载" },
    update: { title: "更新 ECC", body: "拉到仓库 VERSION。新会话才吃到新 skill。", confirm: "更新", danger: false, done: "已更新" },
  };
  const LABELS = { claude: "Claude Code", codex: "Codex" };

  Alpine.data("harnessCards", () => ({
    keys: ["claude", "codex"],
    card(key) {
      return this.$store.console.status[key];
    },
    badge(state) {
      if (state === "missing") return { text: "未装", cls: "miss" };
      if (state === "update") return { text: "可更新", cls: "warn" };
      return { text: "已装", cls: "" };
    },
    statusLine(card) {
      const latest = this.$store.console.status.latest;
      if (card.state === "missing") return "未安装";
      if (card.state === "update") return `已安装  ${card.version} → ${latest}`;
      return `已安装  ${card.label} ${card.version || latest}`;
    },
    detailLine(card) {
      if (card.state === "missing") return "装上后可用目录里的 skill / hook / command";
      if (card.state === "update") return "有新版本。新会话才吃到新 skill。";
      return card.scope ? `${card.scope} 范围 · 已是最新` : "已是最新";
    },
    ask(harness, action) {
      const spec = DIALOGS[action];
      const store = this.$store.console;
      store.ask({
        title: `${spec.title} · ${LABELS[harness]}`,
        body: spec.body,
        confirm: spec.confirm,
        danger: spec.danger,
        run: async () => {
          const res = await EccApi.json(`/api/harness/${harness}/${action}`, { method: "POST" });
          if (res.data.status) store.status = res.data.status;
          if (!res.ok || !res.data.ok) throw new Error(res.data.stderr || res.data.detail || "失败");
          return spec.done;
        },
      });
    },
  }));
});
