/* Settings › Business Groups (Version 1). The Administrator defines the groups the module organizes around and names who is
   accountable for each. People reach a group only through Business Group Mapping; this page never assigns anyone directly. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  const P = AGC.pages.settings;

  function statusCell(g) {
    if (g.state !== "Inactive") return `<span class="pill pill-ok">${I.checkCircle}<span>Active</span></span>`;
    return `<span class="pill pill-muted">${I.pause}<span>Inactive</span></span>${g.deactivation ? `<div class="small muted">Deactivated ${U.fmtDate(g.deactivation.date)}</div>` : ""}`;
  }
  function ownerCell(m) {
    if (!m) return '<span class="danger-text">No owner</span>';
    return `<div class="owner-cell">${U.avatar(m, "sm")}<div><div>${U.esc(m.displayName)}${U.statusTag(m)}</div><div class="small muted">${U.esc(m.jobTitle || "")}</div></div></div>`;
  }
  /* The mapping attribute's own name (Department for Brookhaven), as the group Overview card and the People grid use it (Gabriel, 2026-10-01:
     "Attribute values" meant nothing to him as a column name). */
  const attrLabel = () => S.attributeOption(AGC.data.mapping.sourceAttribute).label;
  const attrPlural = () => `${attrLabel()}s`;
  const attrLower = () => attrLabel().toLowerCase();
  /* The governance record in plain words, the AI Systems wording of 2026-10-01: what refers to the group, then the consequence once. */
  function historyLine(g) {
    const h = S.groupHistory(g);
    if (!h.hasHistory) return `<span class="ok-text">${I.checkCircle} No governance record yet: no members, interactions, findings or AI assets refer to this group. It can still be deleted.</span>`;
    const parts = [];
    if (h.members) parts.push(`${U.fmtNum(h.members)} ${U.plural(h.members, "member")}`);
    if (h.interactions) parts.push(`${U.fmtNum(h.interactions)} archived ${U.plural(h.interactions, "interaction")}`);
    if (h.findings) parts.push(`${U.fmtNum(h.findings)} ${U.plural(h.findings, "finding")}`);
    if (h.systems) parts.push(`${U.fmtNum(h.systems)} AI ${U.plural(h.systems, "asset")}`);
    if (!parts.length) parts.push("past governance decisions on it");
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
    return `<span>${I.lock} Governance record: ${list}. A business group with a governance record can be deactivated but not deleted, so the record stays available to an auditor.</span>`;
  }
  function valuesChips(g) {
    const rows = S.groupMappedValues(g.id);
    if (!rows.length) return `<span class="muted">None mapped yet.</span> <a href="#/settings/mapping" data-modal-close>Map ${U.esc(attrPlural().toLowerCase())}</a>`;
    return rows.map((r) => `<span class="chip chip-muted" title="${r.memberCount} ${U.plural(r.memberCount, "member")}">${U.esc(r.rawValue)}</span>`).join(" ");
  }

  function row(g) {
    const owner = S.member(g.ownerMemberId), h = S.groupHistory(g), can = P.canEdit("groups");
    const members = (S.membersByGroup[g.id] || []).filter((m) => m.memberStatus === "Active").length;
    const mapped = S.groupMappedValues(g.id);
    const item = (action, icon, label, o) => P.menuItem(Object.assign({ attr: "data-bg-action", action, id: g.id, icon, label }, o || {}));
    const menu = [item("view", "coverage", "View")];
    if (can) {
      menu.push(item("edit", "settings", "Edit"));
      if (g.state === "Inactive") menu.push(item("activate", "checkCircle", "Activate"));
      else menu.push(item("deactivate", "pause", "Deactivate", { disabledReason: S.groupDeactivateBlock(g) }));
      menu.push(item("delete", "retire", "Delete", { cls: "menu-danger", disabledReason: h.hasHistory ? "Has a governance record; deactivate instead." : null }));
    }
    const valuesCell = mapped.length ? String(mapped.length) : (g.state === "Inactive" ? "—" : `<span class="danger-text" title="No ${U.esc(attrLower())} is mapped to this group, so nobody is attributed to it">0</span>`);
    return `<tr class="${g.state === "Inactive" ? "row-inactive" : ""}">
      <td><div class="bg-name"><span class="type-ic bg-code" title="Group code">${U.esc(g.code || "")}</span><div><span class="strong">${U.esc(g.name)}</span>${g.description ? `<div class="small muted">${U.esc(g.description)}</div>` : ""}</div></div></td>
      <td>${ownerCell(owner)}</td>
      <td class="num">${U.fmtNum(members)}</td>
      <td class="num" title="${U.esc(mapped.map((r) => r.rawValue).join(", "))}">${valuesCell}</td>
      <td>${statusCell(g)}</td>
      <td class="groups-grid-actions-cell"><div class="group-card-actions group-card-actions--grid"><button type="button" class="group-card-actions-btn" data-menu-toggle="${g.id}" aria-haspopup="true">Actions <span class="group-card-actions-caret">&#9660;</span></button><div class="group-card-actions-menu menu-pop" id="menu-actions-${g.id}" role="menu" hidden>${menu.join("")}</div></div></td>
    </tr>`;
  }

  P.sections.groups = {
    render() {
      const all = S.groupsOrdered(true);
      const active = all.filter((g) => g.state !== "Inactive");
      const rows = active.concat(all.filter((g) => g.state === "Inactive"));
      const unmapped = active.filter((g) => !S.groupMappedValues(g.id).length);
      const table = rows.length
        ? `<div class="tbl-wrap"><table class="tbl tbl-bgroups"><thead><tr><th>Business group</th><th>Accountable owner</th><th class="num">Members</th><th class="num">${U.esc(attrPlural())}</th><th>Status</th><th class="groups-grid-actions-header" style="text-align:right">Actions</th></tr></thead><tbody>${rows.map(row).join("")}</tbody></table></div>`
        : `<div class="empty-state"><div class="empty-title">No business groups yet</div><div class="empty-sub">Two ways to start: add the first group here, or open <a href="#/settings/mapping">Business Group Mapping</a> and create groups from the ${U.esc(attrPlural().toLowerCase())} the identity source reports.</div></div>`;
      return `<div class="page-head"><p class="lead lead-wide">A Business Group is the primary way the platform organizes and governs AI activity. Administrators create Business Groups based on how their organization is structured and map departments to the appropriate group. Members are assigned to a Business Group through <a href="#/settings/mapping">Business Group Mapping</a> based on their department. Each Business Group should also have an accountable owner responsible for its governance.</p>${AGC.shell.permButton("settings", {}, `${I.groups} Add business group`, 'data-bg-action="add"', "btn-primary")}</div>
        ${unmapped.length ? `<div class="notice notice-warn">${I.alert}<span><strong>${unmapped.length} active ${U.plural(unmapped.length, "group has", "groups have")} no ${U.esc(attrLower())} mapped:</strong> ${unmapped.map((g) => U.esc(g.name)).join(", ")}. Nobody is attributed to ${unmapped.length === 1 ? "it" : "them"} until a ${U.esc(attrLower())} is mapped to ${unmapped.length === 1 ? "it" : "them"} on Business Group Mapping.</span><a class="btn btn-sm" href="#/settings/mapping">Open mapping</a></div>` : ""}
        ${C.card(`Business groups <span class="count-badge">${active.length}</span>${all.length > active.length ? ` <span class="small muted">· ${all.length - active.length} inactive</span>` : ""}`, table)}
        <p class="small muted">Ownership never grants content access; reviewers see a group's activity only through their Entitlement Policy. A business group with a governance record can be deactivated but never deleted.</p>`;
    },
    after(root) {
      /* Opened from a group page with ?edit=<group>: the Edit form opens on that group at once, and Save or Cancel returns there
         (Gabriel, 2026-09-25: the card said the owner was terminated and offered no way to fix it). */
      const q = {}; (location.hash.split("?")[1] || "").split("&").forEach((kv) => { const [k, v] = kv.split("="); if (k) q[decodeURIComponent(k)] = decodeURIComponent(v || ""); });
      if (q.edit) { const g = S.group(q.edit); history.replaceState(null, "", location.hash.split("?")[0]); if (g) setTimeout(() => P.groupForm(g, { returnTo: `#/groups/${g.id}`, onCancel: () => AGC.router.navigate(`#/groups/${g.id}`) }), 0); }
      root.querySelectorAll("[data-bg-action]").forEach((b) => b.addEventListener("click", () => {
        const act = b.dataset.bgAction, g = b.dataset.id ? S.group(b.dataset.id) : null;
        AGC.shell.closeMenus();
        if (act === "add") P.groupForm(null);
        else if (act === "view") P.viewGroup(g);
        else if (act === "edit") P.groupForm(g);
        else if (act === "deactivate") P.deactivateGroup(g);
        else if (act === "activate") P.activateGroup(g);
        else if (act === "delete") P.deleteGroup(g);
      }));
    },
  };

  P.viewGroup = function (g) {
    const owner = S.member(g.ownerMemberId), st = S.groupStats(g.id), rd = S.groupReadiness(g), created = S.member(g.createdByMemberId);
    C.modal({ title: U.esc(g.name), size: "modal-lg", body: `
      <dl class="kv kv-wide">
        ${g.description ? `<dt>Description</dt><dd>${U.esc(g.description)}</dd>` : ""}
        <dt>Accountable owner</dt><dd>${ownerCell(owner)}</dd>
        <dt>Status</dt><dd>${statusCell(g)}${g.deactivation ? `<div class="small muted">Reason: ${U.esc(g.deactivation.reason)}</div>` : ""}</dd>
        <dt>Readiness</dt><dd>${rd.ready ? `<span class="pill pill-ok">${I.checkCircle}<span>Ready</span></span>` : `<span class="pill pill-danger">${I.alert}<span>Not ready</span></span> <span class="small">${U.esc(rd.gaps.map((x) => x.text).join(" · "))}</span>`} <a href="#/groups/${g.id}" data-modal-close>Open the group page</a></dd>
        <dt>${U.esc(attrPlural())}</dt><dd>${valuesChips(g)}</dd>
        <dt>Members</dt><dd>${U.fmtNum(st.activeMembers)} active${(function () { const b = U.statusBreakdown(S.membersByGroup[g.id] || [], { skipActive: true }); return b ? ` · ${b}` : ""; })()}</dd>
        <dt>AI systems</dt><dd>${U.fmtNum(st.systems)}</dd>
        <dt>Findings</dt><dd>${U.fmtNum(st.findings)}${st.awaiting ? ` · ${st.awaiting} awaiting review` : ""}</dd>
        <dt>Created</dt><dd>${g.createdDate ? U.fmtDate(g.createdDate) : "—"}${created ? ` by ${U.esc(created.displayName)}` : ""}</dd>
      </dl>
      <div class="notice ${S.groupHistory(g).hasHistory ? "notice-info" : "notice-ok"}">${historyLine(g)}</div>
      <h4 class="sub-title">History</h4>
      <ul class="history-list">${(g.history || []).slice().reverse().map((h) => `<li><span class="hist-date">${U.fmtDate(h.date)}</span><span class="hist-action">${U.esc(h.action)}</span><span class="hist-detail">${U.esc(h.detail || "")}${h.actorMemberId && S.member(h.actorMemberId) ? ` <span class="muted">· ${U.esc(S.member(h.actorMemberId).displayName)}</span>` : ""}</span></li>`).join("") || '<li><span class="muted">No history recorded.</span></li>'}</ul>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Close</button>` });
  };

  /* Add and Edit share one form: name, description, accountable owner. Also opened from the Business Group Mapping picker,
     where opts.rawValue seeds the name and suggests the owner (the manager most of that value's members report to). */
  P.groupForm = function (existing, opts) {
    const o = opts || {}, editing = !!existing;
    let suggested = "", suggestNote = "";
    if (!editing && o.rawValue) {
      const members = D.members.filter((m) => m.department === o.rawValue);
      const top = Object.entries(U.countBy(members.filter((m) => m.managerMemberId), "managerMemberId")).sort((a, b) => b[1] - a[1])[0];
      if (top && S.member(top[0])) { suggested = top[0]; suggestNote = `Suggested: ${U.esc(S.member(top[0]).displayName)}, manager of ${top[1]} of the ${members.length} members carrying "${U.esc(o.rawValue)}". `; }
    }
    const nameGuess = !editing && o.rawValue ? o.rawValue.replace(/\s*(Dept|Department)\s*$/i, "").trim() : "";
    let picker, saved = false;
    C.modal({ title: editing ? `Edit ${U.esc(existing.name)}` : "Add business group", size: "modal-lg", body: `
        ${editing ? "" : `<p class="small muted">The Business Group is created as soon as you save it. Its registration is then submitted with a Pending status for approval. Members are automatically assigned to the Business Group when their ${U.esc(attrLower())} is mapped to it on the Business Group Mapping page.</p>`}
        ${C.field("Group name", `<input class="inp" name="name" value="${U.esc(editing ? existing.name : nameGuess)}" placeholder="For example Mortgage Servicing"/>`, "Unique across all groups, active or inactive.")}
        ${C.field("Description", `<textarea class="inp" name="description" rows="2" placeholder="Optional. What this part of the business does.">${U.esc(editing ? existing.description || "" : "")}</textarea>`)}
        ${C.field("Accountable owner", C.memberPicker("bgOwner", { value: editing ? existing.ownerMemberId : suggested }), `${suggestNote}Required. Receives the group's digest and answers for its remediations. Ownership never grants content access.`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="bg-save">${I.check} ${editing ? "Save changes" : "Create business group"}</button>`,
      onOpen(wrap) {
        picker = C.bindMemberPicker(wrap, "bgOwner");
        wrap.querySelector("[data-action='bg-save']").addEventListener("click", () => {
          const name = wrap.querySelector("input[name='name']").value.trim(), description = wrap.querySelector("textarea[name='description']").value.trim(), ownerId = picker.value();
          if (!name) { AGC.shell.toast("Give the group a name.", "warn"); return; }
          if (D.groups.some((g) => g.name.toLowerCase() === name.toLowerCase() && (!existing || g.id !== existing.id))) { AGC.shell.toast(`A group named ${name} already exists${o.rawValue ? "; map the value to it instead" : ""}.`, "warn"); return; }
          if (!ownerId) { AGC.shell.toast("Choose an accountable owner.", "warn"); return; }
          saved = true;
          if (editing) {
            const res = S.updateGroup(existing.id, { name, description, ownerMemberId: ownerId });
            C.closeModal(); if (o.returnTo) AGC.router.navigate(o.returnTo); else AGC.router.refresh();
            setTimeout(() => AGC.shell.toast(res.changes.length ? `${U.esc(name)} updated: ${U.esc(res.changes.join("; "))}. Recorded in Audit History.` : "Nothing changed.", res.changes.length ? "success" : "info"), 30);
          } else {
            const g = S.addGroup({ name, description, ownerMemberId: ownerId, source: o.rawValue ? `Business group created from the ${attrLower()} "${o.rawValue}" on the Business Group Mapping page; registration submitted for approval.` : "Business group created on the Business Groups page; registration submitted for approval." });
            C.closeModal();
            if (o.onCreate) o.onCreate(g); else AGC.router.refresh();
            setTimeout(() => AGC.shell.toast(`${U.esc(g.name)} created and its registration submitted as Pending.${o.rawValue ? "" : ` Map its ${U.esc(attrPlural().toLowerCase())} on Business Group Mapping so members are attributed.`}`, "success"), 30);
          }
        });
        if (o.onCancel) wrap.addEventListener("click", (e) => { if (!saved && (e.target === wrap || e.target.closest("[data-modal-close]"))) o.onCancel(); });
      } });
  };

  P.deactivateGroup = function (g) {
    const block = S.groupDeactivateBlock(g);
    if (block) { AGC.shell.toast(block, "warn"); return; }
    const st = S.groupStats(g.id);
    C.modal({ title: `Deactivate ${U.esc(g.name)}`, body: `<p>The group leaves the Groups tab, pickers and digests. Its attribution history, ${U.fmtNum(st.findings)} ${U.plural(st.findings, "finding")} and audit events stay readable, and it can be reactivated later.</p>${C.field("Reason", `<textarea class="inp" name="reason" rows="2" placeholder="Required. Shown in the group history and Audit History."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-deactivate">${I.pause} Deactivate</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='do-deactivate']").addEventListener("click", () => { const reason = wrap.querySelector("textarea[name='reason']").value.trim(); if (!reason) { AGC.shell.toast("A reason is required.", "warn"); return; } S.setGroupState(g.id, "Inactive", reason); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(g.name)} deactivated. Recorded in Audit History.`, "success"), 30); }); } });
  };
  P.activateGroup = function (g) {
    C.modal({ title: `Activate ${U.esc(g.name)}`, body: `<p>The group returns to the Groups tab, pickers and digests. Map ${U.esc(attrPlural().toLowerCase())} to it on the Business Group Mapping page so members are attributed again.</p>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-activate">${I.checkCircle} Activate</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='do-activate']").addEventListener("click", () => { S.setGroupState(g.id, "Active"); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(g.name)} activated.`, "success"), 30); }); } });
  };
  P.deleteGroup = function (g) {
    if (S.groupHistory(g).hasHistory) { AGC.shell.toast("This group has governance history and cannot be deleted. Deactivate it instead.", "warn"); return; }
    C.modal({ title: `Delete ${U.esc(g.name)}`, body: `<div class="notice notice-ok">${historyLine(g)}</div><p>Deleting removes the group and its Pending registration. Nothing else references it, so there is nothing to preserve.</p>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary btn-danger" data-action="do-delete">${I.retire} Delete group</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='do-delete']").addEventListener("click", () => { S.deleteGroup(g.id); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(g.name)} deleted.`, "success"), 30); }); } });
  };
})();
