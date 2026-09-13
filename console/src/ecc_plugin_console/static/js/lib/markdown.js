// Frontmatter split/join plus the two Vditor mounts the console uses.
// Loaded before Alpine; also require()-able from node for the unit test.
(function (root) {
  "use strict";

  const VDITOR_CDN = "https://cdn.jsdelivr.net/npm/vditor@3.11.3";
  const TOOLBAR = [
    "headings", "bold", "italic", "strike", "|",
    "list", "ordered-list", "check", "quote", "line", "|",
    "link", "code", "inline-code", "table", "|",
    "undo", "redo", "fullscreen",
  ];

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

  function available() {
    return typeof Vditor !== "undefined";
  }

  /** Read-only render into `host`. */
  function preview(host, markdown) {
    if (!host || !available()) return;
    host.innerHTML = "";
    host.className = "md-preview vditor-reset";
    Vditor.preview(host, markdown || "", { cdn: VDITOR_CDN, mode: "light" });
  }

  /** WYSIWYG editor into `host`; `onInput(value)` receives the body on every change. */
  function editor(host, body, onInput) {
    if (!host || !available()) return null;
    host.innerHTML = "";
    let instance = null;
    instance = new Vditor(host, {
      cdn: VDITOR_CDN,
      mode: "wysiwyg",
      theme: "classic",
      lang: "zh_CN",
      height: "100%",
      cache: { enable: false },
      toolbar: TOOLBAR,
      toolbarConfig: { pin: true },
      placeholder: "正文",
      after: () => { if (instance) instance.setValue(body || "", true); },
      input: (value) => onInput(value),
    });
    return instance;
  }

  const api = { VDITOR_CDN, splitFrontmatter, joinFrontmatter, preview, editor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.EccMarkdown = api;
})(typeof window !== "undefined" ? window : globalThis);
