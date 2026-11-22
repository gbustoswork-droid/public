/* People: everyone the identity source synchronizes, across all business groups, and the person page. Agreed with Gabriel on
   2026-09-22: a lookup that starts from a name genuinely spans groups (a person's history does), so it is a top-level tab, placed after
   Groups. It keeps the module's principle in three ways: the list is sectioned by current business group, with "Not in a group yet" first;
   it is a lookup and a drill-down, never a place to act on a person (attribution changes only on Business Group Mapping); and each person
   sees the people of the groups their Entitlement Policies cover or that they own, the same rule as Audit History. A person is in one
   business group at a time, effective-dated; their interactions stay attributed to the group in force when they happened, so the person
   page shows a timeline, not two memberships. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.people = {});
  const DAYS = 30;
  const since = () => { const d = new Date(U.today() + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - DAYS); return d.toISOString().slice(0, 10); };
  const ui = (P.ui = { tile: "all", group: "all", search: "", open: {} });
  (AGC.personaHooks = AGC.personaHooks || []).push(() => Object.assign(ui, { tile: "all", group: "all", search: "", open: {} }));
  window.addEventListener("hashchange", () => { if (!/^#\/(people|members)/.test(location.hash)) ui.open = {}; });

  const isPerson = (m) => m.sourceSystem !== "Archive360 local account" && m.assignmentSource !== "excluded";
  /* Who a person may see: the people of the groups their Entitlement Policies cover or that they own, themselves, and, for those who work
     the Unregistered AI queue, the people not yet in a group. The Administrator sees everyone. */
  function visible(m) {
    if (!isPerson(m)) return false;
    if (S.can("settings")) return true;
    const p = S.persona(); if (!p) return false;
    if (m.memberId === p.memberId) return true;
    if (!m.primaryGroupId) return S.can("unregistered");
    if (S.isEntitled(m.primaryGroupId)) return true;
    const g = S.group(m.primaryGroupId);
    return !!(g && g.ownerMemberId === p.memberId);
  }
  P.visiblePeople = () => D.members.filter(visible);
  P.canSee = visible;
  /* The business group a person was in on a date. */
  P.groupAt = (m, date) => { for (const h of m.groupHistory || []) { if (h.fromDate <= date && (!h.toDate || date <= h.toDate)) return h.groupId; } return m.primaryGroupId; };
  const attrLabel = () => S.attributeOption(D.mapping.sourceAttribute).label;
  const current = (m) => (m.groupHistory || []).slice(-1)[0] || null;
  function assignedBy(m) {
    switch (m.assignmentSource) {
      case "mapping": return "Mapping";
      case "override": return `Override${m.overrideReason ? `: ${U.esc(m.overrideReason)}` : ""}`;
      case "manager-fallback": { const b = S.member(m.managerMemberId); return `Manager fallback${b ? ` (${U.esc(b.displayName)})` : ""}`; }
      case "unmapped": return '<span class="danger-text">Not in a group yet</span>';
      default: return U.esc(m.assignmentSource || "");
    }
  }
  const activity = (m) => { const all = S.interactionsByMember[m.memberId] || [], from = since(), recent = all.filter((x) => x.date >= from), last = all.reduce((a, x) => (x.date > a ? x.date : a), ""); return { all, recent, last }; };
  const created = (m) => D.aiSystems.filter((s) => s.creatorMemberId === m.memberId && s.type !== "Custom");
  const COUNTRY = { US: "United States", CA: "Canada", GB: "United Kingdom", IE: "Ireland", IN: "India", MX: "Mexico" };
  const rank = (m) => Object.keys(U.STATUS).indexOf(m.memberStatus);

  /* ---------- The tab ---------- */
  const narrowing = () => ui.tile !== "all" || ui.group !== "all" || !!ui.search;
  const isOpen = (key) => (Object.prototype.hasOwnProperty.call(ui.open, key) ? ui.open[key] : key === "none" || narrowing());
  /* Gabriel's columns (2026-09-22): Person, Department, Last AI activity, Actions. The name is plain text and View is in the Actions menu, as
     in A2Z grids. How a person was assigned shows only when it is an exception (an override or the manager fallback), as a tag by the name;
     "Mapping" is the rule and says nothing, and the person page carries the full fact. */
  const exceptionTag = (m) => (m.assignmentSource === "override" ? `<span class="tag" title="Assigned by override${m.overrideReason ? ": " + U.esc(m.overrideReason) : ""}">Override</span>` : m.assignmentSource === "manager-fallback" ? `<span class="tag" title="Assigned through the manager because the ${U.esc(attrLabel())} value is blank">Manager fallback</span>` : "");
  function actionsMenu(m) {
    const item = AGC.pages.settings.menuItem({ attr: "data-person-action", action: "view", id: m.memberId, icon: "overview", label: "View" })
      + AGC.pages.settings.menuItem({ attr: "data-person-action", action: "interactions", id: m.memberId, icon: "interactions", label: "View interactions" });
    return `<div class="group-card-actions group-card-actions--grid"><button type="button" class="group-card-actions-btn" data-menu-toggle="person-${m.memberId}" aria-haspopup="true">Actions <span class="group-card-actions-caret">&#9660;</span></button><div class="group-card-actions-menu menu-pop" id="menu-actions-person-${m.memberId}" role="menu" hidden>${item}</div></div>`;
  }
  /* One row for a person, shared with the group page's Members sub-page so the two grids cannot drift (Gabriel, 2026-09-25): avatar,
     name, an Override or Manager fallback tag, the title beneath; the attribute value; interactions in the period where the page has one;
     the last AI activity; the employment status as a pill (so no status tag by the name here); Actions with View and View interactions.
     People who are not Active are dimmed. */
  P.personHead = function (opts) {
    const o = opts || {};
    return `<thead><tr><th>Person</th><th>${U.esc(attrLabel())}</th>${o.interactions ? '<th class="num">Interactions</th>' : ""}<th>Last AI activity</th><th>Status</th><th class="groups-grid-actions-header" style="text-align:right">Actions</th></tr></thead>`;
  };
  P.personColumns = (opts) => (opts && opts.interactions ? 6 : 5);
  P.personRow = function (m, opts) {
    const o = opts || {}, a = activity(m);
    const cls = [o.cls || "", m.memberStatus !== "Active" ? "row-inactive" : ""].filter(Boolean).join(" ");
    return `<tr${cls ? ` class="${cls}"` : ""}${o.attrs ? " " + o.attrs : ""}>
      <td><div class="inst-name">${U.avatar(m, "sm")}<div><span class="strong">${U.esc(m.displayName)}</span>${exceptionTag(m)}<div class="small muted">${U.esc(m.jobTitle || "")}</div></div></div></td>
      <td class="small">${U.esc(S.attrValue(m, D.mapping.sourceAttribute) || "blank")}</td>
      ${o.interactions ? `<td class="num">${U.fmtNum(S.scoped(S.interactionsByMember[m.memberId] || []).length)}</td>` : ""}
      <td class="small">${a.last ? U.fmtDate(a.last) : '<span class="muted">None</span>'}</td>
      <td>${U.employmentPill(m)}</td>
      <td class="groups-grid-actions-cell">${actionsMenu(m)}</td>
    </tr>`;
  };
  P.bindPersonActions = function (root) {
    root.querySelectorAll("[data-person-action]").forEach((b) => b.addEventListener("click", () => { AGC.shell.closeMenus(); if (b.dataset.personAction === "view") AGC.router.navigate("#/members/" + b.dataset.id); else if (b.dataset.personAction === "interactions") AGC.router.navigate("#/members/" + b.dataset.id + "/interactions"); }));
  };
  P.statusRank = rank;
  const row = (m) => P.personRow(m, { attrs: `data-group-rows="${m.primaryGroupId || "none"}"${isOpen(m.primaryGroupId || "none") ? "" : " hidden"}` });
  function section(key, name, href, people) {
    const open = isOpen(key), away = U.statusBreakdown(people, { skipActive: true });
    /* The unassigned section says the problem and the fix (Gabriel, 2026-09-29), with the same links as the Groups page's line and the
       person page's strip: Business Group Mapping for the Administrator, the Unregistered AI queue for whoever works it. */
    const attr = S.attributeOption(D.mapping.sourceAttribute).label;
    const fix = key !== "none" ? "" : S.can("settings") ? ` · <a href="#/settings/mapping">Map their ${U.esc(attr)} values on Business Group Mapping.</a>` : S.can("unregistered") ? ` · <a href="#/unregistered">See Unregistered AI.</a>` : "";
    const summary = key === "none" ? `<span class="danger-text">nobody owns their activity</span>${fix}` : away;
    return `<tr class="grp-row" data-group-toggle="${key}" aria-expanded="${open}"><td colspan="${P.personColumns()}"><button type="button" class="grp-toggle" aria-expanded="${open}" aria-label="${open ? "Collapse" : "Expand"} ${U.esc(name)}">${open ? I.chevronDown : I.chevronRight}</button>${href ? `<a class="strong" href="${href}">${U.esc(name)}</a>` : `<span class="strong">${U.esc(name)}</span>`} <span class="count-badge">${people.length}</span>${summary ? `<span class="grp-summary">${summary}</span>` : ""}</td></tr>` + people.map(row).join("");
  }
  function matches(m) {
    if (ui.tile === "none" && m.primaryGroupId) return false;
    if (ui.tile !== "all" && ui.tile !== "none" && m.memberStatus !== ui.tile) return false;
    if (ui.group !== "all" && (m.primaryGroupId || "none") !== ui.group) return false;
    if (ui.search) { const q = ui.search.toLowerCase(); if (!`${m.displayName} ${m.jobTitle || ""} ${S.attrValue(m, D.mapping.sourceAttribute) || ""} ${m.email || ""}`.toLowerCase().includes(q)) return false; }
    return true;
  }
  function notAvailable(what) {
    const nav = AGC.shell.navMeta("people");
    AGC.shell.render({ kind: "list", navKey: "overview", title: nav.title, description: nav.description, icon: "members", html: `<div class="placeholder-card"><div class="ph-title">${I.lock} ${what || "People"} is not available for your profile</div><div class="ph-body">Access to people comes from your Profile and Entitlement Policies, managed by an Archive360 Administrator.</div></div>` });
  }
  P.render = function () {
    const all = P.visiblePeople();
    if (!all.length) { notAvailable(); return; }
    const nav = AGC.shell.navMeta("people");
    const tile = (key, val, label, cls) => `<button type="button" class="ready-tile tile-btn ${cls || ""}${ui.tile === key ? " active" : ""}" data-action="people-tile" data-tile="${key}" aria-pressed="${ui.tile === key}"><div class="ready-val">${U.fmtNum(val)}</div><div class="ready-label">${U.esc(label)}</div></button>`;
    /* Tiles are the only status filter: the group exception first, then each employment status (Gabriel, 2026-09-23). */
    const none = all.filter((m) => !m.primaryGroupId).length, count = (st) => all.filter((m) => m.memberStatus === st).length;
    const strip = `<div class="ready-strip people-strip">${tile("all", all.length, "All people")}${tile("none", none, "Not in a group yet", none ? "gap" : "ok")}${tile("On Leave", count("On Leave"), "On leave")}${tile("Inactive", count("Inactive"), "Inactive")}${tile("Terminated", count("Terminated"), "Terminated")}</div>`;
    const groups = S.groupsOrdered();
    const toolbar = `<div class="toolbar reg-toolbar">
        ${C.select("peopleGroup", [{ value: "all", label: "All business groups" }, { value: "none", label: "Not in a group yet" }].concat(groups.map((g) => ({ value: g.id, label: g.name }))), ui.group)}
        <input type="search" id="peopleSearch" class="inp toolbar-search" placeholder="Search names, titles or ${U.esc(attrLabel())} values" value="${U.esc(ui.search)}"/>
        <span class="toolbar-spacer"></span>
        <button type="button" class="btn btn-sm" data-action="people-export">${I.list} Export</button>
      </div>`;
    const shown = all.filter(matches);
    const bySection = [];
    const unassigned = S.sortMembers(shown.filter((m) => !m.primaryGroupId));
    if (unassigned.length) bySection.push(section("none", "Not in a group yet", null, unassigned));
    groups.forEach((g) => { const ppl = S.sortMembers(shown.filter((m) => m.primaryGroupId === g.id), (a, b) => (rank(a) - rank(b) || a.displayName.localeCompare(b.displayName))); if (ppl.length) bySection.push(section(g.id, g.name, `#/groups/${g.id}`, ppl)); });
    const head = P.personHead();
    const empty = C.emptyState("Nothing matches", "Choose All people, another business group, or clear the search.");
    const controls = `<span class="grp-controls"><button type="button" class="link-btn" data-action="people-expand">Expand all</button><span class="muted"> · </span><button type="button" class="link-btn" data-action="people-collapse">Collapse all</button></span>`;
    const body = C.card(`People by business group <span class="count-badge">${shown.length}</span>`, `<div class="tbl-wrap"><table class="tbl tbl-registry tbl-people">${head}<tbody>${bySection.join("") || `<tr><td colspan="${P.personColumns()}">${empty}</td></tr>`}</tbody></table></div>`, { action: controls });
    AGC.shell.render({ kind: "list", navKey: "people", title: nav.title, description: nav.description, icon: "members", html: `${strip}${toolbar}${body}`, after: P.after });
  };
  P.after = function (root) {
    const rerender = () => AGC.router.refresh();
    root.querySelectorAll("[data-action='people-tile']").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.tile; if (k === "all" || ui.tile === k) { ui.tile = "all"; ui.group = "all"; ui.search = ""; ui.open = {}; } else ui.tile = k; rerender(); }));
    const g = root.querySelector("select[name='peopleGroup']"); if (g) g.addEventListener("change", () => { ui.group = g.value; rerender(); });
    const s = root.querySelector("#peopleSearch"); if (s) s.addEventListener("input", U.debounce(() => { ui.search = s.value; const pos = s.selectionStart; rerender(); const s2 = document.querySelector("#peopleSearch"); if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); } }, 220));
    const ex = root.querySelector("[data-action='people-export']"); if (ex) ex.addEventListener("click", () => AGC.shell.toast("Exports the people shown as CSV: name, title, business group, how they were assigned, and their last AI activity.", "info"));
    P.bindPersonActions(root);
    const setOpen = (key, open) => { ui.open[key] = open; root.querySelectorAll(`tr[data-group-rows="${key}"]`).forEach((r) => { r.hidden = !open; }); const h = root.querySelector(`tr[data-group-toggle="${key}"]`); if (h) { h.setAttribute("aria-expanded", open); const b = h.querySelector(".grp-toggle"); b.innerHTML = open ? I.chevronDown : I.chevronRight; b.setAttribute("aria-expanded", open); } };
    root.querySelectorAll("tr[data-group-toggle]").forEach((h) => h.addEventListener("click", (ev) => { if (ev.target.closest("a")) return; const key = h.dataset.groupToggle; setOpen(key, h.getAttribute("aria-expanded") !== "true"); }));
    const ea = root.querySelector("[data-action='people-expand']"); if (ea) ea.addEventListener("click", () => root.querySelectorAll("tr[data-group-toggle]").forEach((h) => setOpen(h.dataset.groupToggle, true)));
    const ca = root.querySelector("[data-action='people-collapse']"); if (ca) ca.addEventListener("click", () => root.querySelectorAll("tr[data-group-toggle]").forEach((h) => setOpen(h.dataset.groupToggle, false)));
  };

  /* ---------- The person page ---------- */
  P.person = function (id) {
    const m = S.member(id);
    if (!m || !visible(m)) { notAvailable("This person"); return; }
    const hist = m.groupHistory || [], cur = current(m), prior = hist.length > 1 ? hist[hist.length - 2] : null;
    const a = activity(m), assets = created(m), attr = attrLabel(), value = S.attrValue(m, D.mapping.sourceAttribute);
    const sentence = m.primaryGroupId
      ? `${U.esc(m.jobTitle || "Member")} in ${U.esc(S.groupName(m.primaryGroupId))}${cur && cur.fromDate ? ` since ${U.fmtDate(cur.fromDate)}` : ""}${prior && S.group(prior.groupId) ? `; before that ${U.esc(S.groupName(prior.groupId))}` : ""}.`
      : `${U.esc(m.jobTitle || "Member")}. Not in a business group yet: the ${U.esc(attr)} value ${value ? `"${U.esc(value)}"` : "is blank and"} is not mapped, so nobody owns or reviews their AI activity.`;
    /* Person identification (Gabriel, 2026-09-23): the profile as the identity source reports it, read-only here. The manager links to
       their own page when the persona may see them. The country code is written out. */
    const source = D.mapping.identitySource || m.sourceSystem || "the identity source";
    const manager = m.managerMemberId ? S.member(m.managerMemberId) : null;
    const managerCell = manager ? `${visible(manager) ? `<a href="#/members/${manager.memberId}">${U.esc(manager.displayName)}</a>` : U.esc(manager.displayName)}${manager.jobTitle ? `<span class="muted"> · ${U.esc(manager.jobTitle)}</span>` : ""}` : '<span class="muted">None</span>';
    const idCard = C.card("Person identification", `<p class="small muted">As ${U.esc(source)} reports it, synchronized ${U.esc(U.relTime(D.mapping.identitySyncAt))}. Changes are made there, never here.</p><dl class="kv kv-wide kv-detail">
        <dt>Job title</dt><dd>${U.esc(m.jobTitle || "")}</dd>
        <dt>${U.esc(attr)}</dt><dd>${value ? `<span class="chip chip-muted">${U.esc(value)}</span>` : '<span class="muted">Blank in the identity source</span>'}</dd>
        <dt>Manager</dt><dd>${managerCell}</dd>
        <dt>Employment status</dt><dd>${U.esc(U.statusDetail(m))}</dd>
        <dt>Employee type</dt><dd>${U.esc(m.employeeType || "")}</dd>
        <dt>Employee ID</dt><dd>${m.employeeId ? `<code>${U.esc(m.employeeId)}</code>` : '<span class="muted">None</span>'}</dd>
        <dt>Email address</dt><dd>${m.email ? `<a href="mailto:${U.esc(m.email)}">${U.esc(m.email)}</a>` : '<span class="muted">None</span>'}</dd>
        <dt>Office location</dt><dd>${U.esc(m.office || "")}</dd>
        <dt>Country</dt><dd>${U.esc(COUNTRY[m.country] || m.country || "")}</dd>
      </dl>`);
    /* Group membership: one business group at a time, effective-dated; the current group first, then the earlier ones. How the person
       was assigned is a fact of each row: an override is recorded on the row, and everything else came through Business Group Mapping. */
    const histRows = hist.slice().reverse().map((h) => `<tr>
        <td><a class="strong" href="#/groups/${h.groupId}">${U.esc(S.groupName(h.groupId))}</a>${h.jobTitle ? `<div class="muted">${U.esc(h.jobTitle)}</div>` : ""}</td>
        <td>${h.toDate ? `<span class="pill pill-muted"><span>Previous</span></span>` : `<span class="pill pill-ok">${I.checkCircle}<span>Current</span></span>`}</td>
        <td>${U.fmtDate(h.fromDate)}</td>
        <td>${h.toDate ? U.fmtDate(h.toDate) : '<span class="muted">—</span>'}</td>
        <td class="small">${h.toDate ? (h.override ? "Override" : "Mapping") : assignedBy(m)}</td>
      </tr>`).join("");
    const queueItem = !hist.length && value ? S.unregOpenItems().find((u) => u.type === "Unmapped attribute value" && u.identity === value) : null;
    const membershipCard = C.card("Group membership", hist.length
      ? `<div class="tbl-wrap"><table class="tbl tbl-people-hist"><thead><tr><th>Business group</th><th>Status</th><th>From</th><th>To</th><th>Assigned by</th></tr></thead><tbody>${histRows}</tbody></table></div>`
      : `<div class="notice notice-warn">${I.alert}<span>No business group yet.${S.can("settings") ? ` <a href="#/settings/mapping">Map the ${U.esc(attr)} value on Business Group Mapping.</a>` : ""}${queueItem && S.can("unregistered") ? ` <a href="#/unregistered/${queueItem.id}">It is waiting in Unregistered AI.</a>` : ""}</span></div>`);
    /* One row per AI system (Gabriel, 2026-09-29): the platform or custom application the interactions happened in, with a count and the
       last activity there. Direct chats, GPT and Project chats and outside GPTs all count under the platform they were used in. The rows
       carry no links; "All interactions" in the card head is the way to the person's Interactions page. Which AI assets the person built or
       reached into from other groups have their own cards. */
    const bySystem = {}; a.all.forEach((x) => { const k = x.instanceId || "unknown"; const e = (bySystem[k] = bySystem[k] || { n: 0, last: "" }); e.n += 1; if (x.date > e.last) e.last = x.date; });
    const sysRows = Object.entries(bySystem).sort((p, q) => q[1].n - p[1].n).map(([k, e]) => { const inst = S.instance(k), name = inst ? inst.name : "Unknown AI system", type = inst && inst.platformType && inst.platformType !== inst.name ? inst.platformType : ""; return `<tr><td class="small"><span class="strong">${U.esc(name)}</span>${type ? `<div class="muted">${U.esc(type)}</div>` : ""}</td><td class="num">${U.fmtNum(e.n)}</td><td class="small">${U.fmtDate(e.last)}<div class="muted">${U.esc(U.relTime(e.last))}</div></td></tr>`; }).join("");
    const activityCard = C.card("AI activity", `<dl class="kv kv-wide kv-detail">
        <dt>Interactions</dt><dd>${U.fmtNum(a.all.length)} in total · ${U.fmtNum(a.recent.length)} in the last ${DAYS} days</dd>
        <dt>Last activity</dt><dd>${a.last ? `${U.fmtDate(a.last)} · ${U.relTime(a.last)}` : '<span class="muted">None recorded</span>'}</dd>
        <dt>Connected apps</dt><dd>${(m.connectedApps || []).length ? `${m.connectedApps.slice().sort((p, q) => p.connectedDate.localeCompare(q.connectedDate)).map((c) => `${U.esc(c.app)} <span class="muted">since ${U.fmtDate(c.connectedDate)}</span>`).join(" · ")}<div class="small muted">Apps this person connected to ChatGPT Enterprise under their own account; each reaches only what that account can already open.</div>` : '<span class="muted">None</span>'}</dd>
      </dl>${sysRows ? `<div class="tbl-wrap"><table class="tbl tbl-people-sys"><thead><tr><th>AI system</th><th class="num">Interactions</th><th>Last activity</th></tr></thead><tbody>${sysRows}</tbody></table></div>` : ""}`, { action: `<a class="link" href="#/members/${m.memberId}/interactions">All interactions ${I.arrowRight}</a>` });
    const assetsCard = C.card(`AI assets created <span class="count-badge">${assets.length}</span>`, assets.length ? `<ul class="people-list">${assets.map((s) => `<li>${AGC.pages.registry.badge(s.type)}<span><a class="strong" href="#/systems/${s.id}">${U.esc(s.name)}</a><span class="muted"> · ${U.esc(s.type)} · created ${U.fmtDate(s.createdDate)}</span></span><span class="small">${(function () { const c = S.systemCoverage(s); return c.key === "individual" ? U.statusPill(c.entry.status) : c.key === "platform" ? `<span class="pill pill-muted pill-managed">${I.stack}<span>Managed</span></span>` : c.key === "platformPending" ? `<span class="pill pill-pending">${I.clock}<span>Waiting</span></span>` : `<span class="pill pill-danger">${I.alert}<span>${c.decided ? "Prohibited" : "Undecided"}</span></span>`; })()}</span></li>`).join("")}</ul>` : '<p class="small muted">This person has not created any GPTs or Projects.</p>');
    /* AI assets used from other business groups (Gabriel, 2026-09-23, replacing the Archive360 access card, which he found added no
       value): the GPTs and Projects of groups the person was not in when they used them, most used first. An AI asset's activity belongs
       to the asset's group, so this is where a person reaching into another department's AI shows. Outside GPTs belong to no group and
       custom applications are AI systems, so neither is listed. The first eight show; the rest open in place. */
    const cross = {};
    a.all.forEach((x) => {
      if (!x.aiSystemId) return;
      const s = S.system(x.aiSystemId);
      if (!s || s.external || s.type === "Custom" || !s.groupId || s.groupId === P.groupAt(m, x.date)) return;
      const e = (cross[s.id] = cross[s.id] || { s, n: 0, last: "" }); e.n += 1; if (x.date > e.last) e.last = x.date;
    });
    const crossRows = Object.values(cross).sort((p, q) => q.n - p.n || p.s.name.localeCompare(q.s.name));
    const crossCard = C.card(`AI assets used from other business groups <span class="count-badge">${crossRows.length}</span>`, crossRows.length
      ? `<ul class="people-list">${crossRows.map((e, i) => `<li${i >= 8 ? " hidden data-more" : ""}>${AGC.pages.registry.badge(e.s.type)}<span><a class="strong" href="#/systems/${e.s.id}">${U.esc(e.s.name)}</a><div class="muted">${U.esc(S.groupName(e.s.groupId))}${AGC.pages.registry.madeBy(e.s)}</div></span><span class="small muted people-side">${U.fmtNum(e.n)} ${U.plural(e.n, "interaction")}<div>${U.relTime(e.last)}</div></span></li>`).join("")}</ul>${crossRows.length > 8 ? `<p class="small muted"><button type="button" class="link-btn" data-action="people-more" data-all="Show all ${crossRows.length}" data-fewer="Show the first 8">Show all ${crossRows.length}</button></p>` : ""}`
      : '<p class="small muted">None. Every AI asset this person used belongs to their own business group.</p>');
    const after = (root) => { const more = root.querySelector("[data-action='people-more']"); if (more) more.addEventListener("click", () => { const open = more.dataset.open === "1"; root.querySelectorAll(".people-list li[data-more]").forEach((li) => { li.hidden = open; }); more.dataset.open = open ? "" : "1"; more.textContent = open ? more.dataset.all : more.dataset.fewer; }); };
    const status = U.employmentPill(m);
    const bc = C.originCrumbs({ label: m.displayName, href: `#/members/${m.memberId}` }, { nav: "people", crumbs: [{ label: "People", href: "#/people" }, { label: m.displayName, href: `#/members/${m.memberId}` }] });
    AGC.shell.render({ kind: "item", navKey: bc.nav, title: m.displayName,
      breadcrumb: bc.crumbs,
      item: { badgeHtml: U.avatar(m, "sm"), name: m.displayName, statusHtml: status, sentence },
      html: `<div class="two-col"><div>${idCard}${membershipCard}${activityCard}</div><div>${assetsCard}${crossCard}</div></div>`, after });
  };
})();
