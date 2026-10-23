/* AI Registry: what is sanctioned to run AI, who answers for it, and when that was last confirmed.
   Platforms and applications come from Settings (registered when the Administrator adds them; an approver approves them once).
   AI assets (GPTs and Projects today, agents later) are registered here when they need their own owner and cadence, and are approved on save.
   Reconfirmation is the owner's attestation. Every decision is written to the entry and to Audit History.
   The group page's AI Registry sub-page reuses the same rows through P.groupHtml. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.registry = {});
  const ui = (P.ui = { view: "registered", tile: "all", group: "all", owner: "all", platform: "all", type: "all", search: "", open: {} });
  (AGC.personaHooks = AGC.personaHooks || []).push(() => Object.assign(ui, { view: "registered", tile: "all", group: "all", owner: "all", platform: "all", type: "all", search: "", open: {} }));
  const SP = () => AGC.pages.settings;
  const me = () => (S.persona() ? S.persona().memberId : null);
  const ownerId = () => (ui.owner === "me" ? me() : ui.owner);
  /* Anything that narrows the rows opens the business-group sections that still have rows; otherwise every section starts collapsed (Gabriel, 2026-09-11). */
  const narrowing = () => ui.tile !== "all" || ui.platform !== "all" || ui.type !== "all" || ui.group !== "all" || ui.owner !== "all" || !!ui.search;
  const isOpen = (key) => (Object.prototype.hasOwnProperty.call(ui.open, key) ? ui.open[key] : narrowing());
  window.addEventListener("hashchange", () => { if (!location.hash.startsWith("#/registry")) ui.open = {}; });

  const TYPE_CODE = { "ChatGPT Enterprise": "CG", "Claude Enterprise": "CL", "Microsoft 365 Copilot": "MS", "Custom AI application": "API", GPT: "GPT", Project: "PRJ", Plugin: "PLG", Custom: "API" };
  /* The status a GPT, Project or Plugin has in its platform (Gabriel, 2026-09-30): Active unless the platform reports otherwise, so only another word is shown. */
  const statusTag = (s) => (s.status && s.status !== "Active" ? ` <span class="tag" title="${U.esc(`As ${(S.instance(s.instanceId) || {}).name || "the platform"} reports it${s.archivedDate ? `, since ${U.fmtDate(s.archivedDate)}` : ""}`)}">${U.esc(s.status)}</span>` : "");
  P.statusTag = statusTag;
  const badge = (kind) => `<span class="type-ic" title="${U.esc(kind)}">${TYPE_CODE[kind] || "AI"}</span>`;
  const kindOf = (e) => (e.level === "Platform" ? (S.entryInstance(e) || {}).platformType || "Platform" : e.level === "Custom AI system" ? "Custom AI application" : e.level);
  const isPlatform = (e) => e.level === "Platform" || e.level === "Custom AI system";
  /* The noun a sentence uses for a registration: an AI system (a platform or a custom application, from Settings) or an AI asset (a GPT or Project). */
  const nounOf = (e) => (isPlatform(e) ? "AI system" : "AI asset");
  /* Why Reconfirm waits on a suspended registration: the approved remediation comes first, and it is on the registration page. */
  const suspReason = (e) => (S.entryRemediation(e.id) ? "Complete the approved remediation first; it is on the registration page." : "Suspended pending the approver's decision.");
  /* Where an AI asset came from: the AI system (Settings) it was discovered in and, where the platform has them, its workspace. Shown on every row, never a scope. */
  const originOf = (sys) => { if (!sys) return { inst: null, ws: null }; return { inst: sys.instanceId ? S.instance(sys.instanceId) : null, ws: sys.workspaceId ? S.byId.workspace[sys.workspaceId] : null }; };
  const originText = (sys) => { const o = originOf(sys); if (sys && sys.external) return `built outside your workspace${o.inst ? `, used in ${U.esc(o.inst.name)}` : ""}`; return o.inst ? `in ${U.esc(o.inst.name)}${o.ws ? ` · ${U.esc(o.ws.name)}` : ""}` : ""; };
  const purposeCell = (t) => `<span class="small" title="${U.esc(t || "")}">${U.esc((t || "").length > 90 ? (t || "").slice(0, 88) + "…" : (t || ""))}</span>`;
  P.badge = badge;

  /* What the approval status means in words: awaiting an approver, expired or retired on a date, or when reconfirmation is due. */
  function approvalLine(e) {
    const d = S.entryDue(e);
    if (e.status === "Pending") return { text: "Awaiting an approver", cls: "muted" };
    if (e.status === "Expired") return { text: `Expired ${e.reconfirmationDueDate ? U.fmtDate(e.reconfirmationDueDate) : ""}`.trim(), cls: "danger-text" };
    if (e.status === "Retired") return { text: `Retired ${U.fmtDate((e.decisionHistory.slice().reverse().find((h) => h.action === "Retired") || {}).date || U.today())}`, cls: "muted" };
    if (e.status === "Suspended") return { text: S.entryRemediation(e.id) ? "Suspended until the approved remediation is complete and the owner reconfirms" : "Suspended pending the approver's decision", cls: "warn-text" };
    if (e.status === "Rejected") return { text: "Rejected; not approved for use", cls: "danger-text" };
    if (d.days !== null) return d.dueSoon ? { text: `Reconfirmation due in ${d.days} ${U.plural(d.days, "day")}`, cls: "warn-text" } : { text: `Reconfirmation due ${U.fmtDate(e.reconfirmationDueDate)}`, cls: "muted" };
    return null;
  }
  function approvalCell(e) {
    const l = approvalLine(e);
    return `${U.statusPill(e.status)}${l ? `<div class="small ${l.cls}">${l.text}</div>` : ""}`;
  }
  P.approvalCell = approvalCell;

  /* Edit registration, Reconfirm and Retire on an individually registered asset: the Registry's row and the group list's row share them. */
  function regExtras(e) {
    const item = (action, icon, label, o) => SP().menuItem(Object.assign({ attr: "data-reg-action", action, id: e.id, icon, label }, o || {}));
    const perm = (a) => { const p = S.permission(a, { entry: e }); return p.allowed ? null : p.reason; };
    const items = [];
    if (e.status !== "Retired") items.push(item("edit", "settings", "Edit registration…", { disabledReason: perm("register") }));
    if (["Approved", "Expired"].includes(e.status)) items.push(item("reconfirm", "check", "Reconfirm…", { disabledReason: perm("reconfirm") }));
    if (e.status === "Suspended") items.push(item("reconfirm", "check", "Reconfirm…", { disabledReason: suspReason(e) }));
    if (e.status !== "Retired") items.push(item("retire", "retire", "Retire…", { cls: "menu-danger", disabledReason: perm("retire") }));
    return items.join("");
  }
  function actionsFor(e) {
    const item = (action, icon, label, o) => SP().menuItem(Object.assign({ attr: "data-reg-action", action, id: e.id, icon, label }, o || {}));
    const perm = (a) => { const p = S.permission(a, { entry: e }); return p.allowed ? null : p.reason; };
    const menu = [item("view", "coverage", "View")];
    /* Evidence collection (Gabriel, 2026-10-20): a package is generated from the registration, here and on its page. */
    menu.push(item("evidence", "evidence", "Generate evidence package…", { disabledReason: perm("evidence") }));
    if (isPlatform(e)) {
      if (e.status === "Pending") { menu.push(item("approve", "checkCircle", "Approve…", { disabledReason: perm("approve") })); menu.push(item("reject", "x", "Reject…", { disabledReason: perm("approve") })); }
      if (["Approved", "Expired"].includes(e.status)) menu.push(item("reconfirm", "check", "Reconfirm…", { disabledReason: perm("reconfirm") }));
      if (e.status === "Suspended") menu.push(item("reconfirm", "check", "Reconfirm…", { disabledReason: suspReason(e) }));
      if (e.status !== "Retired") menu.push(item("retire", "retire", "Retire…", { cls: "menu-danger", disabledReason: perm("retire") }));
      if (S.can("settings")) menu.push(item("settings", "settings", "Configure in Settings"));
    } else {
      menu.push(regExtras(e));
    }
    return `<div class="group-card-actions group-card-actions--grid"><button type="button" class="group-card-actions-btn" data-menu-toggle="reg-${e.id}" aria-haspopup="true">Actions <span class="group-card-actions-caret">&#9660;</span></button><div class="group-card-actions-menu menu-pop" id="menu-actions-reg-${e.id}" role="menu" hidden>${menu.join("")}</div></div>`;
  }

  /* ---------- Row builder shared by the All AI Assets tab and the group's AI assets sub-page ---------- */
  function discoveredRow(s, attrs, extra) {
    const x = extra || {};
    const cov = S.systemCoverage(s);
    const covHtml = cov.key === "individual" ? `<a href="#/registry/${cov.entry.id}">${U.statusPill(cov.entry.status)}</a><div class="small muted">Registered individually</div>` : cov.key === "platform" ? `<span class="pill pill-muted pill-managed">${I.stack}<span>Managed</span></span><div class="small muted">${U.esc(cov.label)}</div>` : cov.key === "platformPending" ? `<span class="pill pill-pending">${I.clock}<span>Waiting</span></span><div class="small muted">${U.esc(cov.label)}</div>` : `${cov.decided ? `<span class="pill pill-danger">${I.alert}<span>Prohibited</span></span>` : `<span class="pill pill-pending">${I.clock}<span>Undecided</span></span>`}<div class="small muted"${cov.reason ? ` title="${U.esc(cov.reason)}"` : ""}>${U.esc(cov.label)}</div>`;
    const canReg = S.permission("register", {});
    /* View, then the registration: "Open registration" on a registered row, or "Register individually…" where registration may start.
       The group's AI assets sub-page is review-only (Gabriel, 2026-09-24): it keeps the link to a registration and drops the action. */
    const nInt = (S.interactionsBySystem[s.id] || []).length;
    const intItem = SP().menuItem({ attr: "data-sys-action", action: "interactions", id: s.id, icon: "interactions", label: "View interactions", disabledReason: nInt ? null : "No interactions archived for this AI asset yet." });
    const regItem = cov.key === "individual" ? SP().menuItem({ attr: "data-sys-action", action: "open", id: s.id, icon: "coverage", label: "Open registration" }) : (x.noRegistration ? "" : SP().menuItem({ attr: "data-sys-action", action: "register", id: s.id, icon: "check", label: "Register individually…", disabledReason: canReg.allowed ? (s.external ? "A GPT built outside your workspace is allowed or prohibited in Unregistered AI." : null) : canReg.reason }));
    return `<tr ${attrs || ""}>
      <td><div class="inst-name">${badge(s.type)}<div><span class="strong">${U.esc(s.name)}</span>${statusTag(s)}<div class="small muted">${U.esc(s.type)} ${originText(s)}${s.creatorName ? ` · created by ${U.esc(s.creatorName)}` : ""}${x.subline || ""}</div></div></div></td>
      <td class="small">${U.fmtDate(s.createdDate)}</td>
      <td class="small">${s.lastActivityDate ? U.relTime(s.lastActivityDate) : '<span class="muted">—</span>'}</td>
      <td class="num">${U.fmtNum(s.conversationCount || 0)}</td>
      <td>${covHtml}</td>
      <td>${C.riskPill(S.riskForAsset(s.id))}</td>
      <td class="groups-grid-actions-cell"><div class="group-card-actions group-card-actions--grid"><button type="button" class="group-card-actions-btn" data-menu-toggle="sys-${s.id}" aria-haspopup="true">Actions <span class="group-card-actions-caret">&#9660;</span></button><div class="group-card-actions-menu menu-pop" id="menu-actions-sys-${s.id}" role="menu" hidden>${SP().menuItem({ attr: "data-sys-action", action: "system", id: s.id, icon: "systems", label: "View AI asset" })}${intItem}${regItem}${x.menu || ""}</div></div></td>
    </tr>`;
  }
  const DISCOVERED_HEAD = `<thead><tr><th>AI asset name</th><th>Created</th><th>Last activity</th><th class="num">Interactions</th><th>Approval</th><th>Risk</th><th class="groups-grid-actions-header" style="text-align:right">Actions</th></tr></thead>`;
  /* A collapsible business-group section: a header row with chevron, group name, count and what needs attention; its rows stay hidden while closed. */
  function section(key, gid, count, summary, rowsFn) {
    const open = isOpen(key), name = S.groupName(gid);
    return `<tr class="grp-row" data-group-toggle="${key}" aria-expanded="${open}"><td colspan="7"><button type="button" class="grp-toggle" data-name="${U.esc(name)}" aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"} ${U.esc(name)}">${open ? I.chevronDown : I.chevronRight}</button><a class="strong" href="#/groups/${gid}">${U.esc(name)}</a> <span class="count-badge">${count}</span>${summary ? `<span class="grp-summary">${summary}</span>` : ""}</td></tr>` + rowsFn(`data-group-rows="${key}"${open ? "" : " hidden"}`);
  }
  function individualSummary(list) {
    const live = list.filter((e) => e.status !== "Retired"), expired = live.filter((e) => e.status === "Expired").length, due = live.filter((e) => e.status === "Approved" && S.entryDue(e).dueSoon), retired = list.length - live.length, parts = [];
    if (expired) parts.push(`<span class="danger-text">${expired} expired</span>`);
    if (due.length) { const soonest = Math.min.apply(null, due.map((e) => S.entryDue(e).days)); parts.push(`<span class="warn-text">${due.length} due${due.length === 1 ? "" : ", soonest"} in ${soonest} ${U.plural(soonest, "day")}</span>`); }
    if (retired) parts.push(`${retired} retired`);
    return parts.join(" · ");
  }
  function discoveredSummary(list) {
    const covs = list.map((s) => S.systemCoverage(s)), c = U.countBy(covs, "key"), parts = [];
    const undecided = (c.none || 0) + covs.filter((x) => x.key === "external" && !x.decided).length, prohibited = covs.filter((x) => x.key === "external" && x.decided).length;
    if (c.individual) parts.push(`${c.individual} registered individually`);
    if (c.platformPending) parts.push(`<span class="warn-text">${c.platformPending} awaiting platform approval</span>`);
    if (undecided) parts.push(`<span class="warn-text">${undecided} undecided</span>`);
    if (prohibited) parts.push(`<span class="danger-text">${prohibited} prohibited</span>`);
    const high = list.filter((a) => S.riskForAsset(a.id).score >= 50).length;
    if (high) parts.push(`<span class="danger-text">${high} at High risk or above</span>`);
    return parts.join(" · ");
  }
  const sectionControls = (grid) => `<span class="grp-controls"><button type="button" class="link-btn" data-action="expand-all" data-grid="${grid}">Expand all</button><span class="muted"> · </span><button type="button" class="link-btn" data-action="collapse-all" data-grid="${grid}">Collapse all</button></span>`;
  P.setSection = function (root, key, open) {
    ui.open[key] = open;
    const tr = root.querySelector(`[data-group-toggle="${key}"]`); if (!tr) return;
    tr.setAttribute("aria-expanded", open);
    const b = tr.querySelector(".grp-toggle"); b.setAttribute("aria-expanded", open); b.innerHTML = open ? I.chevronDown : I.chevronRight; b.setAttribute("aria-label", `${open ? "Collapse" : "Expand"} ${b.dataset.name}`);
    root.querySelectorAll(`[data-group-rows="${key}"]`).forEach((r) => { r.hidden = !open; });
  };
  const sortDiscovered = (a, b) => ((S.systemCoverage(a).key === "individual" ? 0 : 1) - (S.systemCoverage(b).key === "individual" ? 0 : 1)) || a.name.localeCompare(b.name);

  /* ---------- The tab, simplified with Gabriel on 2026-09-18 ----------
     The same shape as the Unregistered AI page: tiles are the only status filter and follow the tab, All (or the selected tile again)
     puts the page back as it first loaded, Registered and All AI Assets are tabs with counts, and one toolbar row holds the business
     group, the accountable owner (Registered) or the platform (All AI Assets), free-text search and Export. The Registered tab is one
     flat grid of platforms, applications and individually registered AI assets; All AI Assets keeps its collapsible business groups,
     because that is the list that grows. The status chips, the kind and workspace filters, the "Not sanctioned" tile that jumped to
     another tab and the explanatory paragraphs are gone. Actions menus, the register button and the entry page are unchanged. */
  const TILES = {
    registered: [["all", "All registrations"], ["pending", "Awaiting approval"], ["due", "Due within 60 days"], ["trouble", "Expired or suspended"]],
    discovered: [["all", "All AI assets"], ["platform", "Managed within their platform"], ["individual", "Registered individually"], ["none", "Built outside your workspace"]],
  };
  const entryTile = (e, k) => k === "all" || (k === "pending" && e.status === "Pending") || (k === "due" && e.status === "Approved" && S.entryDue(e).dueSoon) || (k === "trouble" && ["Expired", "Suspended"].includes(e.status));
  /* A retired registration leaves its AI asset under All only (2026-09-29): it is neither registered individually nor managed within its platform. */
  const assetTile = (a, k) => { const cov = S.systemCoverage(a), c = cov.key; return k === "all" || (k === "platform" && c === "platform") || (k === "individual" && c === "individual" && cov.entry && cov.entry.status !== "Retired") || (k === "none" && ["none", "external"].includes(c)); };
  const entryInstId = (e) => (isPlatform(e) ? (S.entryInstance(e) || {}).id : (S.system(e.refId) || {}).instanceId);
  function matches(e) {
    if (!entryTile(e, ui.tile)) return false;
    if (ui.group !== "all" && (e.groupId || "") !== ui.group) return false;
    if (ui.owner !== "all" && e.ownerMemberId !== ownerId()) return false;
    if (ui.search) { const q = ui.search.toLowerCase(), inst = S.instance(entryInstId(e)), owner = S.member(e.ownerMemberId); if (!`${e.name} ${kindOf(e)} ${e.groupId ? S.groupName(e.groupId) : "all groups"} ${inst ? inst.name : ""} ${owner ? owner.displayName : ""} ${e.approvedPurpose || ""} ${e.status}`.toLowerCase().includes(q)) return false; }
    return true;
  }
  function registeredRow(e) {
    const inst = isPlatform(e) ? S.entryInstance(e) : null, sys = isPlatform(e) ? null : S.system(e.refId);
    const sub = isPlatform(e) ? `${e.level === "Platform" ? "Platform" : "Custom AI application"}${inst && inst.status === "Inactive" ? " · inactive" : ""}${inst && !inst.recordClassId ? ' · <span class="warn-text">not archived</span>' : ""}` : `${U.esc(e.level)} ${originText(sys)}`;
    const grp = e.groupId && S.group(e.groupId) ? `<a href="#/groups/${e.groupId}">${U.esc(S.groupName(e.groupId))}</a>` : '<span class="muted">All groups</span>';
    return `<tr class="${["Pending", "Expired"].includes(e.status) ? "row-gap" : ""}">
      <td><div class="inst-name">${badge(kindOf(e))}<div><span class="strong">${U.esc(e.name)}</span><div class="small muted">${sub}</div></div></div></td>
      <td class="small">${grp}</td>
      <td>${SP().ownerCell(S.member(e.ownerMemberId), e.groupId)}</td>
      <td>${approvalCell(e)}</td>
      <td>${C.riskPill(S.riskForEntry(e.id))}</td>
      <td class="groups-grid-actions-cell">${actionsFor(e)}</td>
    </tr>`;
  }
  /* view, when given, opens the page on that tab as it first loads ("registered" or "discovered"); the Overview's AI assets tile uses it. */
  P.render = function (view) {
    if (view && view !== ui.view) { ui.view = view; ui.tile = "all"; ui.owner = "all"; ui.platform = "all"; ui.type = "all"; }
    const nav = AGC.shell.navMeta("registry");
    const all = S.registryEntries(), assets = D.aiSystems.filter((a) => a.type !== "Custom"), registered = ui.view === "registered";
    if (!TILES[ui.view].some(([k]) => k === ui.tile)) ui.tile = "all";
    const tile = ([k, label]) => {
      const n = registered ? all.filter((e) => entryTile(e, k)).length : assets.filter((a) => assetTile(a, k)).length;
      const cls = k === "all" ? "" : (n && (registered || k === "none") ? "gap" : "ok");
      return `<button type="button" class="ready-tile tile-btn ${cls}${ui.tile === k ? " active" : ""}" data-action="tile" data-tile="${k}" aria-pressed="${ui.tile === k}"><div class="ready-val">${U.fmtNum(n)}</div><div class="ready-label">${label}</div></button>`;
    };
    const strip = `<div class="ready-strip">${TILES[ui.view].map(tile).join("")}</div>`;
    const groupOpts = [{ value: "all", label: "All business groups" }].concat(S.groupsOrdered().map((g) => ({ value: g.id, label: g.name })));
    const owners = S.sortMembers(U.uniq(all.map((e) => e.ownerMemberId)).map((id) => S.member(id)).filter(Boolean));
    const ownsSomething = !!me() && all.some((e) => e.ownerMemberId === me());
    if (ui.owner === "me" && !ownsSomething) ui.owner = "all";
    const ownerOpts = (ownsSomething ? [{ value: "me", label: "Owned by me" }] : []).concat([{ value: "all", label: "All owners" }], owners.map((m) => ({ value: m.memberId, label: m.displayName + (U.isActive(m) ? "" : ` · ${U.statusWord(m)}`) })));
    /* The Type select (Gabriel, 2026-09-30): the same filter the group's AI assets sub-page has; only the types present, and custom AI applications sit on Registered. */
    const typeOpts = [{ value: "all", label: "All types" }].concat(U.uniq(assets.map((a) => a.type)).sort().map((t) => ({ value: t, label: t })));
    const platformOpts = [{ value: "all", label: "All platforms" }].concat(S.instancesOrdered().filter((i) => i.platformType !== "Custom AI application").map((i) => ({ value: i.id, label: i.name + (i.status !== "Active" ? " (inactive)" : "") })));
    const toolbar = `<div class="toolbar reg-toolbar">
        <div class="filter-chips">${[["registered", `Registered <span class="count-badge">${all.length}</span>`], ["discovered", `All AI Assets <span class="count-badge">${assets.length}</span>`]].map(([k, l]) => `<button type="button" class="fchip${ui.view === k ? " active" : ""}" data-action="view" data-view="${k}">${l}</button>`).join("")}</div>
        ${C.select("regGroup", groupOpts, ui.group)}${registered ? C.select("regOwner", ownerOpts, ui.owner) : C.select("regPlatform", platformOpts, ui.platform) + C.select("regType", typeOpts, ui.type)}
        <div class="groups-search-wrap toolbar-search"><span class="groups-search-icon">${I.search}</span><input type="text" class="groups-search-input" id="regSearch" placeholder="${registered ? "Search names, owners, groups or purposes" : "Search AI assets, creators or platforms"}" value="${U.esc(ui.search)}"/></div>
        <span class="toolbar-spacer"></span>
        <button type="button" class="btn btn-sm" data-action="export">${I.list} Export</button>
      </div>`;
    const filtered = narrowing();
    let body;
    if (registered) {
      /* Sorted by risk score, highest first (Gabriel, 2026-10-21): the use case works the list in score order, and the Risk column explains the order. */
      const rows = all.filter(matches).sort((a, b) => (S.riskForEntry(b.id).score - S.riskForEntry(a.id).score) || a.name.localeCompare(b.name));
      body = C.card("", `<div class="tbl-wrap"><table class="tbl tbl-registry"><thead><tr><th>Name</th><th>Business group</th><th>Accountable owner</th><th>Approval</th><th>Risk</th><th class="groups-grid-actions-header" style="text-align:right">Actions</th></tr></thead><tbody>${rows.map(registeredRow).join("") || `<tr><td colspan="7">${C.emptyState("Nothing matches", filtered ? "Choose All registrations to see everything again." : "Add an AI system in Settings, or register an AI asset.")}</td></tr>`}</tbody></table></div>`);
    } else {
      const shown = assets.filter((a) => {
        if (!assetTile(a, ui.tile)) return false;
        if (ui.group !== "all" && (a.groupId || "") !== ui.group) return false;
        if (ui.platform !== "all" && a.instanceId !== ui.platform) return false;
        if (ui.type !== "all" && a.type !== ui.type) return false;
        if (ui.search) { const q = ui.search.toLowerCase(); if (!`${a.name} ${a.type} ${a.creatorName || ""} ${S.groupName(a.groupId)} ${(S.instance(a.instanceId) || {}).name || ""} ${S.systemCoverage(a).label}`.toLowerCase().includes(q)) return false; }
        return true;
      });
      const byGroup = {};
      shown.forEach((a) => { (byGroup[a.groupId || "none"] = byGroup[a.groupId || "none"] || []).push(a); });
      const rows = Object.keys(byGroup).sort((a, b) => S.groupName(a).localeCompare(S.groupName(b))).map((gid) => { const list = byGroup[gid].sort((a, b) => (S.riskForAsset(b.id).score - S.riskForAsset(a.id).score) || sortDiscovered(a, b)); return section("disc:" + gid, gid, list.length, discoveredSummary(list), (attrs) => list.map((a) => discoveredRow(a, attrs)).join("")); }).join("");
      body = C.card(`AI assets by business group <span class="count-badge">${shown.length}</span>`, `<div class="tbl-wrap"><table class="tbl tbl-registry">${DISCOVERED_HEAD}<tbody>${rows || `<tr><td colspan="7">${C.emptyState("Nothing matches", "Choose All AI assets to see everything again.")}</td></tr>`}</tbody></table></div>`, { action: sectionControls("disc") });
    }
    const hint = registered && S.can("register") ? `<p class="small muted reg-hint">To give an AI asset its own owner and reconfirmation date, find it on <button type="button" class="link-btn" data-action="view" data-view="discovered">All AI Assets</button> and choose Register individually from its Actions.</p>` : "";
    const html = `${strip}${toolbar}${body}${hint}`;
    AGC.shell.render({ kind: "list", navKey: "registry", title: nav.title, description: nav.description, icon: "coverage", html, after: P.after });
  };

  /* ---------- The group page's AI Registry sub-page: the same rows, filtered to one group ---------- */
  /* ---------- The group's AI assets sub-page (Gabriel, 2026-09-24): one list of everything that runs AI in the group ----------
     The custom applications the group owns (AI systems), every GPT and Project discovered in it, and the outside GPTs its people use, in
     one grid with the Registry's columns; five tiles are the only filter. The list is review-only (Gabriel, 2026-09-24): View, and the
     way to a registration; registering, reconfirming and retiring happen on the AI Registry. The two cards this replaced ("AI systems owned by", "Registered
     individually") were one duplicate and one orphan. */
  const gui = { gid: null, tile: "all", search: "", type: "all" };
  (AGC.personaHooks = AGC.personaHooks || []).push(() => Object.assign(gui, { gid: null, tile: "all", search: "", type: "all" }));
  const GTILES = [["all", "All"], ["platform", "Managed within their platform"], ["individual", "Registered individually"], ["external", "Built outside your workspace"], ["systems", "AI systems it owns"]];
  const groupQuery = () => { const o = {}; (location.hash.split("?")[1] || "").split("&").forEach((kv) => { const [k, v] = kv.split("="); if (k) o[decodeURIComponent(k)] = decodeURIComponent(v || ""); }); return o; };
  const ownerLine = (e) => { const o = S.member(e.ownerMemberId); if (!o) return ""; const away = o.primaryGroupId && o.primaryGroupId !== e.groupId ? ` <span class="tag" title="Accountable owner from ${U.esc(S.groupName(o.primaryGroupId))}, not ${U.esc(S.groupName(e.groupId))}">${U.esc(S.groupName(o.primaryGroupId))}</span>` : ""; return `<div>Accountable owner ${U.esc(o.displayName)}${U.statusTag(o)}${away}</div>`; };
  /* A custom application the group owns, in the list's columns: its row links to the registration, since an AI system has no asset page. */
  function appRow(e) {
    const inst = S.entryInstance(e), sys = S.system(e.refId);
    return `<tr class="${e.status === "Pending" || e.status === "Expired" ? "row-gap" : ""}">
      <td><div class="inst-name">${badge(inst ? inst.platformType : "Custom AI application")}<div><span class="strong">${U.esc(e.name)}</span><div class="small muted">Custom AI application${inst && !inst.recordClassId ? ' · <span class="warn-text">not archived</span>' : ""}${ownerLine(e)}</div></div></div></td>
      <td class="small">${U.fmtDate(e.registeredDate || (sys && sys.createdDate) || "")}</td>
      <td class="small">${sys && sys.lastActivityDate ? U.relTime(sys.lastActivityDate) : '<span class="muted">—</span>'}</td>
      <td class="num">${U.fmtNum(sys ? sys.conversationCount || 0 : 0)}</td>
      <td>${approvalCell(e)}</td>
      <td>${C.riskPill(S.riskForEntry(e.id))}</td>
      <td class="groups-grid-actions-cell"><div class="group-card-actions group-card-actions--grid"><button type="button" class="group-card-actions-btn" data-menu-toggle="app-${e.id}" aria-haspopup="true">Actions <span class="group-card-actions-caret">&#9660;</span></button><div class="group-card-actions-menu menu-pop" id="menu-actions-app-${e.id}" role="menu" hidden>${SP().menuItem({ attr: "data-reg-action", action: "view", id: e.id, icon: "coverage", label: "View" })}${sys ? SP().menuItem({ attr: "data-sys-action", action: "interactions", id: sys.id, icon: "interactions", label: "View interactions", disabledReason: (S.interactionsBySystem[sys.id] || []).length ? null : (inst && !inst.recordClassId ? "This AI system's interactions are not archived." : "No interactions archived for this AI system yet.") }) : ""}</div></div></td>
    </tr>`;
  }
  const GROUP_HEAD = `<thead><tr><th>Name</th><th>Created</th><th>Last activity</th><th class="num">Interactions</th><th>Approval</th><th>Risk</th><th class="groups-grid-actions-header" style="text-align:right">Actions</th></tr></thead>`;
  P.groupHtml = function (gid) {
    const g = S.group(gid);
    if (gui.gid !== gid) Object.assign(gui, { gid, tile: "all", search: "", type: "all" });
    const q0 = groupQuery(); if (q0.tile && GTILES.some(([k]) => k === q0.tile)) gui.tile = q0.tile;
    const apps = S.registryEntries().filter((e) => e.groupId === gid && isPlatform(e)).sort((a, b) => a.name.localeCompare(b.name));
    const systems = D.aiSystems.filter((s) => s.groupId === gid && s.type !== "Custom").sort(sortDiscovered);
    const rows = apps.map((e) => ({ kind: "systems", e })).concat(systems.map((s) => { const c = S.systemCoverage(s); return { kind: c.key === "individual" ? "individual" : c.key === "platform" ? "platform" : (c.key === "external" || c.key === "none") ? "external" : "waiting", s, cov: c }; }));
    const count = (k) => rows.filter((r) => k === "all" || r.kind === k).length;
    const q = gui.search.trim().toLowerCase();
    const words = (r) => { const o = r.e ? S.member(r.e.ownerMemberId) : (r.cov && r.cov.entry ? S.member(r.cov.entry.ownerMemberId) : null); return r.e ? `${r.e.name} ${o ? o.displayName : ""}` : `${r.s.name} ${r.s.creatorName || ""} ${r.s.type} ${o ? o.displayName : ""}`; };
    const typeOf = (r) => (r.e ? "Custom AI application" : r.s.type);
    const types = U.uniq(rows.map(typeOf)).sort();
    const shown = rows.filter((r) => (gui.tile === "all" || r.kind === gui.tile) && (gui.type === "all" || typeOf(r) === gui.type) && (!q || words(r).toLowerCase().includes(q)));
    const tiles = `<div class="ready-strip ready-strip-5">${GTILES.map(([k, l]) => `<button type="button" class="ready-tile tile-btn${gui.tile === k ? " active" : ""}" data-action="gtile" data-tile="${k}" aria-pressed="${gui.tile === k}"><div class="ready-val">${U.fmtNum(count(k))}</div><div class="ready-label">${U.esc(l)}</div></button>`).join("")}</div>`;
    const toolbar = `<div class="toolbar reg-toolbar">${C.select("gType", [{ value: "all", label: "All types" }].concat(types.map((t) => ({ value: t, label: t }))), gui.type)}<input type="search" id="gSearch" class="inp toolbar-search" placeholder="Search names, owners or creators" value="${U.esc(gui.search)}"/><span class="toolbar-spacer"></span><button type="button" class="btn btn-sm" data-action="gexport">${I.list} Export</button></div>`;
    const rowHtml = (r) => (r.e ? appRow(r.e) : discoveredRow(r.s, "", { noRegistration: true, subline: r.cov.key === "individual" ? ownerLine(r.cov.entry) : "" }));
    const body = shown.length ? `<div class="tbl-wrap"><table class="tbl tbl-registry">${GROUP_HEAD}<tbody>${shown.map(rowHtml).join("")}</tbody></table></div>` : (rows.length ? C.emptyState("Nothing matches", "Choose All, or clear the search.") : C.emptyState("No AI assets discovered yet", "AI assets appear here as Archive360 archives the group's activity."));
    return `${tiles}${toolbar}${C.card(`AI assets in ${U.esc(g.name)} <span class="count-badge">${U.fmtNum(shown.length)}</span>`, body)}`;
  };

  P.after = function (root) {
    const rerender = () => { Object.keys(ui.open).forEach((k) => { if (ui.open[k] === false) delete ui.open[k]; }); AGC.router.refresh(); };
    root.querySelectorAll("[data-group-toggle]").forEach((tr) => tr.addEventListener("click", (ev) => { if (ev.target.closest("a")) return; P.setSection(root, tr.dataset.groupToggle, tr.getAttribute("aria-expanded") !== "true"); }));
    root.querySelectorAll("[data-action='expand-all'], [data-action='collapse-all']").forEach((b) => b.addEventListener("click", () => { const open = b.dataset.action === "expand-all"; root.querySelectorAll(`[data-group-toggle^="${b.dataset.grid}:"]`).forEach((tr) => P.setSection(root, tr.dataset.groupToggle, open)); }));
    /* A tab keeps the business group and the search text and drops what belongs to the other tab. A tile selects its state; All, or the
       selected tile again, puts the page back as it first loaded for this tab. */
    /* The tabs are addresses (2026-09-22): #/registry is Registered, #/registry/assets is All AI Assets, so the Overview's tiles, the nav tab and the browser's back button all land on a known tab. */
    root.querySelectorAll("[data-action='view']").forEach((b) => b.addEventListener("click", () => AGC.router.navigate(b.dataset.view === "discovered" ? "#/registry/assets" : "#/registry")));
    root.querySelectorAll("[data-action='tile']").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.tile; if (k === "all" || ui.tile === k) { ui.tile = "all"; ui.group = "all"; ui.owner = "all"; ui.platform = "all"; ui.type = "all"; ui.search = ""; } else ui.tile = k; rerender(); }));
    const pf = root.querySelector("select[name='regPlatform']"); if (pf) pf.addEventListener("change", () => { ui.platform = pf.value; rerender(); });
    const tf = root.querySelector("select[name='regType']"); if (tf) tf.addEventListener("change", () => { ui.type = tf.value; rerender(); });
    const g = root.querySelector("select[name='regGroup']"); if (g) g.addEventListener("change", () => { ui.group = g.value; rerender(); });
    const o = root.querySelector("select[name='regOwner']"); if (o) o.addEventListener("change", () => { ui.owner = o.value; rerender(); });
    const s = root.querySelector("#regSearch"); if (s) s.addEventListener("input", U.debounce(() => { ui.search = s.value; const pos = s.selectionStart; rerender(); const s2 = document.querySelector("#regSearch"); if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); } }, 220));
    const ex = root.querySelector("[data-action='export']"); if (ex) ex.addEventListener("click", () => AGC.shell.toast("Exports the grid as CSV: the dated inventory of what is approved, who owns it and when it was last reconfirmed.", "info"));
    /* The group's AI assets sub-page: a tile selects its kind; All, or the selected tile again, puts the list back as it first loaded. A link
       may carry ?tile=…; changing a filter drops it from the address. */
    const gre = () => { if (location.hash.includes("?")) history.replaceState(null, "", location.hash.split("?")[0]); AGC.router.dispatch(); };
    root.querySelectorAll("[data-action='gtile']").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.tile; if (k === "all" || gui.tile === k) { gui.tile = "all"; gui.search = ""; gui.type = "all"; } else gui.tile = k; gre(); }));
    const gt = root.querySelector("select[name='gType']"); if (gt) gt.addEventListener("change", () => { gui.type = gt.value; gre(); });
    const gs = root.querySelector("#gSearch"); if (gs) gs.addEventListener("input", U.debounce(() => { gui.search = gs.value; const pos = gs.selectionStart; gre(); const s2 = document.querySelector("#gSearch"); if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); } }, 220));
    const gx = root.querySelector("[data-action='gexport']"); if (gx) gx.addEventListener("click", () => AGC.shell.toast("Exports the grid as CSV: every AI system and AI asset of this group with its approval, owner and activity.", "info"));
    root.querySelectorAll("[data-reg-action]").forEach((b) => b.addEventListener("click", () => { AGC.shell.closeMenus(); P.act(b.dataset.regAction, S.entry(b.dataset.id)); }));
    root.querySelectorAll("[data-sys-action]").forEach((b) => b.addEventListener("click", () => {
      AGC.shell.closeMenus(); const sys = S.system(b.dataset.id);
      if (b.dataset.sysAction === "register") P.registerWizard(sys.id);
      else if (b.dataset.sysAction === "open") AGC.router.navigate("#/registry/" + sys.registerEntryId);
      else if (b.dataset.sysAction === "interactions") AGC.router.navigate(`#/systems/${sys.id}/interactions`);
      else AGC.router.navigate("#/systems/" + sys.id);
    }));
  };

  P.act = function (action, e) {
    if (action === "view") AGC.router.navigate("#/registry/" + e.id);
    else if (action === "approve") P.approveDialog(e);
    else if (action === "reject") P.rejectDialog(e);
    else if (action === "reconfirm") P.reconfirmDialog(e);
    else if (action === "retire") P.retireDialog(e);
    else if (action === "edit") P.editRegistration(e);
    else if (action === "settings") AGC.router.navigate("#/settings/instances");
    else if (action === "evidence") AGC.pages.evidence.wizard(e);
    else if (action === "remediate-start") { const t = S.entryRemediation(e.id); if (t) P.startRemediationDialog(t); }
    else if (action === "remediate-complete") { const t = S.entryRemediation(e.id); if (t) P.completeRemediationDialog(t); }
  };

  /* ---------- Entry page ---------- */
  /* The header sentence: what the registration is and whom it is for, in plain words. Its state is the pill beside the name and its
     details are in the Registration card. A registration has no sub-pages and nothing on its page depends on a period, so it uses the
     item header, not the group page's band with its date range (Gabriel, 2026-09-21). */
  function headline(e) {
    const grp = e.groupId && S.group(e.groupId) ? S.groupName(e.groupId) : null;
    if (e.level === "Platform") {
      const inst = S.entryInstance(e), inside = inst ? D.aiSystems.filter((s) => s.instanceId === inst.id && !s.external).length : 0;
      return `${U.esc(kindOf(e))} platform, registered for all business groups. ${inside ? `${U.fmtNum(inside)} AI ${U.plural(inside, "asset was", "assets were")} created within it.` : "No AI assets have been discovered within it yet."}`;
    }
    if (e.level === "Custom AI system") return `Custom AI application${grp ? `, registered for ${U.esc(grp)}` : ""}.`;
    const sys = S.system(e.refId), o = originOf(sys);
    const origin = sys && sys.external ? `Built outside your workspace${o.inst ? ` and used in ${U.esc(o.inst.name)}` : ""}.` : o.inst ? `Created within ${U.esc(o.inst.name)}${o.ws ? `, ${U.esc(o.ws.name)} workspace` : ""}.` : "";
    return `${U.esc(e.level)} registered individually${grp ? ` for ${U.esc(grp)}` : ""}.${origin ? " " + origin : ""}`;
  }
  /* The registration's facts as the entry page shows them, and the two cards beside them; the Approvals page shows the same cards
     beside the approver's decision (2026-09-25). */
  /* The apps the ChatGPT Enterprise administrator enabled for the workspace (Gabriel, 2026-09-30): what ChatGPT can reach for the whole bank,
     whether any of it is indexed in advance, and on whose authority. Each person still connects their own account and reaches only what it
     can already open; a Project's linked sources and a GPT's apps are on their own pages. */
  function appsHtml(inst) {
    /* Custom Actions (Gabriel, 2026-09-30): the workspace's only controls over what a GPT's Actions may call, with the GPTs that call each
       domain, so the allowlist is read beside the inventory it governs. */
    const ca = inst.customActions, setBy = ca && ca.setByMemberId ? S.member(ca.setByMemberId) : null;
    const gptsOn = (domain) => D.aiSystems.filter((s) => (s.actions || []).some((a) => a.domain === domain));
    const actions = ca ? `<h4 class="sub-title">Custom Actions</h4>
      <p class="small muted">A custom GPT can call an API through an Action its builder writes, and ChatGPT chooses the operation. The workspace administrator controls only who may build and share GPTs and which domains an Action may call; each Action's operations, authentication and confirmation are on its GPT's page.</p>
      <dl class="kv kv-wide kv-detail">
        <dt>Who may build GPTs</dt><dd>${U.esc(ca.whoMayBuild || "")}</dd>
        <dt>Sharing</dt><dd>${U.esc(ca.sharing || "")}</dd>
        <dt>Allowed action domains</dt><dd><ul class="app-list app-list-tight">${(ca.allowedDomains || []).map((d) => { const g = gptsOn(d.domain); return `<li><span class="mono">${U.esc(d.domain)}</span>${d.outside ? ' <span class="tag tag-pending" title="Outside Brookhaven Financial: what people type can be sent to a third party">Outside Brookhaven</span>' : ""}<span class="muted"> · allowed ${U.fmtDate(d.since)}</span><div class="small muted">${g.length ? `Called by ${g.map((s) => `<a href="#/systems/${s.id}">${U.esc(s.name)}</a>`).join(", ")}` : "No GPT calls it"}</div></li>`; }).join("")}</ul><div class="small muted">Set ${ca.setDate ? U.fmtDate(ca.setDate) : ""}${setBy ? ` by ${U.esc(setBy.displayName)}` : ""}; a GPT cannot call a domain that is not listed. Changes are in Audit History under Setup changes.</div></dd>
      </dl>` : "";
    /* Workspace-built plugins (Gabriel, 2026-09-30): who may create and publish them, and the marketplaces imported; the plugins themselves
       are AI assets on All AI Assets. Each app names the public plugin it comes from, as the catalog export lists it. */
    const pl = inst.plugins, mkts = pl ? (pl.marketplaces || []) : [];
    const plugins = pl ? `<h4 class="sub-title">Workspace-built plugins</h4>
      <p class="small muted">A plugin built for this workspace, with Plugin Creator, by upload or by importing a marketplace, or migrated from a custom GPT, starts private and never joins OpenAI's public directory; each one is an AI asset on All AI Assets, with its skills, apps and MCP servers on its own page.</p>
      <dl class="kv kv-wide kv-detail">
        <dt>Who may create</dt><dd>${U.esc(pl.whoMayCreate || "")}</dd>
        <dt>Who may publish</dt><dd>${U.esc(pl.whoMayPublish || "")}<div class="small muted">Publishing to the workspace directory makes a plugin findable by everyone in the workspace.</div></dd>
        <dt>Marketplaces imported</dt><dd>${mkts.length ? mkts.map((m) => { const by = m.importedByMemberId ? S.member(m.importedByMemberId) : null; return `<div><span class="strong">${U.esc(m.name)}</span> <span class="muted">· <span class="mono">${U.esc(m.repository)}</span> · imported ${U.fmtDate(m.importedDate)}${by ? ` by ${U.esc(by.displayName)}` : ""}</span></div>`; }).join("") : '<span class="muted">None</span>'}</dd>
      </dl>` : "";
    return `<p class="small muted">What ChatGPT can reach for the whole workspace, as its administrator configured it. Each person connects their own account for live access and reaches only what that account can already open; administrator-managed sync indexes the listed content in advance for everyone.</p>
      <ul class="app-list">${inst.apps.map((a) => `<li><div class="strong">${U.esc(a.app)} <span class="muted">· enabled ${U.fmtDate(a.enabledDate)} · available to ${U.esc(String(a.availableTo || "").toLowerCase())} · ${U.esc(String(a.actions || "").toLowerCase())}</span></div>
        <div class="small">${a.sync ? `Administrator-managed sync since ${U.fmtDate(a.sync.since)}. ${U.esc(a.sync.scopeKind)}: ${a.sync.scope.map(U.esc).join(", ")}.` : "Live access only, under each person's own account; nothing is indexed in advance."}</div>
        ${a.plugin ? `<div class="small muted">From the ${U.esc(a.plugin.name)} plugin by ${U.esc(a.plugin.developer)} · version ${U.esc(a.plugin.version)}${a.plugin.verified ? " · OpenAI Verified" : ""}${a.plugin.dateAdded ? ` · in the public directory since ${U.fmtDate(a.plugin.dateAdded)}` : ""}${(a.plugin.skills || []).length ? ` · skills: ${a.plugin.skills.map(U.esc).join(", ")}` : ""}</div>` : ""}
        <div class="small muted">${U.esc(a.providerApproval || "")}.</div></li>`).join("")}</ul>${plugins}${actions}`;
  }
  P.appsHtml = appsHtml;
  P.registrationCard = function (e, actionsHtml, cardOpts) {
    const inst = S.entryInstance(e), owner = S.member(e.ownerMemberId), grp = e.groupId ? S.group(e.groupId) : null;
    return C.card("Registration", `<dl class="kv kv-wide kv-detail">
            <dt>Approval</dt><dd>${(function () { const l = approvalLine(e); return l ? `<span class="${l.cls === "muted" ? "" : l.cls}">${l.text}</span>` : U.esc(e.status); })()}${e.blockers && e.blockers.length ? `<div class="small danger-text">${e.blockers.map((b) => U.esc(b)).join(" · ")}</div>` : ""}</dd>
            <dt>Accountable owner</dt><dd>${SP().ownerCell(owner, e.groupId)}<div class="small muted">${e.level === "Platform" ? "Owns the vendor relationship; reconfirms on the cadence below." : e.level === "Custom AI system" ? "Answers for this AI system; reconfirms on the cadence below and completes any remediation." : "Answers for this AI asset; reconfirms on the cadence below and completes any remediation."} Ownership never grants content access.</div></dd>
            <dt>Approved purpose</dt><dd>${U.esc(e.approvedPurpose || "")}</dd>
            <dt>Permitted sensitive data tags</dt><dd>${(e.permittedDataClasses || []).length ? e.permittedDataClasses.map((id) => `<span class="chip chip-muted">${U.esc(S.dcName(id))}</span>`).join(" ") : '<span class="muted">None beyond the platform\'s policy</span>'}</dd>
            ${grp ? `<dt>Business group</dt><dd><a href="#/groups/${grp.id}">${U.esc(grp.name)}</a></dd>` : ""}
            ${inst ? `<dt>AI system</dt><dd>${U.esc(inst.name)}${inst.platformType !== inst.name ? ` · ${U.esc(inst.platformType)}` : ""} · ${inst.status}${inst.externalIdentifier ? ` · <code>${U.esc(inst.externalIdentifier)}</code>` : ""}</dd>` : ""}
            ${inst && !inst.recordClassId ? `<dt>Archive</dt><dd><span class="warn-text">${I.alert} Not archived.</span> Its interactions are not collected, so nothing it produces is classified or reviewed.<div class="small muted">${SP().notArchivedLine ? SP().notArchivedLine(inst) : ""}${S.can("settings") ? ` An Administrator can edit the AI system on <a href="#/settings/instances">AI Systems</a> to associate a record class.` : ""}</div></dd>` : ""}
            ${inst && (inst.apiAccess || []).length ? `<dt>API access</dt><dd>${inst.apiAccess.map((k) => `<div><code>${U.esc(k.redacted || "")}</code> ${U.esc(k.name)} · ${U.esc(k.provider || "")} · ${U.esc(k.projectName || "")}<div class="small muted">last used ${U.fmtDate(k.lastUsed)} · ${U.fmtNum(k.requests30d || 0)} requests in 30 days · ${(k.models || []).map((x) => U.esc(x)).join(", ")}</div></div>`).join("")}</dd>` : ""}
            <dt>Cadence</dt><dd>Reconfirm every ${e.reconfirmationIntervalMonths || D.settings.reconfirmation.intervalMonths} months<div class="small muted">${e.cadenceBand ? `Set from the ${U.esc(e.cadenceBand)} risk band on ${U.fmtDate(e.cadenceSetOn)}; fixed until the next reconfirmation.` : `Set from the risk band at approval or reconfirmation: High and Critical reconfirm every ${S.cadenceForBand("High")} months, others every ${S.cadenceForBand("Low")}; fixed until the next reconfirmation.`}</div></dd>
            <dt>Registered</dt><dd>${U.fmtDate(e.registeredDate)}${S.member(e.registeredByMemberId) ? ` by ${U.esc(S.member(e.registeredByMemberId).displayName)}` : ""}${e.approvedDate ? ` · approved ${U.fmtDate(e.approvedDate)}${S.member(e.approvedByMemberId) ? ` by ${U.esc(S.member(e.approvedByMemberId).displayName)}` : ""}` : ""}${e.lastReconfirmedDate ? ` · last reconfirmed ${U.fmtDate(e.lastReconfirmedDate)}` : ""}</dd>
          </dl>${actionsHtml ? `<div class="btn-row">${actionsHtml}</div>` : ""}`, cardOpts);
  };
  P.reviewersCard = function (grp, cov) {
    return grp ? C.card("Who can review its activity", cov.length ? `<ul class="people-list">${cov.map((c) => `<li>${U.avatar(c.member, "sm")}<span><a class="strong" href="#/members/${c.member.memberId}">${U.esc(c.member.displayName)}</a><span class="muted"> · ${U.esc(c.member.jobTitle || "")}</span></span><span class="small muted">${U.esc(c.ep.name)}</span></li>`).join("")}</ul><p class="small muted">Derived from Archive360 Profiles and Entitlement Policies for ${U.esc(grp.name)}.</p>` : `<div class="notice notice-warn">${I.alert}<span>Nobody can review ${U.esc(grp.name)}'s activity. See the <a href="#/settings/access">Readiness check</a>.</span></div>`) : "";
  };
  P.decisionHistoryCard = function (e) {
    return C.card("Decision history", `<ul class="history-list">${e.decisionHistory.slice().reverse().map((h) => `<li><span class="hist-date">${U.fmtDate(h.date)}</span><span class="hist-action">${U.esc(h.action)}</span><span class="hist-detail">${U.esc(h.detail || "")}${h.actorMemberId && S.member(h.actorMemberId) ? ` <span class="muted">· ${U.esc(S.member(h.actorMemberId).displayName)}</span>` : ""}</span></li>`).join("")}</ul>`);
  };
  P.entry = function (id) {
    const e = S.entry(id);
    if (!e || !S.registryLevels.includes(e.level)) { AGC.router.navigate("#/registry"); return; }
    const inst = S.entryInstance(e), sys = !isPlatform(e) ? S.system(e.refId) : null, owner = S.member(e.ownerMemberId), d = S.entryDue(e);
    const grp = e.groupId ? S.group(e.groupId) : null, cov = grp ? S.coverage(grp.id) : [];
    const perm = (a) => S.permission(a, { entry: e });
    const btn = (a, label, icon, cls, action) => { const p = perm(a); const act = action || a; return p.allowed ? `<button type="button" class="btn ${cls || "btn-secondary"}" data-reg-action="${act}" data-id="${e.id}">${icon} ${label}</button>` : `<span class="btn-disabled-wrap"><button type="button" class="btn ${cls || "btn-secondary"} is-disabled" disabled>${icon} ${label}</button><span class="btn-reason">${U.esc(p.reason)}</span></span>`; };
    const actions = [];
    if (isPlatform(e) && e.status === "Pending") { actions.push(btn("approve", "Approve", I.checkCircle, "btn-primary")); actions.push(btn("approve", "Reject", I.x, "btn-secondary", "reject")); }
    if (["Approved", "Expired"].includes(e.status)) actions.push(btn("reconfirm", "Reconfirm", I.check, e.status === "Expired" ? "btn-primary" : "btn-secondary"));
    if (e.status === "Suspended") actions.push(`<span class="btn-disabled-wrap"><button type="button" class="btn btn-secondary is-disabled" disabled>${I.check} Reconfirm</button><span class="btn-reason">${U.esc(suspReason(e))}</span></span>`);
    if (!isPlatform(e) && e.status !== "Retired") actions.push(btn("register", "Edit registration", I.settings, "btn-secondary", "edit"));
    if (e.status !== "Retired") actions.push(btn("retire", "Retire", I.retire));
    if (isPlatform(e) && S.can("settings")) actions.push(`<a class="btn btn-secondary" href="#/settings/instances">${I.settings} Configure in Settings</a>`);
    const sysCard = sys && !(inst && !inst.recordClassId) ? C.card("The AI asset as Archive360 archived it", `${sys.external ? `<div class="notice notice-info">${I.info}<span>This GPT was built outside your workspace. Archive360 archives your people's interactions with it, not its instructions, knowledge or actions, so those are empty below.</span></div>` : ""}<dl class="kv kv-wide kv-detail">
        <dt>Type</dt><dd>${U.esc(sys.type)} ${originText(sys)}</dd>
        <dt>Created</dt><dd>${U.fmtDate(sys.createdDate)} by ${U.esc(sys.creatorName || "")}</dd>
        <dt>Last activity</dt><dd>${sys.lastActivityDate ? U.fmtDate(sys.lastActivityDate) : "—"} · ${U.fmtNum(sys.conversationCount || 0)} ${U.plural(sys.conversationCount || 0, "interaction")}</dd>
        <dt>Instructions</dt><dd class="small">${U.esc(sys.instructions || "None recorded")}</dd>
        <dt>Knowledge files</dt><dd>${(sys.knowledgeFiles || []).length ? sys.knowledgeFiles.map((f) => `<span class="chip chip-muted">${U.esc(f.name || f)}</span>`).join(" ") : '<span class="muted">None</span>'}</dd>
        ${sys.type === "Plugin" ? `<dt>Skills</dt><dd>${(sys.skills || []).map((k) => `<span class="chip chip-muted">${U.esc(k.name)}</span>`).join(" ") || '<span class="muted">None</span>'}</dd><dt>Apps</dt><dd>${(sys.apps || []).length ? sys.apps.map((a) => `<span class="chip chip-muted">${U.esc(a.app)}</span>`).join(" ") : '<span class="muted">None</span>'}</dd><dt>MCP servers</dt><dd>${(sys.mcpServers || []).length ? sys.mcpServers.map((m) => `<span class="chip chip-muted">${U.esc(m.name)} · ${U.esc(m.domain)}</span>`).join(" ") : '<span class="muted">None</span>'}</dd>` : ""}
        ${sys.type === "GPT" && (sys.actions || []).length ? `<dt>Actions</dt><dd>${sys.actions.map((a) => `<span class="chip chip-muted">${U.esc(a.name)} · ${U.esc(a.domain || "")}</span>`).join(" ")}</dd>` : ""}
        ${sys.type === "GPT" ? `<dt>Apps</dt><dd>${(sys.apps || []).length ? sys.apps.map((a) => `<span class="chip chip-muted">${U.esc(a.app)}</span>`).join(" ") : '<span class="muted">None</span>'}</dd>` : sys.type === "Project" ? `<dt>Linked sources</dt><dd>${(sys.linkedSources || []).length ? sys.linkedSources.map((l) => `<span class="chip chip-muted">${U.esc(l.type)} ${U.esc(l.name)}</span>`).join(" ") : '<span class="muted">None</span>'}</dd>` : (sys.connectedSources || []).length ? `<dt>Archive360 content access</dt><dd>${sys.connectedSources.map((c) => `<span class="chip chip-muted">${U.esc(c.name)}</span>`).join(" ")}</dd>` : ""}
        <dt>Shared with</dt><dd>${U.fmtNum(sys.accessibleUserCount || 0)} people${(sys.usedByGroupIds || []).length ? ` · used by ${sys.usedByGroupIds.map((gid) => U.esc(S.groupName(gid))).join(", ")}` : ""}</dd>
      </dl>`, { action: `<a class="link" href="#/systems/${sys.id}">View the AI asset ${I.arrowRight}</a>` }) : "";
    const html = `
      <div class="two-col">
        <div>
          ${P.remediationCard(e)}
          ${P.registrationCard(e, actions.join(""))}
          ${inst && (inst.apps || []).length ? C.card(inst.customActions || inst.plugins ? "Apps, plugins and custom Actions" : `Apps <span class="count-badge">${inst.apps.length}</span>`, appsHtml(inst)) : ""}
          ${sysCard}
          ${AGC.pages.evidence.card(e)}
        </div>
        <div>
          ${C.riskCard(S.riskForEntry(e.id))}
          ${P.reviewersCard(grp, cov)}
          ${P.decisionHistoryCard(e)}
        </div>
      </div>`;
    const bc = C.originCrumbs({ label: e.name, href: `#/registry/${e.id}` }, { nav: "registry", crumbs: [{ label: "AI Registry", href: ui.view === "discovered" ? "#/registry/assets" : "#/registry" }, { label: e.name, href: `#/registry/${e.id}` }] });
    /* From the asset page the asset and its registration share a name, so the last crumb says which one it is. */
    if (bc.crumbs.length >= 2 && bc.crumbs[bc.crumbs.length - 2].label === e.name) bc.crumbs[bc.crumbs.length - 1] = { label: `${e.name} registration`, href: `#/registry/${e.id}` };
    AGC.shell.render({ kind: "item", navKey: bc.nav || "registry", title: e.name,
      breadcrumb: bc.crumbs,
      item: { badgeHtml: badge(kindOf(e)), name: e.name, statusHtml: U.statusPill(e.status), sentence: headline(e) },
      html, after(root) { root.querySelectorAll("[data-reg-action]").forEach((b) => b.addEventListener("click", () => P.act(b.dataset.regAction, S.entry(b.dataset.id)))); } });
  };

  /* ---------- Dialogs ---------- */
  P.approveDialog = function (e) {
    const owner = S.member(e.ownerMemberId);
    C.modal({ title: `Approve ${U.esc(e.name)}`, size: "modal-lg", body: `<p>Approves this ${nounOf(e)} for use. Its owner, ${U.esc(owner ? owner.displayName : "unassigned")}, will reconfirm it every ${e.reconfirmationIntervalMonths || D.settings.reconfirmation.intervalMonths} months.</p><dl class="kv"><dt>Approved purpose</dt><dd>${U.esc(e.approvedPurpose || "")}</dd></dl>${C.field("Note", `<textarea class="inp" name="note" rows="2" placeholder="Optional. Recorded with the decision."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-approve">${I.checkCircle} Approve</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='do-approve']").addEventListener("click", () => { S.approveEntry(e.id, wrap.querySelector("textarea[name='note']").value.trim()); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(e.name)} approved. Next reconfirmation due ${U.fmtDate(S.entry(e.id).reconfirmationDueDate)}.`, "success"), 30); }); } });
  };
  P.rejectDialog = function (e) {
    C.modal({ title: `Reject ${U.esc(e.name)}`, body: `<p>The ${nounOf(e)} is not approved for use. Its activity keeps being archived and classified, and use of it is flagged for review under the Unsanctioned system rule.</p>${C.field("Reason", `<textarea class="inp" name="reason" rows="2" placeholder="Required. Shown to the owner and recorded with the decision."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary btn-danger" data-action="do-reject">${I.x} Reject</button>`,
      onOpen(wrap) { C.guard(wrap, () => wrap.querySelector("textarea[name='reason']").value.trim(), "Enter the reason first.", "[data-action='do-reject']"); wrap.querySelector("[data-action='do-reject']").addEventListener("click", () => { const r = wrap.querySelector("textarea[name='reason']").value.trim(); if (!r) { AGC.shell.toast("A reason is required.", "warn"); return; } S.rejectEntry(e.id, r); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(e.name)} rejected. The owner is notified.`, "success"), 30); }); } });
  };
  P.reconfirmDialog = function (e) {
    const months = e.reconfirmationIntervalMonths || D.settings.reconfirmation.intervalMonths, next = U.fmtDate(S.addMonths(U.today(), months)), due = e.reconfirmationDueDate ? U.fmtDate(e.reconfirmationDueDate) : null;
    const when = e.status === "Expired"
      ? `The approval expired on ${due}. Reconfirming today restores it and sets the next reconfirmation for ${next}.`
      : `${e.lastReconfirmedDate ? `Last reconfirmed on ${U.fmtDate(e.lastReconfirmedDate)}` : `Approved on ${U.fmtDate(e.approvedDate || e.registeredDate)}`}${due ? `; reconfirmation is due ${due}` : ""}. Reconfirming today ${due ? "moves the due date" : "sets the due date"} to ${next}.`;
    C.modal({ title: `Reconfirm ${U.esc(e.name)}`, body: `<p>Reconfirming records that you, as the accountable owner, have checked that this ${nounOf(e)} is still needed and still used for its approved purpose. ${when}</p><dl class="kv"><dt>Approved purpose</dt><dd>${U.esc(e.approvedPurpose || "")}</dd></dl>
        <label class="check-line"><input type="checkbox" name="confirm"/> <span>I confirm this ${nounOf(e)} is still needed and is still used for its approved purpose.</span></label>
        ${C.field("Note", `<textarea class="inp" name="note" rows="2" placeholder="Optional. For example, what changed since the last reconfirmation."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-reconfirm">${I.check} Reconfirm</button>`,
      onOpen(wrap) { C.guard(wrap, () => wrap.querySelector("input[name='confirm']").checked, "Tick the box first.", "[data-action='do-reconfirm']"); wrap.querySelector("[data-action='do-reconfirm']").addEventListener("click", () => { if (!wrap.querySelector("input[name='confirm']").checked) { AGC.shell.toast("Tick the box to reconfirm.", "warn"); return; } S.reconfirmEntry(e.id, wrap.querySelector("textarea[name='note']").value.trim()); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(e.name)} reconfirmed. Next due ${U.fmtDate(S.entry(e.id).reconfirmationDueDate)}. Recorded in Audit History.`, "success"), 30); }); } });
  };
  P.retireDialog = function (e) {
    C.modal({ title: `Retire ${U.esc(e.name)}`, body: `<p>The ${nounOf(e)} is no longer approved for use. Its history, findings and audit events stay; Archive360 keeps its archived activity under retention.${isPlatform(e) ? " The AI system itself is deactivated or deleted in Settings." : ""}</p>${C.field("Reason", `<textarea class="inp" name="reason" rows="2" placeholder="Required. Recorded with the decision."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary btn-danger" data-action="do-retire">${I.retire} Retire</button>`,
      onOpen(wrap) { C.guard(wrap, () => wrap.querySelector("textarea[name='reason']").value.trim(), "Enter the reason first.", "[data-action='do-retire']"); wrap.querySelector("[data-action='do-retire']").addEventListener("click", () => { const r = wrap.querySelector("textarea[name='reason']").value.trim(); if (!r) { AGC.shell.toast("A reason is required.", "warn"); return; } S.retireEntry(e.id, r); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(e.name)} retired.`, "success"), 30); }); } });
  };
  /* ---------- The owner's response (built 2026-09-28) ---------- */
  const remSubject = (esc) => {
    const en = esc.registerEntryId ? S.entry(esc.registerEntryId) : null, sys = esc.aiSystemId ? S.system(esc.aiSystemId) : null, f = S.finding(esc.findingId), m = f ? S.member(f.memberId) : null;
    if (esc.target === "Conduct") return `${m ? m.displayName : "this person"}'s use of ${sys ? sys.name : "AI"}`;
    return en ? en.name : sys ? sys.name : S.groupName(esc.groupId);
  };
  /* What a suspended registration waits for, and the way out of the suspension: the card opens the registration page while an approved
     remediation waits for the owner, outlined while it waits for the signed-in persona. */
  P.remediationCard = function (e) {
    const task = S.entryRemediation(e.id), pend = task ? null : S.entryPendingEscalation(e.id);
    if (!task && !pend) return "";
    const esc = task || pend, f = S.finding(esc.findingId), r = f ? S.rule(f.ruleId) : null, owner = S.member(e.ownerMemberId), by = S.member(esc.escalatedByMemberId);
    if (pend) return C.card("Remediation", `<div class="notice notice-warn">${I.clock}<span>${U.esc(e.name)} is suspended pending the approver's decision on the escalation${by ? ` by ${U.esc(by.displayName)}` : ""} of ${U.fmtDate(esc.escalatedAt)}${f ? ` (${U.esc(f.severity)}, ${U.esc(r ? r.name : "")})` : ""}.${esc.status === "Returned" ? " The escalation is back with the reviewer." : ""} Nothing for the owner to do yet. <a href="#/findings/escalated/${esc.findingId}">Open the finding.</a></span></div>`);
    const appr = (esc.approvals || []).filter((a) => a.decision === "Approved").slice(-1)[0], apprBy = appr ? S.member(appr.approverMemberId) : null;
    const perm = S.permission("remediate", { entry: e, escalation: esc }), started = esc.ownerTaskStatus === "In progress", ownerName = owner ? U.esc(owner.displayName) : "the owner";
    const btn = (action, label, icon, cls) => (perm.allowed ? `<button type="button" class="btn ${cls}" data-reg-action="${action}" data-id="${e.id}">${icon} ${label}</button>` : `<span class="btn-disabled-wrap"><button type="button" class="btn ${cls} is-disabled" disabled>${icon} ${label}</button><span class="btn-reason">${U.esc(perm.reason)}</span></span>`);
    return C.card("Remediation", `<dl class="kv kv-wide kv-detail">
        <dt>What must change</dt><dd>${U.esc(esc.proposedRemediation || "")}</dd>
        <dt>Approved</dt><dd>${apprBy ? U.esc(apprBy.displayName) : "An approver"}${appr ? `, ${U.fmtDate(appr.decidedAt)}` : ""}<div class="small muted">From the escalation${by ? ` by ${U.esc(by.displayName)}` : ""} of ${U.fmtDate(esc.escalatedAt)}${f ? `, a ${U.esc(f.severity)} violation of ${U.esc(r ? r.name : "")}` : ""}. <a href="#/findings/escalated/${esc.findingId}">Open the finding.</a></div></dd>
        <dt>Status</dt><dd>${started ? `In progress${esc.startedAt ? ` since ${U.fmtDate(esc.startedAt)}` : ""}${esc.startNote ? `: ${U.esc(esc.startNote)}` : ""}` : `Waiting for ${ownerName} since ${U.fmtDate(appr ? appr.decidedAt : esc.escalatedAt)}`}<div class="small muted">${U.esc(e.name)} stays suspended until the remediation is complete and ${ownerName} reconfirms it. Retiring it is the other way out.</div></dd>
      </dl><div class="btn-row">${started ? "" : btn("remediate-start", "Started…", I.clock, "btn-secondary")}${btn("remediate-complete", "Complete the remediation…", I.checkCircle, "btn-primary")}</div>`, { cls: perm.allowed ? "fq-decision fq-decision-open" : "" });
  };
  P.startRemediationDialog = function (esc) {
    const subject = remSubject(esc);
    C.modal({ title: `Start the remediation on ${U.esc(subject)}`, body: `<p>Records that the remediation is under way, so the approver and Compliance can see it has been picked up. Completing it is a separate step.</p><dl class="kv"><dt>Approved remediation</dt><dd>${U.esc(esc.proposedRemediation || "")}</dd></dl>${C.field("What is happening", `<textarea class="inp" name="note" rows="2" placeholder="Optional. For example, what has been requested and from whom."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-start">${I.clock} Started</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='do-start']").addEventListener("click", () => { S.startRemediation(esc.escalationId, { note: wrap.querySelector("textarea[name='note']").value.trim() }); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast("Remediation started. Recorded in Audit History.", "success"), 30); }); } });
  };
  P.completeRemediationDialog = function (esc) {
    const en = esc.registerEntryId ? S.entry(esc.registerEntryId) : null, subject = remSubject(esc), g = S.group(esc.groupId);
    const owner = en ? S.member(en.ownerMemberId) : (g ? S.member(g.ownerMemberId) : null), ownerName = owner ? U.esc(owner.displayName) : "the accountable owner";
    const canReconfirm = !!en && en.status === "Suspended" && S.permission("reconfirm", { entry: en }).allowed;
    const months = en ? (en.reconfirmationIntervalMonths || D.settings.reconfirmation.intervalMonths) : 0, next = en ? U.fmtDate(S.addMonths(U.today(), months)) : "";
    const lead = esc.target === "Conduct" ? "Records that the approved change to this person's use of AI has been made. Nothing is suspended, so nothing else changes."
      : canReconfirm ? `Records that the approved change has been made and that you, as the accountable owner, have checked that ${U.esc(subject)} is still needed and still used for its approved purpose. The suspension is lifted and the next reconfirmation is due ${next}.`
      : `Records that the approved change has been made. ${en ? `${U.esc(en.name)} stays suspended until ${ownerName} reconfirms it.` : ""}`;
    C.modal({ title: `Complete the remediation on ${U.esc(subject)}`, size: "modal-lg", body: `<p>${lead}</p><dl class="kv"><dt>Approved remediation</dt><dd>${U.esc(esc.proposedRemediation || "")}</dd></dl>${C.field("What was done", `<textarea class="inp" name="note" rows="3" placeholder="Required. Recorded on the registration and in Audit History, and shown to the approver."></textarea>`)}${canReconfirm ? `<label class="check-line"><input type="checkbox" name="confirm"/> <span>I confirm ${U.esc(subject)} is still needed and is still used for its approved purpose.</span></label>` : ""}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-complete">${I.checkCircle} ${canReconfirm ? "Complete and reconfirm" : "Complete"}</button>`,
      onOpen(wrap) {
        const note = () => wrap.querySelector("textarea[name='note']").value.trim(), box = () => { const c = wrap.querySelector("input[name='confirm']"); return !c || c.checked; };
        C.guard(wrap, () => note() && box(), () => (!note() ? "Say what was done first." : "Tick the box first."), "[data-action='do-complete']");
        wrap.querySelector("[data-action='do-complete']").addEventListener("click", () => {
          if (!note() || !box()) return;
          S.completeRemediation(esc.escalationId, { note: note(), reconfirm: canReconfirm });
          C.closeModal(); AGC.router.refresh();
          setTimeout(() => AGC.shell.toast(canReconfirm ? `Remediation completed and ${U.esc(subject)} reconfirmed; next due ${U.fmtDate(S.entry(en.id).reconfirmationDueDate)}. Recorded in Audit History.` : "Remediation completed. Recorded in Audit History.", "success"), 30);
        });
      } });
  };
  P.editRegistration = function (e) {
    let picker;
    C.modal({ title: `Edit registration: ${U.esc(e.name)}`, size: "modal-lg", body: `${C.field("Accountable owner", C.memberPicker("regOwner", { value: e.ownerMemberId }), "Required. Ownership never grants content access.")}${C.field("Approved purpose", `<textarea class="inp" name="purpose" rows="2">${U.esc(e.approvedPurpose || "")}</textarea>`)}${C.field("Permitted sensitive data tags", `<div class="chips chips-select">${D.dataClasses.map((dc) => `<label class="chip chip-check" title="${U.esc(dc.name)}"><input type="checkbox" name="dc" value="${dc.id}" ${(e.permittedDataClasses || []).includes(dc.id) ? "checked" : ""}/>${U.esc(dc.short)}</label>`).join("")}</div>`, "What this AI asset may handle beyond the platform's policy.")}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-save">${I.check} Save changes</button>`,
      onOpen(wrap) {
        const draw = C.bindOwnerNote(wrap, "regOwner", e.groupId, isPlatform(e) ? "AI system" : "AI asset");
        picker = C.bindMemberPicker(wrap, "regOwner", null, draw);
        wrap.querySelector("[data-action='do-save']").addEventListener("click", () => {
          const ownerId = picker.value(), purpose = wrap.querySelector("textarea[name='purpose']").value.trim();
          if (!ownerId) { AGC.shell.toast("Choose the accountable owner.", "warn"); return; }
          if (!purpose) { AGC.shell.toast("State the approved purpose.", "warn"); return; }
          const res = S.updateRegistration(e.id, { ownerMemberId: ownerId, approvedPurpose: purpose, permittedDataClasses: Array.from(wrap.querySelectorAll("input[name='dc']:checked")).map((c) => c.value) });
          C.closeModal(); AGC.router.refresh();
          setTimeout(() => AGC.shell.toast(res.changes.length ? `${U.esc(e.name)} updated: ${U.esc(res.changes.join("; "))}.` : "Nothing changed.", res.changes.length ? "success" : "info"), 30);
        });
      } });
  };

  /* ---------- Register an AI asset individually. Registration starts from the asset's own row (Gabriel, 2026-09-18), so the asset is
     already chosen and the wizard has two steps: Registration, then Summary and Commit. Internally they are still steps 2 and 3. ---------- */
  P.registerWizard = function (systemId) {
    if (!systemId || !S.system(systemId)) return;
    const st = { step: 2, systemId, q: "", ownerMemberId: "", purpose: "", permitted: [], cadence: D.settings.reconfirmation.intervalMonths };
    const steps = ["Registration", "Summary and Commit"];
    const stepsHtml = () => `<ol class="wizard-steps">${steps.map((s, i) => `<li class="wstep${st.step - 1 === i + 1 ? " active" : st.step - 1 > i + 1 ? " done" : ""}"><span class="wstep-num">${st.step - 1 > i + 1 ? I.check : i + 1}</span><span>Step ${i + 1}. ${s}</span></li>`).join("")}</ol>`;
    const sysOf = () => S.system(st.systemId);
    const body = () => {
      if (st.step === 2) {
        const s = sysOf(), g = s ? S.group(s.groupId) : null, gOwner = g ? S.member(g.ownerMemberId) : null, gOwnerActive = !!(gOwner && gOwner.memberStatus === "Active");
        if (!st.ownerMemberId && gOwnerActive) st.ownerMemberId = gOwner.memberId;
        const ownerHelp = gOwnerActive ? `Required. The business group owner is ${U.esc(gOwner.displayName)}. You can assign a different owner for this AI asset if needed.` : gOwner ? `Required. ${U.esc(g.name)}'s accountable owner, ${U.esc(gOwner.displayName)}, left the organization${gOwner.removedDate ? ` on ${U.fmtDate(gOwner.removedDate)}` : ""}, so nobody is proposed. Choose an owner for this AI asset${S.can("settings") ? `, and <a href="#/settings/groups" data-modal-close>name a new owner for ${U.esc(g.name)}</a> on the Business Groups page` : ", and ask an Archive360 Administrator to name a new owner for the group"}. Ownership never grants content access.` : `Required. ${g ? U.esc(g.name) + " has no accountable owner, so nobody is proposed." : "Choose who answers for this AI asset."} Ownership never grants content access.`;
        return `${stepsHtml()}<div class="notice notice-info">${I.info}<span><strong>${U.esc(s.name)}</strong> · ${U.esc(s.type)} ${originText(s)}${g ? ` · ${U.esc(g.name)}` : ""}${s.creatorName ? ` · created by ${U.esc(s.creatorName)}` : ""}. Register an AI asset individually when it needs its own owner and reconfirmation date: customer-facing, handling regulated data, shared widely, or named in an escalation.</span></div>${gOwnerActive ? "" : `<div class="notice notice-warn">${I.alert}<span>${gOwner ? `${U.esc(g.name)}'s accountable owner has left the organization.` : `${g ? U.esc(g.name) : "This group"} has no accountable owner.`} Until a new owner is named, this registration's owner is the only person accountable for it.</span></div>`}${C.field("Accountable owner", C.memberPicker("wzOwner", { value: st.ownerMemberId }), ownerHelp)}${C.field("Approved purpose", `<textarea class="inp" name="purpose" rows="2" placeholder="Required. What this AI asset is approved to do.">${U.esc(st.purpose)}</textarea>`)}${C.field("Permitted sensitive data tags", `<div class="chips chips-select">${D.dataClasses.map((dc) => `<label class="chip chip-check" title="${U.esc(dc.name)}"><input type="checkbox" name="dc" value="${dc.id}" ${st.permitted.includes(dc.id) ? "checked" : ""}/>${U.esc(dc.short)}</label>`).join("")}</div>`, "Optional. What this AI asset may handle beyond the platform's policy.")}`;
      }
      const s = sysOf(), g = s ? S.group(s.groupId) : null, cov = g ? S.coverage(g.id) : [], owner = S.member(st.ownerMemberId);
      return `${stepsHtml()}<dl class="kv kv-wide"><dt>AI asset</dt><dd>${U.esc(s ? s.name : "")} · ${U.esc(s ? s.type : "")}</dd><dt>Business group</dt><dd>${U.esc(g ? g.name : "")}</dd><dt>Accountable owner</dt><dd>${owner ? U.esc(owner.displayName) + ` <span class="muted">· ${U.esc(owner.jobTitle || "")}</span>` : ""}</dd><dt>Approved purpose</dt><dd>${U.esc(st.purpose)}</dd><dt>Permitted sensitive data tags</dt><dd>${st.permitted.length ? st.permitted.map((id) => U.esc(S.dcName(id))).join(", ") : '<span class="muted">None beyond the platform\'s policy</span>'}</dd><dt>Cadence</dt><dd>${(function () { const r = S.riskForAsset(st.systemId), m = S.cadenceForBand(r ? r.band : "Low"); return `Every ${m} months, because the risk band is ${r ? r.band : "Low"} (${r ? r.score : 0}) today · first reconfirmation due ${U.fmtDate(S.addMonths(U.today(), m))}`; })()}</dd></dl>
        ${cov.length ? `<div class="notice notice-ok">${I.checkCircle}<span>${cov.length} ${U.plural(cov.length, "reviewer", "reviewers")} can see ${U.esc(g.name)}'s activity: ${cov.slice(0, 3).map((c) => U.esc(c.member.displayName)).join(", ")}${cov.length > 3 ? ` and ${cov.length - 3} more` : ""}.</span></div>` : `<div class="notice notice-warn">${I.alert}<span><strong>Nobody can review ${U.esc(g ? g.name : "this group")}'s activity.</strong> The registration cannot be saved until a reviewer has access. See the Readiness check.</span></div>`}
        <div class="notice notice-info">${I.info}<span>Saving approves the registration at once. The owner is notified, and reconfirmation reminders begin ${D.settings.reconfirmation.reminderStartDays || 30} days before each due date.</span></div>`;
    };
    const canSave = () => { const s = sysOf(); return !!(s && s.groupId && S.coverage(s.groupId).length); };
    const footer = () => `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>${st.step > 2 ? `<button type="button" class="btn btn-secondary" data-wz="back">Back</button>` : ""}${st.step < 3 ? `<button type="button" class="btn btn-primary" data-wz="next">Next</button>` : (canSave() ? `<button type="button" class="btn btn-primary" data-wz="save">${I.check} Save and Close</button>` : `<span class="btn-disabled-wrap"><button type="button" class="btn btn-primary is-disabled" disabled>${I.check} Save and Close</button><span class="btn-reason">No reviewer has access to this business group. Fix it on the Readiness check first.</span></span>`)}`;
    const capture = (wrap) => {
      const o = wrap.querySelector("#wzOwner [data-mpick-value]"); if (o) st.ownerMemberId = o.value;
      const p = wrap.querySelector("textarea[name='purpose']"); if (p) st.purpose = p.value.trim();
      if (wrap.querySelector("input[name='dc']")) st.permitted = Array.from(wrap.querySelectorAll("input[name='dc']:checked")).map((x) => x.value);
    };
    const validate = () => {
      if (st.step === 2) { if (!st.ownerMemberId) return "Choose the accountable owner."; if (!st.purpose) return "State the approved purpose."; }
      return null;
    };
    const paint = (wrap) => {
      wrap.querySelector(".modal-body").innerHTML = body();
      wrap.querySelector(".modal-foot").innerHTML = footer();
      if (st.step === 2) { const s = sysOf(); const draw = C.bindOwnerNote(wrap, "wzOwner", s ? s.groupId : null, "AI asset"); C.bindMemberPicker(wrap, "wzOwner", null, draw); }
      wrap.querySelectorAll("[data-wz]").forEach((b) => b.addEventListener("click", () => {
        capture(wrap);
        const act = b.dataset.wz;
        if (act === "back") { st.step -= 1; paint(wrap); return; }
        const err = validate(); if (err) { AGC.shell.toast(err, "warn"); return; }
        if (act === "next") { st.step += 1; paint(wrap); return; }
        const e = S.registerSystem({ aiSystemId: st.systemId, ownerMemberId: st.ownerMemberId, approvedPurpose: st.purpose, permittedDataClasses: st.permitted });
        C.closeModal(); AGC.router.navigate("#/registry/" + e.id);
        setTimeout(() => AGC.shell.toast(`${U.esc(e.name)} registered and approved. First reconfirmation due ${U.fmtDate(e.reconfirmationDueDate)}.`, "success"), 30);
      }));
      const first = wrap.querySelector(".modal-body input:not([type=radio]):not([type=checkbox]), .modal-body textarea"); if (first && st.step !== 1) first.focus();
    };
    C.modal({ title: `Register ${U.esc(S.system(systemId).name)}`, size: "modal-lg", body: "", footer: "", onOpen: paint });
  };
})();
