/* Settings › Business Group Mapping (Version 1). Attribute values from the identity source become business groups. Edits are staged
   and published as a version. The attribute is chosen at setup; changing it later is a deliberate, staged switch that archives the old
   mapping and re-attributes everyone when published. Registers itself as the Settings "mapping" section. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  const P = AGC.pages.settings;
  const ui = (P.mappingUi = { filter: "all", search: "", selected: new Set() });

  const attrLabel = (key) => S.attributeOption(key).label;
  const attrTech = (key) => S.attributeOption(key).technical;
  const menuId = (raw) => "map-" + raw.replace(/[^A-Za-z0-9]+/g, "-");
  const targetLabel = (t) => (!t ? "Unmapped" : t === "__excluded__" ? "Excluded from governance" : S.groupName(t));

  /* The picker leads with the two actions so they are discoverable above a long list of groups. */
  function targetOptions() {
    return [{ value: "", label: "Unmapped" }]
      .concat([{ value: "__new__", label: "New business group…", group: "Actions" }, { value: "__excluded__", label: "Exclude from governance…", group: "Actions" }])
      .concat(S.activeGroups().map((g) => ({ value: g.id, label: g.name, group: "Business groups" })));
  }
  function setRow(raw, target) {
    const dr = S.mappingDraft;
    if (S.attributeChangeStaged()) { if (target === "") delete dr.rows[raw]; else dr.rows[raw] = target; return; }
    const r = D.mapping.rows.find((x) => x.rawValue === raw);
    const current = r ? (r.excluded ? "__excluded__" : (r.groupId || "")) : "";
    if (target === current) delete dr.rows[raw]; else dr.rows[raw] = target;
  }
  function breakdownHtml(r) {
    if (!r.currentGroups.length) return '<span class="muted">—</span>';
    return r.currentGroups.slice(0, 3).map((b) => `${U.esc(b.groupId ? S.groupName(b.groupId) : "Unassigned")} <span class="muted">${b.count}</span>`).join(", ") + (r.currentGroups.length > 3 ? ` <span class="muted">+${r.currentGroups.length - 3} more</span>` : "");
  }

  P.sections.mapping = {
    render() {
      const M = D.mapping, dr = S.mappingDraft, can = P.canEdit("mapping"), dis = can ? "" : "disabled";
      const switching = S.attributeChangeStaged(), attr = S.activeAttribute();
      const rows = S.mappingRowsView();
      const counts = { all: rows.length, mapped: rows.filter((r) => r.status === "Mapped").length, unmapped: rows.filter((r) => r.status === "Unmapped").length, excluded: rows.filter((r) => r.status === "Excluded").length };
      const unmapped = rows.filter((r) => r.status === "Unmapped");
      const unmappedPeople = U.sum(unmapped, (r) => r.members);
      let shown = rows.filter((r) => ui.filter === "all" || r.status.toLowerCase() === ui.filter);
      if (ui.search) { const q = ui.search.toLowerCase(); shown = shown.filter((r) => r.rawValue.toLowerCase().includes(q) || targetLabel(r.target).toLowerCase().includes(q)); }
      shown.sort((a, b) => ((a.status === "Unmapped" ? 0 : 1) - (b.status === "Unmapped" ? 0 : 1)) || a.rawValue.localeCompare(b.rawValue));
      const impact = S.draftImpact();
      const changeCount = impact.rows + impact.overrides + (impact.attributeChanged ? 1 : 0) + (impact.fallbackChanged ? 1 : 0);
      const fallback = dr.managerFallback !== null ? dr.managerFallback : M.managerFallback;
      const latest = M.versions[M.versions.length - 1];
      const opts = targetOptions();
      const allShownSelected = shown.length > 0 && shown.every((r) => ui.selected.has(r.rawValue));
      const item = (raw, action, icon, label) => P.menuItem({ attr: "data-map-action", action, id: raw, icon, label });

      const attrBlock = !M.versions.length && !switching
        ? C.field("Attribute", C.select("sourceAttribute", S.attributeOptions().map((o) => ({ value: o.key, label: `${o.label} (${o.technical})` })), attr, dis), "Choose the attribute that organizes the business. Department is usually right; cost center when HR owns the structure; division only if coarse groups are wanted. It can be changed later as a deliberate, published change.")
        : C.field("Attribute", `<div class="static-val">${U.esc(attrLabel(attr))}${switching ? ' <span class="tag tag-pending">Change staged</span>' : ""}<div class="small muted">${U.esc(attrTech(attr))} in ${U.esc(M.identitySource || "the identity source")}</div></div>`,
            switching ? `Values of ${U.esc(attrLabel(attr))} are listed below, unmapped until you map them. Nothing changes until you publish. <button type="button" class="link-btn" data-action="cancel-attr">Cancel the change</button>` : (can ? `Chosen at setup. <button type="button" class="link-btn" data-action="change-attr">Change attribute…</button>` : "Chosen at setup."));
      const sourceCard = C.card("Identity source", `<div class="form-grid form-grid-4">
            ${C.field("System", `<div class="static-val">${U.esc(M.identitySource || "Microsoft Entra ID")}</div>`, `Synchronized by Archive360 and managed in Administration.${M.identitySyncAt ? ` Last sync ${U.esc(U.relTime(M.identitySyncAt))}, ${U.fmtNum(D.members.filter((m) => m.memberStatus === "Active" && m.sourceSystem !== "Archive360 local account").length)} active people.` : ""}`)}
            ${attrBlock}
            ${C.field("Manager fallback", `<div class="toggle-list">${C.toggle("managerFallback", fallback, "Assign people with a blank attribute to their nearest manager's group", { disabled: !can })}</div>`)}
            ${C.field("Published version", latest ? `<div class="version-line"><span class="version-badge">v${M.currentVersion}</span><span class="small">${U.fmtDate(latest.date)} by ${U.esc(S.member(latest.byMemberId) ? S.member(latest.byMemberId).displayName : "")}</span></div>` : '<div class="static-val muted">Not published yet</div>', `<button type="button" class="link-btn" data-action="version-history">Version history</button>`)}
          </div>`);

      const pendingBar = S.draftHasChanges() ? `<div class="pending-bar"><div class="pending-text">${I.flag}<span><strong>${changeCount} ${U.plural(changeCount, "change")} staged.</strong> ${impact.attributeChanged
          ? `Publishing switches the attribute to ${U.esc(attrLabel(attr))} and re-attributes ${impact.members} ${U.plural(impact.members, "person", "people")}${impact.unmappedMembersAfterSwitch ? `; <strong>${impact.unmappedMembersAfterSwitch} would be left unassigned</strong> by values still unmapped` : ""}.`
          : `Publishing re-attributes ${impact.members} ${U.plural(impact.members, "person", "people")} and ${U.fmtNum(impact.interactions)} ${U.plural(impact.interactions, "interaction")}.`}</span></div><div class="btn-row"><button type="button" class="btn btn-secondary" data-action="discard">Discard</button><button type="button" class="btn btn-primary" data-action="publish">${I.check} Publish changes…</button></div></div>` : "";

      const rowHtml = shown.map((r) => `<tr class="${r.changed ? "row-changed" : ""} ${r.status === "Unmapped" ? "row-gap" : ""}">
          <td><input type="checkbox" data-sel="${U.esc(r.rawValue)}" ${ui.selected.has(r.rawValue) ? "checked" : ""} ${dis}/></td>
          <td><span class="strong">${U.esc(r.rawValue)}</span>${r.changed ? ' <span class="tag tag-pending">Pending</span>' : ""}</td>
          <td>${C.select("map:" + r.rawValue, opts, r.target, dis)}</td>
          <td class="num">${U.fmtNum(r.members)}</td>
          ${switching ? `<td class="small">${breakdownHtml(r)}</td>` : ""}
          <td>${r.status === "Mapped" ? `<span class="pill pill-ok">${I.checkCircle}<span>Mapped</span></span>` : r.status === "Excluded" ? `<span class="pill pill-muted">${I.minus}<span>Excluded</span></span>` : `<span class="pill pill-danger">${I.alert}<span>Unmapped</span></span>`}</td>
          <td class="groups-grid-actions-cell"><div class="group-card-actions group-card-actions--grid"><button type="button" class="group-card-actions-btn" data-menu-toggle="${U.esc(menuId(r.rawValue))}" aria-haspopup="true">Actions <span class="group-card-actions-caret">&#9660;</span></button><div class="group-card-actions-menu menu-pop" id="menu-actions-${U.esc(menuId(r.rawValue))}" role="menu" hidden>${item(r.rawValue, "history", "audit", "Version History")}${item(r.rawValue, "members", "groups", "View people")}${can ? (r.status === "Excluded" ? item(r.rawValue, "include", "checkCircle", "Include in governance") : item(r.rawValue, "exclude", "minus", "Exclude from governance…")) : ""}</div></div></td>
        </tr>`).join("");
      const valuesCard = C.card(`${U.esc(attrLabel(attr))} values <span class="count-badge">${counts.all}</span>`, `
          ${switching ? `<div class="notice notice-info">${I.info}<span><strong>Attribute change staged.</strong> These are the ${counts.all} distinct values of ${U.esc(attrLabel(attr))} across active people. Map or exclude each one, then publish. "Currently in" shows where each value's people sit under today's ${U.esc(attrLabel(M.sourceAttribute).toLowerCase())} mapping, so you can see where a coarser attribute merges groups.</span></div>` : ""}
          ${unmapped.length ? `<div class="notice notice-warn unmapped-strip">${I.alert}<span><strong>${unmapped.length} unmapped ${U.plural(unmapped.length, "value")}</strong> covering ${unmappedPeople} ${U.plural(unmappedPeople, "person", "people")}. ${switching ? "Those people stay unassigned after publishing until the values are mapped." : 'Their activity waits in <a href="#/unregistered">Unregistered AI</a> until mapped or excluded.'}</span></div>` : `<div class="notice notice-ok">${I.checkCircle}<span>Every ${U.esc(attrLabel(attr).toLowerCase())} value is mapped or excluded.</span></div>`}
          <div class="toolbar">
            <div class="filter-chips">${[["all", "All"], ["unmapped", "Unmapped"], ["mapped", "Mapped"], ["excluded", "Excluded"]].map(([k, l]) => `<button type="button" class="fchip${ui.filter === k ? " active" : ""}" data-action="filter" data-filter="${k}">${l} <span class="fcount">${counts[k]}</span></button>`).join("")}</div>
            <div class="groups-search-wrap toolbar-search"><span class="groups-search-icon">${I.search}</span><input type="text" class="groups-search-input" id="mapSearch" placeholder="Search values or groups" value="${U.esc(ui.search)}"/></div>
            <div class="bulk${ui.selected.size ? "" : " is-hidden"}"><span class="small">${ui.selected.size} selected: map to</span>${C.select("bulkTarget", opts.filter((o) => o.value !== ""), (S.activeGroups()[0] || {}).id || "__new__", dis)}<button type="button" class="btn btn-sm btn-primary" data-action="bulk-apply" ${dis}>Apply</button><button type="button" class="btn btn-sm" data-action="clear-selection">Clear selection</button></div>
          </div>
          <div class="tbl-wrap"><table class="tbl tbl-map"><thead><tr><th><input type="checkbox" data-sel-all ${allShownSelected ? "checked" : ""} ${dis} aria-label="Select or clear every value shown"/></th><th>${U.esc(attrLabel(attr))} value</th><th>Business group</th><th class="num">People</th>${switching ? "<th>Currently in</th>" : ""}<th>Status</th><th class="groups-grid-actions-header" style="text-align:right">Actions</th></tr></thead><tbody>${rowHtml || `<tr><td colspan="${switching ? 7 : 6}">${C.emptyState(rows.length ? "No values match" : "No attribute values yet", rows.length ? "Clear the search or choose another filter." : "Values appear as the identity source synchronizes and archived activity arrives.")}</td></tr>`}</tbody></table></div>`);

      const overridesCard = C.card(`Individual overrides <span class="count-badge">${M.overrides.length + dr.overridesAdd.length}</span>`, `<p class="lead">An override places one person in a business group other than the one their ${U.esc(attrLabel(M.sourceAttribute).toLowerCase())} value maps to. Use it when the identity source is wrong or has not caught up with a move, record the reason, and remove it once the source is corrected. Overrides are the only exception to automatic assignment: each one is audited, and nobody can choose their own group.</p>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Person</th><th>Attribute implies</th><th>Assigned group</th><th>Reason</th><th>Set by</th><th></th></tr></thead><tbody>
          ${M.overrides.map((o) => { const m = S.member(o.memberId); const removing = dr.overridesRemove.includes(o.memberId); return `<tr class="${removing ? "row-removed" : ""}"><td>${U.memberLink(m)}</td><td>${U.esc(S.groupName(o.impliedGroupId))}<div class="small muted">${U.esc(S.attrValue(m, M.sourceAttribute) || "blank")}</div></td><td>${U.esc(S.groupName(o.groupId))}</td><td class="small">${U.esc(o.reason)}</td><td class="small">${U.esc(S.member(o.setByMemberId) ? S.member(o.setByMemberId).displayName : "")} · ${U.fmtDate(o.setDate)}</td><td class="nowrap">${removing ? `<span class="tag tag-pending">Removal pending</span> <button type="button" class="btn btn-sm" data-action="undo-remove" data-mid="${o.memberId}">Undo</button>` : can ? `<button type="button" class="btn btn-sm" data-action="remove-override" data-mid="${o.memberId}">Remove</button>` : ""}</td></tr>`; }).join("")}
          ${dr.overridesAdd.map((o) => { const m = S.member(o.memberId); return `<tr class="row-changed"><td>${U.memberLink(m)}</td><td>${U.esc(S.groupName(o.impliedGroupId))}</td><td>${U.esc(S.groupName(o.groupId))}</td><td class="small">${U.esc(o.reason)}</td><td class="small"><span class="tag tag-pending">Pending</span></td><td><button type="button" class="btn btn-sm" data-action="undo-add" data-mid="${o.memberId}">Undo</button></td></tr>`; }).join("")}
          </tbody></table></div>`, { action: can ? `<button type="button" class="btn btn-sm" data-action="add-override">${I.owner} Add override</button>` : "" });

      return `${sourceCard}${pendingBar}${valuesCard}${overridesCard}`;
    },
    after(root) {
      const dr = S.mappingDraft, M = D.mapping;
      const rerender = () => AGC.router.refresh();
      root.querySelectorAll("[data-action='filter']").forEach((b) => b.addEventListener("click", () => { ui.filter = b.dataset.filter; rerender(); }));
      const search = root.querySelector("#mapSearch");
      if (search) search.addEventListener("input", U.debounce(() => { ui.search = search.value; const pos = search.selectionStart; rerender(); const s2 = document.querySelector("#mapSearch"); if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); } }, 220));
      root.querySelectorAll("select[name^='map:']").forEach((sel) => sel.addEventListener("change", () => {
        const raw = sel.name.slice(4);
        if (sel.value === "__new__") { P.groupForm(null, { rawValue: raw, onCreate: (g) => { setRow(raw, g.id); rerender(); }, onCancel: () => rerender() }); return; }
        if (sel.value === "__excluded__") { P.excludeModal([raw], () => rerender(), () => rerender()); return; }
        setRow(raw, sel.value); rerender();
      }));
      root.querySelectorAll("input[data-sel]").forEach((c) => c.addEventListener("change", () => { if (c.checked) ui.selected.add(c.dataset.sel); else ui.selected.delete(c.dataset.sel); rerender(); }));
      const all = root.querySelector("[data-sel-all]");
      if (all) {
        const vis = Array.from(root.querySelectorAll("input[data-sel]"));
        const picked = vis.filter((c) => ui.selected.has(c.dataset.sel)).length;
        all.indeterminate = picked > 0 && picked < vis.length;
        all.addEventListener("change", () => { if (all.checked) vis.forEach((c) => ui.selected.add(c.dataset.sel)); else vis.forEach((c) => ui.selected.delete(c.dataset.sel)); rerender(); });
      }
      const clear = root.querySelector("[data-action='clear-selection']");
      if (clear) clear.addEventListener("click", () => { ui.selected.clear(); rerender(); });
      const bulk = root.querySelector("[data-action='bulk-apply']");
      if (bulk) bulk.addEventListener("click", () => {
        const t = root.querySelector("select[name='bulkTarget']").value;
        if (t === "__new__") { P.groupForm(null, { rawValue: Array.from(ui.selected)[0], onCreate: (g) => { ui.selected.forEach((raw) => setRow(raw, g.id)); ui.selected.clear(); rerender(); }, onCancel: () => rerender() }); return; }
        if (t === "__excluded__") { P.excludeModal(Array.from(ui.selected), () => { ui.selected.clear(); rerender(); }, () => rerender()); return; }
        ui.selected.forEach((raw) => setRow(raw, t)); ui.selected.clear(); rerender();
      });
      const attrSel = root.querySelector("select[name='sourceAttribute']");
      if (attrSel) attrSel.addEventListener("change", () => { M.sourceAttribute = attrSel.value; rerender(); }); // first setup, nothing published yet
      root.querySelectorAll("[data-action='change-attr']").forEach((b) => b.addEventListener("click", () => P.changeAttributeModal()));
      root.querySelectorAll("[data-action='cancel-attr']").forEach((b) => b.addEventListener("click", () => { Object.keys(dr.rows).forEach((k) => delete dr.rows[k]); dr.sourceAttribute = null; ui.selected.clear(); AGC.shell.toast("Attribute change cancelled. The published mapping is unchanged.", "info"); rerender(); }));
      root.querySelectorAll("[data-action='version-history']").forEach((b) => b.addEventListener("click", () => P.versionHistoryModal()));
      root.querySelectorAll("[data-map-action]").forEach((b) => b.addEventListener("click", () => { AGC.shell.closeMenus(); const a = b.dataset.mapAction, raw = b.dataset.id; if (a === "history") P.rowHistoryModal(raw); else if (a === "members") P.valueMembersModal(raw); else if (a === "exclude") P.excludeModal([raw], () => rerender(), () => rerender()); else if (a === "include") { setRow(raw, ""); rerender(); } }));
      const fb = root.querySelector("input[name='managerFallback']");
      if (fb) fb.addEventListener("change", () => { dr.managerFallback = fb.checked === M.managerFallback ? null : fb.checked; rerender(); });
      root.querySelectorAll("[data-action='remove-override']").forEach((b) => b.addEventListener("click", () => { dr.overridesRemove.push(b.dataset.mid); rerender(); }));
      root.querySelectorAll("[data-action='undo-remove']").forEach((b) => b.addEventListener("click", () => { dr.overridesRemove = dr.overridesRemove.filter((x) => x !== b.dataset.mid); rerender(); }));
      root.querySelectorAll("[data-action='undo-add']").forEach((b) => b.addEventListener("click", () => { dr.overridesAdd = dr.overridesAdd.filter((x) => x.memberId !== b.dataset.mid); rerender(); }));
      const addO = root.querySelector("[data-action='add-override']");
      if (addO) addO.addEventListener("click", () => P.overrideModal(() => rerender()));
      const discard = root.querySelector("[data-action='discard']");
      if (discard) discard.addEventListener("click", () => { S.resetMappingDraft(); ui.selected.clear(); AGC.shell.toast("Staged changes discarded.", "info"); rerender(); });
      const publish = root.querySelector("[data-action='publish']");
      if (publish) publish.addEventListener("click", () => P.publishModal());
    },
  };

  /* Row dialogs: the history of one value (who changed it, from what, to what, and since when) and the people carrying it. */
  P.rowHistoryModal = function (rawValue) {
    const view = S.mappingRowsView().find((r) => r.rawValue === rawValue);
    const row = view ? view.row : null, attr = S.activeAttribute();
    const hist = S.rowHistory(row);
    C.modal({ title: `History: ${U.esc(rawValue)}`, size: "modal-lg", body: `<dl class="kv kv-wide">
        <dt>Attribute</dt><dd>${U.esc(attrLabel(attr))} <span class="muted small">${U.esc(attrTech(attr))}</span></dd>
        <dt>Current mapping</dt><dd>${U.esc(targetLabel(view ? view.target : ""))}${view && view.changed ? ' <span class="tag tag-pending">Pending, not published</span>' : ""}</dd>
        ${row && row.excluded && row.excludedReason ? `<dt>Exclusion reason</dt><dd>${U.esc(row.excludedReason)}</dd>` : ""}
        <dt>Mapped since</dt><dd>${row && row.mappedSince ? U.fmtDate(row.mappedSince) : '<span class="muted">Not mapped</span>'}</dd>
        <dt>First seen</dt><dd>${row && row.firstSeen ? U.fmtDate(row.firstSeen) : "—"}</dd>
        <dt>People today</dt><dd>${view ? view.members : 0}</dd></dl>
      <h4 class="sub-title">Changes</h4>
      ${hist.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Version</th><th>Changed by</th><th>Original value</th><th>New value</th></tr></thead><tbody>${hist.map((h) => `<tr><td class="nowrap">${U.fmtDate(h.date)}</td><td>v${h.version}</td><td>${U.esc(S.member(h.byMemberId) ? S.member(h.byMemberId).displayName : "")}</td><td>${U.esc(targetLabel(h.fromTarget))}</td><td class="strong">${U.esc(targetLabel(h.toTarget))}${h.reason ? `<div class="small muted">${U.esc(h.reason)}</div>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No mapping changes recorded. This value has never been mapped.</p>`}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Close</button>` });
  };
  P.valueMembersModal = function (rawValue) {
    const attr = S.activeAttribute();
    const all = S.membersForValue(rawValue, attr);
    const ms = all.filter((m) => m.memberStatus === "Active").concat(all.filter((m) => m.memberStatus !== "Active"));
    const active = ms.filter((m) => m.memberStatus === "Active").length, away = ms.length - active, breakdown = U.statusBreakdown(ms, { skipActive: true });
    const src = (m) => ({ mapping: "Mapping", override: "Override", "manager-fallback": "Manager fallback", unmapped: "Unmapped", excluded: "Excluded", none: "None" })[m.assignmentSource] || m.assignmentSource || "";
    C.modal({ title: `People: ${U.esc(rawValue)}`, size: "modal-lg", body: `<p class="small muted">${active} active ${U.plural(active, "person carries", "people carry")} the ${U.esc(attrLabel(attr).toLowerCase())} value "${U.esc(rawValue)}" in ${U.esc(D.mapping.identitySource || "the identity source")}${away === 1 ? `, and 1 more person, ${breakdown.replace(/^1 /, "")}, still carries it` : away ? `, and ${away} more people who are not active (${breakdown}) still carry it` : ""}.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Person</th><th>Title</th><th>Business group today</th><th>Assigned by</th></tr></thead><tbody>${ms.map((m) => `<tr><td>${U.memberLink(m)}</td><td class="small">${U.esc(m.jobTitle || "")}</td><td>${U.esc(m.primaryGroupId ? S.groupName(m.primaryGroupId) : "Unassigned")}</td><td class="small">${U.esc(src(m))}</td></tr>`).join("") || `<tr><td colspan="4">${C.emptyState("Nobody carries this value")}</td></tr>`}</tbody></table></div>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Close</button>` });
  };
  P.versionHistoryModal = function () {
    const M = D.mapping;
    C.modal({ title: "Mapping version history", size: "modal-lg", body: `<ul class="history-list">${M.versions.slice().reverse().map((v) => `<li><span class="hist-date">${U.fmtDate(v.date)}</span><span class="hist-action">v${v.version}</span><span class="hist-detail">${U.esc(v.summary)}${v.attributeChangedFrom ? ` <span class="tag tag-pending">Attribute changed: ${U.esc(attrLabel(v.attributeChangedFrom))} to ${U.esc(attrLabel(v.attribute))}</span>` : ""} <span class="muted">· ${U.esc(S.member(v.byMemberId) ? S.member(v.byMemberId).displayName : "")} · ${v.affectedMembers} ${U.plural(v.affectedMembers, "person", "people")} affected</span></span></li>`).join("") || '<li><span class="muted">Nothing published yet.</span></li>'}</ul><p class="small muted">Each interaction records the mapping version that attributed it, so a reorganization never rewrites history. A row's Actions menu shows the history of one value.</p>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Close</button>` });
  };

  /* Changing the attribute after setup: a deliberate, staged switch with the consequences spelled out first. The list is the set of
     people attributes Archive360 synchronizes from the identity source (configured in Administration), each with its technical name;
     the attribute in force is preselected and marked, and nothing can be staged until a different one is chosen. */
  P.changeAttributeModal = function () {
    const M = D.mapping, dr = S.mappingDraft;
    const options = S.attributeOptions();
    const stagedEdits = Object.keys(dr.rows).length;
    C.modal({ title: "Change the attribute", size: "modal-lg", body: `<p>Business groups are derived from the attribute marked current. Choosing another one starts a new mapping.</p>
        <div class="rc-list">${options.map((o) => { const pv = S.attributePreview(o.key), current = o.key === M.sourceAttribute; return `<label class="rc-item${current ? " selected" : ""}"><input type="radio" name="newAttr" value="${o.key}" ${current ? "checked" : ""}/><span class="rc-body"><span class="strong">${U.esc(o.label)}${current ? ' <span class="tag tag-pending">Current</span>' : ""}</span><span class="small muted">${U.esc(o.technical)} in ${U.esc(M.identitySource || "the identity source")}</span><span class="small">${pv.values} distinct ${U.plural(pv.values, "value")} across ${pv.members} active ${U.plural(pv.members, "person", "people")}</span></span></label>`; }).join("")}</div>
        <p class="small muted">These are the people attributes Archive360 synchronizes from ${U.esc(M.identitySource || "the identity source")}. To organize by another attribute, add it to the user sync in Administration first.</p>
        <div class="notice notice-warn">${I.alert}<span><strong>What happens when you choose a different attribute.</strong> The current ${U.esc(attrLabel(M.sourceAttribute).toLowerCase())} mapping is archived with version ${M.currentVersion}. Every value of the new attribute starts unmapped, and people keep their current groups until you publish. Values still unmapped when you publish leave their people unassigned, and Unregistered AI shows them.${stagedEdits ? ` <strong>${stagedEdits} staged ${U.plural(stagedEdits, "edit")} to the current mapping will be discarded.</strong>` : ""}</span></div>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="stage-attr" disabled title="Choose an attribute other than the current one">${I.check} Stage the change</button>`,
      onOpen(wrap) {
        const btn = wrap.querySelector("[data-action='stage-attr']");
        wrap.querySelectorAll("input[name='newAttr']").forEach((r) => r.addEventListener("change", () => {
          btn.disabled = r.value === M.sourceAttribute;
          wrap.querySelectorAll(".rc-item").forEach((el) => el.classList.toggle("selected", el.querySelector("input").value === r.value));
        }));
        btn.addEventListener("click", () => {
          const v = wrap.querySelector("input[name='newAttr']:checked").value;
          if (v === M.sourceAttribute) { AGC.shell.toast("That is already the attribute in force.", "warn"); return; }
          Object.keys(dr.rows).forEach((k) => delete dr.rows[k]);
          dr.sourceAttribute = v; ui.selected.clear(); ui.filter = "all"; ui.search = "";
          C.closeModal(); AGC.router.refresh();
          setTimeout(() => AGC.shell.toast(`Attribute change to ${U.esc(attrLabel(v))} staged. Map its values, then publish.`, "info"), 30);
        });
      } });
  };

  /* Excluding a value is a governance decision, so it needs a reason. Excluded people are not attributed, not reviewed and not
     listed in Unregistered AI; Archive360 still archives their activity under its retention. Reachable from the row menu, the picker
     and bulk mapping; "Include in governance" reverses it. */
  P.excludeModal = function (raws, onStage, onCancel) {
    const dr = S.mappingDraft, view = S.mappingRowsView();
    const members = U.sum(raws, (raw) => { const r = view.find((x) => x.rawValue === raw); return r ? r.members : 0; });
    /* Rewritten with Gabriel on 2026-10-01: the people and the department first, in the customer's words, then three consequences, then when
       to use it, how to undo it and that nothing changes until the mapping is published; the Exclude button waits for the reason. */
    const one = raws.length === 1, attrL = attrLabel(S.activeAttribute()).toLowerCase(), srcName = D.mapping.identitySource || "the identity source";
    const lead = `${members} ${U.plural(members, "person", "people")} in ${U.esc(srcName)} ${members === 1 ? "has" : "have"} ${one ? `the ${U.esc(attrL)} ${U.esc(raws[0])}` : `these ${U.esc(attrL)}s: ${raws.map((r) => U.esc(r)).join(", ")}`}. Excluding ${one ? "it" : "them"} means:`;
    let saved = false;
    C.modal({ title: one ? `Exclude ${U.esc(raws[0])} from governance` : `Exclude ${raws.length} ${U.esc(attrL)}s from governance`,
      body: `<p>${lead}</p><ul class="consequences"><li>They are not assigned to any business group, so their AI activity is not reviewed and no accountable owner hears about it.</li><li>${one ? `The ${U.esc(attrL)} no longer appears` : `These ${U.esc(attrL)}s no longer appear`} in Unregistered AI as needing a decision.</li><li>Archive360 keeps archiving their activity. Exclusion changes what is governed, not what is collected.</li></ul><p>Use this for ${U.esc(attrL)}s that are not real business units, such as test accounts, service accounts and placeholder values. You can bring ${one ? "it" : "them"} back at any time with "Include in governance" on ${one ? "its row" : "their rows"}. Nothing changes until you publish the mapping.</p>${C.field(`Why ${one ? `this ${attrL} is` : `these ${attrL}s are`} excluded`, `<textarea class="inp" name="reason" rows="2" placeholder="Required. Shown in the ${attrL}'s history and in Audit History."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="stage-exclude">${I.minus} Exclude</button>`,
      onOpen(wrap) {
        C.guard(wrap, () => wrap.querySelector("textarea[name='reason']").value.trim(), "Enter the reason first.", "[data-action='stage-exclude']");
        wrap.querySelector("[data-action='stage-exclude']").addEventListener("click", () => {
          const reason = wrap.querySelector("textarea[name='reason']").value.trim();
          if (!reason) return;
          saved = true;
          raws.forEach((raw) => { setRow(raw, "__excluded__"); dr.excludeReasons[raw] = reason; });
          C.closeModal(); onStage();
          setTimeout(() => AGC.shell.toast(`${one ? U.esc(raws[0]) : `${raws.length} ${U.esc(attrL)}s`} staged as excluded. Publish to apply.`, "info"), 30);
        });
        wrap.addEventListener("click", (e) => { if (!saved && onCancel && (e.target === wrap || e.target.closest("[data-modal-close]"))) onCancel(); });
      } });
  };

  P.overrideModal = function (done) {
    const dr = S.mappingDraft, M = D.mapping;
    const groups = S.activeGroups().map((g) => ({ value: g.id, label: g.name }));
    let picker;
    C.modal({ title: "Add an override", body: `${C.field("Person", C.memberPicker("ovPicker"))}<div id="ovImplied" class="small muted"></div>${C.field("Assign to group", C.select("ovGroup", groups, groups[0].value))}${C.field("Reason", `<textarea class="inp" name="ovReason" rows="2" placeholder="Why this person belongs to a different group than their attribute value implies"></textarea>`, "Shown on the override list and in Audit History.")}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="ov-save">${I.check} Add to staged changes</button>`,
      onOpen(wrap) {
        picker = C.bindMemberPicker(wrap, "ovPicker", (m) => m.assignmentSource !== "override" && !dr.overridesAdd.some((o) => o.memberId === m.memberId), (m) => { wrap.querySelector("#ovImplied").textContent = m ? `${attrLabel(M.sourceAttribute)} "${S.attrValue(m, M.sourceAttribute) || "blank"}" implies ${S.groupName(m.primaryGroupId)}.` : ""; });
        wrap.querySelector("[data-action='ov-save']").addEventListener("click", () => {
          const mid = picker.value(), gid = wrap.querySelector("select[name='ovGroup']").value, reason = wrap.querySelector("textarea[name='ovReason']").value.trim();
          if (!mid) { AGC.shell.toast("Choose a person.", "warn"); return; }
          if (!reason) { AGC.shell.toast("A reason is required for every override.", "warn"); return; }
          const m = S.member(mid);
          if (m.primaryGroupId === gid) { AGC.shell.toast("That is already their group.", "warn"); return; }
          dr.overridesAdd.push({ memberId: mid, groupId: gid, impliedGroupId: m.primaryGroupId, reason });
          C.closeModal();
          done();
        });
      } });
  };

  P.publishModal = function () {
    const dr = S.mappingDraft, M = D.mapping, impact = S.draftImpact();
    const lines = [];
    if (impact.attributeChanged) lines.push(`Attribute: ${attrLabel(M.sourceAttribute)} → ${attrLabel(dr.sourceAttribute)}; the ${attrLabel(M.sourceAttribute).toLowerCase()} mapping is archived`);
    impact.rowList.forEach((r) => { const from = impact.attributeChanged ? "unmapped" : (r.currentGroupId ? S.groupName(r.currentGroupId) : (r.excluded ? "excluded" : "unmapped")); lines.push(`${r.rawValue}: ${from} → ${targetLabel(r.target)}${r.target === "__excluded__" && dr.excludeReasons[r.rawValue] ? ` (${dr.excludeReasons[r.rawValue]})` : ""}`); });
    dr.overridesAdd.forEach((o) => lines.push(`Override: ${S.member(o.memberId).displayName} → ${S.groupName(o.groupId)}`));
    dr.overridesRemove.forEach((id) => lines.push(`Remove override: ${S.member(id).displayName}`));
    if (impact.fallbackChanged) lines.push(`Manager fallback ${dr.managerFallback ? "enabled" : "disabled"}`);
    const auto = lines.slice(0, 3).join("; ") + (lines.length > 3 ? `; ${lines.length - 3} more` : "");
    C.modal({ title: "Publish mapping changes", size: "modal-lg", body: `<ul class="change-list">${lines.map((l) => `<li>${I.arrowRight}<span>${U.esc(l)}</span></li>`).join("")}</ul>
        <div class="notice ${impact.attributeChanged && impact.unmappedMembersAfterSwitch ? "notice-warn" : "notice-info"}">${I.info}<span>${impact.members} ${U.plural(impact.members, "person", "people")} and ${U.fmtNum(impact.interactions)} ${U.plural(impact.interactions, "interaction")} will be re-attributed, including their findings. ${impact.attributeChanged && impact.unmappedMembersAfterSwitch ? `<strong>${impact.unmappedMembersAfterSwitch} ${U.plural(impact.unmappedMembersAfterSwitch, "person", "people")} would be left unassigned</strong> by values still unmapped; they appear in Unregistered AI until mapped. ` : ""}Resolved Unregistered AI items close automatically. Every step is written to Audit History, and this becomes version ${M.currentVersion + 1} in the history.</span></div>
        ${C.field("Summary", `<textarea class="inp" name="summary" rows="2">${U.esc(auto)}</textarea>`, "Shown in the version history and the audit event.")}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-publish">${I.check} Publish</button>`,
      onOpen(wrap) {
        wrap.querySelector("[data-action='do-publish']").addEventListener("click", () => {
          const summary = wrap.querySelector("textarea[name='summary']").value.trim() || auto;
          const res = S.publishMapping(summary);
          C.closeModal();
          ui.selected.clear();
          AGC.router.refresh();
          setTimeout(() => AGC.shell.toast(`Mapping published. ${res.affected} ${U.plural(res.affected, "person", "people")} re-attributed${res.switched ? `; business groups now derive from ${U.esc(attrLabel(D.mapping.sourceAttribute))}` : ""}.`, "success"), 30);
        });
      } });
  };
})();
