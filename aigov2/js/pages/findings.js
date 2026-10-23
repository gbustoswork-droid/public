/* Findings (agreed with Gabriel on 2026-09-25, on six recommendations): the review queue on the left, grouped by business group, and the
   selected finding open on the right with the interaction it came from, the flagged turn highlighted and the detected values marked.
   Reviewers judge validity: Confirm with a cause or Dismiss with a reason, change the severity with a reason, and escalate only when
   something must change, naming the AI system or the person's use. A finding is a violation only once confirmed. Tiles are the only
   status filter; saving a decision advances to the next finding awaiting review; j and k move through the queue. Who sees what: the
   findings of the groups a person's Entitlement Policies cover, or that they own (as facts, without the conversation, and without
   deciding); the Administrator everything. The group page's Findings sub-page is the same component filtered to the group, within the
   band's date range. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.findings = {});
  const VIEWS = [["awaiting", "Awaiting review"], ["confirmed", "Confirmed"], ["dismissed", "Dismissed"], ["escalated", "Escalated"], ["all", "All"]];
  const SEVS = ["Critical", "High", "Medium", "Low"];
  const fresh = () => ({ scope: "", view: "awaiting", group: "all", severity: "all", rule: "all", search: "", selected: null, collapsed: new Set() });
  let ui = fresh();
  P.ui = () => ui;
  (AGC.personaHooks = AGC.personaHooks || []).push(() => { ui = fresh(); });
  const current = { scope: null };
  const LOC = { prompt: "The person's prompt", response: "The AI's response", attachment: "A file attached to the prompt", knowledgeFile: "A knowledge file of the AI asset", app: "Content the AI retrieved from an app", action: "The request or response of an Action" };
  const STATE = { Group: "managed within its platform's approval", Individual: "registered individually", External: "built outside your workspace", Unregistered: "not approved" };
  /* The values classification marks in a prompt: identifiers, card and account numbers, keys, employee and case ids, dates of birth. */
  const MARK = /\b\d{3}-\d{2}-\d{3,4}\b|\b(?:\d{4}\s?){3}\d{4,5}\b|\b\d{4}-\d{6}-\d\b|\bsk_[A-Za-z0-9_]{6,}\b|\bE\d{5,}\b|\b\d{2}\/\d{2}\/\d{4}\b|\b[A-Z]\d{7}\b|\bFC-\d{4}-\d+\b|(?<=\bpassword\b[^.]{0,60}\bis )[^\s,]+/g;
  P.MARK = MARK;
  const kindName = (s) => (s ? (s.type === "Custom" ? "Custom AI application" : s.type) : "");
  const viewOf = (f) => (f.status === "Detected" ? "awaiting" : f.status === "Confirmed" ? "confirmed" : "dismissed");
  const inView = (f, v) => v === "all" || (v === "escalated" ? !!f.escalationId : viewOf(f) === v);
  /* An escalation returned by the approver waits for the reviewer's revision: the one escalated state that is the reviewer's own work. */
  const returned = (f) => { const e = f.escalationId ? S.byId.escalation[f.escalationId] : null; return !!(e && e.status === "Returned"); };
  const query = () => { const o = {}; (location.hash.split("?")[1] || "").split("&").forEach((kv) => { const [k, v] = kv.split("="); if (k) o[decodeURIComponent(k)] = decodeURIComponent(v || ""); }); return o; };
  const notAvailable = (what) => `<div class="placeholder-card"><div class="ph-title">${I.lock} ${what} not available for your profile</div><div class="ph-body">Access to findings comes from your Profile and Entitlement Policies, managed by an Archive360 Administrator. A business group's owner sees its findings as facts.</div></div>`;
  const canSeeGroup = (g) => { const p = S.persona(); return !!p && !!g && (S.can("settings") || S.isEntitled(g.id) || g.ownerMemberId === p.memberId); };
  function markHtml(text) {
    const t = text || ""; let out = "", last = 0, m; const re = new RegExp(MARK.source, "g");
    while ((m = re.exec(t))) { out += U.esc(t.slice(last, m.index)) + `<mark class="hit">${U.esc(m[0])}</mark>`; last = m.index + m[0].length; if (!m[0].length) re.lastIndex++; }
    return out + U.esc(t.slice(last));
  }
  /* A knowledge-file or connected-content finding is not the person's doing: the data was in the GPT's configuration before they asked. */
  const surfaced = (f, s) => {
    if (f.location === "action") return f.actionDirection === "sent" ? `<div class="small muted">Their prompt held it; ChatGPT sent it on in the Action's request.</div>` : `<div class="small muted">Their chat called the Action; the data was in the system behind ${U.esc(f.actionDomain || "the domain")} before they asked, and came back in its response.</div>`;
    if (f.location === "app") return `<div class="small muted">Their chat retrieved it through the ${U.esc(f.app || "app")} app${f.appItem ? ` from ${U.esc(f.appItem.name)}` : ""}; the data was there before they asked, and their own account could already open it.</div>`;
    if (!s || f.location !== "knowledgeFile") return "";
    const c = s.creatorMemberId ? S.member(s.creatorMemberId) : null, who = c ? `<a href="#/members/${c.memberId}">${U.esc(c.displayName)}</a>` : U.esc(s.creatorName || "its builder");
    return `<div class="small muted">Their chat surfaced it; the knowledge file belongs to ${U.esc(s.name)}, built by ${who}.</div>`;
  };
  /* Where the data was (2026-09-30): for an Action, which direction it travelled, through which operation, to or from which domain, and
     whether the operation was one ChatGPT asked the person to confirm, since that confirmation is in no log. */
  const detectedIn = (f, x) => {
    if (f.location === "app") return `Content the AI retrieved from ${U.esc(f.app || "an app")}${f.appItem ? `: ${U.esc(f.appItem.name)}${f.appItem.container ? ` (${U.esc(f.appItem.container)})` : ""}` : ""}`;
    if (f.location === "action") {
      const call = ((x && x.actionCalls) || []).find((c) => c.turnNumber === f.turnNumber && c.operationId === f.actionOperation), sent = f.actionDirection === "sent";
      return `${sent ? "The request an Action sent" : "The response an Action returned"}: <span class="strong">${U.esc(f.actionName || "")}</span> · <span class="mono">${U.esc(f.actionOperation || "")}</span> · ${U.esc(f.actionDomain || "")}${f.actionExternal ? ' <span class="tag tag-pending" title="Outside Brookhaven Financial: the data left the bank">Outside Brookhaven</span>' : ""}<div class="small muted">${sent ? "ChatGPT put it in the Action's request, which the app-call log recorded." : "It came back in the Action's response, which the app-call log recorded, and ChatGPT showed it in the chat."}${call && call.consequential ? " ChatGPT asked the person to confirm this operation before calling it; the confirmation is in no log." : ""}</div>`;
    }
    return LOC[f.location] || U.esc(f.location || "");
  };
  const whereWord = (f) => f.location === "action" ? (f.actionDirection === "sent" ? `the request the Action ${U.esc(f.actionName || "")} sent to ${U.esc(f.actionDomain || "")}` : `the response the Action ${U.esc(f.actionName || "")} returned from ${U.esc(f.actionDomain || "")}`) : LOC[f.location] ? LOC[f.location].charAt(0).toLowerCase() + LOC[f.location].slice(1) : "the interaction";
  /* The other findings on the same interaction (Gabriel, 2026-09-25): a prompt can break two rules at once, and each is decided on its
     own, so the reviewer sees the whole picture and can move to the next one with the conversation already open. */
  const siblings = (f) => S.visibleFindings().filter((y) => y.interactionId === f.interactionId && y.findingId !== f.findingId).sort((a, b) => a.turnNumber - b.turnNumber || a.detectedAt.localeCompare(b.detectedAt));
  const statusWord = (f) => (f.status === "Detected" ? "awaiting review" : f.status === "Confirmed" ? (f.escalationId ? "confirmed, escalated" : "confirmed") : "dismissed");
  const siblingsHtml = (f, links) => { const list = siblings(f); return list.length ? `<dt>Also on this interaction</dt><dd><ul class="plain-list">${list.map((y) => { const r = S.rule(y.ruleId), nm = U.esc(r ? r.name : y.ruleId); return `<li>${U.sevChip(y.severity)} ${links ? `<a href="#/findings/all/${y.findingId}">${nm}</a>` : `<button type="button" class="link-btn" data-fq="${y.findingId}">${nm}</button>`} <span class="muted">· turn ${y.turnNumber} · ${statusWord(y)}</span></li>`; }).join("")}</ul></dd>` : ""; };
  const escStatusWord = (e) => ({ Open: "Awaiting approval", Returned: "Returned to the reviewer", Approved: "Approved; remediation with the owner", Rejected: "Rejected as accepted risk", Completed: "Remediation completed" })[e.status] || e.status;
  function statusPill(f) {
    const e = f.escalationId ? S.escalation(f.escalationId) : null;
    if (f.status === "Detected") return `<span class="pill pill-pending">${I.clock}<span>Awaiting review</span></span>`;
    if (f.status === "Dismissed") return `<span class="pill pill-muted">${I.check}<span>Dismissed</span></span>`;
    return `<span class="pill pill-danger">${I.alert}<span>Confirmed violation</span></span>${e ? `<span class="pill pill-pending">${I.flag}<span>Escalated · ${escStatusWord(e).toLowerCase()}</span></span>` : ""}`;
  }

  /* ---------- The queue ---------- */
  function pool(scope) {
    let list = S.visibleFindings();
    if (scope.groupId) list = list.filter((f) => f.groupId === scope.groupId && S.inRange(f.detectedAt));
    return list;
  }
  function matches(f) {
    if (!inView(f, ui.view)) return false;
    if (ui.group !== "all" && f.groupId !== ui.group) return false;
    if (ui.severity !== "all" && f.severity !== ui.severity) return false;
    if (ui.rule !== "all" && f.ruleId !== ui.rule) return false;
    if (ui.search) { const q = ui.search.toLowerCase(), m = S.member(f.memberId), s = f.aiSystemId ? S.system(f.aiSystemId) : null, r = S.rule(f.ruleId), dc = S.dataClass(f.dataClassId); if (!`${m ? m.displayName : ""} ${s ? s.name : ""} ${r ? r.name : ""} ${dc ? dc.name : ""} ${f.severity}`.toLowerCase().includes(q)) return false; }
    return true;
  }
  /* Awaiting review is oldest first, so nothing waits unseen; decided findings newest first. A returned escalation is the reviewer's work,
     so it sorts first wherever it appears, oldest first (Gabriel, 2026-09-29: in a queue of 15 escalated findings nothing said which one
     had been returned). */
  const order = (a, b) => {
    const ra = returned(a), rb = returned(b);
    if (ra !== rb) return ra ? -1 : 1;
    if (ra) return a.detectedAt.localeCompare(b.detectedAt);
    return ui.view === "awaiting" ? a.detectedAt.localeCompare(b.detectedAt) : b.detectedAt.localeCompare(a.detectedAt);
  };
  function rowHtml(f) {
    const m = S.member(f.memberId), s = f.aiSystemId ? S.system(f.aiSystemId) : null, r = S.rule(f.ruleId);
    return `<li><button type="button" class="tree-leaf fq-row${ui.selected === f.findingId ? " selected" : ""}" data-fq="${f.findingId}" aria-pressed="${ui.selected === f.findingId}"><span class="fq-sev">${U.sevChip(f.severity)}</span><span class="tree-leaf-main"><span class="tree-leaf-name" title="${U.esc(r ? r.name : "")}">${U.esc(r ? r.name : f.ruleId)}</span><span class="tree-leaf-sub small muted">${m ? U.esc(m.displayName) : "Unknown"} · ${s ? U.esc(s.name) : "Direct chat"} · ${U.esc(U.relTime(f.detectedAt))}</span></span>${returned(f) ? `<span class="tag tag-pending fq-returned" title="Returned by the approver; waits for the reviewer's revision">Returned</span>` : f.escalationId ? `<span class="tree-ic" title="Escalated">${I.flag}</span>` : ""}</button></li>`;
  }
  function listHtml(scope, shown, all) {
    if (!shown.length) return `<div class="tree-empty small muted">${all.length ? "Nothing matches. Choose another tile, or clear the filters." : (scope.groupId ? "No findings in this period." : "No findings to show.")}</div>`;
    if (scope.groupId) return `<ul class="tree">${shown.map(rowHtml).join("")}</ul>`;
    const groups = S.groupsOrdered().filter((g) => shown.some((f) => f.groupId === g.id));
    return `<ul class="tree">${groups.map((g) => { const rows = shown.filter((f) => f.groupId === g.id), open = !ui.collapsed.has(g.id), ret = rows.filter(returned).length; return `<li class="tree-section"><button type="button" class="tree-row tree-section-row" data-fq-section="${g.id}" aria-expanded="${open}"><span class="tree-chev">${I.chevronRight}</span><span>${U.esc(g.name)}</span><span class="count-badge">${rows.length}</span>${ret ? `<span class="tree-section-note warn-text">${ret} returned</span>` : ""}</button>${open ? `<ul>${rows.map(rowHtml).join("")}</ul>` : ""}</li>`; }).join("")}</ul>`;
  }
  function tilesHtml(all) {
    return `<div class="ready-strip ready-strip-5">${VIEWS.map(([k, l]) => { const n = all.filter((f) => inView(f, k)).length; return `<button type="button" class="ready-tile tile-btn${ui.view === k ? " active" : ""}${k === "awaiting" && n ? " gap" : ""}" data-action="fq-tile" data-tile="${k}" aria-pressed="${ui.view === k}"><div class="ready-val">${U.fmtNum(n)}</div><div class="ready-label">${U.esc(l)}</div></button>`; }).join("")}</div>`;
  }
  function toolbarHtml(scope, all) {
    const groups = S.groupsOrdered().filter((g) => all.some((f) => f.groupId === g.id));
    const rules = U.uniq(all.map((f) => f.ruleId)).map((id) => S.rule(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    return `<div class="toolbar reg-toolbar">
        ${scope.groupId ? "" : C.select("fqGroup", [{ value: "all", label: "All business groups" }].concat(groups.map((g) => ({ value: g.id, label: g.name }))), ui.group)}
        ${C.select("fqSeverity", [{ value: "all", label: "All severities" }].concat(SEVS.map((v) => ({ value: v, label: v }))), ui.severity)}
        ${C.select("fqRule", [{ value: "all", label: "All AI Policy Rules" }].concat(rules.map((r) => ({ value: r.id, label: r.name }))), ui.rule)}
        <input type="search" id="fqSearch" class="inp toolbar-search" placeholder="Search people, AI assets, rules or sensitive data" value="${U.esc(ui.search)}"/>
        <span class="toolbar-spacer"></span>
        <button type="button" class="btn btn-sm" data-action="fq-export">${I.list} Export</button>
      </div>`;
  }
  function pageHtml(scope) {
    const all = pool(scope);
    if (ui.selected && !all.some((f) => f.findingId === ui.selected)) ui.selected = null;
    const shown = all.filter(matches).sort(order);
    const f = ui.selected ? S.finding(ui.selected) : null;
    const head = `<div class="int-tree-head"><div class="int-tree-title"><span class="strong">Queue</span><span id="fqCount"><span class="count-badge">${U.fmtNum(shown.length)}</span><span class="small muted"> of ${U.fmtNum(all.length)}${scope.groupId ? " in this period" : ""}</span></span></div><div class="small muted">${ui.view === "awaiting" ? "Oldest first, so nothing waits unseen. j and k move through the queue." : `${shown.some(returned) ? "Returned escalations first, then newest first." : "Newest first."} j and k move through the queue.`}</div></div>`;
    return `${tilesHtml(all)}${toolbarHtml(scope, all)}<div class="int-split fq-split"><aside class="int-tree-pane" aria-label="Findings queue">${head}<div class="int-tree-body" id="fqQueue">${listHtml(scope, shown, all)}</div></aside><div class="int-conv" id="fqDetail">${detailHtml(f)}</div></div>`;
  }

  /* ---------- The review screen ---------- */
  /* The finding's facts, read-only: shared with the Approvals page, which shows them beside the approver's decision (2026-09-25). */
  function factsHtml(f, contentOk, opts) {
    const o = opts || {}, m = S.member(f.memberId), s = f.aiSystemId ? S.system(f.aiSystemId) : null, g = f.groupId ? S.group(f.groupId) : null, r = S.rule(f.ruleId), dc = S.dataClass(f.dataClassId), x = S.interaction(f.interactionId);
    return `<dl class="kv kv-wide kv-detail">
        <dt>AI Policy Rule</dt><dd>${r ? `<a href="#/rules/${r.id}">${U.esc(r.name)}</a>` : U.esc(f.ruleId)}<div class="small muted">${r ? `${U.esc(r.family)} · version ${U.esc(f.ruleVersion)} · ${(r.regulatoryBasis || []).map(U.esc).join(", ")}${r.basisDetail ? ` (${U.esc(r.basisDetail)})` : ""}` : ""}</div></dd>
        <dt>Sensitive data detected</dt><dd>${dc ? U.esc(dc.name) : ""}</dd>
        <dt>Severity</dt><dd>${U.sevChip(f.severity)}</dd>
        <dt>Detected in</dt><dd>${detectedIn(f, x)}</dd>
        <dt>What was detected</dt><dd>${contentOk ? `<div class="fq-snippet${f.status === "Confirmed" ? " fq-snippet-confirmed" : f.status === "Dismissed" ? " fq-snippet-dismissed" : ""}"><div class="fq-snippet-label">${I.alert} Flagged content</div>${markHtml(f.snippet)}</div>` : `<span class="muted">Not available for your profile: the content of ${g ? U.esc(g.name) : "this group"}'s interactions needs an Archive360 Entitlement Policy that covers it.</span>`}</dd>
        ${f.subjectCount ? `<dt>People affected</dt><dd>${U.fmtNum(f.subjectCount)}</dd>` : ""}
        <dt>AI asset</dt><dd>${s ? `${s.type === "Custom" && s.registerEntryId ? `<a href="#/registry/${s.registerEntryId}">${U.esc(s.name)}</a>` : `<a href="#/systems/${s.id}">${U.esc(s.name)}</a>`} · ${U.esc(kindName(s))}<div class="small muted">At detection: ${STATE[f.registrationStateAtDetection] || U.esc(f.registrationStateAtDetection || "")}</div>` : '<span class="muted">None: a direct chat</span>'}</dd>
        <dt>Business group</dt><dd>${g ? `<a href="#/groups/${g.id}">${U.esc(g.name)}</a>` : '<span class="muted">None</span>'}</dd>
        <dt>Person</dt><dd>${m ? `<a href="#/members/${m.memberId}">${U.esc(m.displayName)}</a>${U.statusTag(m)}<div class="small muted">${U.esc(m.jobTitle || "")}</div>` : '<span class="muted">Unknown</span>'}${surfaced(f, s)}</dd>
        ${x && contentOk && x.contentRetained ? `<dt>Interaction</dt><dd><button type="button" class="link-btn" data-action="fq-jump" data-turn="${f.turnNumber}">Jump to the flagged turn</button></dd>` : ""}
        ${siblingsHtml(f, o.links)}
      </dl>`;
  }
  function purposeHtml(f) {
    const s = f.aiSystemId ? S.system(f.aiSystemId) : null, cov = s ? S.systemCoverage(s) : null, entry = cov ? cov.entry : null;
    return C.card("Approved purpose and instructions", `<dl class="kv kv-wide kv-detail">
        <dt>Approved purpose</dt><dd>${entry ? `${U.esc(entry.approvedPurpose || "")}<div class="small muted">${cov.key === "individual" ? "This AI asset's own registration" : `${U.esc(entry.name)}, the AI system's registration`} · ${U.esc(entry.status)}</div>` : `<span class="muted">${s ? "No approval covers this AI asset" : "A direct chat runs under the platform's approval and has no purpose of its own"}</span>`}</dd>
        <dt>Instructions</dt><dd>${s && s.instructions ? `<div class="instr-block">${U.esc(s.instructions)}</div>` : `<span class="muted">${s ? (s.external ? "Not archived: this GPT was built outside your workspace" : "None recorded") : "None: a direct chat"}</span>`}</dd>
      </dl>`);
  }
  function recurrenceHtml(f) {
    const rec = S.recurrence(f), m = S.member(f.memberId), s = f.aiSystemId ? S.system(f.aiSystemId) : null, who = m ? U.esc(m.displayName) : "An unknown person";
    return rec.member || rec.system ? `<div class="notice notice-warn">${I.alert}<span>Recurrence: ${rec.member ? `${rec.member} earlier confirmed ${U.plural(rec.member, "violation")} of this rule by ${who} in the last 120 days` : ""}${rec.member && rec.system ? "; " : ""}${rec.system ? `${rec.system} earlier confirmed ${U.plural(rec.system, "violation")} on ${s ? U.esc(s.name) : "this AI asset"} in the last 90 days` : ""}.</span></div>` : "";
  }
  /* A returned escalation waits for a reviewer who may escalate in that group; the one who escalated it may be away. */
  const canRevise = (f, esc) => !!esc && esc.status === "Returned" && S.can("escalate") && S.permission("review", { groupId: f.groupId, finding: f }).allowed;
  /* An approved remediation waits for the owner (or whoever may complete it on their behalf); a conduct remediation lives only here. */
  const openTask = (esc) => !!esc && esc.status === "Approved" && ["Open", "In progress"].includes(esc.ownerTaskStatus || "Open");
  const canRemediate = (esc) => openTask(esc) && S.permission("remediate", { entry: esc.registerEntryId ? S.entry(esc.registerEntryId) : null, escalation: esc }).allowed;
  function detailHtml(f) {
    if (!f) return C.card("Finding", C.emptyState("Choose a finding", "Pick a finding in the queue on the left to review it here, with the interaction it came from."));
    const m = S.member(f.memberId), s = f.aiSystemId ? S.system(f.aiSystemId) : null, g = f.groupId ? S.group(f.groupId) : null, r = S.rule(f.ruleId), dc = S.dataClass(f.dataClassId), x = S.interaction(f.interactionId);
    const esc = f.escalationId ? S.escalation(f.escalationId) : null;
    const contentOk = S.canViewContent(f.groupId, { escalated: !!esc });
    const who = m ? U.esc(m.displayName) : "An unknown person";
    const where = whereWord(f);
    const sentence = `Detected ${U.fmtDateTime(f.detectedAt)} in ${where}${s ? `, ${who} with ${U.esc(s.name)} (${U.esc(kindName(s))}${g ? `, ${U.esc(g.name)}` : ""})` : `, ${who}'s direct chat${g ? ` in ${U.esc(g.name)}` : ""}`}: ${dc ? U.esc(dc.name) : ""}${f.subjectCount ? `, ${U.fmtNum(f.subjectCount)} ${U.plural(f.subjectCount, "person", "people")} affected` : ""}.`;
    const head = C.card(`<span class="conv-title">${U.sevChip(f.severity)}<span>${U.esc(r ? r.name : f.ruleId)}</span></span>`, `<p class="conv-sentence">${sentence}</p>${recurrenceHtml(f)}`, { action: `<span class="conv-pills">${statusPill(f)}</span>`, cls: "conv-head-card" });
    const facts = C.card("Finding", factsHtml(f, contentOk));
    const due = (f.status === "Detected" && S.permission("review", { groupId: f.groupId, finding: f }).allowed) || canRevise(f, esc) || canRemediate(esc);
    const decision = C.card(f.status === "Detected" ? "Decision" : "Review decision", decisionHtml(f, m, s, g, r, esc), { cls: due ? "fq-decision fq-decision-open" : "fq-decision" });
    const conv = x ? AGC.pages.interactions.conversationHtml(x, { mark: MARK, focusTurn: f.turnNumber, noHead: true, escalated: !!esc }) : C.card("Conversation", '<p class="small muted">The interaction is not archived.</p>');
    return `${head}${facts}${decision}${conv}${purposeHtml(f)}${historyHtml(f, esc)}`;
  }
  P.factsHtml = factsHtml; P.purposeHtml = purposeHtml; P.recurrenceHtml = recurrenceHtml; P.historyHtml = (f, esc) => historyHtml(f, esc); P.escStatusWord = escStatusWord;
  function decisionHtml(f, m, s, g, r, esc) {
    if (f.status !== "Detected") return recordHtml(f, esc);
    const perm = S.permission("review", { groupId: f.groupId, finding: f });
    if (!perm.allowed) return `<div class="notice notice-warn">${I.lock}<span>${U.esc(perm.reason)} The finding waits for a reviewer.</span></div>`;
    const cov = s ? S.systemCoverage(s) : null, entry = cov && cov.key === "individual" ? cov.entry : null, owner = g ? S.member(g.ownerMemberId) : null;
    const need = ((D.settings.approvals || {}).requiredBySeverity || {})[f.severity] || 1;
    return `<form class="fq-form" data-fq-form="${f.findingId}" autocomplete="off">
      ${C.field("Confirm or dismiss", `<div class="fq-choice"><label class="qf-opt"><input type="radio" name="fqDecision" value="Confirmed"/> Confirm: this is a violation</label><label class="qf-opt"><input type="radio" name="fqDecision" value="Dismissed"/> Dismiss: it is not</label></div>`)}
      ${C.field("Reason", `<select class="sel" name="fqReason" disabled><option value="">Choose the decision first</option></select>`, "A confirmed finding records its cause; a dismissed one, why it is not a violation.")}
      ${C.field("Note", `<textarea class="inp" name="fqNote" rows="2" placeholder="Optional. Recorded with the decision and shown to approvers."></textarea>`)}
      ${C.field("Severity", `<div class="fq-inline"><select class="sel inp-short" name="fqSeverity">${SEVS.map((v) => `<option value="${v}"${v === f.severity ? " selected" : ""}>${v}</option>`).join("")}</select><input class="inp" name="fqSeverityReason" placeholder="Why the severity changes" hidden/></div>`, `The rule's default is ${U.esc(f.severityDefault || f.severity)}. A change needs a reason.`)}
      <div class="fq-esc-wrap" data-confirm-only hidden>
        <label class="qf-opt"><input type="checkbox" name="fqEscalate"/> Escalate: something must change before this can rest</label>
        <div class="fq-esc" data-esc-block hidden>
          ${C.field("What must change", `<label class="qf-opt"><input type="radio" name="fqTarget" value="AI system"/> The AI system: its configuration, knowledge, instructions, sharing or registration</label><label class="qf-opt"><input type="radio" name="fqTarget" value="Conduct"/> This person's use of it</label>`, entry ? `Escalating the AI system suspends ${U.esc(entry.name)}'s registration until the approver decides. Archive360 switches nothing off.` : (s ? `${U.esc(s.name)} has no registration of its own, so nothing is suspended; the escalation goes to the approver.` : "A direct chat has no AI system to suspend; the escalation goes to the approver."))}
          ${C.field("Proposed remediation", `<textarea class="inp" name="fqRemediation" rows="3">${U.esc(r ? r.remediationGuidance || "" : "")}</textarea>`, "Pre-filled from the rule's guidance; edit it for this case.")}
          <label class="qf-opt"><input type="checkbox" name="fqNotify"/> Notify ${owner ? U.esc(owner.displayName) : "the accountable owner"} now, not in the next digest</label>
          <div class="small muted">A ${U.esc(f.severity)} finding needs ${need} ${U.plural(need, "approval")} before the remediation goes to the owner.</div>
        </div>
      </div>
      <label class="qf-opt"><input type="checkbox" name="fqFlagRule"/> Flag this rule for review: the rule, not the person, may need a change</label>
      <div class="fq-actions"><button type="button" class="btn btn-primary" data-action="go">Save decision</button></div>
    </form>`;
  }
  function recordHtml(f, esc) {
    const rv = f.review || {}, who = rv.reviewerMemberId ? S.member(rv.reviewerMemberId) : null;
    const rows = [
      ["Decision", `${f.status === "Confirmed" ? "Confirmed: a violation" : "Dismissed: not a violation"}${who ? ` · by <a href="#/members/${who.memberId}">${U.esc(who.displayName)}</a>` : ""}${rv.decidedAt ? `, ${U.fmtDateTime(rv.decidedAt)}` : ""}`],
      ["Reason", U.esc(rv.reason || "")],
      rv.note ? ["Note", U.esc(rv.note)] : null,
      f.severityAdjustment ? ["Severity", `Changed from ${U.esc(f.severityAdjustment.fromSeverity)} to ${U.esc(f.severityAdjustment.toSeverity)}: ${U.esc(f.severityAdjustment.reason || "")}`] : null,
      f.ruleFlaggedForReview ? ["AI Policy Rule", "Flagged for review by the reviewer"] : null,
    ].filter(Boolean);
    let escHtml = "";
    if (esc) {
      const by = S.member(esc.escalatedByMemberId), entry = esc.registerEntryId ? S.entry(esc.registerEntryId) : null;
      const given = (esc.approvals || []).filter((a) => a.decision === "Approved").length;
      const appr = (esc.approvals || []).map((a) => { const p = S.member(a.approverMemberId); return `<li>${p ? U.esc(p.displayName) : "Approver"}: ${a.decision === "Approved" ? "approved" : a.decision === "Rejected" ? "rejected as accepted risk" : "returned to the reviewer"}${a.decidedAt ? ` on ${U.fmtDate(a.decidedAt)}` : ""}${a.reasoning ? ` · ${U.esc(a.reasoning)}` : ""}</li>`; }).join("");
      const ret = (esc.approvals || []).filter((a) => a.decision === "Returned").slice(-1)[0], retBy = ret ? S.member(ret.approverMemberId) : null, revise = canRevise(f, esc);
      /* The approver decides on Approvals; a reviewer answers a return here, where the finding is (Gabriel, 2026-09-25). */
      const link = esc.status === "Open" && S.can("approve") ? `<div><a class="link" href="#/approvals/${esc.escalationId}">Open it on Approvals ${I.arrowRight}</a></div>` : "";
      const returned = esc.status === "Returned" ? `<div class="notice notice-warn">${I.flag}<span>Returned to the reviewer${retBy ? ` by ${U.esc(retBy.displayName)}` : ""}${ret ? ` on ${U.fmtDate(ret.decidedAt)}` : ""}: ${U.esc(esc.returnNote || (ret && ret.reasoning) || "")}${revise ? " Revise it below and resubmit it to the approver." : " It waits for a reviewer to revise it."}</span></div>` : "";
      escHtml = `<h4 class="fq-sub">Escalation</h4>${returned}<dl class="kv kv-wide kv-detail">
        <dt>What must change</dt><dd>${esc.target === "Conduct" ? "This person's use of the AI system" : "The AI system"}${esc.downgrade ? `<div class="small muted">Downgraded from the AI system to conduct by ${U.esc((S.member(esc.downgrade.byMemberId) || {}).displayName || "the approver")} on ${U.fmtDate(esc.downgrade.at)}: ${U.esc(esc.downgrade.reason || "")}</div>` : ""}${entry ? `<div class="small muted">${U.esc(entry.name)}'s registration: ${U.esc(entry.status)}</div>` : ""}</dd>
        <dt>Proposed remediation</dt><dd>${U.esc(esc.proposedRemediation || "")}</dd>
        <dt>Escalated</dt><dd>${by ? U.esc(by.displayName) : ""}${esc.escalatedAt ? `, ${U.fmtDateTime(esc.escalatedAt)}` : ""}${esc.revision ? `<div class="small muted">Revised by ${U.esc((S.member(esc.revision.byMemberId) || {}).displayName || "the reviewer")} on ${U.fmtDate(esc.revision.at)}${esc.revision.note ? `: ${U.esc(esc.revision.note)}` : ""}</div>` : ""}</dd>
        <dt>Approvals</dt><dd>${given} of ${esc.requiredApprovals}${appr ? `<ul class="plain-list">${appr}</ul>` : ' · <span class="muted">none yet</span>'}</dd>
        <dt>Status</dt><dd>${escStatusWord(esc)}${esc.ownerTaskStatus ? `<div class="small muted">Owner's remediation: ${esc.ownerTaskStatus === "Completed" ? `completed${esc.completedAt ? ` ${U.fmtDate(esc.completedAt)}` : ""}${esc.completionNote ? `: ${U.esc(esc.completionNote)}` : ""}${esc.reconfirmedAt ? ` · reconfirmed ${U.fmtDate(esc.reconfirmedAt)}` : ""}` : esc.ownerTaskStatus === "In progress" ? `in progress${esc.startedAt ? ` since ${U.fmtDate(esc.startedAt)}` : ""}${esc.startNote ? `: ${U.esc(esc.startNote)}` : ""}` : "waiting for the owner"}</div>` : ""}${link}</dd>
      </dl>${revise ? reviseFormHtml(f, esc) : ""}${ownerHtml(f, esc, entry)}`;
    }
    return `<dl class="kv kv-wide kv-detail">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>${escHtml}`;
  }
  /* The owner's remediation (built 2026-09-28): its state, and the Started and Complete actions for whoever may take them. */
  function ownerHtml(f, esc, entry) {
    if (!openTask(esc)) return "";
    const g = S.group(esc.groupId), owner = g ? S.member(g.ownerMemberId) : null, ownerName = owner ? U.esc(owner.displayName) : "the accountable owner";
    const appr = (esc.approvals || []).filter((a) => a.decision === "Approved").slice(-1)[0], perm = S.permission("remediate", { entry: entry || null, escalation: esc });
    const state = esc.ownerTaskStatus === "In progress" ? `In progress${esc.startedAt ? ` since ${U.fmtDate(esc.startedAt)}` : ""}${esc.startNote ? `: ${U.esc(esc.startNote)}` : ""}.` : `Waiting for ${ownerName} since ${U.fmtDate(appr ? appr.decidedAt : esc.escalatedAt)}.`;
    const consequence = entry ? ` ${U.esc(entry.name)} stays suspended until it is complete and ${ownerName} reconfirms it; <a href="#/registry/${entry.id}">open the registration</a>.` : " Nothing is suspended: this is about the person's use of the AI system.";
    const actions = perm.allowed ? `<div class="btn-row">${esc.ownerTaskStatus === "In progress" ? "" : `<button type="button" class="btn btn-secondary" data-action="rem-start" data-esc="${esc.escalationId}">${I.clock} Started…</button>`}<button type="button" class="btn btn-primary" data-action="rem-complete" data-esc="${esc.escalationId}">${I.checkCircle} Complete the remediation…</button></div>` : `<div class="notice notice-warn">${I.lock}<span>${U.esc(perm.reason)}</span></div>`;
    return `<div class="fq-owner"><h4 class="fq-sub">The owner's remediation</h4><p class="small">${state}${consequence}</p>${actions}</div>`;
  }
  /* The reviewer's answer to a return: the same choices as the escalation itself, resubmitted to the approvers with a clean count. */
  function reviseFormHtml(f, esc) {
    const s = f.aiSystemId ? S.system(f.aiSystemId) : null, cov = s ? S.systemCoverage(s) : null, entry = cov && cov.key === "individual" ? cov.entry : null;
    return `<form class="fq-form fq-revise" data-fq-revise="${esc.escalationId}" autocomplete="off">
      <h4 class="fq-sub">Revise the escalation</h4>
      ${C.field("What must change", `<label class="qf-opt"><input type="radio" name="rvTarget" value="AI system"${esc.target === "AI system" ? " checked" : ""}/> The AI system: its configuration, knowledge, instructions, sharing or registration</label><label class="qf-opt"><input type="radio" name="rvTarget" value="Conduct"${esc.target === "Conduct" ? " checked" : ""}/> This person's use of it</label>`, entry ? `Escalating the AI system suspends ${U.esc(entry.name)}'s registration until the approver decides; a conduct escalation leaves it approved.` : "")}
      ${C.field("Proposed remediation", `<textarea class="inp" name="rvRemediation" rows="3">${U.esc(esc.proposedRemediation || "")}</textarea>`, "Answer what the approver asked; the earlier text stays in Audit History.")}
      ${C.field("Note to the approver", `<textarea class="inp" name="rvNote" rows="2" placeholder="Optional. What changed, and why."></textarea>`)}
      <div class="fq-actions"><button type="button" class="btn btn-primary" data-action="revise-go">${I.flag} Resubmit to the approver</button></div>
    </form>`;
  }
  function historyHtml(f, esc) {
    const events = (D.auditEvents || []).filter((e) => (e.refType === "finding" && e.refId === f.findingId) || (esc && e.refType === "escalation" && e.refId === esc.escalationId)).sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    const li = events.map((e) => { const a = e.actorType === "member" ? S.member(e.actorId) : null; return `<li><span class="muted">${U.fmtDateTime(e.timestamp)}</span> · <span class="strong">${a ? U.esc(a.displayName) : "Archive360"}</span> · ${U.esc(e.eventType)}${e.summary ? `<div class="small muted">${U.esc(e.summary)}</div>` : ""}</li>`; }).join("");
    return C.card("History", li ? `<ul class="plain-list fq-hist">${li}</ul>` : '<p class="small muted">Nothing yet: the finding was detected and waits for a reviewer.</p>');
  }

  /* ---------- Pages ---------- */
  const sync = () => { if (!current.scope || current.scope.groupId) return; history.replaceState(null, "", `#/findings/${ui.view}${ui.selected ? "/" + ui.selected : ""}`); };
  P.render = function (params) {
    const p = params || {};
    if (ui.scope !== "tab") { ui = fresh(); ui.scope = "tab"; }
    ui.view = p.view && VIEWS.some(([k]) => k === p.view) ? p.view : (p.view ? ui.view : "awaiting");
    if (p.id && S.finding(p.id)) ui.selected = p.id;
    const nav = AGC.shell.navMeta("findings");
    if (!S.persona() || (!S.visibleFindings().length && !S.can("review"))) { AGC.shell.render({ kind: "list", navKey: "findings", title: nav.title, description: nav.description, icon: "findings", html: notAvailable("Findings are") }); return; }
    current.scope = { tab: true };
    AGC.shell.render({ kind: "list", navKey: "findings", title: nav.title, description: nav.description, icon: "findings", html: pageHtml(current.scope), after: P.after });
  };
  P.groupHtml = function (gid) {
    const g = S.group(gid);
    if (!g || !canSeeGroup(g)) return notAvailable(`The findings of ${g ? U.esc(g.name) : "this group"} are`);
    if (ui.scope !== "g:" + gid) { ui = fresh(); ui.scope = "g:" + gid; }
    const q = query(); if (q.open && S.finding(q.open)) { ui.selected = q.open; ui.view = "all"; }
    if (q.view && VIEWS.some(([k]) => k === q.view)) { ui.view = q.view; const rest = Object.keys(q).filter((k) => k !== "view").map((k) => `${k}=${encodeURIComponent(q[k])}`).join("&"); history.replaceState(null, "", location.hash.split("?")[0] + (rest ? "?" + rest : "")); }
    current.scope = { groupId: gid, group: g };
    return pageHtml(current.scope);
  };

  /* ---------- Behaviour ---------- */
  let keysBound = false;
  P.after = function (root) {
    const scope = current.scope; if (!scope || !root.querySelector(".fq-split")) return;
    const rerender = () => { sync(); AGC.router.dispatch(); };
    const currentX = () => { const f = ui.selected ? S.finding(ui.selected) : null; return f ? S.interaction(f.interactionId) : null; };
    const drawDetail = () => { const pane = root.querySelector("#fqDetail"); const f = ui.selected ? S.finding(ui.selected) : null; AGC.pages.interactions.resetConversation(); if (pane) pane.innerHTML = detailHtml(f); bindForm(); };
    const bindRevise = () => {
      const rf = root.querySelector("[data-fq-revise]"); if (!rf) return;
      const missing = () => { if (!rf.querySelector("[name='rvTarget']:checked")) return "Choose what must change."; if (!rf.querySelector("[name='rvRemediation']").value.trim()) return "Describe the remediation."; return ""; };
      C.guard(rf, () => !missing(), missing, "[data-action='revise-go']");
    };
    const bindForm = () => {
      bindRevise();
      const form = root.querySelector("[data-fq-form]"); if (!form) return;
      const v = (n) => { const el = form.querySelector(`[name='${n}']`); return el ? (el.type === "checkbox" ? el.checked : el.value) : ""; };
      const picked = (n) => { const el = form.querySelector(`[name='${n}']:checked`); return el ? el.value : ""; };
      const f = S.finding(form.dataset.fqForm);
      const missing = () => {
        if (!picked("fqDecision")) return "Choose Confirm or Dismiss first.";
        if (!v("fqReason")) return "Choose a reason.";
        if (v("fqSeverity") !== f.severity && !String(v("fqSeverityReason")).trim()) return "Say why the severity changes.";
        if (picked("fqDecision") === "Confirmed" && v("fqEscalate")) { if (!picked("fqTarget")) return "Choose what must change."; if (!String(v("fqRemediation")).trim()) return "Describe the remediation."; }
        return "";
      };
      C.guard(form, () => !missing(), missing, "[data-action='go']");
    };
    const select = (id) => { ui.selected = id; sync(); root.querySelectorAll(".fq-row.selected").forEach((b) => { b.classList.remove("selected"); b.setAttribute("aria-pressed", "false"); }); const b = root.querySelector(`.fq-row[data-fq="${id}"]`); if (b) { b.classList.add("selected"); b.setAttribute("aria-pressed", "true"); } drawDetail(); const pane = root.querySelector("#fqDetail"); if (pane) pane.scrollIntoView({ block: "start" }); };
    root.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-fq], [data-fq-section], [data-action]");
      if (!t) return;
      if (t.dataset.fq) { select(t.dataset.fq); return; }
      if (t.dataset.fqSection) { const k = t.dataset.fqSection; if (ui.collapsed.has(k)) ui.collapsed.delete(k); else ui.collapsed.add(k); const q = root.querySelector("#fqQueue"); if (q) { const all = pool(scope), shown = all.filter(matches).sort(order); q.innerHTML = listHtml(scope, shown, all); } return; }
      switch (t.dataset.action) {
        case "fq-tile": { const k = t.dataset.tile; if (k === "all" || ui.view === k) { ui.view = k === "all" ? "all" : "awaiting"; ui.group = "all"; ui.severity = "all"; ui.rule = "all"; ui.search = ""; } else ui.view = k; rerender(); break; }
        case "fq-export": AGC.shell.toast("Exports the queue as CSV: every finding shown, with its rule, severity, person, AI asset, business group, status and decision."); break;
        case "fq-jump": { const el = document.getElementById("turn-" + t.dataset.turn); if (el) el.scrollIntoView({ block: "center" }); break; }
        case "rem-start": { const e = S.escalation(t.dataset.esc); if (e) AGC.pages.registry.startRemediationDialog(e); break; }
        case "rem-complete": { const e = S.escalation(t.dataset.esc); if (e) AGC.pages.registry.completeRemediationDialog(e); break; }
        case "revise-go": {
          const rf = t.closest("[data-fq-revise]"); if (!rf) break;
          const target = (rf.querySelector("[name='rvTarget']:checked") || {}).value, remediation = rf.querySelector("[name='rvRemediation']").value.trim(), note = rf.querySelector("[name='rvNote']").value.trim();
          if (!target || !remediation) break;
          S.reviseEscalation(rf.dataset.fqRevise, { target, remediation, note });
          AGC.shell.toast("Escalation revised and resubmitted to the approver.", "success");
          rerender();
          break;
        }
        case "go": {
          const form = t.closest("[data-fq-form]"); if (!form) break;
          const val = (n) => { const el = form.querySelector(`[name='${n}']`); return el ? (el.type === "checkbox" ? el.checked : el.value) : ""; };
          const picked = (n) => { const el = form.querySelector(`[name='${n}']:checked`); return el ? el.value : ""; };
          const f = S.finding(form.dataset.fqForm), decision = picked("fqDecision");
          if (!f || !decision || !val("fqReason")) break;
          const list = pool(scope).filter(matches).sort(order), at = list.findIndex((y) => y.findingId === f.findingId);
          const res = S.decideFinding(f.findingId, { decision, reason: val("fqReason"), note: String(val("fqNote")).trim(), severity: val("fqSeverity") !== f.severity ? { to: val("fqSeverity"), reason: String(val("fqSeverityReason")).trim() } : null, escalate: decision === "Confirmed" && val("fqEscalate") ? { target: picked("fqTarget"), remediation: String(val("fqRemediation")).trim(), notifyOwner: !!val("fqNotify") } : null, flagRule: !!val("fqFlagRule") });
          const r = S.rule(f.ruleId);
          AGC.shell.toast(`${decision}: ${r ? r.name : f.ruleId}${res.escalation ? " · escalated" : ""}`, "success");
          /* Saving advances: a sibling on the same interaction still awaiting review first (the conversation is already open), then the
             next finding in this queue, in its order, or the first one left. */
          const after = pool(scope).filter(matches).sort(order);
          const sib = after.find((y) => y.interactionId === f.interactionId && y.status === "Detected");
          const next = sib || after[Math.min(at, after.length - 1)] || after[0] || null;
          ui.selected = next && next.findingId !== f.findingId ? next.findingId : (ui.view === "awaiting" ? (next ? next.findingId : null) : f.findingId);
          rerender();
          break;
        }
        default: break;
      }
    });
    root.addEventListener("change", (ev) => {
      const el = ev.target, form = el.closest("[data-fq-form]");
      if (el.name === "fqGroup") { ui.group = el.value; rerender(); return; }
      if (el.name === "fqSeverity" && !form) { ui.severity = el.value; rerender(); return; }
      if (el.name === "fqRule") { ui.rule = el.value; rerender(); return; }
      if (!form) return;
      const f = S.finding(form.dataset.fqForm);
      if (el.name === "fqDecision") {
        const sel = form.querySelector("[name='fqReason']"), list = el.value === "Confirmed" ? D.confirmReasons : D.dismissReasons;
        sel.disabled = false; sel.innerHTML = `<option value="">Choose a reason</option>${list.map((x) => `<option value="${U.esc(x)}">${U.esc(x)}</option>`).join("")}`;
        const wrap = form.querySelector("[data-confirm-only]"); if (wrap) wrap.hidden = el.value !== "Confirmed";
      } else if (el.name === "fqSeverity") {
        const inp = form.querySelector("[name='fqSeverityReason']"); if (inp) inp.hidden = el.value === f.severity;
      } else if (el.name === "fqEscalate") {
        const block = form.querySelector("[data-esc-block]"); if (block) block.hidden = !el.checked;
      }
    });
    const s = root.querySelector("#fqSearch"); if (s) s.addEventListener("input", U.debounce(() => { ui.search = s.value; const pos = s.selectionStart; rerender(); const s2 = document.querySelector("#fqSearch"); if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); } }, 220));
    AGC.pages.interactions.bindConversation(root, currentX);
    bindForm();
    if (!keysBound) {
      keysBound = true;
      document.addEventListener("keydown", (ev) => {
        if (!document.querySelector(".fq-split") || ev.altKey || ev.ctrlKey || ev.metaKey) return;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test((ev.target.tagName || "").toUpperCase())) return;
        if (ev.key !== "j" && ev.key !== "k") return;
        const rows = Array.from(document.querySelectorAll(".fq-row")), i = rows.findIndex((b) => b.classList.contains("selected"));
        const nextRow = ev.key === "j" ? rows[i + 1] || rows[0] : rows[i - 1] || rows[rows.length - 1];
        if (nextRow) { nextRow.click(); nextRow.scrollIntoView({ block: "nearest" }); ev.preventDefault(); }
      });
    }
    const sel = root.querySelector(".fq-row.selected"); if (sel) sel.scrollIntoView({ block: "center" });
  };
})();
