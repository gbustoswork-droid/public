/* Hash router. Routes are registered with path patterns such as "/groups/:id/:facet?". */
(function () {
  const R = (AGC.router = { routes: [], current: null });

  R.add = function (pattern, handler) {
    const keys = [];
    pattern.replace(/:(\w+)\??/g, (m, k) => { keys.push(k); return m; }); // positional order of the capture groups
    const re = new RegExp("^" + pattern.replace(/\/:(\w+)\?/g, "(?:/([^/]+))?").replace(/:(\w+)/g, "([^/]+)") + "/?$");
    R.routes.push({ pattern, re, keys, handler });
  };
  R.parse = function (hash) {
    const path = (hash || "#/").replace(/^#/, "").split("?")[0] || "/";
    for (const r of R.routes) {
      const m = path.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { params[k] = m[i + 1] ? decodeURIComponent(m[i + 1]) : undefined; });
        return { route: r, params, path };
      }
    }
    return null;
  };
  R.navigate = function (hash) {
    if (location.hash === hash) R.dispatch();
    else location.hash = hash;
  };
  R.dispatch = function () {
    const hash = location.hash || "#/start";
    if (!AGC.state.persona && hash !== "#/start" && !/^#\/guide(\/|$)/.test(hash)) { // no persisted persona: every load starts at the profile picker; the user guide opens without one (2026-10-22)
      R.current = { path: "/start", params: {} };
      AGC.pages.start.show();
      return;
    }
    const match = R.parse(hash);
    if (!match) { R.navigate("#/overview"); return; }
    if (!R.current || R.current.path !== match.path) R.previous = R.current; // where the reader came from, for a breadcrumb that leads back there
    R.current = match;
    AGC.shell.closeMenus();
    if (R.beforeRoute) R.beforeRoute(match); // state that must not outlive the page it was set on (see app.js)
    match.route.handler(match.params, match);
    window.scrollTo(0, 0);
  };
  R.refresh = function () { R.dispatch(); };
  R.start = function () {
    window.addEventListener("hashchange", R.dispatch);
    R.dispatch();
  };
})();
