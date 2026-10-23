/* Settings › AI Systems (Version 1; the page was called AI Platform Instances until 2026-09-21, and the code keeps "instance" in its names).
   One AI system is one AI platform environment, or one custom application, mapped to one record class.
   Connectors, credentials and schedules live in the collection module; this page only records what exists and where its data is. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  const P = AGC.pages.settings;

  function statusCell(inst) {
    if (inst.status === "Active") return `<span class="pill pill-ok">${I.checkCircle}<span>Active</span></span>`;
    const sub = inst.deactivation ? `Deactivated ${U.fmtDate(inst.deactivation.date)}` : "Never activated";
    return `<span class="pill pill-muted">${I.pause}<span>Inactive</span></span><div class="small muted">${sub}</div>`;
  }
  function typeIcon(type) {
    const map = { "ChatGPT Enterprise": "CG", "Claude Enterprise": "CL", "Microsoft 365 Copilot": "MS", "Custom AI application": "API" };
    return `<span class="type-ic" title="${U.esc(type)}">${map[type] || "AI"}</span>`;
  }
  function archiveSummary(rc) {
    if (!rc) return "";
    const a = rc.archive || { items: 0, firstItem: null, lastItem: null, users: 0, gpts: 0, projects: 0, workspaces: [] };
    const items = [["Items archived", U.fmtNum(a.items)], ["Earliest interaction", a.firstItem ? U.fmtDate(a.firstItem) : "—"], ["Latest interaction", a.lastItem ? U.fmtDate(a.lastItem) : "—"], ["Distinct users", U.fmtNum(a.users)]];
    if (a.gpts || a.projects || a.plugins) items.push(["GPTs / Projects / Plugins", `${U.fmtNum(a.gpts)} / ${U.fmtNum(a.projects)} / ${U.fmtNum(a.plugins || 0)}`]);
    return `<div class="verify">
      <div class="verify-title">${I.checkCircle}<span>What Archive360 holds in <strong>${U.esc(rc.name)}</strong></span></div>
      <div class="summary-grid">${items.map(([l, v]) => `<div class="sg-item"><div class="sg-val">${v}</div><div class="sg-label">${U.esc(l)}</div></div>`).join("")}</div>
      ${a.workspaces && a.workspaces.length ? `<div class="small verify-ws"><span class="kv-label">Workspaces discovered</span> ${a.workspaces.map((w) => `<span class="chip chip-muted">${U.esc(w)}</span>`).join(" ")}</div>` : `<div class="small muted verify-ws">This platform's metadata carries no workspaces.</div>`}
      ${a.items === 0 ? `<div class="notice notice-info">${I.info}<span>No items archived yet. The AI system can still be added; governance begins as items arrive.</span></div>` : ""}
    </div>`;
  }
  /* The not-archived decision in one line: who decided, when, and why (Gabriel, 2026-10-01: a required reason, shown beside the fact). */
  function notArchivedLine(inst) {
    const na = inst.notArchived || {}, by = S.member(na.byMemberId);
    return `Not archived by decision${by ? ` of ${U.esc(by.displayName)}` : ""}${na.date ? ` on ${U.fmtDate(na.date)}` : ""}${na.reason ? `: ${U.esc(na.reason)}` : "."}`;
  }
  P.notArchivedLine = notArchivedLine;
  /* The governance record in plain words (Gabriel, 2026-10-01: "1 registration decision references this AI system" meant nothing to him).
     It names what happened, then says the consequence once: an AI system with a record is deactivated, never deleted. */
  function historyLine(inst) {
    const h = S.instanceHistory(inst), e = S.instanceEntry(inst);
    const andJoin = (arr) => (arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`);
    if (!h.hasHistory) return `<span class="ok-text">${I.checkCircle} No governance record yet: its registration ${e ? (e.status === "Pending" ? "is awaiting approval" : "has no decision yet") : "does not exist"} and no finding refers to it. It can still be deleted.</span>`;
    const parts = [];
    if (h.interactions) {
      const sub = [];
      if (h.findings) sub.push(`${U.fmtNum(h.findings)} ${U.plural(h.findings, "finding")}`);
      if (h.decisions) sub.push(`${U.fmtNum(h.decisions)} reviewer ${U.plural(h.decisions, "decision")}`);
      if (h.escalations) sub.push(`${U.fmtNum(h.escalations)} ${U.plural(h.escalations, "escalation")}`);
      parts.push(`${U.fmtNum(h.interactions)} archived ${U.plural(h.interactions, "interaction")}${sub.length ? ` with ${andJoin(sub)}` : ""}`);
    }
    if (e && h.registerDecisions) {
      const by = S.member(e.approvedByMemberId);
      let reg;
      if (e.approvedDate) reg = `its registration was approved${by ? ` by ${U.esc(by.displayName)}` : ""} on ${U.fmtDate(e.approvedDate)}`;
      else { const last = e.decisionHistory.filter((d) => d.action !== "Registered").slice(-1)[0]; reg = `its registration was ${U.esc((last.action || "decided").toLowerCase())} on ${U.fmtDate(last.date)}`; }
      if (e.lastReconfirmedDate) reg += `, last reconfirmed ${U.fmtDate(e.lastReconfirmedDate)}`;
      if (e.status === "Suspended") reg += ", and is suspended"; else if (e.status === "Expired") reg += ", and has expired"; else if (e.status === "Retired") reg += ", and was retired";
      parts.push(reg);
    }
    return `<span>${I.lock} Governance record: ${parts.join(", and ")}. An AI system with a governance record can be deactivated but not deleted, so the record stays available to an auditor.</span>`;
  }

  function approvalCell(inst) {
    const e = S.instanceEntry(inst);
    if (!e) return '<span class="muted">Not registered</span>';
    const due = e.reconfirmationDueDate ? `<div class="small muted">Reconfirmation due ${U.fmtDate(e.reconfirmationDueDate)}</div>` : (e.status === "Pending" ? '<div class="small muted">Awaiting an approver</div>' : "");
    return `${U.statusPill(e.status)}${due}`;
  }
  function row(inst) {
    const rc = S.recordClass(inst.recordClassId), a = S.instanceArchive(inst), h = S.instanceHistory(inst), can = P.canEdit("instances");
    const item = (action, icon, label, o) => P.menuItem(Object.assign({ attr: "data-inst-action", action, id: inst.id, icon, label }, o || {}));
    const menu = [item("view", "coverage", "View")];
    if (can) {
      menu.push(item("edit", "settings", "Edit"));
      menu.push(inst.status === "Active" ? item("deactivate", "pause", "Deactivate") : item("activate", "checkCircle", "Activate"));
      menu.push(item("delete", "retire", "Delete", { cls: "menu-danger", disabledReason: h.hasHistory ? "Has a governance record; deactivate instead." : null }));
    }
    return `<tr>
      <td><div class="inst-name">${typeIcon(inst.platformType)}<div><span class="strong">${U.esc(inst.name)}</span><div class="small muted">${[inst.platformType !== inst.name ? U.esc(inst.platformType) : "", inst.externalIdentifier ? `<code>${U.esc(inst.externalIdentifier)}</code>` : ""].filter(Boolean).join(" · ")}</div></div></div></td>
      <td>${P.ownerCell(S.member(inst.ownerMemberId))}</td>
      <td class="small">${rc ? U.esc(rc.name) : (inst.notArchived ? '<span class="warn-text">None · not archived</span>' : '<span class="danger-text">Unmapped</span>')}</td>
      <td>${statusCell(inst)}</td>
      <td class="num">${U.fmtNum(a.items)}</td>
      <td class="small">${a.lastItem ? U.relTime(a.lastItem) : '<span class="muted">None yet</span>'}</td>
      <td class="groups-grid-actions-cell"><div class="group-card-actions group-card-actions--grid"><button type="button" class="group-card-actions-btn" data-menu-toggle="${inst.id}" aria-haspopup="true">Actions <span class="group-card-actions-caret">&#9660;</span></button><div class="group-card-actions-menu menu-pop" id="menu-actions-${inst.id}" role="menu" hidden>${menu.join("")}</div></div></td>
    </tr>`;
  }

  P.sections.instances = {
    render() {
      const rows = S.instancesOrdered();
      const table = rows.length ? `<div class="tbl-wrap"><table class="tbl tbl-instances"><thead><tr><th>AI system</th><th>Accountable owner</th><th>Record class</th><th>Status</th><th class="num">Items archived</th><th>Last item</th><th class="groups-grid-actions-header" style="text-align:right">Actions</th></tr></thead><tbody>${rows.map(row).join("")}</tbody></table></div>`
        : C.emptyState("No AI systems yet", "Add the first AI system to begin. Nothing can be governed until an archived environment is mapped to its record class.");
      return `<div class="page-head"><p class="lead lead-wide">An AI system is an AI platform, such as ChatGPT Enterprise or Claude, or a custom application that allows users to submit AI prompts and receive AI-generated responses. Registering an AI system identifies its purpose, assigns an accountable owner, and maps its archived interactions to the appropriate record class. New AI systems enter a Pending Approval status and are reviewed through the AI Registry. Owners must also reconfirm approved systems when their review is due.</p>${AGC.shell.permButton("settings", {}, `${I.platform} Add AI system`, 'data-inst-action="add"', "btn-primary")}</div>
        ${C.card("", table)}
        <p class="small muted">Record classes and their metadata must be created in Archive360 before an AI system's interactions can be archived. Active indicates that the AI system is currently in use and, where a record class is associated, collecting data. Inactive indicates that the AI system is no longer in use or collecting data.</p>`;
    },
    after(root) {
      root.querySelectorAll("[data-inst-action]").forEach((b) => b.addEventListener("click", () => {
        const act = b.dataset.instAction, inst = b.dataset.id ? S.instance(b.dataset.id) : null;
        AGC.shell.closeMenus();
        if (act === "add") P.instanceWizard(null);
        else if (act === "view") P.viewInstance(inst);
        else if (act === "edit") P.instanceWizard(inst);
        else if (act === "deactivate") P.deactivateInstance(inst);
        else if (act === "activate") P.activateInstance(inst);
        else if (act === "delete") P.deleteInstance(inst);
      }));
    },
  };

  P.viewInstance = function (inst) {
    const rc = S.recordClass(inst.recordClassId), e = S.instanceEntry(inst);
    const added = S.member(inst.addedByMemberId);
    C.modal({ title: U.esc(inst.name), size: "modal-lg", body: `
      <dl class="kv kv-wide">
        <dt>Type</dt><dd>${U.esc(inst.platformType)}</dd>
        <dt>Accountable owner</dt><dd>${P.ownerCell(S.member(inst.ownerMemberId))}<div class="small muted">${inst.platformType === "Custom AI application" ? "Answers for this AI system" : "Owns the vendor relationship"}; reconfirms the approval when it comes due. Ownership never grants content access.</div></dd>
        <dt>Approved purpose</dt><dd>${U.esc(inst.approvedPurpose || "")}</dd>
        <dt>Approval</dt><dd>${approvalCell(inst)}${e ? `<div class="small muted">Registered ${U.fmtDate(e.registeredDate)}${e.approvedDate ? ` · approved ${U.fmtDate(e.approvedDate)} by ${U.esc(S.member(e.approvedByMemberId) ? S.member(e.approvedByMemberId).displayName : "")}` : ""}${e.lastReconfirmedDate ? ` · last reconfirmed ${U.fmtDate(e.lastReconfirmedDate)}` : ""}. Decided on the AI Registry.</div>` : ""}</dd>
        <dt>Record class</dt><dd>${rc ? U.esc(rc.name) : (inst.notArchived ? '<span class="warn-text">None · not archived</span>' : "Unmapped")}${rc && rc.description ? `<div class="small muted">${U.esc(rc.description)}</div>` : ""}${!rc && inst.notArchived ? `<div class="small muted">${notArchivedLine(inst)} Edit the AI system to associate a record class if its interactions are to be archived.</div>` : ""}</dd>${(inst.apiAccess || []).length ? `<dt>API access</dt><dd>${inst.apiAccess.map((k) => `<div><code>${U.esc(k.redacted || "")}</code> ${U.esc(k.name)} · ${U.esc(k.provider || "")} · ${U.esc(k.projectName || "")}<div class="small muted">last used ${U.fmtDate(k.lastUsed)} · ${U.fmtNum(k.requests30d || 0)} requests in 30 days · claimed ${U.fmtDate(k.claimedDate)}</div></div>`).join("")}</dd>` : ""}
        <dt>Status</dt><dd>${statusCell(inst)}${inst.deactivation ? `<div class="small muted">Reason: ${U.esc(inst.deactivation.reason)}</div>` : ""}</dd>
        <dt>Environment identifier</dt><dd>${inst.externalIdentifier ? `<code>${U.esc(inst.externalIdentifier)}</code>` : (inst.recordClassId ? '<span class="muted">Read from the archive when items arrive</span>' : '<span class="muted">None: nothing is archived for it</span>')}</dd>
        <dt>Added</dt><dd>${U.fmtDate(inst.addedDate)}${added ? ` by ${U.esc(added.displayName)}` : ""}</dd>
      </dl>
      ${archiveSummary(rc)}
      <div class="notice ${S.instanceHistory(inst).hasHistory ? "notice-info" : "notice-ok"}">${historyLine(inst)}</div>
      <h4 class="sub-title">History</h4>
      <ul class="history-list">${inst.history.slice().reverse().map((h) => `<li><span class="hist-date">${U.fmtDate(h.date)}</span><span class="hist-action">${U.esc(h.action)}</span><span class="hist-detail">${U.esc(h.detail || "")}${h.actorMemberId && S.member(h.actorMemberId) ? ` <span class="muted">· ${U.esc(S.member(h.actorMemberId).displayName)}</span>` : ""}</span></li>`).join("")}</ul>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Close</button>` });
  };

  /* Add and Edit share one three-step wizard: Details, Record class, Summary and Commit. */
  P.instanceWizard = function (existing, prefill) {
    const pf = prefill || {};
    const editing = !!existing;
    /* Two locks (Gabriel, 2026-10-01). The type is locked once governance history exists. The record class is locked only once one is
       associated and history exists, because archived interactions and findings hang off it; associating a record class where there was
       none is always allowed, so an AI system registered without archiving can start archiving later by Edit. Dropping a record class is
       not an Edit here: stopping collection is done in Archive360 Administration, and the module shows the AI system as Inactive. */
    const typeLocked = editing && S.instanceHistory(existing).hasHistory;
    const locked = typeLocked && !!existing.recordClassId;
    const st = { step: 1, name: existing ? existing.name : (pf.name || ""), platformType: existing ? existing.platformType : (pf.platformType || D.platformTypes[0]), ownerMemberId: existing ? existing.ownerMemberId || "" : (pf.ownerMemberId || ""), approvedPurpose: existing ? existing.approvedPurpose || "" : (pf.approvedPurpose || ""), cadence: existing ? existing.reconfirmationIntervalMonths || D.settings.reconfirmation.intervalMonths : D.settings.reconfirmation.intervalMonths, recordClassId: existing ? existing.recordClassId : "", activate: existing ? existing.status === "Active" : true };
    st.noArchive = existing ? !existing.recordClassId : !!pf.noArchive;
    st.noArchiveReason = existing && existing.notArchived ? existing.notArchived.reason || "" : "";
    if (!existing && pf.recordClassId) st.recordClassId = pf.recordClassId;
    st.externalIdentifier = existing ? existing.externalIdentifier || null : (pf.externalIdentifier || null);
    st.apiAccess = pf.apiAccess || null;
    const steps = ["Details", "Record class", "Summary and Commit"];
    const stepsHtml = () => `<ol class="wizard-steps">${steps.map((s, i) => `<li class="wstep${st.step === i + 1 ? " active" : st.step > i + 1 ? " done" : ""}"><span class="wstep-num">${st.step > i + 1 ? I.check : i + 1}</span><span>Step ${i + 1}. ${s}</span></li>`).join("")}</ol>`;
    const rcList = () => D.recordClasses.map((rc) => {
      const claim = S.recordClassClaim(rc.id);
      const claimedByOther = claim && (!existing || claim.id !== existing.id);
      const a = rc.archive || { items: 0 };
      return `<label class="rc-item${claimedByOther ? " rc-claimed" : ""}${st.recordClassId === rc.id ? " selected" : ""}"><input type="radio" name="rc" value="${rc.id}" ${st.recordClassId === rc.id ? "checked" : ""} ${claimedByOther || locked ? "disabled" : ""}/><span class="rc-body"><span class="strong">${U.esc(rc.name)}</span><span class="small muted">${U.esc(rc.description || "")}</span><span class="small">${U.fmtNum(a.items)} items archived${a.lastItem ? ` · latest ${U.fmtDate(a.lastItem)}` : ""}${claimedByOther ? ` · <span class="danger-text">claimed by ${U.esc(claim.name)}</span>` : ""}</span></span></label>`;
    }).join("");
    const body = () => {
      if (st.step === 1) return `${stepsHtml()}<div class="form-grid">${C.field("AI system name", `<input class="inp" name="name" value="${U.esc(st.name)}" placeholder="For example ChatGPT Enterprise, an acquired company's environment, or a custom application"/>`, "Unique across AI systems.")}${C.field("Type", C.select("platformType", D.platformTypes.map((t) => ({ value: t, label: t })), st.platformType, typeLocked ? "disabled" : ""), typeLocked ? "Locked: this AI system has a governance record." : "An AI platform the collection module can collect, or a custom AI application.")}</div>${C.field("Accountable owner", C.memberPicker("instOwner", { value: st.ownerMemberId }), pf.ownerHelp || "Required. Answers for this AI system, owns any vendor relationship, and reconfirms the approval when it comes due. Ownership never grants content access.")}${C.field("Approved purpose", `<textarea class="inp" name="approvedPurpose" rows="2" placeholder="Required. What this AI system is sanctioned for, for example: enterprise AI assistant for all business groups under the AI acceptable use policy.">${U.esc(st.approvedPurpose)}</textarea>`, "Shown to the approver and on the AI Registry.")}`;
      if (st.step === 2) {
        /* "Not archived" is offered when adding, and when editing an AI system that has no record class; once a record class is associated it
           cannot be dropped here. The reason is required (Gabriel, 2026-10-01): the decision narrows governance, as Exclude from governance does. */
        const offerNone = !editing || !existing.recordClassId;
        const lead = locked ? `<div class="notice notice-info">${I.lock}<span>The record class is locked because this AI system has a governance record (findings, or decisions on its registration). To govern a different record class, add a new AI system.</span></div>`
          : `<p class="small muted">Choose the record class Archive360 already uses for this environment. One record class per AI system; a class claimed by another AI system cannot be chosen.${editing && !existing.recordClassId ? ` ${U.esc(existing.name)} is registered without archiving: choose a record class to start archiving and reviewing its interactions, or leave it as it is.` : ""}</p>`;
        const none = offerNone ? `<label class="rc-item rc-none${st.noArchive ? " selected" : ""}"><input type="radio" name="rc" value="__none__" ${st.noArchive ? "checked" : ""}/><span class="rc-body"><span class="strong">Not archived</span><span class="small muted">Registers the AI system for accountability, with an owner and an approved purpose, without archiving its interactions. Nothing it produces is classified or reviewed. Edit the AI system later to associate a record class if you decide to archive it.</span></span></label>` : "";
        const reason = offerNone ? `<div id="rcReason" ${st.noArchive ? "" : "hidden"}>${C.field("Why its interactions are not archived", `<textarea class="inp" name="noArchiveReason" rows="2" placeholder="Required. For example: a vendor-embedded feature that processes no customer or employee data.">${U.esc(st.noArchiveReason)}</textarea>`, "Shown on the registration and in Audit History, so an examiner finds the decision beside the AI system.")}</div>` : "";
        /* "Not archived" leads the list (Gabriel, 2026-10-01), with its reason directly beneath it, then the record classes. */
        return `${stepsHtml()}${lead}<div class="rc-list">${none}${reason}${rcList()}</div><div id="rcSummary">${st.recordClassId ? archiveSummary(S.recordClass(st.recordClassId)) : ""}</div>`;
      }
      const rc = S.recordClass(st.recordClassId);
      const ownerM = S.member(st.ownerMemberId);
      return `${stepsHtml()}<dl class="kv kv-wide"><dt>AI system name</dt><dd>${U.esc(st.name)}</dd><dt>Type</dt><dd>${U.esc(st.platformType)}</dd><dt>Accountable owner</dt><dd>${ownerM ? U.esc(ownerM.displayName) + ` <span class="muted">· ${U.esc(ownerM.jobTitle || "")}</span>` : '<span class="danger-text">Not chosen</span>'}</dd><dt>Approved purpose</dt><dd>${U.esc(st.approvedPurpose)}</dd><dt>Record class</dt><dd>${rc ? U.esc(rc.name) : (st.noArchive ? `<span class="warn-text">None · not archived</span><div class="small muted">${U.esc(st.noArchiveReason)}</div>` : "")}</dd>${st.externalIdentifier ? `<dt>Identifier</dt><dd><code>${U.esc(st.externalIdentifier)}</code></dd>` : ""}</dl>${rc ? archiveSummary(rc) : ""}${editing && !existing.recordClassId && rc ? `<div class="notice notice-info">${I.info}<span>Saving associates <strong>${U.esc(rc.name)}</strong> with ${U.esc(existing.name)}: its interactions are archived, classified and reviewed from now on. The approval stands; the change goes to the registration's history and to Audit History, and the owner hears in the digest.</span></div>` : ""}<div class="toggle-list">${C.toggle("activate", st.activate, editing ? (st.noArchive ? "AI system is active (in use; its interactions are not archived)" : "AI system is active (governance runs on new items)") : (st.noArchive ? "Activate on save (in use; nothing is collected)" : "Activate on save (governance begins immediately)"))}</div>${editing ? "" : `<div class="notice notice-info">${I.info}<span>Saving registers the AI system as <strong>Pending</strong>. An approver decides on the AI Registry; the owner reconfirms it when the approval comes due.</span></div>`}`;
    };
    const footer = () => `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>${st.step > 1 ? `<button type="button" class="btn btn-secondary" data-wz="back">Back</button>` : ""}${st.step < 3 ? `<button type="button" class="btn btn-primary" data-wz="next">Next</button>` : `<button type="button" class="btn btn-primary" data-wz="save">${I.check} Save and Close</button>`}`;
    const capture = (wrap) => {
      const n = wrap.querySelector("input[name='name']"); if (n) st.name = n.value.trim();
      const t = wrap.querySelector("select[name='platformType']"); if (t) st.platformType = t.value;
      const d = wrap.querySelector("textarea[name='approvedPurpose']"); if (d) st.approvedPurpose = d.value.trim();
      const o = wrap.querySelector("#instOwner [data-mpick-value]"); if (o) st.ownerMemberId = o.value;
      const r = wrap.querySelector("input[name='rc']:checked"); if (r) { st.noArchive = r.value === "__none__"; st.recordClassId = st.noArchive ? "" : r.value; }
      const nr = wrap.querySelector("textarea[name='noArchiveReason']"); if (nr) st.noArchiveReason = nr.value.trim();
      const a = wrap.querySelector("input[name='activate']"); if (a) st.activate = a.checked;
    };
    const validate = () => {
      if (st.step === 1) {
        if (!st.name) return "Give the AI system a name.";
        if (D.instances.some((x) => x.name.toLowerCase() === st.name.toLowerCase() && (!existing || x.id !== existing.id))) return "An AI system with that name already exists.";
        if (!st.ownerMemberId) return "Choose the accountable owner.";
        if (!st.approvedPurpose) return "State the approved purpose.";
      }
      if (st.step === 2 && !st.recordClassId && !st.noArchive) return "Choose the record class that holds this environment's archived interactions, or Not archived.";
      if (st.step === 2 && st.noArchive && !st.noArchiveReason) return "Say why its interactions are not archived.";
      return null;
    };
    const paint = (wrap) => {
      wrap.querySelector(".modal-body").innerHTML = body();
      wrap.querySelector(".modal-foot").innerHTML = footer();
      if (st.step === 1) C.bindMemberPicker(wrap, "instOwner");
      wrap.querySelectorAll("input[name='rc']").forEach((r) => r.addEventListener("change", () => { st.noArchive = r.value === "__none__"; st.recordClassId = st.noArchive ? "" : r.value; wrap.querySelectorAll(".rc-item").forEach((el) => el.classList.toggle("selected", el.querySelector("input").value === r.value)); const rr = wrap.querySelector("#rcReason"); if (rr) rr.hidden = !st.noArchive; wrap.querySelector("#rcSummary").innerHTML = st.noArchive ? "" : archiveSummary(S.recordClass(r.value)); }));
      wrap.querySelectorAll("[data-wz]").forEach((b) => b.addEventListener("click", () => {
        capture(wrap);
        const act = b.dataset.wz;
        if (act === "back") { st.step -= 1; paint(wrap); return; }
        const err = validate();
        if (err) { AGC.shell.toast(err, "warn"); return; }
        if (act === "next") { st.step += 1; paint(wrap); return; }
        if (editing) {
          const wasActive = existing.status === "Active";
          S.updateInstance(existing.id, { name: st.name, ownerMemberId: st.ownerMemberId, approvedPurpose: st.approvedPurpose, platformType: typeLocked ? undefined : st.platformType, recordClassId: locked ? undefined : st.recordClassId, notArchivedReason: st.noArchive ? st.noArchiveReason : undefined });
          if (st.activate !== wasActive) S.setInstanceStatus(existing.id, st.activate ? "Active" : "Inactive", st.activate ? "" : "Deactivated while editing");
          C.closeModal(); AGC.router.refresh();
          setTimeout(() => AGC.shell.toast(`${U.esc(st.name)} updated.`, "success"), 30);
        } else {
          const inst = S.addInstance({ name: st.name, platformType: st.platformType, ownerMemberId: st.ownerMemberId, approvedPurpose: st.approvedPurpose, recordClassId: st.noArchive ? null : st.recordClassId, notArchivedReason: st.noArchive ? st.noArchiveReason : null, externalIdentifier: st.externalIdentifier, apiAccess: st.apiAccess, activate: st.activate });
          C.closeModal();
          if (pf.onCreated) { pf.onCreated(inst); return; }
          AGC.router.refresh();
          setTimeout(() => AGC.shell.toast(`${U.esc(inst.name)} added${inst.status === "Active" ? " and activated" : " (inactive)"} and registered as Pending. Recorded in Audit History.`, "success"), 30);
        }
      }));
      const first = wrap.querySelector(".modal-body input, .modal-body select, .modal-body textarea");
      if (first && !first.disabled) first.focus();
    };
    C.modal({ title: editing ? `Edit ${U.esc(existing.name)}` : "Add AI system", size: "modal-lg", body: "", footer: "", onOpen: paint });
  };

  P.deactivateInstance = function (inst) {
    C.modal({ title: `Deactivate ${U.esc(inst.name)}`, body: `<p>The AI system stops feeding groups, findings and coverage. Its history stays readable, the archived interactions remain in Archive360, and it can be reactivated later.</p>${C.field("Reason", `<textarea class="inp" name="reason" rows="2" placeholder="Required. Shown in the AI system's history and Audit History."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-deactivate">${I.pause} Deactivate</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='do-deactivate']").addEventListener("click", () => { const reason = wrap.querySelector("textarea[name='reason']").value.trim(); if (!reason) { AGC.shell.toast("A reason is required.", "warn"); return; } S.setInstanceStatus(inst.id, "Inactive", reason); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(inst.name)} deactivated.`, "success"), 30); }); } });
  };
  P.activateInstance = function (inst) {
    C.modal({ title: `Activate ${U.esc(inst.name)}`, body: inst.recordClassId ? `<p>Governance begins on new items in <strong>${U.esc((S.recordClass(inst.recordClassId) || {}).name || "its record class")}</strong>: attribution to business groups, classification and rule evaluation. Existing archived items are read as well.</p>` : `<p>The AI system is marked as in use again. Its interactions are not archived, so nothing is collected or reviewed; edit it to associate a record class if that should change.</p>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-activate">${I.checkCircle} Activate</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='do-activate']").addEventListener("click", () => { S.setInstanceStatus(inst.id, "Active"); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(inst.name)} activated.`, "success"), 30); }); } });
  };
  P.deleteInstance = function (inst) {
    const rc = S.recordClass(inst.recordClassId);
    C.modal({ title: `Delete ${U.esc(inst.name)}`, body: `<div class="notice notice-ok">${historyLine(inst)}</div><p>Deleting removes the AI system and its Pending registration.${rc ? ` The archived interactions stay in Archive360 under <strong>${U.esc(rc.name)}</strong> with their retention, and the record class becomes available to another AI system.` : " Nothing was archived for it."}</p>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary btn-danger" data-action="do-delete">${I.retire} Delete AI system</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='do-delete']").addEventListener("click", () => { S.deleteInstance(inst.id); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(inst.name)} deleted. Archived data is untouched.`, "success"), 30); }); } });
  };
})();
