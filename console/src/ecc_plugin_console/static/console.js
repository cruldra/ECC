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
  };
}
