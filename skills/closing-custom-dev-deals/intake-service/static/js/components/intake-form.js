import { LitElement, html, nothing } from "https://cdn.jsdelivr.net/npm/lit@3/+esm";

const INDUSTRIES = ["装修建材", "教育培训", "医疗健康", "生产制造", "零售电商", "餐饮连锁", "物流仓储", "专业服务", "其他"];
const HEADCOUNT = ["1–10 人", "11–50 人", "51–200 人", "200 人以上"];
const STEPS = [
  { title: "企业信息", lead: "用于了解贵司的业务方向。" },
  { title: "关键岗位与流程", lead: "请列出与本次业务相关的关键岗位及其日常流程。" },
  { title: "期望 AI 赋能的场景", lead: "请填写您希望借助 AI 改善的环节，可自行添加。" },
];
const DRAFT_KEY = "client-intake-draft";

const emptyRole = () => ({ name: "", flow: "" });
const emptyScene = () => ({ name: "", now: "", want: "" });

/**
 * 客户端整个表单。渲染进 light DOM 而不是 shadow DOM，
 * 因为 Tailwind 的样式表进不了 shadow root。
 */
class IntakeForm extends LitElement {
  static properties = {
    step: { state: true },
    data: { state: true },
    showError: { state: true },
    submitting: { state: true },
    submitted: { state: true },
  };

  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this.step = 0; // 0 = 开始页，1..3 = 三步，4 = 完成
    this.showError = false;
    this.submitting = false;
    this.submitted = false;
    this.data = this.restore();
  }

  // ── 草稿 ────────────────────────────────────────────────────────────
  // 「填写内容自动保存，可中断后继续」是首页写给客户的承诺，所以每次改动都落盘。
  restore() {
    const blank = {
      company: "", city: "", business: "", industry: "", headcount: "",
      roles: [emptyRole(), emptyRole()],
      scenes: [emptyScene(), emptyScene()],
    };
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      return saved ? { ...blank, ...saved } : blank;
    } catch {
      return blank;
    }
  }

  persist() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(this.data));
    } catch {
      // 隐私模式下写不进去，草稿丢了也不该挡住填表
    }
  }

  patch(patch) {
    this.data = { ...this.data, ...patch };
    this.persist();
  }

  patchList(key, index, patch) {
    const list = this.data[key].map((item, i) => (i === index ? { ...item, ...patch } : item));
    this.patch({ [key]: list });
  }

  addTo(key, factory) {
    this.patch({ [key]: [...this.data[key], factory()] });
  }

  removeFrom(key, index) {
    this.patch({ [key]: this.data[key].filter((_, i) => i !== index) });
  }

  // ── 流程 ────────────────────────────────────────────────────────────
  get companyReady() {
    return this.data.company.trim().length > 0;
  }

  next() {
    if (this.step === 1 && !this.companyReady) {
      this.showError = true;
      return;
    }
    this.showError = false;
    this.step += 1;
    window.scrollTo({ top: 0 });
  }

  back() {
    this.step = Math.max(0, this.step - 1);
    window.scrollTo({ top: 0 });
  }

  async submit() {
    if (this.submitting) return;
    this.submitting = true;
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.data),
      });
      if (!response.ok) throw new Error(await response.text());
      localStorage.removeItem(DRAFT_KEY);
      this.submitted = true;
      this.step = 4;
      window.scrollTo({ top: 0 });
    } catch (error) {
      window.alert(`提交失败，请稍后重试。\n${error.message}`);
    } finally {
      this.submitting = false;
    }
  }

  // ── 片段 ────────────────────────────────────────────────────────────
  shell(children) {
    return html`<div class="mx-auto min-h-screen w-full max-w-[420px] px-6 py-9">${children}</div>`;
  }

  progress() {
    const step = STEPS[this.step - 1];
    return html`
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[13px] font-medium text-slate-600">第 ${this.step} 步 · ${step.title}</span>
          <span class="text-xs text-slate-400">${this.step} / ${STEPS.length}</span>
        </div>
        <div class="h-1 rounded-full bg-slate-200">
          <div class="h-1 rounded-full bg-blue-600 transition-all"
               style="width: ${(this.step / STEPS.length) * 100}%"></div>
        </div>
        <p class="text-[13px] text-slate-600">${step.lead}</p>
      </div>
    `;
  }

  field(label, value, onInput, { error = false, helper = "" } = {}) {
    return html`
      <div class="space-y-1.5">
        <label class="block text-[13px] font-medium text-slate-600">${label}</label>
        <input
          class="w-full rounded-xl border bg-white px-3.5 py-3 text-[15px] outline-none transition
                 ${error ? "border-red-600" : "border-slate-200 focus:border-blue-500"}"
          .value=${value}
          @input=${(event) => onInput(event.target.value)} />
        ${error && helper
          ? html`<p class="text-xs text-red-600">${helper}</p>`
          : nothing}
      </div>
    `;
  }

  area(label, value, onInput, rows = 3) {
    return html`
      <div class="space-y-1.5">
        <label class="block text-[13px] font-medium text-slate-600">${label}</label>
        <textarea
          rows=${rows}
          class="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px]
                 leading-5 outline-none transition focus:border-blue-500"
          .value=${value}
          @input=${(event) => onInput(event.target.value)}></textarea>
      </div>
    `;
  }

  chips(options, selected, onPick) {
    return html`
      <div class="flex flex-wrap gap-2">
        ${options.map((option) => {
          const on = selected === option;
          return html`
            <button type="button" @click=${() => onPick(on ? "" : option)}
              class="rounded-full border px-3.5 py-2 text-sm transition
                     ${on ? "border-blue-600 bg-blue-50 font-medium text-blue-700" : "border-slate-200 bg-white text-slate-600"}">
              ${on ? html`<span class="mr-1">✓</span>` : nothing}${option}
            </button>
          `;
        })}
      </div>
    `;
  }

  card(title, index, key, children) {
    return html`
      <div class="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5">
        <div class="flex items-center justify-between">
          <span class="text-[13px] font-medium text-slate-600">${title}</span>
          ${this.data[key].length > 1
            ? html`<button type="button" class="text-xs text-slate-400 hover:text-red-600"
                     @click=${() => this.removeFrom(key, index)}>移除</button>`
            : nothing}
        </div>
        ${children}
      </div>
    `;
  }

  button(label, onClick, { kind = "primary", disabled = false } = {}) {
    const styles = {
      primary: "bg-blue-600 text-white",
      outline: "border border-slate-300 bg-white text-slate-900",
      disabled: "bg-slate-200 text-slate-400",
    };
    const style = disabled ? styles.disabled : styles[kind];
    return html`
      <button type="button" ?disabled=${disabled} @click=${onClick}
        class="w-full rounded-xl px-4 py-3.5 text-[15px] font-medium transition ${style}">
        ${label}
      </button>
    `;
  }

  // ── 各屏 ────────────────────────────────────────────────────────────
  renderStart() {
    return this.shell(html`
      <div class="space-y-5">
        <span class="inline-block rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">业务信息收集</span>
        <h1 class="text-[26px] font-semibold leading-9">我们想更好地理解您的业务</h1>
        <p class="text-sm text-slate-600">为此需要向您收集一些基本信息。共三步，约二十分钟。</p>
        <div class="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          ${["不确定的项可以留空，后续沟通时一并确认。", "请按贵司实际情况填写。", "填写内容自动保存，可中断后继续。"].map(
            (line) => html`
              <div class="flex items-start gap-2 text-[13px] text-slate-600">
                <span class="text-green-600">✓</span><span>${line}</span>
              </div>`
          )}
        </div>
        ${this.button("开始填写", () => this.next())}
      </div>
    `);
  }

  renderCompany() {
    const error = this.showError && !this.companyReady;
    return this.shell(html`
      <div class="space-y-5">
        ${this.progress()}
        ${this.field("公司名称", this.data.company, (v) => this.patch({ company: v }),
          { error, helper: "此项为必填。" })}
        ${this.field("所在城市", this.data.city, (v) => this.patch({ city: v }))}
        ${this.field("主营业务", this.data.business, (v) => this.patch({ business: v }))}
        <div class="space-y-2">
          <span class="block text-[13px] font-medium text-slate-600">行业</span>
          ${this.chips(INDUSTRIES, this.data.industry, (v) => this.patch({ industry: v }))}
        </div>
        <div class="space-y-2">
          <span class="block text-[13px] font-medium text-slate-600">企业规模</span>
          ${this.chips(HEADCOUNT, this.data.headcount, (v) => this.patch({ headcount: v }))}
        </div>
        ${this.button("下一步", () => this.next(), { disabled: !this.companyReady })}
      </div>
    `);
  }

  renderRoles() {
    return this.shell(html`
      <div class="space-y-5">
        ${this.progress()}
        ${this.data.roles.map((role, index) => this.card(`岗位 ${index + 1}`, index, "roles", html`
          ${this.field("岗位名称", role.name, (v) => this.patchList("roles", index, { name: v }))}
          ${this.area("日常工作流程", role.flow, (v) => this.patchList("roles", index, { flow: v }))}
        `))}
        ${this.button("添加岗位", () => this.addTo("roles", emptyRole), { kind: "outline" })}
        ${this.button("下一步", () => this.next())}
        ${this.button("上一步", () => this.back(), { kind: "outline" })}
      </div>
    `);
  }

  renderScenes() {
    return this.shell(html`
      <div class="space-y-5">
        ${this.progress()}
        ${this.data.scenes.map((scene, index) => this.card(`场景 ${index + 1}`, index, "scenes", html`
          ${this.field("场景名称", scene.name, (v) => this.patchList("scenes", index, { name: v }))}
          ${this.area("现状", scene.now, (v) => this.patchList("scenes", index, { now: v }))}
          ${this.area("预期", scene.want, (v) => this.patchList("scenes", index, { want: v }))}
        `))}
        ${this.button("添加场景", () => this.addTo("scenes", emptyScene), { kind: "outline" })}
        ${this.button(this.submitting ? "提交中…" : "提交", () => this.submit(), { disabled: this.submitting })}
        ${this.button("上一步", () => this.back(), { kind: "outline" })}
      </div>
    `);
  }

  renderDone() {
    return this.shell(html`
      <div class="space-y-4 pt-24 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">✓</div>
        <h1 class="text-2xl font-semibold">已提交</h1>
        <p class="text-sm text-slate-600">感谢您的配合。我们会尽快与您联系，就填写内容进一步沟通。</p>
      </div>
    `);
  }

  render() {
    if (this.step === 0) return this.renderStart();
    if (this.step === 1) return this.renderCompany();
    if (this.step === 2) return this.renderRoles();
    if (this.step === 3) return this.renderScenes();
    return this.renderDone();
  }
}

customElements.define("intake-form", IntakeForm);
