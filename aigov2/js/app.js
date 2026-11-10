/* Boot: routes, global event delegation, theme and menus. */
(function () {
  const S = AGC.store, R = AGC.router, SH = AGC.shell, P = AGC.pages;

  R.add("/start", () => P.start.show());
  R.add("/overview", () => P.overview.render());
  R.add("/groups", () => P.groups.render());
  R.add("/groups/:id/:facet?", (params) => P.group.render(params));
  R.add("/findings/:view?/:id?", (params) => P.findings.render(params));
  R.add("/approvals/:view?/:id?", (params) => P.approvals.render(params));
  R.add("/unregistered", () => P.unregistered.render());
  R.add("/unregistered/:id", (params) => P.unregistered.item(params.id));
  R.add("/rules", () => P.rules.render("rules"));
  R.add("/rules/matrix", () => P.rules.render("matrix")); // the Permitted data by business group view (before /rules/:id, which would take "matrix" for an id)
  R.add("/rules/risk", () => P.rules.render("risk")); // the Risk scoring view (Gabriel, 2026-11-10), also before /rules/:id
  R.add("/rules/:id", (params) => P.rules.rule(params.id));
  R.add("/audit", () => P.audit.render());
  R.add("/settings/:page?", (params) => P.settings.render(params));
  R.add("/registry", () => P.registry.render("registered"));
  R.add("/registry/assets", () => P.registry.render("discovered")); // the All AI Assets tab (before /registry/:id, which would take "assets" for an id)
  R.add("/registry/:id", (params) => P.registry.entry(params.id));
  R.add("/register/:id", (params) => R.navigate("#/registry/" + params.id));
  R.add("/systems/:id", (params) => P.asset.render(params.id));
  R.add("/members/:id/interactions", (params) => P.interactions.person(params.id));
  R.add("/systems/:id/interactions", (params) => P.interactions.asset(params.id));
  R.add("/interactions/:id", (params) => P.interactions.conversation(params.id));
  R.add("/people", () => P.people.render());
  R.add("/members/:id", (params) => P.people.person(params.id));
  R.add("/evidence/:id?", (params) => params.id ? P.evidence.page(params.id) : R.navigate("#/registry")); // a package lives on its registration (2026-10-20)
  R.add("/guide/:section?", (params) => P.guide.render(params.section)); // the user guide, in its own tab, with or without a profile (2026-10-22)
  R.add("/", () => R.navigate("#/overview"));

  /* The date range belongs to the group page it was set on. Leaving that page, or opening another group, puts it back to All data, so it can
     never change a number on a page that does not show it. Before this, a range set on a group page silently cut the Groups tab's
     interaction counts (Gabriel, 2026-09-21: the same reasoning that removed the platform scope band). */
  R.beforeRoute = (match) => {
    const dr = AGC.state.dateRange, onGroup = match.route.pattern === "/groups/:id/:facet?" ? match.params.id : null;
    if (dr.mode === "custom" && dr.groupId !== onGroup) AGC.state.dateRange = { mode: "all", from: null, to: null };
    /* A link onto a group page may carry its period (?from=&to=), so a number clicked on the Overview lands on the same number (Gabriel,
       2026-10-02): the range is set on arrival, the band says "Showing … to …", and the two parameters leave the address at once. */
    if (onGroup) {
      const parts = location.hash.split("?"), q = {}; (parts[1] || "").split("&").forEach((kv) => { const [k, v] = kv.split("="); if (k) q[k] = decodeURIComponent(v || ""); });
      if (/^\d{4}-\d{2}-\d{2}$/.test(q.from || "") && /^\d{4}-\d{2}-\d{2}$/.test(q.to || "") && q.from <= q.to) {
        AGC.state.dateRange = { mode: "custom", from: q.from, to: q.to, groupId: onGroup };
        const rest = Object.keys(q).filter((k) => k !== "from" && k !== "to").map((k) => `${k}=${encodeURIComponent(q[k])}`).join("&");
        history.replaceState(null, "", parts[0] + (rest ? "?" + rest : ""));
      }
    }
  };

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-nav], [data-menu], [data-menu-toggle], [data-action], .row-link");
    // close menus when clicking elsewhere
    if (!ev.target.closest(".hdr-menu, .gd-date-range-popover, .group-card-actions-menu, .menu-pop")) {
      if (!t || (!t.dataset.menu && !t.dataset.menuToggle)) SH.closeMenus();
    }
    if (!t) return;
    if (t.dataset.nav && !t.disabled) { ev.preventDefault(); R.navigate(t.dataset.nav); return; }
    if (t.classList.contains("row-link") && !ev.target.closest("a, button")) { R.navigate(t.dataset.nav); return; }
    if (t.dataset.menu) { ev.stopPropagation(); SH.toggleMenu(t.dataset.menu); return; }
    if (t.dataset.menuToggle) { ev.stopPropagation(); const m = document.getElementById("menu-actions-" + t.dataset.menuToggle); const open = m && !m.hidden; SH.closeMenus(); if (m) m.hidden = open; return; }
    switch (t.dataset.action) {
      case "toggle-theme":
        AGC.state.theme = AGC.state.theme === "dark" ? "light" : "dark";
        document.body.setAttribute("data-theme", AGC.state.theme);
        document.getElementById("globalIconMoon").style.display = AGC.state.theme === "dark" ? "none" : "block";
        document.getElementById("globalIconSun").style.display = AGC.state.theme === "dark" ? "block" : "none";
        break;
      case "change-profile":
      case "sign-out":
        S.setPersona(null); AGC.state.dateRange = { mode: "all", from: null, to: null }; location.hash = "#/start"; R.dispatch(); break;
      case "personal-settings": SH.closeMenus(); SH.toast("Personal Settings opens the A2Z profile page (not part of this prototype).", "info"); break;
      case "about": SH.closeMenus(); SH.toast("AI Governance Center prototype · " + AGC.data.meta.company.name + " dataset · data as of " + AGC.util.fmtDateLong(AGC.util.today()), "info"); break;
      case "app-switch": SH.closeMenus(); if (t.dataset.app !== "AI Governance Center") SH.toast(`${t.dataset.app} is an existing A2Z application and is not part of this prototype.`, "info"); break;
      case "daterange-cancel": SH.closeMenus(); break;
      case "daterange-apply": {
        const mode = document.querySelector("input[name='gdDateRangeMode']:checked").value;
        if (mode === "custom") {
          const from = document.getElementById("gdDateRangeFrom").value, to = document.getElementById("gdDateRangeTo").value;
          if (!from || !to || from > to) { SH.toast("Choose a valid from and to date.", "warn"); return; }
          AGC.state.dateRange = { mode: "custom", from, to, groupId: (R.current && R.current.params.id) || null };
        } else AGC.state.dateRange = { mode: "all", from: null, to: null };
        R.refresh(); break;
      }
      default: break;
    }
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.dataset.action === "view-select") { R.navigate(t.value); }
    else if (t.dataset.action === "daterange-mode") { const c = document.getElementById("gdDateRangeCustom"); if (c) c.style.display = t.value === "custom" ? "" : "none"; }
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") SH.closeMenus(); });

  R.start();
})();
