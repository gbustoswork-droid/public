/* Approvals (agreed with Gabriel on 2026-09-25, on four recommendations): the approver's queue on the left, grouped by business group,
   and the item open on the right. Two kinds wait here. An escalated violation, whose response the approver decides: Approve (an AI
   system escalation may be downgraded to conduct on the way), Reject as accepted risk, or Return to reviewer. And an AI system's
   registration, a platform or a custom application, decided through the Registry's own Approve and Reject dialogs, so there is one
   dialog wherever it is opened. Reviewers judge validity on Findings; approvers decide the response here; the verbs never mix. Who
   sees it: approvers and the Administrator. Anyone else who follows a link to an escalation lands on its finding. Tiles are the only
   status filter; j and k move through the queue. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.approvals = {});
  const VIEWS = [["mine", "Awaiting your decision"], ["others", "Awaiting others"], ["decided", "Decided"], ["all", "All"]];
  const WAIT = { mine: "you", others: "others", decided: "decided" };
  const fresh = () => ({ view: "mine", group: "all", kind: "all", search: "", selected: null, collapsed: new Set() });
  let ui = fresh();
  P.ui = () => ui;
  (AGC.personaHooks = AGC.personaHooks || []).push(() => { ui = fresh(); });
  const F = () => AGC.pages.findings, RG = () => AGC.pages.registry;
  const kindName = (s) => (s ? (s.type === "Custom" ? "Custom AI application" : s.type) : "");
  const regKind = (e) => (e.level === "Platform" ? ((S.entryInstance(e) || {}).platformType || "Platform") : "Custom AI application");
  const inView = (it, v) => v === "all" || it.wait === WAIT[v];
  const lastOf = (e, decision) => (e.approvals || []).filter((a) => a.decision === decision).slice(-1)[0] || null;
  const name = (m) => (m ? U.esc(m.displayName) : "");
  const subjectOf = (e) => { const s = e.aiSystemId ? S.system(e.aiSystemId) : null; return s ? s.name : S.groupName(e.groupId); };
  const notAvailable = () => `<div class="placeholder-card"><div class="ph-title">${I.lock} Approvals are not available for your profile</div><div class="ph-body">Deciding escalations and registrations needs a Profile that includes approvals, managed by an Archive360 Administrator. A reviewer follows their escalations on Findings; an accountable owner follows a remediation on their group's page.</div></div>`;

  /* ---------- The queue ---------- */
  const words = (it) => {
    if (it.kind === "escalation") { const f = it.finding, m = f ? S.member(f.memberId) : null, s = it.aiSystemId ? S.system(it.aiSystemId) : null, r = f ? S.rule(f.ruleId) : null; return `${r ? r.name : ""} ${s ? s.name : "direct chat"} ${m ? m.displayName : ""} ${it.escalation.target} ${it.groupId ? S.groupName(it.groupId) : ""} ${it.escalation.status} ${it.severity || ""}`; }
    const e = it.entry, o = S.member(e.ownerMemberId); return `${e.name} ${regKind(e)} ${o ? o.displayName : ""} registration ${it.groupId ? S.groupName(it.groupId) : "all groups"} ${e.status}`;
  };
  function matches(it) {
    if (!inView(it, ui.view)) return false;
    if (ui.group !== "all" && (it.groupId || "none") !== ui.group) return false;
    if (ui.kind !== "all" && it.kind !== ui.kind) return false;
    if (ui.search && !words(it).toLowerCase().includes(ui.search.toLowerCase())) return false;
    return true;
  }
  /* Waiting items oldest first, so nothing waits unseen; decided ones newest first. */
  const order = (a, b) => (ui.view === "decided" ? (b.decidedAt || "").localeCompare(a.decidedAt || "") : (a.requestedAt || "").localeCompare(b.requestedAt || ""));
  const waitIc = (it) => (it.wait !== "others" ? "" : it.escalation && it.escalation.status === "Returned" ? `<span class="tag tag-pending" title="Returned to the reviewer; it comes back when they revise it">Returned</span>` : `<span class="tree-ic" title="${U.esc(it.reason || "Waiting for someone else")}">${I.lock}</span>`);
  function rowHtml(it) {
    const sel = ui.selected === it.id ? " selected" : "";
    if (it.kind === "escalation") {
      const e = it.escalation, f = it.finding, m = f ? S.member(f.memberId) : null, s = it.aiSystemId ? S.system(it.aiSystemId) : null, r = f ? S.rule(f.ruleId) : null;
      const count = e.status === "Open" && e.requiredApprovals > 1 ? `<span class="ap-count small muted" title="Approvals given">${it.given} of ${it.required}</span>` : "";
      return `<li><button type="button" class="tree-leaf fq-row ap-row${sel}" data-ap="${it.id}" aria-pressed="${!!sel}"><span class="fq-sev">${U.sevChip(it.severity)}</span><span class="tree-leaf-main"><span class="tree-leaf-name" title="${U.esc(r ? r.name : "")}">${U.esc(r ? r.name : "")}</span><span class="tree-leaf-sub small muted">${e.target === "Conduct" ? "Conduct" : "AI system"} · ${s ? U.esc(s.name) : "Direct chat"} · ${name(m)} · ${U.esc(U.relTime(e.escalatedAt))}</span></span>${count}${waitIc(it)}</button></li>`;
    }
    const e = it.entry, o = S.member(e.ownerMemberId);
    return `<li><button type="button" class="tree-leaf fq-row ap-row${sel}" data-ap="${it.id}" aria-pressed="${!!sel}"><span class="fq-sev ap-badge">${RG().badge(regKind(e))}</span><span class="tree-leaf-main"><span class="tree-leaf-name" title="${U.esc(e.name)}">${U.esc(e.name)}</span><span class="tree-leaf-sub small muted">Registration · ${U.esc(regKind(e))} · ${o ? name(o) : "no owner"} · ${U.esc(U.relTime(e.registeredDate))}</span></span>${waitIc(it)}</button></li>`;
  }
  function listHtml(shown, all) {
    if (!shown.length) {
      const narrowed = ui.group !== "all" || ui.kind !== "all" || !!ui.search;
      const empty = { mine: "Nothing waits for your decision.", others: "Nothing waits for anyone else.", decided: "Nothing has been decided yet.", all: "Nothing waits for an approver." }[ui.view];
      return `<div class="tree-empty small muted">${narrowed ? "Nothing matches. Choose another tile, or clear the filters." : empty}</div>`;
    }
    const sections = [{ id: "none", name: "All business groups" }].concat(S.groupsOrdered()).filter((g) => shown.some((it) => (it.groupId || "none") === g.id));
    return `<ul class="tree">${sections.map((g) => { const rows = shown.filter((it) => (it.groupId || "none") === g.id), open = !ui.collapsed.has(g.id); return `<li class="tree-section"><button type="button" class="tree-row tree-section-row" data-ap-section="${g.id}" aria-expanded="${open}"><span class="tree-chev">${I.chevronRight}</span><span>${U.esc(g.name)}</span><span class="count-badge">${rows.length}</span></button>${open ? `<ul>${rows.map(rowHtml).join("")}</ul>` : ""}</li>`; }).join("")}</ul>`;
  }
  function tilesHtml(all) {
    return `<div class="ready-strip">${VIEWS.map(([k, l]) => { const n = all.filter((it) => inView(it, k)).length; return `<button type="button" class="ready-tile tile-btn${ui.view === k ? " active" : ""}${k === "mine" && n ? " gap" : ""}" data-action="ap-tile" data-tile="${k}" aria-pressed="${ui.view === k}"><div class="ready-val">${U.fmtNum(n)}</div><div class="ready-label">${U.esc(l)}</div></button>`; }).join("")}</div>`;
  }
  function toolbarHtml(all) {
    const groups = S.groupsOrdered().filter((g) => all.some((it) => it.groupId === g.id));
    const gOpts = [{ value: "all", label: "All business groups" }].concat(all.some((it) => !it.groupId) ? [{ value: "none", label: "Registered for all groups" }] : []).concat(groups.map((g) => ({ value: g.id, label: g.name })));
    return `<div class="toolbar reg-toolbar">
        ${C.select("apGroup", gOpts, ui.group)}
        ${C.select("apKind", [{ value: "all", label: "Escalations and registrations" }, { value: "escalation", label: "Escalations" }, { value: "registration", label: "Registrations" }], ui.kind)}
        <input type="search" id="apSearch" class="inp toolbar-search" placeholder="Search rules, AI systems, people or owners" value="${U.esc(ui.search)}"/>
        <span class="toolbar-spacer"></span>
        <button type="button" class="btn btn-sm" data-action="ap-export">${I.list} Export</button>
      </div>`;
  }
  function pageHtml() {
    const all = S.approvalQueue();
    if (ui.selected && !all.some((it) => it.id === ui.selected)) ui.selected = null;
    const shown = all.filter(matches).sort(order), it = ui.selected ? all.find((x) => x.id === ui.selected) : null;
    const head = `<div class="int-tree-head"><div class="int-tree-title"><span class="strong">Queue</span><span id="apCount"><span class="count-badge">${U.fmtNum(shown.length)}</span><span class="small muted"> of ${U.fmtNum(all.length)}</span></span></div><div class="small muted">${ui.view === "decided" ? "Newest first." : "Oldest first, so nothing waits unseen."} j and k move through the queue.</div></div>`;
    return `${tilesHtml(all)}${toolbarHtml(all)}<div class="int-split ap-split"><aside class="int-tree-pane" aria-label="Approvals queue">${head}<div class="int-tree-body" id="apQueue">${listHtml(shown, all)}</div></aside><div class="int-conv" id="apDetail">${detailHtml(it)}</div></div>`;
  }

  /* ---------- The item on the right ---------- */
  function detailHtml(it) {
    if (!it) return C.card("Decision", C.emptyState("Choose an item", "Pick an escalation or a registration in the queue on the left to see it here with everything behind it."));
    return it.kind === "escalation" ? escalationHtml(it) : registrationHtml(it);
  }
  const escPill = (e, it) => ({
    Open: `<span class="pill pill-pending">${I.clock}<span>Awaiting approval${e.requiredApprovals > 1 ? ` · ${it.given} of ${it.required}` : ""}</span></span>`,
    Returned: `<span class="pill pill-pending">${I.flag}<span>Returned to the reviewer</span></span>`,
    Approved: `<span class="pill pill-ok">${I.checkCircle}<span>Approved · remediation with the owner</span></span>`,
    Rejected: `<span class="pill pill-muted">${I.x}<span>Rejected as accepted risk</span></span>`,
    Completed: `<span class="pill pill-ok">${I.checkCircle}<span>Remediation completed</span></span>`,
  })[e.status] || `<span class="pill pill-muted"><span>${U.esc(e.status)}</span></span>`;

  function escalationHtml(it) {
    const e = it.escalation, f = it.finding;
    if (!f) return C.card("Escalation", '<p class="small muted">The finding behind this escalation is not in the data.</p>');
    const m = S.member(f.memberId), s = f.aiSystemId ? S.system(f.aiSystemId) : null, g = f.groupId ? S.group(f.groupId) : null, r = S.rule(f.ruleId), x = S.interaction(f.interactionId);
    const by = S.member(e.escalatedByMemberId), owner = g ? S.member(g.ownerMemberId) : null, entry = e.registerEntryId ? S.entry(e.registerEntryId) : null;
    const perm = S.permission("approve", { finding: f, escalation: e }), due = e.status === "Open" && perm.allowed;
    const contentOk = S.canViewContent(f.groupId, { escalated: true });
    const who = m ? name(m) : "an unknown person";
    const sentence = `Escalated by ${by ? name(by) : "a reviewer"} on ${U.fmtDate(e.escalatedAt)} from a ${U.esc(f.severity)} violation of ${U.esc(r ? r.name : f.ruleId)}, ${who} ${s ? `with ${U.esc(s.name)} (${U.esc(kindName(s))}${g ? `, ${U.esc(g.name)}` : ""})` : `in a direct chat${g ? ` in ${U.esc(g.name)}` : ""}`}. ${e.target === "Conduct" ? "What must change is this person's use of it." : `What must change is the AI system${entry ? `; ${U.esc(entry.name)}'s registration is suspended until the approvers decide` : ""}.`}`;
    const head = C.card(`<span class="conv-title">${U.sevChip(f.severity)}<span>${U.esc(r ? r.name : f.ruleId)}</span></span>`, `<p class="conv-sentence">${sentence}</p>${F().recurrenceHtml(f)}`, { action: `<span class="conv-pills">${escPill(e, it)}</span>`, cls: "conv-head-card" });
    const escalation = C.card("Escalation", escalationRows(e, f, s, entry, owner));
    const decision = C.card(due ? "Your decision" : "Decision", decisionHtml(it, e, f, entry, owner, by, perm), { cls: due ? "fq-decision fq-decision-open" : "fq-decision" });
    const finding = C.card("Finding", F().factsHtml(f, contentOk, { links: true }), { action: `<a class="link" href="#/findings/escalated/${f.findingId}">Open the finding ${I.arrowRight}</a>` });
    const conv = x ? AGC.pages.interactions.conversationHtml(x, { mark: F().MARK, focusTurn: f.turnNumber, noHead: true, escalated: true }) : C.card("Conversation", '<p class="small muted">The interaction is not archived.</p>');
    return `${head}${escalation}${decision}${finding}${conv}${F().purposeHtml(f)}${F().historyHtml(f, e)}`;
  }
  function escalationRows(e, f, s, entry, owner) {
    const rv = f.review || {}, reviewer = rv.reviewerMemberId ? S.member(rv.reviewerMemberId) : null, by = S.member(e.escalatedByMemberId);
    const cov = s ? S.systemCoverage(s) : null;
    const regRow = e.target === "AI system"
      ? (entry ? `<a href="#/registry/${entry.id}">${U.esc(entry.name)}</a> · ${U.statusPill(entry.status)}<div class="small muted">${entry.status === "Suspended" ? "Suspended pending this decision. Archive360 switches nothing off; the suspension is a governance flag." : `Registered individually · ${U.esc(entry.status)}`}</div>` : `<span class="muted">${s ? `${U.esc(s.name)} has no registration of its own${cov && cov.entry ? `; it runs under ${U.esc(cov.entry.name)}'s approval` : ""}, so nothing is suspended.` : "A direct chat has no registration."}</span>`)
      : `<span class="muted">Not affected: a conduct escalation never touches the registration.</span>${e.downgrade ? `<div class="small muted">Downgraded from the AI system by ${name(S.member(e.downgrade.byMemberId)) || "the approver"} on ${U.fmtDate(e.downgrade.at)}: ${U.esc(e.downgrade.reason || "")}</div>` : ""}`;
    return `<dl class="kv kv-wide kv-detail">
      <dt>What must change</dt><dd>${e.target === "Conduct" ? "This person's use of the AI system" : "The AI system: its configuration, knowledge, instructions, sharing or registration"}</dd>
      <dt>Proposed remediation</dt><dd>${U.esc(e.proposedRemediation || "")}</dd>
      <dt>Registration</dt><dd>${regRow}</dd>
      <dt>Escalated</dt><dd>${by ? `<a href="#/members/${by.memberId}">${name(by)}</a>` : "A reviewer"}, ${U.fmtDateTime(e.escalatedAt)}${f.notifyOwnerNow ? `<div class="small muted">${owner ? name(owner) : "The accountable owner"} was notified at once, not in the digest.</div>` : ""}${e.revision ? `<div class="small muted">Revised by ${name(S.member(e.revision.byMemberId)) || "the reviewer"} on ${U.fmtDate(e.revision.at)}${e.revision.note ? `: ${U.esc(e.revision.note)}` : ""}${e.lastReturn && e.lastReturn.note ? ` · answering the return: "${U.esc(e.lastReturn.note)}"` : ""}</div>` : ""}</dd>
      <dt>Reviewer's assessment</dt><dd>${reviewer ? `Confirmed by <a href="#/members/${reviewer.memberId}">${name(reviewer)}</a>${rv.decidedAt ? `, ${U.fmtDateTime(rv.decidedAt)}` : ""}` : "Confirmed"}<div class="small muted">Cause: ${U.esc(rv.reason || "")}${rv.note ? ` · ${U.esc(rv.note)}` : ""}${f.severityAdjustment ? ` · Severity changed from ${U.esc(f.severityAdjustment.fromSeverity)} to ${U.esc(f.severityAdjustment.toSeverity)}: ${U.esc(f.severityAdjustment.reason || "")}` : ""}${f.ruleFlaggedForReview ? " · The rule was flagged for review" : ""}</div></dd>
      <dt>Approvals</dt><dd>${approvalsCell(e)}</dd>
    </dl>`;
  }
  function approvalsCell(e) {
    const given = (e.approvals || []).filter((a) => a.decision === "Approved").length;
    const li = (e.approvals || []).map((a) => { const p = S.member(a.approverMemberId); return `<li>${p ? name(p) : "Approver"}: ${a.decision === "Approved" ? "approved" : a.decision === "Rejected" ? "rejected as accepted risk" : "returned to the reviewer"}${a.decidedAt ? ` on ${U.fmtDate(a.decidedAt)}` : ""}${a.reasoning ? ` · ${U.esc(a.reasoning)}` : ""}</li>`; }).join("");
    const need = `${e.requiredApprovals} ${U.plural(e.requiredApprovals, "approval")} needed${e.requiredApprovals > 1 ? " for this severity" : ""}`;
    return `${e.status === "Open" ? `${given} of ${e.requiredApprovals} given` : need}${li ? `<ul class="plain-list">${li}</ul>` : ' · <span class="muted">none yet</span>'}${(e.priorApprovals || []).length ? '<div class="small muted">The decisions before the revision are in the History below.</div>' : ""}`;
  }
  function decisionHtml(it, e, f, entry, owner, by, perm) {
    const ret = lastOf(e, "Returned"), retBy = ret ? S.member(ret.approverMemberId) : null, ownerName = owner ? name(owner) : "the accountable owner";
    if (e.status === "Returned") return `<div class="notice notice-warn">${I.flag}<span>Returned to the reviewer${retBy ? ` by ${name(retBy)}` : ""}${ret ? ` on ${U.fmtDate(ret.decidedAt)}` : ""}: ${U.esc(e.returnNote || (ret && ret.reasoning) || "")} It comes back to this queue once the reviewer revises it on <a href="#/findings/escalated/${f.findingId}">the finding</a>.</span></div>`;
    if (e.status !== "Open") return outcomeHtml(e, entry, owner);
    const remaining = e.requiredApprovals - it.given;
    if (!perm.allowed) return `<div class="notice notice-warn">${I.lock}<span>${U.esc(perm.reason)}${remaining > 0 ? ` It waits for ${remaining === 1 ? "one more approver" : `${remaining} more approvers`}.` : ""}</span></div>`;
    const last = remaining <= 1, sev = U.esc(f.severity);
    return `<form class="fq-form ap-form" data-ap-form="${e.escalationId}" autocomplete="off">
      ${C.field("Approve, reject or return", `<div class="fq-choice ap-choice"><label class="qf-opt"><input type="radio" name="apDecision" value="approve"/> Approve the remediation</label><label class="qf-opt"><input type="radio" name="apDecision" value="reject"/> Reject as accepted risk: the violation stands, nothing has to change</label><label class="qf-opt"><input type="radio" name="apDecision" value="return"/> Return to reviewer: something must be clarified first</label></div>`)}
      <div data-ap-block="approve" hidden>
        ${e.target === "AI system" ? `<label class="qf-opt"><input type="checkbox" name="apDowngrade"/> Downgrade to conduct: the AI system is not the problem, this person's use of it is</label><div data-ap-downgrade hidden>${C.field("Why", `<input class="inp" name="apDowngradeReason" placeholder="Required. Recorded on the registration and in Audit History."/>`, entry ? `${U.esc(entry.name)} returns to Approved at once and ${ownerName} is told now; the remediation goes to them as a conduct matter.` : "The remediation goes to the owner as a conduct matter.")}</div>` : ""}
        ${C.field("Note", `<textarea class="inp" name="apNote" rows="2" placeholder="Optional. Recorded with your decision and shown to the owner."></textarea>`)}
        <div class="notice notice-info">${I.info}<span>${last ? `Your approval completes it: the remediation goes to ${ownerName} to complete${entry && e.target === "AI system" ? `, and ${U.esc(entry.name)} stays suspended until they complete it and reconfirm` : ""}. ${owner ? `${ownerName} hears about it in the next digest.` : ""}` : `Yours is ${it.given ? "another" : "the first"} of the ${e.requiredApprovals} approvals a ${sev} violation needs; ${remaining - 1 === 1 ? "one more approver" : `${remaining - 1} more approvers`} must decide before the remediation goes to ${ownerName}.`}</span></div>
      </div>
      <div data-ap-block="reject" hidden>
        ${C.field("Why the risk is accepted", `<textarea class="inp" name="apReason" rows="2" placeholder="Required. Recorded with your decision and sent to the owner now."></textarea>`)}
        <div class="notice notice-info">${I.info}<span>The violation stays confirmed and counted; nothing has to change.${entry && entry.status === "Suspended" ? ` ${U.esc(entry.name)} returns to Approved at once.` : ""} ${ownerName.charAt(0).toUpperCase() + ownerName.slice(1)} is notified now.</span></div>
      </div>
      <div data-ap-block="return" hidden>
        ${C.field("What the reviewer must clarify", `<textarea class="inp" name="apReturnNote" rows="2" placeholder="Required. The reviewer sees it on the finding and resubmits the escalation."></textarea>`)}
        <div class="notice notice-info">${I.info}<span>The escalation leaves this queue and goes back to ${by ? name(by) : "the reviewer"}. It returns here once revised${entry && entry.status === "Suspended" ? `; ${U.esc(entry.name)} stays suspended meanwhile` : ""}. ${ownerName.charAt(0).toUpperCase() + ownerName.slice(1)} is notified now.</span></div>
      </div>
      <div class="fq-actions"><button type="button" class="btn btn-primary" data-action="ap-go">Save decision</button></div>
    </form>`;
  }
  function outcomeHtml(e, entry, owner) {
    const ownerName = owner ? `<a href="#/members/${owner.memberId}">${name(owner)}</a>` : "the accountable owner";
    const last = (e.approvals || []).slice(-1)[0], lastBy = last ? S.member(last.approverMemberId) : null;
    const rows = [];
    if (e.status === "Rejected") rows.push(["Outcome", `Rejected as accepted risk${lastBy ? ` by ${name(lastBy)}` : ""}${last ? `, ${U.fmtDateTime(last.decidedAt)}` : ""}<div class="small muted">${U.esc(last ? last.reasoning : "")}</div>`]);
    else {
      const when = e.approvedAt || (last ? last.decidedAt : null);
      rows.push(["Outcome", `Approved${when ? `, ${U.fmtDateTime(when)}` : ""}: the remediation went to ${ownerName}${e.downgrade ? " as a conduct matter, after a downgrade" : ""}.`]);
      rows.push(["Owner's remediation", e.status === "Completed" ? `Completed${e.completedAt ? ` ${U.fmtDate(e.completedAt)}` : ""}${e.completionNote ? `: ${U.esc(e.completionNote)}` : ""}${e.resolution === "Retired" ? " · resolved by retiring the AI system" : ""}${e.reconfirmedAt ? ` · reconfirmed ${U.fmtDate(e.reconfirmedAt)}` : ""}` : `${e.ownerTaskStatus === "In progress" ? `In progress${e.startedAt ? ` since ${U.fmtDate(e.startedAt)}` : ""}${e.startNote ? `: ${U.esc(e.startNote)}` : ""}` : `Waiting for ${ownerName}`}${entry && entry.status === "Suspended" ? ` · ${U.esc(entry.name)} stays suspended until it is completed and reconfirmed` : ""}`]);
    }
    return `<dl class="kv kv-wide kv-detail">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
  }

  function registrationHtml(it) {
    const e = it.entry, o = S.member(e.ownerMemberId), grp = e.groupId ? S.group(e.groupId) : null, cov = grp ? S.coverage(grp.id) : [];
    const perm = S.permission("approve", { entry: e }), blocked = (e.blockers || []).length > 0, due = e.status === "Pending" && perm.allowed && !blocked;
    const regBy = S.member(e.registeredByMemberId), kind = regKind(e), months = e.reconfirmationIntervalMonths || D.settings.reconfirmation.intervalMonths;
    const last = (e.decisionHistory || []).filter((h) => ["Approved", "Rejected"].includes(h.action)).slice(-1)[0], lastBy = last && last.actorMemberId ? S.member(last.actorMemberId) : null;
    const scope = e.level === "Platform" ? ", registered for all business groups" : grp ? `, registered for ${U.esc(grp.name)}` : "";
    const sentence = e.status === "Pending"
      ? `${U.esc(kind)}${scope}, added by ${regBy ? name(regBy) : "an Administrator"} on ${U.fmtDate(e.registeredDate)}. Waiting for ${D.settings.approvals.registrationApprovals === 1 ? "one approver" : `${D.settings.approvals.registrationApprovals} approvers`}; once approved, ${o ? name(o) : "its owner"} reconfirms it every ${months} months.`
      : `${U.esc(kind)}${scope}. ${last ? `${U.esc(last.action)}${lastBy ? ` by ${name(lastBy)}` : ""} on ${U.fmtDate(last.date)}.` : ""}${["Approved", "Rejected"].includes(e.status) ? "" : ` Now ${U.esc(e.status.toLowerCase())}.`}`;
    const head = C.card(`<span class="conv-title">${RG().badge(kind)}<span>${U.esc(e.name)}</span></span>`, `<p class="conv-sentence">${sentence}</p>`, { action: `<span class="conv-pills">${U.statusPill(e.status)}</span>`, cls: "conv-head-card" });
    let decision;
    if (e.status !== "Pending") decision = `<dl class="kv kv-wide kv-detail"><dt>Outcome</dt><dd>${last ? `${U.esc(last.action)}${lastBy ? ` by <a href="#/members/${lastBy.memberId}">${name(lastBy)}</a>` : ""}, ${U.fmtDate(last.date)}<div class="small muted">${U.esc(last.detail || "")}</div>` : U.esc(e.status)}</dd></dl>`;
    else if (!perm.allowed) decision = `<div class="notice notice-warn">${I.lock}<span>${U.esc(perm.reason)} It waits for another approver.</span></div>`;
    else if (blocked) decision = `<div class="notice notice-danger">${I.alert}<span>Blocked: ${(e.blockers || []).map(U.esc).join(", ")}. It cannot be approved until that is fixed.</span></div>`;
    else decision = `<p class="small">Approve this ${e.level === "Platform" ? "AI platform" : "AI system"} for use, or reject it with a reason. The decision is recorded on its registration and in Audit History, and ${o ? name(o) : "its owner"} is told.</p><div class="btn-row"><button type="button" class="btn btn-primary" data-action="ap-approve-reg" data-id="${e.id}">${I.checkCircle} Approve…</button><button type="button" class="btn btn-secondary" data-action="ap-reject-reg" data-id="${e.id}">${I.x} Reject…</button></div>`;
    const decisionCard = C.card(due ? "Your decision" : "Decision", decision, { cls: due ? "fq-decision fq-decision-open" : "fq-decision" });
    return `${head}${decisionCard}${RG().registrationCard(e, "", { action: `<a class="link" href="#/registry/${e.id}">Open the registration ${I.arrowRight}</a>` })}${RG().reviewersCard(grp, cov)}${RG().decisionHistoryCard(e)}`;
  }

  /* ---------- Pages ---------- */
  P.render = function (params) {
    const p = params || {}, nav = AGC.shell.navMeta("approvals");
    if (!S.persona()) { AGC.router.navigate("#/start"); return; }
    let view = p.view || null, id = p.id || null;
    if (view && !VIEWS.some(([k]) => k === view)) { id = view; view = null; } // an older link: #/approvals/<id>
    if (!S.can("approve")) {
      /* Not an approver: a link to an escalation lands on its finding, a link to a registration on the Registry, the tab on the notice. */
      const e = id ? S.escalation(id) : null, en = id ? S.entry(id) : null;
      if (e) { history.replaceState(null, "", `#/findings/escalated/${e.findingId}`); AGC.router.dispatch(); return; }
      if (en) { history.replaceState(null, "", `#/registry/${en.id}`); AGC.router.dispatch(); return; }
      AGC.shell.render({ kind: "list", navKey: "approvals", title: nav.title, description: nav.description, icon: "approvals", html: notAvailable() });
      return;
    }
    const all = S.approvalQueue();
    if (id) { const it = all.find((x) => x.id === id); if (it) { ui.selected = id; if (!view) view = it.wait === "you" ? "mine" : it.wait; } }
    if (view) ui.view = view;
    AGC.shell.render({ kind: "list", navKey: "approvals", title: nav.title, description: nav.description, icon: "approvals", html: pageHtml(), after: P.after });
  };

  /* ---------- Behaviour ---------- */
  let keysBound = false;
  P.after = function (root) {
    if (!root.querySelector(".ap-split")) return;
    const sync = () => history.replaceState(null, "", `#/approvals/${ui.view}${ui.selected ? "/" + ui.selected : ""}`);
    const rerender = () => { sync(); AGC.router.dispatch(); };
    const itemOf = (id) => S.approvalQueue().find((x) => x.id === id) || null;
    const currentX = () => { const it = ui.selected ? itemOf(ui.selected) : null; return it && it.finding ? S.interaction(it.finding.interactionId) : null; };
    const bindForm = () => {
      const form = root.querySelector("[data-ap-form]"); if (!form) return;
      const v = (n) => { const el = form.querySelector(`[name='${n}']`); return el ? (el.type === "checkbox" ? el.checked : el.value) : ""; };
      const picked = () => { const el = form.querySelector("[name='apDecision']:checked"); return el ? el.value : ""; };
      const missing = () => {
        const d = picked();
        if (!d) return "Choose Approve, Reject or Return first.";
        if (d === "approve" && v("apDowngrade") && !String(v("apDowngradeReason")).trim()) return "Say why it is downgraded.";
        if (d === "reject" && !String(v("apReason")).trim()) return "Say why the risk is accepted.";
        if (d === "return" && !String(v("apReturnNote")).trim()) return "Say what the reviewer must clarify.";
        return "";
      };
      C.guard(form, () => !missing(), missing, "[data-action='ap-go']");
    };
    const drawDetail = () => { const pane = root.querySelector("#apDetail"); AGC.pages.interactions.resetConversation(); if (pane) pane.innerHTML = detailHtml(ui.selected ? itemOf(ui.selected) : null); bindForm(); };
    const select = (id) => { ui.selected = id; sync(); root.querySelectorAll(".ap-row.selected").forEach((b) => { b.classList.remove("selected"); b.setAttribute("aria-pressed", "false"); }); const b = root.querySelector(`.ap-row[data-ap="${id}"]`); if (b) { b.classList.add("selected"); b.setAttribute("aria-pressed", "true"); } drawDetail(); const pane = root.querySelector("#apDetail"); if (pane) pane.scrollIntoView({ block: "start" }); };
    const redrawList = () => { const q = root.querySelector("#apQueue"); if (q) { const all = S.approvalQueue(), shown = all.filter(matches).sort(order); q.innerHTML = listHtml(shown, all); } };
    sync();
    root.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-ap], [data-ap-section], [data-action]");
      if (!t) return;
      if (t.dataset.ap) { select(t.dataset.ap); return; }
      if (t.dataset.apSection) { const k = t.dataset.apSection; if (ui.collapsed.has(k)) ui.collapsed.delete(k); else ui.collapsed.add(k); redrawList(); return; }
      switch (t.dataset.action) {
        case "ap-tile": { const k = t.dataset.tile; if (k === "all" || ui.view === k) { ui.view = k === "all" ? "all" : "mine"; ui.group = "all"; ui.kind = "all"; ui.search = ""; } else ui.view = k; rerender(); break; }
        case "ap-export": AGC.shell.toast("Exports the queue as CSV: every item shown, with its kind, severity, rule or AI system, business group, who escalated or registered it, the approvals given and its status."); break;
        case "fq-jump": { const el = document.getElementById("turn-" + t.dataset.turn); if (el) el.scrollIntoView({ block: "center" }); break; }
        case "ap-approve-reg": { const e = S.entry(t.dataset.id); if (e) RG().approveDialog(e); break; }
        case "ap-reject-reg": { const e = S.entry(t.dataset.id); if (e) RG().rejectDialog(e); break; }
        case "ap-go": {
          const form = t.closest("[data-ap-form]"); if (!form) break;
          const v = (n) => { const el = form.querySelector(`[name='${n}']`); return el ? (el.type === "checkbox" ? el.checked : String(el.value).trim()) : ""; };
          const picked = form.querySelector("[name='apDecision']:checked"), d = picked ? picked.value : "";
          const e = S.escalation(form.dataset.apForm); if (!e || !d) break;
          const list = S.approvalQueue().filter(matches).sort(order), at = list.findIndex((y) => y.id === e.escalationId), subject = U.esc(subjectOf(e));
          if (d === "approve") {
            S.approveEscalation(e.escalationId, { note: v("apNote"), downgrade: !!v("apDowngrade"), downgradeReason: v("apDowngradeReason") });
            const given = e.approvals.filter((a) => a.decision === "Approved").length;
            AGC.shell.toast(e.status === "Approved" ? `Approved: the remediation on ${subject} goes to the owner.` : `Approved, ${given} of ${e.requiredApprovals}: waiting for another approver.`, "success");
          } else if (d === "reject") { S.rejectEscalation(e.escalationId, { reason: v("apReason") }); AGC.shell.toast(`Rejected as accepted risk: ${subject}. The owner is notified.`, "success"); }
          else { S.returnEscalation(e.escalationId, { note: v("apReturnNote") }); AGC.shell.toast(`Returned to the reviewer: ${subject}.`, "success"); }
          /* Saving advances to the next item waiting in this queue, in its order; when nothing else waits, the decided item stays open
             so the outcome is in view. */
          const after = S.approvalQueue().filter(matches).sort(order).filter((y) => y.id !== e.escalationId);
          const next = after[Math.min(at, after.length - 1)] || after[0] || null;
          ui.selected = next ? next.id : e.escalationId;
          rerender();
          break;
        }
        default: break;
      }
    });
    root.addEventListener("change", (ev) => {
      const el = ev.target, form = el.closest("[data-ap-form]");
      if (el.name === "apGroup") { ui.group = el.value; rerender(); return; }
      if (el.name === "apKind") { ui.kind = el.value; rerender(); return; }
      if (!form) return;
      if (el.name === "apDecision") {
        form.querySelectorAll("[data-ap-block]").forEach((b) => { b.hidden = b.dataset.apBlock !== el.value; });
        const btn = form.querySelector("[data-action='ap-go']");
        if (btn) { btn.innerHTML = el.value === "approve" ? `${I.checkCircle} Approve` : el.value === "reject" ? `${I.x} Reject as accepted risk` : `${I.flag} Return to reviewer`; btn.classList.toggle("btn-danger", el.value === "reject"); }
      } else if (el.name === "apDowngrade") { const d = form.querySelector("[data-ap-downgrade]"); if (d) d.hidden = !el.checked; }
    });
    const s = root.querySelector("#apSearch"); if (s) s.addEventListener("input", U.debounce(() => { ui.search = s.value; const pos = s.selectionStart; rerender(); const s2 = document.querySelector("#apSearch"); if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); } }, 220));
    AGC.pages.interactions.bindConversation(root, currentX);
    bindForm();
    if (!keysBound) {
      keysBound = true;
      document.addEventListener("keydown", (ev) => {
        if (!document.querySelector(".ap-split") || ev.altKey || ev.ctrlKey || ev.metaKey) return;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test((ev.target.tagName || "").toUpperCase())) return;
        if (ev.key !== "j" && ev.key !== "k") return;
        const rows = Array.from(document.querySelectorAll(".ap-row")), i = rows.findIndex((b) => b.classList.contains("selected"));
        const nextRow = ev.key === "j" ? rows[i + 1] || rows[0] : rows[i - 1] || rows[rows.length - 1];
        if (nextRow) { nextRow.click(); nextRow.scrollIntoView({ block: "nearest" }); ev.preventDefault(); }
      });
    }
    const sel = root.querySelector(".ap-row.selected"); if (sel) sel.scrollIntoView({ block: "center" });
  };
})();
