/* Placeholders for tabs and detail pages that arrive in later build steps. Each shows real data so links are never dead ends. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.placeholder = {});

  function ph(title, body, step) {
    return `<div class="placeholder-card"><div class="ph-title">${title}</div><div class="ph-body">${body}</div><div class="ph-note">Built in step ${step} of the build plan. The data behind it already exists.</div></div>`;
  }

  P.tab = function (navKey, step) {
    const nav = AGC.shell.navMeta(navKey);
    let body = "";
    if (navKey === "approvals") {
      const items = S.approvalItems();
      body = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Type</th><th>Subject</th><th>Group</th><th>Severity</th><th>Approvals</th><th>Requested</th></tr></thead><tbody>${items.map((a) => `<tr><td>${U.esc(a.kind)}</td><td class="strong">${U.esc(a.aiSystemId ? S.systemName(a.aiSystemId) : (a.entry ? a.entry.name : ""))}</td><td>${U.esc(S.groupName(a.groupId))}</td><td>${a.severity ? U.sevChip(a.severity) : ""}</td><td>${a.blocked ? '<span class="danger-text">Blocked</span>' : `${a.given} of ${a.required}`}</td><td>${U.fmtDate(a.requestedAt)}</td></tr>`).join("")}</tbody></table></div>`;
    } else if (navKey === "findings") {
      const rows = S.activeGroups().map((g) => ({ g, st: S.groupStats(g.id) })).sort((a, b) => b.st.awaiting - a.st.awaiting);
      body = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Group</th><th class="num">Awaiting review</th><th class="num">Confirmed</th><th class="num">Dismissed</th><th>Reviewers</th></tr></thead><tbody>${rows.map(({ g, st }) => `<tr><td><a class="strong" href="#/groups/${g.id}/findings">${U.esc(g.name)}</a></td><td class="num${st.awaiting ? " danger-text" : ""}">${st.awaiting}</td><td class="num">${st.confirmed}</td><td class="num">${st.dismissed}</td><td>${st.coverageCount || '<span class="danger-text">none</span>'}</td></tr>`).join("")}</tbody></table></div>`;
    } else if (navKey === "unregistered") {
      body = `<ul class="mini-list">${D.unregisteredItems.map((u) => `<li><span class="mini-kind">${U.esc(u.type)} · ${U.esc(u.status)}</span><span class="mini-main">${U.esc(u.name)}</span><span class="mini-meta">${U.esc(u.suggestion)}</span></li>`).join("")}</ul>`;
    } else if (navKey === "rules") {
      body = `<ul class="rule-list">${D.rules.map((r) => `<li><span class="rule-name">${U.esc(r.name)}</span><span class="rule-meta">${U.sevChip(r.defaultSeverity)} <span class="muted">v${U.esc(r.currentVersion)} · ${U.esc(r.family)} · ${U.esc(r.regulatoryBasis.join(", "))}</span></span></li>`).join("")}</ul>`;
    } else if (navKey === "audit") {
      body = C.auditList(D.auditEvents, 15);
    } else if (navKey === "settings") {
      body = `<ul class="mini-list"><li><span class="mini-main">Business Group Mapping</span><span class="mini-meta">${D.mapping.rows.length} attribute values · ${D.mapping.unmappedValues.length} unmapped · version ${D.mapping.currentVersion}</span></li><li><span class="mini-main">Digests</span><span class="mini-meta">Default ${U.esc(D.settings.digest.defaultFrequency)}; immediate for ${D.settings.digest.immediateCases.length} cases</span></li><li><span class="mini-main">Approvals</span><span class="mini-meta">Critical requires ${D.settings.approvals.requiredBySeverity.Critical} approvers; other severities ${D.settings.approvals.requiredBySeverity.High}</span></li></ul>`;
    }
    AGC.shell.render({ kind: "list", navKey, title: nav.title, description: nav.description, icon: nav.icon, html: ph(`${U.icon(nav.icon)} ${U.esc(nav.title)}`, body, step) });
  };

  P.entity = function (kind, id) {
    let title = kind, body = "", crumbs = [], detail = {};
    if (kind === "register") {
      const e = S.entry(id);
      if (!e) { body = "Register entry not found."; }
      else {
        title = e.name;
        crumbs = [{ label: "Groups", href: "#/groups" }, e.groupId ? { label: S.groupName(e.groupId), href: `#/groups/${e.groupId}` } : null, { label: e.name }].filter(Boolean);
        detail = { name: e.name, statusHtml: U.statusPill(e.status), viewName: "Register entry", iconHtml: I.approvals };
        body = `<dl class="kv"><dt>Level</dt><dd>${U.esc(e.level)}</dd><dt>Status</dt><dd>${U.statusPill(e.status)}${e.blockers.length ? " " + U.esc(e.blockers.join(", ")) : ""}</dd><dt>Owner</dt><dd>${U.memberLink(S.member(e.ownerMemberId))}</dd><dt>Approved purpose</dt><dd>${U.esc(e.approvedPurpose)}</dd><dt>Permitted data</dt><dd>${e.permittedDataClasses.map((d) => U.esc(S.dcName(d))).join(", ") || "None"}</dd><dt>Reconfirmation due</dt><dd>${e.reconfirmationDueDate ? U.fmtDate(e.reconfirmationDueDate) : "After approval"}</dd></dl>
          <h4 class="sub-title">Decision history</h4><ul class="history-list">${e.decisionHistory.slice().reverse().map((h) => `<li><span class="hist-date">${U.fmtDate(h.date)}</span><span class="hist-action">${U.esc(h.action)}</span><span class="hist-detail">${U.esc(h.detail)}${h.actorMemberId ? ` <span class="muted">· ${U.esc(S.member(h.actorMemberId) ? S.member(h.actorMemberId).displayName : "")}</span>` : ' <span class="muted">· system</span>'}</span></li>`).join("")}</ul>`;
      }
    } else if (kind === "systems") {
      const s = S.system(id);
      if (!s) body = "AI system not found."; else {
        title = s.name;
        const en = S.entryForSystem(s.id);
        const r = S.riskForSystem(s.id);
        crumbs = [{ label: "Groups", href: "#/groups" }, s.groupId ? { label: S.groupName(s.groupId), href: `#/groups/${s.groupId}` } : null, { label: s.name }].filter(Boolean);
        detail = { name: s.name, statusHtml: en ? U.statusPill(en.status) : "", viewName: s.type, iconHtml: I.systems };
        body = `<dl class="kv"><dt>Type</dt><dd>${U.esc(s.type)}${s.external ? " (external)" : ""}</dd><dt>Platform</dt><dd>${U.esc(S.platform(s.platformId).name)}</dd><dt>Created</dt><dd>${U.fmtDate(s.createdDate)} by ${U.esc(s.creatorName)}</dd><dt>Registration</dt><dd>${en ? U.statusPill(en.status) + ` <a href="#/register/${en.id}">entry</a>` : (s.registrationCoverage === "group" ? "Covered by the group registration" : '<span class="danger-text">Unregistered</span>')}</dd><dt>Risk</dt><dd>${U.riskBadge(r.score)}</dd><dt>Interactions</dt><dd>${U.fmtNum((S.interactionsBySystem[s.id] || []).length)}</dd><dt>Findings</dt><dd>${(S.findingsBySystem[s.id] || []).length}</dd><dt>Description</dt><dd>${U.esc(s.description)}</dd></dl>${C.riskFactors(r, 6)}`;
      }
    } else if (kind === "members") {
      const m = S.member(id);
      if (!m) body = "Member not found."; else {
        title = m.displayName;
        crumbs = [{ label: "Groups", href: "#/groups" }, m.primaryGroupId ? { label: S.groupName(m.primaryGroupId), href: `#/groups/${m.primaryGroupId}` } : null, { label: m.displayName }].filter(Boolean);
        detail = { name: m.displayName, statusHtml: "", viewName: "Member", iconHtml: I.members };
        body = `<div class="owner-block">${U.avatar(m, "lg")}<div><div class="strong">${U.esc(m.displayName)}</div><div class="muted">${U.esc(m.jobTitle)} · ${U.esc(S.groupName(m.primaryGroupId))}</div><div class="small">${U.esc(m.email)}</div></div></div><dl class="kv"><dt>Department (identity source)</dt><dd>${U.esc(m.department || "blank")} · assigned by ${U.esc(m.assignmentSource)}</dd><dt>Status</dt><dd>${U.esc(m.memberStatus)}</dd><dt>Profile</dt><dd>${U.esc(S.byId.profile[m.profileId].name)}</dd><dt>Entitlement</dt><dd>${m.entitlementPolicyIds.map((id) => U.esc(S.byId.ep[id].name)).join(", ") || "None"}</dd><dt>Interactions</dt><dd>${U.fmtNum((S.interactionsByMember[m.memberId] || []).length)}</dd><dt>Findings on own activity</dt><dd>${(S.findingsByMember[m.memberId] || []).length}</dd></dl>`;
      }
    } else if (kind === "unregistered") {
      const u = S.byId.unregistered[id];
      title = u ? u.name : "Unregistered item";
      crumbs = [{ label: "Unregistered AI", href: "#/unregistered" }, { label: title }];
      detail = { name: title, viewName: u ? u.type : "", iconHtml: I.unregistered };
      body = u ? `<dl class="kv"><dt>Type</dt><dd>${U.esc(u.type)}</dd><dt>Identity</dt><dd>${U.esc(u.identity)}</dd><dt>Observed via</dt><dd>${U.esc(u.source)}</dd><dt>First seen</dt><dd>${U.fmtDate(u.firstSeen)}</dd><dt>Last seen</dt><dd>${U.fmtDate(u.lastSeen)}</dd><dt>Interactions</dt><dd>${U.fmtNum(u.interactionCount)}</dd><dt>Members</dt><dd>${u.memberIds.length}</dd><dt>Findings</dt><dd>${u.findingIds.length}</dd><dt>Suggestion</dt><dd>${U.esc(u.suggestion)}</dd></dl>` : "Not found.";
    } else if (kind === "rules") {
      const r = S.rule(id);
      title = r ? r.name : "Rule";
      crumbs = [{ label: "AI Policy Rules", href: "#/rules" }, { label: title }];
      detail = { name: title, viewName: "AI Policy Rule", iconHtml: I.rules };
      body = r ? `<dl class="kv"><dt>Family</dt><dd>${U.esc(r.family)}</dd><dt>Default severity</dt><dd>${U.sevChip(r.defaultSeverity)}</dd><dt>Data classes</dt><dd>${r.dataClassIds.map((d) => U.esc(S.dcName(d))).join(", ")}</dd><dt>Permitted in</dt><dd>${r.permittedGroupIds === null ? "Context rule (evaluated on every group)" : r.permittedGroupIds.length ? r.permittedGroupIds.map((g) => U.esc(S.groupName(g))).join(", ") : "Never permitted"}</dd><dt>Regulatory basis</dt><dd>${U.esc(r.regulatoryBasis.join(", "))}</dd><dt>Remediation guidance</dt><dd>${U.esc(r.remediationGuidance)}</dd></dl><h4 class="sub-title">Versions</h4><ul class="history-list">${r.versions.slice().reverse().map((v) => `<li><span class="hist-date">${U.fmtDate(v.effectiveDate)}</span><span class="hist-action">v${U.esc(v.version)}</span><span class="hist-detail">${U.esc(v.changeNote)}</span></li>`).join("")}</ul>` : "Not found.";
    } else if (kind === "approvals") {
      const e = S.escalation(id) || null;
      title = e ? `Escalation ${e.escalationId}` : "Approval";
      crumbs = [{ label: "Approvals", href: "#/approvals" }, { label: title }];
      detail = { name: e ? (e.aiSystemId ? S.systemName(e.aiSystemId) : S.groupName(e.groupId)) : title, viewName: e ? `${e.target} remediation` : "", iconHtml: I.approvals };
      body = e ? `<dl class="kv"><dt>Status</dt><dd>${U.esc(e.status)}</dd><dt>Target</dt><dd>${U.esc(e.target)}</dd><dt>Proposed remediation</dt><dd>${U.esc(e.proposedRemediation)}</dd><dt>Escalated by</dt><dd>${U.esc(S.member(e.escalatedByMemberId).displayName)} · ${U.fmtDateTime(e.escalatedAt)}</dd><dt>Approvals</dt><dd>${e.approvals.filter((a) => a.decision === "Approved").length} of ${e.requiredApprovals}${e.approvals.map((a) => `<div class="small">${U.esc(a.decision)} by ${U.esc(S.member(a.approverMemberId).displayName)}: ${U.esc(a.reasoning)}</div>`).join("")}</dd></dl>` : "Not found.";
    }
    const stepFor = { register: 2, systems: 2, members: 6, unregistered: 5, rules: 6, approvals: 4 }[kind] || 2;
    /* None of these has sub-pages or numbers that depend on a period, so they use the item header, never the group page's band with its date range. */
    AGC.shell.render({ kind: "item", navKey: kind === "unregistered" ? "unregistered" : kind === "rules" ? "rules" : kind === "approvals" ? "approvals" : "groups", title,
      breadcrumb: crumbs, item: { badgeHtml: `<span class="type-ic" aria-hidden="true">${detail.iconHtml || U.icon("overview")}</span>`, name: detail.name || title, statusHtml: detail.statusHtml || "", sentence: U.esc(detail.viewName || "") },
      html: ph(U.esc(title), body, stepFor) });
  };
})();
