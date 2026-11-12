/* Group page: one business group, the unit of governance. Sub-pages: Overview, AI assets (the Registry's rows filtered
   to the group) and Members. A group is not registered; it is ready or not (owner and reviewer access). Findings, policies,
   interactions, sources, evidence and audit history return with their own pages. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.group = {});

  P.SUBPAGES = [
    { key: "overview", label: "Overview", icon: "overview" },
    { key: "registry", label: "AI assets", icon: "coverage" },
    { key: "members", label: "Members", icon: "members" },
    { key: "interactions", label: "Interactions", icon: "interactions" },
    { key: "findings", label: "Findings", icon: "findings" },
    { key: "audit", label: "Audit History", icon: "audit" },
  ];
  P.FACETS = P.SUBPAGES;

  function attention(g, r) {
    const items = [];
    const canSettings = S.can("settings");
    r.gaps.forEach((x) => items.push(x.kind === "owner"
      ? `${I.alert} ${U.esc(x.text)}. ${canSettings ? `<a href="#/settings/groups?edit=${g.id}">Name a new owner.</a>` : "Ask an Archive360 Administrator to name a new owner."}`
      : `${I.alert} ${U.esc(x.text)}. ${canSettings ? `<a href="#/settings/access">See the Readiness check.</a>` : "Ask an Archive360 Administrator to grant a reviewer access."}`));
    const entries = S.registryEntries().filter((e) => e.groupId === g.id);
    const expired = entries.filter((e) => e.status === "Expired"), due = entries.filter((e) => e.status === "Approved" && S.entryDue(e).dueSoon);
    entries.filter((e) => e.status === "Pending").forEach((e) => items.push(`${I.clock} <a href="#/registry/${e.id}">${U.esc(e.name)}</a> is awaiting approval.`));
    expired.forEach((e) => items.push(`${I.clock} <a href="#/registry/${e.id}">${U.esc(e.name)}</a> expired: not reconfirmed by ${U.fmtDate(e.reconfirmationDueDate)}.`));
    due.forEach((e) => items.push(`${I.clock} <a href="#/registry/${e.id}">${U.esc(e.name)}</a> reconfirmation due in ${S.entryDue(e).days} ${U.plural(S.entryDue(e).days, "day")}.`));
    /* An accountable owner who moved to another group keeps the registration until it is handed over; the move must not stay silent. */
    entries.filter((e) => !["Retired", "Rejected"].includes(e.status)).forEach((e) => {
      const o = S.member(e.ownerMemberId); if (!o || o.primaryGroupId === g.id) return;
      const was = (o.groupHistory || []).find((h) => h.groupId === g.id && h.toDate), now = (o.groupHistory || []).slice(-1)[0];
      if (!was || !now) return;
      items.push(`${I.alert} <a href="#/members/${o.memberId}">${U.esc(o.displayName)}</a>, accountable owner of <a href="#/registry/${e.id}">${U.esc(e.name)}</a>, moved from ${U.esc(g.name)} to ${U.esc(S.groupName(now.groupId))} on ${U.fmtDate(now.fromDate)}. Hand the registration over on the AI Registry, or confirm it stays with them.`);
    });
    const pendingPlat = new Set(); (S.systemsByGroup[g.id] || []).forEach((s) => { const c = S.systemCoverage(s); if (c.key === "platformPending") pendingPlat.add(c.entry.name); });
    pendingPlat.forEach((n) => items.push(`${I.clock} ${U.esc(n)} is awaiting approval, so this group's AI assets on it are not yet approved.`));
    /* Findings awaiting review are a decision waiting (Gabriel, 2026-09-25): a reviewer is sent to them, anyone else sees that they wait. */
    const awaiting = (S.findingsByGroup[g.id] || []).filter((f) => f.status === "Detected" && S.inRange(f.detectedAt)).length;
    if (awaiting) items.push(`${I.clock} ${U.fmtNum(awaiting)} ${U.plural(awaiting, "finding is", "findings are")} awaiting review. ${S.permission("review", { groupId: g.id }).allowed ? `<a href="#/groups/${g.id}/findings">Review ${awaiting === 1 ? "it" : "them"}.</a>` : "Waiting for a reviewer."}`);
    /* The group's escalations waiting on an approver, or on a reviewer after a return (Approvals, 2026-09-25). */
    const gEsc = (S.escalationsByGroup[g.id] || []).filter((e) => e.status === "Open"), gRet = (S.escalationsByGroup[g.id] || []).filter((e) => e.status === "Returned");
    if (gEsc.length) items.push(`${I.flag} ${gEsc.length} ${U.plural(gEsc.length, "escalation is", "escalations are")} awaiting an approver's decision. ${S.can("approve") ? `<a href="#/approvals">Open Approvals.</a>` : (canSeeMembers(g) ? `<a href="#/groups/${g.id}/findings">See ${gEsc.length === 1 ? "it" : "them"} on Findings.</a>` : "")}`);
    if (gRet.length) items.push(`${I.flag} ${gRet.length} ${U.plural(gRet.length, "escalation was", "escalations were")} returned to the reviewer and ${U.plural(gRet.length, "waits", "wait")} for a revision.${S.permission("review", { groupId: g.id }).allowed ? ` <a href="#/groups/${g.id}/findings?open=${gRet.slice().sort((a, b) => (a.escalatedAt || "").localeCompare(b.escalatedAt || ""))[0].findingId}">Revise ${gRet.length === 1 ? "it" : "them"} on Findings.</a>` : ""}`);
    /* The owner's response (2026-09-28): an approved remediation is the owner's to-do item, and a suspended registration is said so. */
    const me = S.persona(), gOwner = S.member(g.ownerMemberId), short = (t) => (t.length > 120 ? `<span title="${U.esc(t)}">${U.esc(t.slice(0, 118))}…</span>` : U.esc(t));
    (S.escalationsByGroup[g.id] || []).filter(S.remediationOpen).forEach((e) => {
      const en = e.registerEntryId ? S.entry(e.registerEntryId) : null, f = S.finding(e.findingId), m = f ? S.member(f.memberId) : null, sys = e.aiSystemId ? S.system(e.aiSystemId) : null;
      const appr = (e.approvals || []).filter((a) => a.decision === "Approved").slice(-1)[0], apprBy = appr ? S.member(appr.approverMemberId) : null, when = U.fmtDate(appr ? appr.decidedAt : e.escalatedAt);
      const perm = S.permission("remediate", { entry: en, escalation: e }), rOwner = S.remediationOwner(e) || gOwner, own = S.remediationOwnUse(e), isOwner = !own && !!(me && rOwner && rOwner.memberId === me.memberId);
      const state = S.remediationStatus(e) === "In progress" ? `in progress${e.startedAt ? ` since ${U.fmtDate(e.startedAt)}` : ""}` : `not started and waits for ${own ? S.REMEDIATION_OWN_USE : isOwner ? "you" : (rOwner ? U.esc(rOwner.displayName) : "the owner")}`;
      const fix = !perm.allowed ? "" : isOwner ? (en ? "Complete it and reconfirm." : "Complete it.") : "Complete it on the owner's behalf.";
      if (en) items.push(`${I.alert} <a href="#/registry/${en.id}">${U.esc(en.name)}</a> is suspended: the remediation approved${apprBy ? ` by ${U.esc(apprBy.displayName)}` : ""} on ${when} is ${state}: ${short(e.proposedRemediation || "")}${fix ? ` <a href="#/registry/${en.id}">${fix}</a>` : ""}`);
      else items.push(`${I.alert} The remediation approved on ${when} for ${m ? U.esc(m.displayName) : "a person"}'s use of ${sys ? U.esc(sys.name) : "AI"} is ${state}: ${short(e.proposedRemediation || "")}${fix ? ` <a href="#/groups/${g.id}/findings?open=${e.findingId}">${fix}</a>` : ""}`);
    });
    entries.filter((en) => en.status === "Suspended" && !S.entryRemediation(en.id)).forEach((en) => { const pe = S.entryPendingEscalation(en.id); items.push(`${I.clock} <a href="#/registry/${en.id}">${U.esc(en.name)}</a> is suspended pending the approver's decision${pe && pe.status === "Returned" ? "; the escalation is back with the reviewer" : ""}.`); });
    if (!items.length) return `<div class="notice notice-ok">${I.checkCircle}<span>Nothing needs attention. Owner and reviewer access are in place, and every registration is current.</span></div>`;
    return C.attentionBox(items);
  }

  function overview(g) {
    const r = S.groupReadiness(g), owner = r.owner;
    const systems = (S.systemsByGroup[g.id] || []).filter((s) => !s.external && s.type !== "Custom");
    const counts = U.countBy(systems, (s) => S.systemCoverage(s).key);
    /* Outside GPTs are counted on their own: the systems list above leaves them out, so the old "Not sanctioned" figure was always 0 here while the group's AI Registry sub-page counted them. */
    const outside = (S.systemsByGroup[g.id] || []).filter((s) => s.external).length;
    const byType = U.countBy(systems, "type");
    const apps = S.registryEntries().filter((e) => e.groupId === g.id && e.level === "Custom AI system");
    const registered = S.registryEntries().filter((e) => e.groupId === g.id && ["GPT", "Project", "Plugin"].includes(e.level) && e.status !== "Retired");
    const members = S.membersByGroup[g.id] || [], active = members.filter((m) => m.memberStatus === "Active");
    const anchors = canSeeMembers(g) ? S.sortMembers(active).slice(0, 4) : [];
    const ints = S.scoped(S.interactionsByGroup[g.id] || []);
    const digest = D.digests.filter((x) => x.groupId === g.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
    /* Findings in the band's period (Gabriel, 2026-09-25): the counts for everyone who can open the group, the list for those who may see it. */
    const fnd = (S.findingsByGroup[g.id] || []).filter((f) => S.inRange(f.detectedAt));
    const fc = { awaiting: fnd.filter((f) => f.status === "Detected").length, confirmed: fnd.filter((f) => f.status === "Confirmed").length, dismissed: fnd.filter((f) => f.status === "Dismissed").length, escalated: fnd.filter((f) => f.escalationId).length };
    const findingsCard = C.card("Findings", `<div class="summary-grid summary-grid-4">
              <div class="sg-item"><div class="sg-val${fc.awaiting ? " warn-text" : ""}">${U.fmtNum(fc.awaiting)}</div><div class="sg-label">Awaiting review</div></div>
              <div class="sg-item"><div class="sg-val${fc.confirmed ? " danger-text" : ""}">${U.fmtNum(fc.confirmed)}</div><div class="sg-label">Confirmed violations</div></div>
              <div class="sg-item"><div class="sg-val">${U.fmtNum(fc.dismissed)}</div><div class="sg-label">Dismissed</div></div>
              <div class="sg-item"><div class="sg-val">${U.fmtNum(fc.escalated)}</div><div class="sg-label">Escalated</div></div>
            </div>
            <p class="small muted">${fnd.length ? `${U.fmtNum(fnd.length)} ${U.plural(fnd.length, "finding")} in this period. A finding is a violation only once a reviewer confirms it.` : "No findings in this period."}${canSeeMembers(g) ? "" : " The list is not available for your profile; the counts are."}</p>`,
      { action: canSeeMembers(g) ? `<a class="link" href="#/groups/${g.id}/findings">All findings ${I.arrowRight}</a>` : "" });
    return `
      ${attention(g, r)}
      <div class="status-cards">
        ${C.card("Governance", `
          <div class="status-main">${r.ready ? `<span class="pill pill-ok">${I.checkCircle}<span>Ready</span></span>` : `<span class="pill pill-danger">${I.alert}<span>Not ready</span></span>`}</div>
          <dl class="kv">
            <dt>Owner</dt><dd>${owner ? `${U.esc(owner.displayName)}${U.statusTag(owner)}` : '<span class="danger-text">None</span>'}</dd>
            <dt>Reviewers with access</dt><dd>${r.coverage.length ? `${r.coverage.length} ${U.plural(r.coverage.length, "person", "people")}` : '<span class="danger-text">Nobody</span>'}</dd>
            <dt>Members</dt><dd>${U.fmtNum(active.length)} active${(function () { const b = U.statusBreakdown(members, { skipActive: true }); return b ? ` · ${b}` : ""; })()}</dd>
            <dt>Interactions</dt><dd>${U.fmtNum(ints.length)}${ints.length ? ` · latest ${U.relTime(ints.reduce((a, x) => (x.date > a ? x.date : a), ""))}` : ""}</dd>
          </dl>
          <p class="small muted">A group is ready when it has an active accountable owner and at least one reviewer who can see its activity. It is not registered itself; its platforms and individually registered AI assets are.</p>`)}
        ${C.card("Accountable owner", owner ? `
          <div class="owner-block">${U.avatar(owner, "lg")}<div><div class="strong">${U.esc(owner.displayName)}${U.statusTag(owner)}</div><div class="muted">${U.esc(owner.jobTitle || "")}</div><div class="small"><a href="mailto:${U.esc(owner.email)}">${U.esc(owner.email)}</a></div></div></div>
          <dl class="kv">
            <dt>Accountable for</dt><dd>the group's use of AI: reconfirming the registrations they own, completing remediations, and retiring systems that are no longer needed</dd>
            <dt>Content access</dt><dd>${owner.entitlementPolicyIds && owner.entitlementPolicyIds.length ? U.esc(owner.entitlementPolicyIds.map((id) => S.byId.ep[id].name).join(", ")) : "None. Ownership does not grant access to interactions."}</dd>
            <dt>Digest</dt><dd>${U.esc(D.settings.digest.perGroup[g.id] || D.settings.digest.defaultFrequency)}${digest ? ` · last sent ${U.relTime(digest.sentAt)}${digest.delivered ? "" : ' <span class="danger-text">(bounced)</span>'}` : ""}</dd>
          </dl>
          ${!U.isActive(owner) ? `<div class="notice notice-danger">${I.alert}<span>${U.esc(U.statusSentence(owner))}. ${owner.memberStatus === "Terminated" ? "Digests bounce and nobody can reconfirm this group's registrations until a new owner is named." : "Nobody can reconfirm this group's registrations or complete its remediations until they return or a new owner is named."}${S.can("settings") ? "" : " Ask an Archive360 Administrator to name a new owner."}</span></div>` : ""}` : `<div class="notice notice-danger">${I.alert}<span>No owner assigned. Digests have nobody to go to and nobody can reconfirm this group's registrations.${S.can("settings") ? "" : " Ask an Archive360 Administrator to name an owner."}</span></div>`)}
        ${C.card("Reviewer access", `
          <div class="status-main">${r.coverage.length ? `<span class="cov-ok big">${I.coverage} ${r.coverage.length} ${U.plural(r.coverage.length, "reviewer has", "reviewers have")} access</span>` : `<span class="cov-gap big">${I.alert} No reviewer has access</span>`}</div>
          <p class="small muted">Derived from Archive360 Profiles and Entitlement Policies, never stored on the group.</p>
          ${r.coverage.length ? `<ul class="people-list">${r.coverage.map((c) => `<li>${U.avatar(c.member, "sm")}<span><span class="strong">${U.esc(c.member.displayName)}</span><span class="muted"> · ${U.esc(c.member.jobTitle || "")}</span></span></li>`).join("")}</ul>` : `<div class="notice notice-warn">${I.alert}<span>Findings from this group wait unreviewed until an Archive360 Entitlement Policy covering it is assigned to a reviewer.${S.can("settings") ? "" : " Ask an Archive360 Administrator to grant a reviewer access."}</span></div>`}
`)}
      </div>
      <div class="two-col">
        <div class="col-main">
          ${findingsCard}
          ${C.card(`AI in ${U.esc(g.name)}`, `<div class="summary-grid">
              <div class="sg-item"><div class="sg-val">${U.fmtNum(byType.GPT || 0)}</div><div class="sg-label">GPTs</div></div>
              <div class="sg-item"><div class="sg-val">${U.fmtNum(byType.Project || 0)}</div><div class="sg-label">Projects</div></div>
              <div class="sg-item"><div class="sg-val">${U.fmtNum(byType.Plugin || 0)}</div><div class="sg-label">Plugins</div></div>
              <div class="sg-item"><div class="sg-val">${U.fmtNum(apps.length)}</div><div class="sg-label">Custom AI applications</div></div>
              <div class="sg-item"><div class="sg-val${outside ? " danger-text" : ""}">${U.fmtNum(outside)}</div><div class="sg-label">Built outside your workspace</div></div>
            </div>
            <p class="small muted">${counts.platform || 0} managed within their platform · ${registered.length} registered individually${counts.platformPending ? ` · ${counts.platformPending} on a platform awaiting approval` : ""}.</p>
            ${registered.length ? `<h4 class="sub-title">Registered individually</h4><ul class="people-list">${registered.slice(0, 6).map((e) => `<li>${AGC.pages.registry.badge(e.level)}<span><a class="strong" href="#/registry/${e.id}">${U.esc(e.name)}</a><span class="muted"> · owner ${U.esc(S.member(e.ownerMemberId) ? S.member(e.ownerMemberId).displayName : "")}</span></span><span class="small people-status">${AGC.pages.registry.approvalCell(e)}</span></li>`).join("")}</ul>${registered.length > 6 ? `<p class="small muted">and ${registered.length - 6} more</p>` : ""}` : ""}
            ${apps.length ? `<h4 class="sub-title">Custom AI applications</h4><ul class="people-list">${apps.map((e) => `<li>${AGC.pages.registry.badge("Custom AI application")}<span><a class="strong" href="#/registry/${e.id}">${U.esc(e.name)}</a><span class="muted"> · owner ${U.esc(S.member(e.ownerMemberId) ? S.member(e.ownerMemberId).displayName : "")}</span></span><span class="small people-status">${AGC.pages.registry.approvalCell(e)}</span></li>`).join("")}</ul>` : ""}`,
            { action: `<a class="link" href="#/groups/${g.id}/registry">All AI assets ${I.arrowRight}</a>` })}
          ${C.card(`What ${U.esc(g.name)} uses AI for`, C.useMixList(S.useMix(ints), ints.length))}
        </div>
        <div class="col-side">
          ${C.riskCard(S.riskForGroup(g.id), { title: "Risk" })}
          ${C.card("Members", `<div class="status-main"><span class="strong">${U.fmtNum(active.length)}</span> <span class="muted">active members${(function () { const b = U.statusBreakdown(members, { skipActive: true }); return b ? ` · ${b}` : ""; })()}</span></div>
            ${canSeeMembers(g) ? "" : '<p class="small muted">Names are not available for your profile; the counts are.</p>'}<ul class="people-list">${anchors.map((m) => `<li>${U.avatar(m, "sm")}<span><a class="strong" href="#/members/${m.memberId}">${U.esc(m.displayName)}</a><span class="muted"> · ${U.esc(m.jobTitle || "")}</span></span><span class="small muted">${S.scoped(S.interactionsByMember[m.memberId] || []).length} interactions</span></li>`).join("")}</ul>`,
            { action: `<a class="link" href="#/groups/${g.id}/members">All members ${I.arrowRight}</a>` })}
          ${C.card("Business Group Mapping", `<dl class="kv"><dt>${U.esc(D.mapping.identitySource || "Identity source")}</dt><dd>${U.esc(S.attributeOption(D.mapping.sourceAttribute).label)}</dd><dt>${U.esc(S.attributeOption(D.mapping.sourceAttribute).label)}s</dt><dd>${(S.groupMappedValues(g.id).length ? S.groupMappedValues(g.id).map((row) => `<span class="chip chip-muted">${U.esc(row.rawValue)}</span>`).join(" ") : '<span class="danger-text">None mapped</span>')}</dd></dl>`)}
        </div>
      </div>`;
  }

  /* Who may see a group's people: the same rule as the People tab (2026-09-23). The group's other cards are metadata and stay. */
  const canSeeMembers = (g) => { const p = S.persona(); return !!p && (S.can("settings") || S.isEntitled(g.id) || g.ownerMemberId === p.memberId); };
  P.canSeeMembers = canSeeMembers;
  function membersPage(g) {
    if (!canSeeMembers(g)) return C.card("Members", `<div class="placeholder-card"><div class="ph-title">${I.lock} The members of ${U.esc(g.name)} are not available for your profile</div><div class="ph-body">Access to people comes from your Profile and Entitlement Policies, managed by an Archive360 Administrator.</div></div>`);
    /* The People tab's grid, row for row (Gabriel, 2026-09-25); the Interactions column was removed at his instruction the same day. */
    const PP = AGC.pages.people, members = S.membersByGroup[g.id] || [];
    const rows = S.sortMembers(members, (a, b) => (PP.statusRank(a) - PP.statusRank(b) || a.displayName.localeCompare(b.displayName)));
    return `${C.card(`Members <span class="count-badge">${rows.filter((m) => m.memberStatus !== "Terminated").length}</span>`, `<p class="lead">People attributed to ${U.esc(g.name)} through Business Group Mapping. Their interactions belong to this group; the AI assets they create do too.</p>
      <div class="tbl-wrap"><table class="tbl tbl-registry tbl-people">${PP.personHead()}<tbody>${rows.map((m) => PP.personRow(m)).join("") || `<tr><td colspan="${PP.personColumns()}">${C.emptyState("No members yet", "Map an attribute value to this group on the Business Group Mapping page.")}</td></tr>`}</tbody></table></div>`)}`;
  }

  /* The header's one sentence: who answers for the group, who can review it, how many people it has and which attribute values feed it,
     and the period when the reader set one, so the numbers below never belong to a period the reader forgot (Gabriel, 2026-09-25). */
  function headerSentence(g, r, sub) {
    const owner = r.owner, members = (S.membersByGroup[g.id] || []).filter((m) => m.memberStatus !== "Terminated");
    const attr = S.attributeOption(D.mapping.sourceAttribute).label, values = S.groupMappedValues(g.id).map((row) => row.rawValue);
    const list = values.length > 1 ? `${values.slice(0, -1).map(U.esc).join(", ")} and ${U.esc(values[values.length - 1])}` : (values.length ? U.esc(values[0]) : "none mapped");
    const parts = [
      `Accountable owner ${owner ? `${U.esc(owner.displayName)}${owner.memberStatus !== "Active" ? `, ${U.esc(U.STATUS[owner.memberStatus].word)}` : ""}` : "none"}`,
      `${r.coverage.length} ${U.plural(r.coverage.length, "reviewer")} with access`,
      `${U.fmtNum(members.length)} ${U.plural(members.length, "member")}`,
      `${U.esc(attr)}${values.length === 1 ? "" : "s"} ${list}`,
    ];
    const dr = AGC.state.dateRange, period = dr.mode === "custom" && !(sub === "registry" || sub === "members") ? ` Showing ${U.fmtDate(dr.from)} to ${U.fmtDate(dr.to)}.` : "";
    return `${parts.join(" · ")}.${period}`;
  }
  P.render = function (params) {
    const g = S.group(params.id);
    if (!g) { AGC.router.navigate("#/groups"); return; }
    const sub = P.SUBPAGES.some((s) => s.key === params.facet) ? params.facet : (params.facet === "systems" ? "registry" : "overview");
    const r = S.groupReadiness(g);
    const html = sub === "overview" ? overview(g) : sub === "registry" ? AGC.pages.registry.groupHtml(g.id) : sub === "audit" ? AGC.pages.audit.groupHtml(g.id) : sub === "interactions" ? AGC.pages.interactions.groupHtml(g.id) : sub === "findings" ? AGC.pages.findings.groupHtml(g.id) : membersPage(g);
    AGC.shell.render({
      kind: "detail", navKey: "groups", title: g.name,
      breadcrumb: [{ label: "Groups", href: "#/groups" }, { label: g.name, href: `#/groups/${g.id}` }],
      viewOptions: P.SUBPAGES.map((f) => ({ label: f.label, href: `#/groups/${g.id}/${f.key}`, active: f.key === sub })),
      /* The AI assets sub-page has no numbers that depend on a period (Gabriel, 2026-09-22), and neither has Members since its Interactions
         column went (2026-09-25), so their bands carry no date range. */
      detail: { noDateRange: sub === "registry" || sub === "members", iconHtml: AGC.GROUP_ICON, name: g.name, statusHtml: r.ready ? `<span class="pill pill-ok">${I.checkCircle}<span>Ready</span></span>` : `<span class="pill pill-danger">${I.alert}<span>Not ready</span></span>`, sentence: headerSentence(g, r, sub), firstDate: g.firstSynchronized },
      html,
      after(root) { if (sub === "registry") AGC.pages.registry.after(root); else if (sub === "audit") AGC.pages.audit.after(root); else if (sub === "interactions") AGC.pages.interactions.after(root); else if (sub === "findings") AGC.pages.findings.after(root); else if (sub === "members") AGC.pages.people.bindPersonActions(root); },
    });
  };
})();
