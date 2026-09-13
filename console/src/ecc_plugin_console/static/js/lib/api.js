// One fetch wrapper. Every call resolves to { ok, status, data }; network
// failures land in data.detail so callers never need try/catch.
(function (root) {
  "use strict";

  async function json(url, { method = "GET", body } = {}) {
    try {
      const res = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let data = null;
      try { data = await res.json(); } catch { data = {}; }
      return { ok: res.ok, status: res.status, data: data || {} };
    } catch (err) {
      return { ok: false, status: 0, data: { detail: String(err) } };
    }
  }

  root.EccApi = { json };
})(window);
