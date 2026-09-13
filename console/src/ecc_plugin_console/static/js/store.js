// Page state lives in one Alpine store. Panels read it, mutate it through
// its methods, and never reach into each other.
document.addEventListener("alpine:init", () => {
  "use strict";

  const KINDS = [
    { key: "skill", label: "Skill", list: "skills" },
    { key: "agent", label: "Agent", list: "agents" },
    { key: "hook", label: "Hook", list: "hooks" },
    { key: "command", label: "Command", list: "commands" },
    { key: "mcp", label: "MCP", list: "mcps" },
    { key: "workflow", label: "工作流", list: "workflows" },
  ];
  const EDITABLE = new Set(["skill", "command", "agent"]);
  const EMPTY_CATALOG = () => ({
    skills: [], agents: [], hooks: [], commands: [], mcps: [], workflows: [],
    counts: { skill: 0, agent: 0, hook: 0, command: 0, mcp: 0, workflow: 0 },
    latest: "",
  });

  Alpine.store("console", {
    kinds: KINDS,
    kind: "skill",
    query: "",
    chip: "全部",
    selectedId: "",
    catalog: EMPTY_CATALOG(),
    status: {
      latest: "",
      claude: { key: "claude", label: "Claude Code", state: "missing", version: "", hint: "", error: "" },
      codex: { key: "codex", label: "Codex", state: "missing", version: "", hint: "", error: "" },
    },
    busy: false,
    toast: "",
    dialog: null,
    editing: null,

    // ── selectors ──────────────────────────────────────────────────────
    kindMeta(kind) {
      return KINDS.find((item) => item.key === (kind || this.kind)) || KINDS[0];
    },
    kindLabel(kind) {
      return this.kindMeta(kind).label;
    },
    editable(kind) {
      return EDITABLE.has(kind || this.kind);
    },
    bucket(kind) {
      return `${kind || this.kind}s`;
    },
    all() {
      return this.catalog[this.kindMeta().list] || [];
    },
    items() {
      const q = this.query.trim().toLowerCase();
      return this.all().filter((item) => {
        if (this.chip !== "全部" && item.module !== this.chip) return false;
        if (!q) return true;
        return [item.id, item.module, item.blurb, item.path, item.event].join(" ").toLowerCase().includes(q);
      });
    },
    chips() {
      const modules = [...new Set(this.all().map((item) => item.module).filter(Boolean))];
      return ["全部", ...modules.sort()];
    },
    selected() {
      const list = this.items();
      return list.find((item) => item.id === this.selectedId) || list[0] || null;
    },

    // ── mutations ──────────────────────────────────────────────────────
    selectKind(kind) {
      this.kind = kind;
      this.chip = "全部";
      this.selectedId = "";
      if (kind === "mcp") this.refreshMcp();
    },
    select(id) {
      this.selectedId = id;
    },
    notify(message) {
      this.toast = message || "";
    },
    /** spec: { title, body, confirm, danger, run } — run() resolves to the toast text or throws. */
    ask(spec) {
      if (this.busy) return;
      this.dialog = spec;
    },
    closeDialog() {
      this.dialog = null;
    },
    async confirm() {
      if (!this.dialog || this.busy) return;
      const { run } = this.dialog;
      this.busy = true;
      this.toast = "";
      try {
        this.toast = (await run()) || "";
      } catch (err) {
        this.toast = err && err.message ? err.message : String(err);
      } finally {
        this.busy = false;
        this.dialog = null;
      }
    },
    openEditor(kind, id) {
      if (!this.editable(kind)) return;
      this.editing = { kind, id };
    },
    closeEditor() {
      this.editing = null;
    },

    // ── loaders ────────────────────────────────────────────────────────
    async refreshCatalog() {
      const res = await EccApi.json("/api/catalog");
      if (res.ok) this.catalog = { ...EMPTY_CATALOG(), ...res.data };
      else this.notify(res.data.detail || "目录读不到");
    },
    async refreshStatus() {
      const res = await EccApi.json("/api/status");
      if (res.ok) this.status = res.data;
    },
    async refreshMcp() {
      const res = await EccApi.json("/api/mcp");
      if (res.ok && res.data.mcps) this.applyMcps(res.data.mcps);
      else if (!res.ok) this.notify(res.data.detail || "MCP 状态读不到");
    },
    applyMcps(mcps) {
      this.catalog.mcps = mcps;
      this.catalog.counts.mcp = mcps.length;
    },
    async boot() {
      await Promise.all([this.refreshCatalog(), this.refreshStatus()]);
      await this.refreshMcp();
    },
  });
});
