// Hash routes: #/<kind>, #/<kind>/<id>, #/<kind>/<id>/edit.
// Pure parse/format so the browser history logic in the store stays small and testable.
(function (root) {
  "use strict";

  const KIND_RE = /^[a-z]+$/;
  const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:@-]*$/;

  function parseRoute(hash) {
    const raw = (hash || "").replace(/^#\/?/, "");
    if (!raw) return null;
    const [kind, id, action] = raw.split("/");
    if (!KIND_RE.test(kind)) return null;
    if (id !== undefined && !ID_RE.test(id)) return null;
    if (action !== undefined && action !== "edit") return null;
    return { kind, id: id || "", edit: action === "edit" && Boolean(id) };
  }

  function formatRoute({ kind, id, edit }) {
    let route = `#/${kind}`;
    if (id) route += `/${id}`;
    if (id && edit) route += "/edit";
    return route;
  }

  const api = { parseRoute, formatRoute };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.EccRoute = api;
})(typeof window !== "undefined" ? window : globalThis);
