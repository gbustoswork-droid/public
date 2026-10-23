/* Groups: the primary lens. Cards and grid ported from v216. Version 1 shows the day-one facts for each business group:
   readiness (owner and reviewer access), members, AI assets, findings awaiting review, interactions, and since 2026-10-21 the risk band. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.groups = {});
  (AGC.personaHooks = AGC.personaHooks || []).push(() => Object.assign(AGC.state.ui, { groupsSearch: "", groupsStatus: "all", groupsSort: "name", groupsSortDir: "asc" }));

  const GROUP_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  AGC.GROUP_ICON = GROUP_ICON;

  function stats(g) {
    const r = S.groupReadiness(g);
    /* AI assets: what the group's AI assets sub-page lists on All (2026-09-29). Findings awaiting review: the group's open queue, its whole
       history, since this page has no period; it took the place of Registered individually, which the AI Registry keeps (Gabriel, 2026-09-29). */
    const systems = S.groupAssetCount(g.id);
    const awaiting = (S.findingsByGroup[g.id] || []).filter((f) => f.status === "Detected").length;
    const ints = S.scoped(S.interactionsByGroup[g.id] || []);
    const members = (S.membersByGroup[g.id] || []).filter((m) => m.memberStatus !== "Terminated");  // on leave or inactive is still a member
    return { g, r, owner: r.owner, coverageCount: r.coverage.length, systems, awaiting, interactions: ints.length, members: members.length, risk: S.riskForGroup(g.id) };
  }
  function filtered() {
    const ui = AGC.state.ui;
    const term = (ui.groupsSearch || "").trim().toLowerCase();
    let rows = S.activeGroups().map(stats);
    if (ui.groupsStatus === "ready") rows = rows.filter((x) => x.r.ready);
    if (ui.groupsStatus === "notready") rows = rows.filter((x) => !x.r.ready);
    if (term) rows = rows.filter((x) => x.g.name.toLowerCase().includes(term) || (x.owner && x.owner.displayName.toLowerCase().includes(term)) || (x.g.rawDepartmentValues || []).some((v) => v.toLowerCase().includes(term)));
    const key = ui.groupsSort || "name", dir = ui.groupsSortDir || "asc";
    const val = (x) => ({ name: x.g.name, readiness: x.r.ready ? 1 : 0, risk: x.risk.score, owner: x.owner ? x.owner.displayName : "", members: x.members, systems: x.systems, awaiting: x.awaiting, interactions: x.interactions, coverage: x.coverageCount })[key];
    rows.sort((a, b) => { const va = val(a), vb = val(b); const c = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb)); return dir === "asc" ? c : -c; });
    return rows;
  }
  const readyIcon = (r) => (r.ready ? `<span class="cov-ok" title="Ready: owner and reviewer access in place">${I.checkCircle}</span>` : `<span class="cov-gap" title="${U.esc(r.gaps.map((x) => x.text).join(" · "))}">${I.alert}</span>`);
  const readyPill = (r) => (r.ready ? `<span class="pill pill-ok">${I.checkCircle}<span>Ready</span></span>` : `<span class="pill pill-danger">${I.alert}<span>Not ready</span></span>`);

  function actionsMenu(g) {
    const items = [
      { label: "Overview", href: `#/groups/${g.id}`, icon: "overview" },
      { label: "AI assets", href: `#/groups/${g.id}/registry`, icon: "coverage" },
      { label: "Members", href: `#/groups/${g.id}/members`, icon: "members" },
      { label: "Interactions", href: `#/groups/${g.id}/interactions`, icon: "interactions" },
      { label: "Findings", href: `#/groups/${g.id}/findings`, icon: "findings" },
      { label: "Audit History", href: `#/groups/${g.id}/audit`, icon: "audit" },
    ];
    return items.map((it) => `<a class="group-card-actions-menu-item" role="menuitem" href="${it.href}"><span class="action-menu-icon">${U.icon(it.icon)}</span><span class="action-menu-label">${U.esc(it.label)}</span></a>`).join("");
  }
  function actionsBtn(g, grid) {
    return `<div class="group-card-actions${grid ? " group-card-actions--grid" : ""}">
      <button class="group-card-actions-btn" data-menu-toggle="${g.id}" aria-haspopup="true" aria-expanded="false">Actions <span class="group-card-actions-caret">&#9660;</span></button>
      <div class="group-card-actions-menu menu-pop" id="menu-actions-${g.id}" role="menu" hidden>${actionsMenu(g)}</div>
    </div>`;
  }

  function card(x) {
    const { g, r } = x;
    return `<article class="group-card${r.ready ? "" : " group-card-warn"}" data-group-id="${g.id}">
      <div class="group-card-header">
        <div class="group-card-icon-tile">${GROUP_ICON}</div>
        <div class="group-card-name"><a class="group-card-name-text" href="#/groups/${g.id}" title="${U.esc(g.name)}">${U.esc(g.name)}</a>${readyIcon(r)}</div>
        ${C.riskPill(x.risk)}
        ${actionsBtn(g, false)}
      </div>
      <div class="group-card-meta">
        <span class="gcm">${I.owner}${x.owner ? `<a href="#/members/${x.owner.memberId}">${U.esc(x.owner.displayName)}</a>${U.statusTag(x.owner)}` : '<span class="danger-text">No owner</span>'}</span>
        <span class="gcm">${x.coverageCount ? `${I.coverage}<span>${x.coverageCount} ${U.plural(x.coverageCount, "reviewer")}</span>` : `<span class="cov-gap">${I.alert} No reviewer has access</span>`}</span>
      </div>
      <div class="group-card-kpis">
        <a class="group-card-kpi group-card-kpi-clickable" href="#/groups/${g.id}/members"><div class="group-card-kpi-value">${U.fmtNum(x.members)}</div><div class="group-card-kpi-label">Members</div></a>
        <a class="group-card-kpi group-card-kpi-clickable" href="#/groups/${g.id}/registry"><div class="group-card-kpi-value">${U.fmtNum(x.systems)}</div><div class="group-card-kpi-label">AI assets</div></a>
        <a class="group-card-kpi group-card-kpi-clickable" href="#/groups/${g.id}/findings"><div class="group-card-kpi-value${x.awaiting ? " danger" : ""}">${U.fmtNum(x.awaiting)}</div><div class="group-card-kpi-label">Findings awaiting review</div></a>
        <a class="group-card-kpi group-card-kpi-clickable" href="#/groups/${g.id}/interactions"><div class="group-card-kpi-value">${U.fmtNum(x.interactions)}</div><div class="group-card-kpi-label">Interactions</div></a>
      </div>
      ${r.ready ? "" : `<div class="group-card-foot foot-danger">${U.esc(r.gaps.map((y) => y.text).join(" · "))}</div>`}
    </article>`;
  }

  const COLS = [
    { key: "name", label: "Group", align: "left" }, { key: "readiness", label: "Readiness", align: "left" }, { key: "risk", label: "Risk", align: "left" }, { key: "owner", label: "Accountable owner", align: "left" },
    { key: "coverage", label: "Reviewers", align: "right" }, { key: "members", label: "Members", align: "right" }, { key: "systems", label: "AI assets", align: "right" },
    { key: "awaiting", label: "Findings awaiting review", align: "right" }, { key: "interactions", label: "Interactions", align: "right" },
  ];
  function grid(rows) {
    const ui = AGC.state.ui;
    const head = COLS.map((c) => { const sorted = ui.groupsSort === c.key; const ind = sorted ? (ui.groupsSortDir === "asc" ? "&#9650;" : "&#9660;") : "&#9651;"; return `<th class="sortable${sorted ? " sorted" : ""}" data-sort="${c.key}" style="text-align:${c.align}">${c.label}<span class="sort-indicator">${ind}</span></th>`; }).join("");
    const body = rows.map((x) => `<tr data-group-id="${x.g.id}">
      <td><div class="groups-grid-cell-name"><div class="groups-grid-cell-name-icon">${GROUP_ICON}</div><span class="groups-grid-cell-name-text">${U.esc(x.g.name)}</span></div></td>
      <td>${readyPill(x.r)}${x.r.ready ? "" : `<div class="small danger-text">${U.esc(x.r.gaps.map((y) => y.text).join(" · "))}</div>`}</td>
      <td>${C.riskPill(x.risk)}</td>
      <td>${U.memberLink(x.owner, { noAvatar: true })}</td>
      <td class="groups-grid-num${x.coverageCount ? "" : " danger"}">${x.coverageCount}</td>
      <td class="groups-grid-num">${U.fmtNum(x.members)}</td>
      <td class="groups-grid-num">${U.fmtNum(x.systems)}</td>
      <td class="groups-grid-num${x.awaiting ? " danger" : ""}">${U.fmtNum(x.awaiting)}</td>
      <td class="groups-grid-num">${U.fmtNum(x.interactions)}</td>
      <td class="groups-grid-actions-cell">${actionsBtn(x.g, true)}</td>
    </tr>`).join("");
    return `<table class="groups-grid-table"><thead><tr>${head}<th class="groups-grid-actions-header" style="text-align:right">Actions</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  P.render = function () {
    const ui = AGC.state.ui;
    if (!["all", "ready", "notready"].includes(ui.groupsStatus)) ui.groupsStatus = "all";
    const all = S.activeGroups().map(stats);
    const rows = filtered();
    const nav = AGC.shell.navMeta("groups");
    const notReady = all.filter((x) => !x.r.ready).length;
    /* Four facts: the group count is the All groups tile beneath (2026-09-29). */
    const totals = [["Members", U.sum(all, (x) => x.members)], ["AI assets", U.sum(all, (x) => x.systems)], ["Findings awaiting review", U.sum(all, (x) => x.awaiting)], ["Interactions", U.sum(all, (x) => x.interactions)]];
    const attr = S.attributeOption(D.mapping.sourceAttribute).label;
    const unmapped = S.unregOpenItems().filter((u) => u.type === "Unmapped attribute value").length;
    const statuses = [["all", "All groups", all.length], ["ready", "Ready", all.length - notReady], ["notready", "Not ready", notReady]];
    const html = `
      <section class="groups-page" id="groupsPage">
        <section class="groups-summary-section" aria-labelledby="groupsSummaryTitle">
          <h2 class="groups-summary-title" id="groupsSummaryTitle">SUMMARY ACROSS ALL GROUPS</h2>
          <div class="groups-summary-divider"></div>
          <div class="groups-totals-strip">
            ${totals.map(([l, v, d]) => `<div class="groups-totals-tile"><div class="groups-totals-value${d ? " danger" : ""}">${U.fmtNum(v)}</div><div class="groups-totals-label">${l}</div></div>`).join("")}
          </div>
        </section>
        <div class="ready-strip groups-ready-strip">${statuses.map(([k, l, n]) => `<button type="button" class="ready-tile tile-btn${k === "ready" ? " ok" : k === "notready" && n ? " gap" : ""}${ui.groupsStatus === k ? " active" : ""}" data-action="groups-tile" data-tile="${k}" aria-pressed="${ui.groupsStatus === k}"><div class="ready-val">${U.fmtNum(n)}</div><div class="ready-label">${U.esc(l)}</div></button>`).join("")}</div>
        <p class="groups-note">A group is ready when it has an active accountable owner and at least one reviewer who can see its activity.${unmapped && S.can("unregistered") ? ` ${unmapped} ${U.esc(attr)} ${U.plural(unmapped, "value is", "values are")} not mapped to a group yet: <a href="#/unregistered">see Unregistered AI</a>.` : ""}</p>
        <div class="groups-controls-row">
          <div class="groups-view-toggle" role="tablist" aria-label="View mode">
            <button class="groups-view-toggle-btn${ui.groupsView === "cards" ? " active" : ""}" data-view="cards" role="tab"><span class="view-toggle-icon">${I.cards}</span><span>Cards</span></button>
            <button class="groups-view-toggle-btn${ui.groupsView === "grid" ? " active" : ""}" data-view="grid" role="tab"><span class="view-toggle-icon">${I.list}</span><span>Grid</span></button>
          </div>
          <div class="groups-search-wrap"><span class="groups-search-icon" aria-hidden="true">${I.search}</span><input type="text" class="groups-search-input" id="groupsSearchInput" placeholder="Search groups, owners or ${U.esc(attr)} values..." value="${U.esc(ui.groupsSearch || "")}" aria-label="Search groups"/></div>
          <div class="groups-customize-spacer"></div>
          <button type="button" class="btn btn-sm" data-action="groups-export">${I.list} Export</button>
        </div>
        ${rows.length ? (ui.groupsView === "cards" ? `<div class="groups-cards-container">${rows.map(card).join("")}</div>` : `<div class="groups-grid-container">${grid(rows)}</div>`) : `<div class="groups-empty-state"><div class="groups-empty-title">No groups match</div><div class="groups-empty-subtitle">Clear the search or choose another readiness filter.</div></div>`}
      </section>`;

    AGC.shell.render({ kind: "list", navKey: "groups", title: nav.title, description: nav.description, icon: "groups", html,
      after(root) {
        root.querySelectorAll(".groups-view-toggle-btn").forEach((b) => b.addEventListener("click", () => { ui.groupsView = b.dataset.view; P.render(); }));
        const inp = root.querySelector("#groupsSearchInput");
        inp.addEventListener("input", U.debounce(() => { ui.groupsSearch = inp.value; const pos = inp.selectionStart; P.render(); const i2 = document.querySelector("#groupsSearchInput"); if (i2) { i2.focus(); i2.setSelectionRange(pos, pos); } }, 220));
        /* Tiles are the only filter: All groups, or the selected tile again, puts the page back as it first loaded. */
        root.querySelectorAll("[data-action='groups-tile']").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.tile; if (k === "all" || k === ui.groupsStatus) { ui.groupsStatus = "all"; ui.groupsSearch = ""; } else ui.groupsStatus = k; P.render(); }));
        const ex = root.querySelector("[data-action='groups-export']"); if (ex) ex.addEventListener("click", () => AGC.shell.toast("Exports the grid as CSV: every business group with its readiness, accountable owner, reviewers, members, AI assets, findings awaiting review and interactions."));
        root.querySelectorAll("th.sortable").forEach((th) => th.addEventListener("click", () => { const k = th.dataset.sort; if (ui.groupsSort === k) ui.groupsSortDir = ui.groupsSortDir === "asc" ? "desc" : "asc"; else { ui.groupsSort = k; ui.groupsSortDir = ["members", "systems", "awaiting", "interactions", "coverage"].includes(k) ? "desc" : "asc"; } P.render(); }));
      },
    });
  };
})();
