/* Store: indexes over the data modules, persona permissions, scope and date filters, computed statistics and risk scores.
   All mutations happen in memory (nothing persists). */
(function () {
  const U = AGC.util;
  const D = AGC.data;
  const S = (AGC.store = {});
  const state = (AGC.state = {
    persona: null,
    theme: "light",
    dateRange: { mode: "all", from: null, to: null },
    ui: { groupsView: "cards", groupsSearch: "", groupsStatus: "all", groupsSort: "name" },
    audit: [], // runtime-added events (prepended to data)
  });

  function index(arr, key) { const m = {}; for (const x of arr) m[x[key]] = x; return m; }
  S.byId = {
    member: index(D.members, "memberId"), group: index(D.groups, "id"), system: index(D.aiSystems, "id"),
    entry: index(D.registerEntries, "id"), rule: index(D.rules, "id"), dataClass: index(D.dataClasses, "id"),
    finding: index(D.findings, "findingId"), interaction: index(D.interactions, "interactionId"),
    escalation: index(D.escalations, "escalationId"), platform: index(D.platforms, "id"), workspace: index(D.workspaces, "id"),
    profile: index(D.profiles, "id"), ep: index(D.entitlementPolicies, "id"), persona: index(D.personas, "id"),
    unregistered: index(D.unregisteredItems, "id"), evidence: index(D.evidencePackages, "id"),
  };
  S.member = (id) => S.byId.member[id];
  S.group = (id) => S.byId.group[id];
  S.system = (id) => S.byId.system[id];
  S.entry = (id) => S.byId.entry[id];
  S.rule = (id) => S.byId.rule[id];
  S.dataClass = (id) => S.byId.dataClass[id];
  S.finding = (id) => S.byId.finding[id];
  S.escalation = (id) => S.byId.escalation[id];
  S.interaction = (id) => S.byId.interaction[id];
  S.platform = (id) => S.byId.platform[id];

  // Static grouped indexes (arrays hold object references, so status edits stay visible)
  S.membersByGroup = U.groupBy(D.members.filter((m) => m.primaryGroupId), "primaryGroupId");
  S.systemsByGroup = U.groupBy(D.aiSystems.filter((s) => s.groupId), "groupId");
  S.interactionsByGroup = U.groupBy(D.interactions.filter((i) => i.groupId), "groupId");
  S.interactionsByMember = U.groupBy(D.interactions, "memberId");
  S.interactionsBySystem = U.groupBy(D.interactions.filter((i) => i.aiSystemId), "aiSystemId");
  S.findingsByGroup = U.groupBy(D.findings.filter((f) => f.groupId), "groupId");
  S.findingsByMember = U.groupBy(D.findings, "memberId");
  S.findingsBySystem = U.groupBy(D.findings.filter((f) => f.aiSystemId), "aiSystemId");
  S.escalationsByGroup = U.groupBy(D.escalations, "groupId");
  S.entriesByGroup = U.groupBy(D.registerEntries.filter((e) => e.groupId), "groupId");
  S.entryBySystem = index(D.registerEntries.filter((e) => ["GPT", "Project", "Plugin", "Custom AI system"].includes(e.level)), "refId");
  S.auditByGroup = U.groupBy(D.auditEvents.filter((e) => e.groupId), "groupId");

  /* ---------- Persona and permissions ---------- */
  S.setPersona = function (personaId) {
    const p = S.byId.persona[personaId];
    if (!p) { state.persona = null; (AGC.personaHooks || []).forEach((fn) => fn()); return; }
    const member = S.member(p.memberId);
    state.persona = Object.assign({}, p, { member, profile: S.byId.profile[p.profileId], eps: p.entitlementPolicyIds.map((id) => S.byId.ep[id]) });
    /* A new profile starts every page as it first loads: the pages register their filter resets here (2026-09-22). */
    (AGC.personaHooks || []).forEach((fn) => fn());
  };
  S.persona = () => state.persona;
  S.can = function (feature) { const p = state.persona; return !!(p && p.profile.features.includes(feature)); };
  S.isApprover = () => S.can("approve");
  S.entitledGroupIds = function () {
    const p = state.persona;
    if (!p) return new Set();
    const out = new Set();
    p.eps.forEach((ep) => ep.groupIds.forEach((g) => out.add(g)));
    return out;
  };
  S.isEntitled = (groupId) => S.entitledGroupIds().has(groupId);
  S.canViewContent = function (groupId, ctx) {
    if (S.isEntitled(groupId)) return true;
    if (ctx && ctx.escalated && S.isApprover()) return true;
    return false;
  };
  S.reviewedByPersona = function (finding) { return !!(finding.review && state.persona && finding.review.reviewerMemberId === state.persona.memberId); };

  // Returns {allowed, reason}. Reason is user-facing and names the persona's profile.
  S.permission = function (action, ctx) {
    const p = state.persona;
    ctx = ctx || {};
    if (!p) return { allowed: false, reason: "Choose a profile first." };
    const prof = p.profile.name;
    const need = (feature, what) => S.can(feature) ? null : `Your profile (${prof}) does not include ${what}.`;
    let r = null;
    switch (action) {
      case "register": r = need("register", "AI system registration"); break;
      case "review":
        r = need("review", "findings review");
        if (!r && ctx.groupId && !S.isEntitled(ctx.groupId)) r = `Your Entitlement Policy does not cover ${S.group(ctx.groupId) ? S.group(ctx.groupId).name : "this group"}, so you cannot review its findings.`;
        if (!r && ctx.finding && ctx.finding.memberId === p.memberId) r = "You cannot review a finding on your own activity.";
        break;
      case "escalate": r = need("escalate", "escalation"); break;
      case "approve":
        r = need("approve", "approvals");
        if (!r && ctx.finding && S.reviewedByPersona(ctx.finding)) r = "You reviewed this finding, so you cannot approve its escalation. Separation of duties is recorded in the audit trail.";
        if (!r && ctx.escalation && ctx.escalation.approvals.some((a) => a.approverMemberId === p.memberId)) r = "You have already recorded your decision on this escalation.";
        if (!r && ctx.entry && ctx.entry.ownerMemberId === p.memberId) r = "You are the accountable owner of this registration, so you cannot approve it.";
        break;
      case "reconfirm":
      case "remediate":
      case "retire": {
        /* The accountable owner always holds these duties for what they own, whatever their Profile says; the Administrator can do
           everything; Compliance (register) may retire or remediate but never attests for an owner. */
        const verb = action === "retire" ? "retire" : action === "remediate" ? "complete remediation on" : "reconfirm";
        if (action === "remediate" && ctx.escalation) {
          /* Separation of duties (Gabriel, 2026-09-28): nobody completes a remediation about their own use of AI. */
          const f = S.finding(ctx.escalation.findingId);
          if (f && f.memberId === p.memberId) { r = "This remediation is about your own use of AI, so you cannot complete it. Compliance or an Archive360 Administrator completes it."; break; }
          if (!ctx.entry) {
            /* A conduct remediation has no registration: the group's accountable owner completes it, or the Administrator, or Compliance. */
            const g = S.group(ctx.escalation.groupId), isOwner = !!g && g.ownerMemberId === p.memberId, isAdmin = p.profile.id === "prof_admin";
            if (isOwner || isAdmin || S.can("register")) { r = null; break; }
            const o = g ? S.member(g.ownerMemberId) : null;
            r = `Only the accountable owner of ${g ? g.name : "the group"} (${o ? o.displayName : "unassigned"}) can complete this remediation.`;
            break;
          }
        }
        if (ctx.entry) {
          const isOwner = ctx.entry.ownerMemberId === p.memberId, isAdmin = p.profile.id === "prof_admin";
          if (isOwner || isAdmin || (action !== "reconfirm" && S.can("register"))) { r = null; break; }
          const o = S.member(ctx.entry.ownerMemberId);
          r = verb === "retire" ? `Only the accountable owner (${o ? o.displayName : "unassigned"}) or Compliance can retire this registration.` : `Only the accountable owner (${o ? o.displayName : "unassigned"}) can ${verb} this registration.`;
          break;
        }
        r = need(action, action === "retire" ? "retiring systems" : action === "remediate" ? "completing remediations" : "reconfirmation");
        break;
      }
      case "evidence": r = need("evidence", "Allow Generate Evidence Package"); break;
      case "rules": r = need("rules", "AI Policy Rule administration"); break;
      case "mapping": r = need("mapping", "Business Group Mapping"); break;
      case "digests": r = need("digests", "notification settings"); break;
      case "settings": r = need("settings", "module settings"); break;
      case "unregistered": r = need("unregistered", "the Unregistered AI queue"); break;
      case "content":
        if (!S.canViewContent(ctx.groupId, ctx)) r = ctx.owner ? "Ownership does not grant access. Your Entitlement Policy does not cover this group's interactions." : "Your Entitlement Policy does not cover this group's interactions.";
        break;
      default: r = null;
    }
    return { allowed: !r, reason: r };
  };

  /* ---------- Scope and date filters ---------- */
  /* The module governs everything Archive360 archives for the customer; there is no platform scope (Gabriel, 2026-09-11).
     Where an AI asset or an interaction came from is shown on its row as origin metadata and filtered locally on the pages that list it. */
  S.inScope = () => true;
  /* The order the Instances page shows: platform type order, then name. The Registry's platform filter uses the same order. */
  S.instancesOrdered = function () {
    const order = D.platformTypes || [];
    return (D.instances || []).slice().sort((a, b) => (order.indexOf(a.platformType) - order.indexOf(b.platformType)) || a.name.localeCompare(b.name));
  };
  S.inRange = function (dateStr) {
    const dr = state.dateRange;
    if (dr.mode !== "custom" || !dateStr) return true;
    const d = dateStr.slice(0, 10);
    if (dr.from && d < dr.from) return false;
    if (dr.to && d > dr.to) return false;
    return true;
  };
  S.scoped = (arr, dateKey) => arr.filter((x) => S.inScope(x) && S.inRange(x[dateKey || "date"]));

  /* ---------- Sorting helpers ---------- */
  S.anchorFirst = function (getMember) {
    return function (a, b) {
      const ma = getMember(a), mb = getMember(b);
      const aa = ma && ma.isDemoAnchor ? 0 : 1, ab = mb && mb.isDemoAnchor ? 0 : 1;
      return aa - ab;
    };
  };
  S.sortMembers = function (arr, cmp) {
    return arr.slice().sort((a, b) => {
      const d = (a.isDemoAnchor ? 0 : 1) - (b.isDemoAnchor ? 0 : 1);
      if (d) return d;
      return cmp ? cmp(a, b) : a.displayName.localeCompare(b.displayName);
    });
  };

  /* ---------- Coverage ---------- */
  S.reviewersAll = function () {
    return D.members.filter((m) => m.memberStatus === "Active" && m.sourceSystem !== "Archive360 local account" && S.byId.profile[m.profileId] && S.byId.profile[m.profileId].features.includes("review"));
  };
  S.coverage = function (groupId) {
    const out = [];
    S.reviewersAll().forEach((m) => {
      const ep = m.entitlementPolicyIds.map((id) => S.byId.ep[id]).find((e) => e.groupIds.includes(groupId));
      if (ep) out.push({ member: m, ep });
    });
    return S.sortMembers(out.map((x) => Object.assign({}, x.member, { _ep: x.ep }))).map((m) => ({ member: S.member(m.memberId), ep: m._ep }));
  };

  /* ---------- Findings and escalations ---------- */
  S.openEscalations = () => D.escalations.filter((e) => ["Open", "Returned"].includes(e.status));
  /* The approver's queue (Approvals, 2026-09-25): every escalation, whatever its status, and every registration an approver decides
     (a platform or a custom application; an individually registered AI asset is approved on registration and never waits here, and the
     legacy business-group entries are not registrations). `wait` says whose turn it is for the signed-in persona: "you" (they may decide it
     now), "others" (another approver, the reviewer while it is returned, or the owner who cannot approve their own registration) or
     "decided". */
  const lastDecisionAt = (e) => (e.approvals || []).reduce((m, a) => (a.decidedAt > m ? a.decidedAt : m), e.completedAt || e.revisedAt || e.escalatedAt || "");
  S.approvalQueue = function () {
    const p = state.persona; if (!p) return [];
    const items = [];
    D.escalations.forEach((e) => {
      const f = S.finding(e.findingId), perm = S.permission("approve", { finding: f, escalation: e });
      const wait = e.status === "Open" ? (perm.allowed ? "you" : "others") : e.status === "Returned" ? "others" : "decided";
      items.push({ kind: "escalation", id: e.escalationId, escalation: e, finding: f, groupId: e.groupId || null, aiSystemId: e.aiSystemId || null, severity: f ? f.severity : null, requestedAt: e.escalatedAt, decidedAt: lastDecisionAt(e), required: e.requiredApprovals, given: (e.approvals || []).filter((a) => a.decision === "Approved").length, wait, reason: perm.allowed ? (e.status === "Returned" ? "Returned to the reviewer; it comes back when they revise it." : null) : perm.reason });
    });
    D.registerEntries.filter((e) => ["Platform", "Custom AI system"].includes(e.level)).forEach((e) => {
      const perm = S.permission("approve", { entry: e }), pending = e.status === "Pending", blocked = pending && (e.blockers || []).length > 0;
      const last = (e.decisionHistory || []).filter((h) => ["Approved", "Rejected"].includes(h.action)).slice(-1)[0];
      items.push({ kind: "registration", id: e.id, entry: e, groupId: e.groupId || null, aiSystemId: e.level === "Custom AI system" ? e.refId : null, severity: null, requestedAt: e.registeredDate, decidedAt: last ? last.date : (e.approvedDate || e.registeredDate), required: D.settings.approvals.registrationApprovals, given: pending ? 0 : 1, wait: pending ? (perm.allowed && !blocked ? "you" : "others") : "decided", reason: pending ? (perm.allowed ? (blocked ? `Blocked: ${(e.blockers || []).join(", ")}.` : null) : perm.reason) : null });
    });
    return items;
  };
  /* The open items, for the counts and the attention strips. */
  S.approvalItems = () => S.approvalQueue().filter((it) => it.wait !== "decided");
  S.awaitingReview = function (groupIds) {
    return D.findings.filter((f) => f.status === "Detected" && (!groupIds || groupIds.has(f.groupId)));
  };
  S.queueCounts = function () {
    const p = state.persona;
    if (!p) return {};
    const ent = S.entitledGroupIds();
    const out = { findings: 0, approvals: 0, unregistered: 0 };
    if (S.can("review")) out.findings = S.awaitingReview(ent).length;
    if (S.can("approve")) out.approvals = S.approvalQueue().filter((it) => it.wait === "you").length;
    if (S.can("unregistered")) out.unregistered = S.unregOpenItems().length;
    return out;
  };
  /* What AI is used for (Gabriel, 2026-09-25): the use categories, and a list's mix of them, most used first. */
  S.useCategories = () => D.useCategories || [];
  S.useMix = function (list) {
    const n = {}; list.forEach((x) => { if (x.useCategory) n[x.useCategory] = (n[x.useCategory] || 0) + 1; });
    return S.useCategories().map((c) => ({ cat: c, n: n[c.id] || 0 })).filter((r) => r.n).sort((a, b) => b.n - a.n);
  };
  S.recurrence = function (finding) {
    // same member + same rule, confirmed, within 120 days before this finding
    const prior = (S.findingsByMember[finding.memberId] || []).filter((f) => f.findingId !== finding.findingId && f.ruleId === finding.ruleId && f.status === "Confirmed" && f.detectedAt < finding.detectedAt && U.daysBetween(f.detectedAt, finding.detectedAt) <= 120);
    const onSystem = finding.aiSystemId ? (S.findingsBySystem[finding.aiSystemId] || []).filter((f) => f.findingId !== finding.findingId && f.status === "Confirmed" && U.daysBetween(f.detectedAt, finding.detectedAt) <= 90 && f.detectedAt < finding.detectedAt) : [];
    return { member: prior.length, system: onSystem.length };
  };

  /* ---------- Statistics ---------- */
  S.lastN = (arr, key, days) => arr.filter((x) => U.daysAgo(x[key]) <= days);
  S.groupStats = function (groupId) {
    const g = S.group(groupId);
    const members = S.membersByGroup[groupId] || [];
    const active = members.filter((m) => m.memberStatus === "Active");
    const systems = (S.systemsByGroup[groupId] || []).filter((s) => S.inScope(s));
    const sysActive = systems.filter((s) => s.status === "Active" && !s.external && s.registrationCoverage !== "none");
    const findings = (S.findingsByGroup[groupId] || []).filter((f) => S.inScope(f) && S.inRange(f.detectedAt));
    const ints = S.scoped(S.interactionsByGroup[groupId] || []);
    const entry = S.entry(g.registerEntryId);
    const esc = (S.escalationsByGroup[groupId] || []);
    const cov = S.coverage(groupId);
    const conf90 = findings.filter((f) => f.status === "Confirmed" && U.daysAgo(f.detectedAt) <= 90);
    const last = ints.reduce((a, x) => (x.date > a ? x.date : a), "");
    return {
      group: g, entry, owner: S.member(g.ownerMemberId), members: members.length, activeMembers: active.length, anchors: active.filter((m) => m.isDemoAnchor).length,
      systems: systems.length, systemsActive: sysActive.length, individuallyRegistered: systems.filter((s) => s.registrationCoverage === "individual").length,
      externalSystems: systems.filter((s) => s.external || s.registrationCoverage === "none").length,
      findings: findings.length, awaiting: findings.filter((f) => f.status === "Detected").length, confirmed: findings.filter((f) => f.status === "Confirmed").length,
      confirmed90: conf90.length, dismissed: findings.filter((f) => f.status === "Dismissed").length,
      criticalOpen: findings.filter((f) => f.status !== "Dismissed" && f.severity === "Critical" && U.daysAgo(f.detectedAt) <= 90).length,
      openRemediations: esc.filter((e) => ["Open", "Approved", "Returned"].includes(e.status)).length,
      interactions: ints.length, interactions30: ints.filter((i) => U.daysAgo(i.date) <= 30).length, lastActivity: last,
      coverage: cov, coverageCount: cov.length, risk: S.riskForGroup(groupId),
      knowledgeFiles: U.sum(systems, (s) => (s.knowledgeFiles || []).length), appCalls: U.sum(ints, (x) => (x.appCalls || []).length),
      evidence: D.evidencePackages.filter((e) => e.groupId === groupId).length, audit30: (S.auditByGroup[groupId] || []).filter((e) => U.daysAgo(e.date) <= 30).length,
    };
  };
  S.overviewTotals = function () {
    const groups = S.activeGroups();
    const ents = D.registerEntries;
    const findings = D.findings.filter((f) => S.inScope(f) && S.inRange(f.detectedAt));
    return {
      groups: groups.length, groupsApproved: groups.filter((g) => S.entry(g.registerEntryId).status === "Approved").length,
      entries: ents.length, systemsRegistered: ents.filter((e) => ["GPT", "Project", "Plugin", "Custom AI system"].includes(e.level)).length,
      systemsTotal: D.aiSystems.filter((s) => S.inScope(s) && s.status === "Active").length,
      awaiting: findings.filter((f) => f.status === "Detected").length,
      confirmed90: findings.filter((f) => f.status === "Confirmed" && U.daysAgo(f.detectedAt) <= 90).length,
      openRemediations: D.escalations.filter((e) => ["Open", "Approved", "Returned"].includes(e.status)).length,
      pendingApprovals: S.approvalItems().length,
      unregistered: S.unregOpenItems().length,
      interactions: S.scoped(D.interactions).length, members: D.members.filter((m) => m.memberStatus === "Active" && m.primaryGroupId).length,
      coverageGaps: groups.filter((g) => S.coverage(g.id).length === 0).length,
      expiringSoon: ents.filter((e) => e.reconfirmationDueDate && e.status === "Approved" && U.daysUntil(e.reconfirmationDueDate) <= 30).length + ents.filter((e) => e.status === "Expired").length,
    };
  };

  /* ---------- Dynamic risk scoring (Gabriel, 2026-10-21) ----------
     One score per AI system, per individually registered AI asset and per discovered GPT, Project or Plugin with activity, 0 to 100, derived on
     every draw and never stored, from facts the module already holds: additive points, each factor capped, confirmed violations rather than raw
     detections, and every factor a link to its evidence and a sentence saying what would lower it. The activity factors use a rolling 90 days,
     recurrence 120; the state factors have no window. "Not archived, by decision" adds nothing (Gabriel). A business group's score is its
     riskiest item plus its own gaps. The weights are the product's defaults; since 2026-11-10 a customer weighs them on AI Policy Rules, Risk scoring (below). */
  const SEV_PTS = { Critical: 10, High: 6, Medium: 3, Low: 1 };
  S.RISK_MODEL = {
    version: "1.0", since: "2026-10-21", windowDays: 90, recurrenceDays: 120, backlogDays: 30, trendDays: 30,
    bands: [["Critical", 75], ["High", 50], ["Moderate", 25], ["Low", 0]],
    /* Each factor says what it is in plain words (`what`), holds its point values once (`n`), and words the points that count at a weight
       (`points`: w gives a point value at that weight, cap the most the factor can add). The page, the dialog and the evidence cards all
       print these, and riskCompute reads the same `n`, so the words can never disagree with the score (Gabriel, 2026-11-10: every factor
       rewritten to be easy to understand, always visible, and in whole numbers only). */
    factors: [
      { key: "violations", label: "Confirmed violations, 90 days", cap: 30, n: SEV_PTS,
        what: "Findings in its interactions from the last 90 days that a reviewer confirmed as violations. Dismissed findings, and findings still awaiting review, add nothing.",
        points: (w, cap, n) => `Each confirmed violation adds points by its severity: Critical ${w(n.Critical)} · High ${w(n.High)} · Medium ${w(n.Medium)} · Low ${w(n.Low)}. They add up, to at most ${cap}.` },
      { key: "sensitive", label: "Sensitive data handled, 90 days", cap: 15, n: { perClass: 2, classCap: 6, perInteraction: 1, interactionCap: 9 },
        what: "How much sensitive data the rules found in its interactions in the last 90 days, whether or not a reviewer confirmed a violation.",
        points: (w, cap, n) => `Across all its interactions: each different kind of sensitive data found adds ${w(n.perClass)}, up to ${w(n.classCap)}, and each interaction that carried any adds ${w(n.perInteraction)}, up to ${w(n.interactionCap)}.` },
      { key: "approval", label: "Approval", cap: 15, n: { Expired: 15, Suspended: 15, Rejected: 10, Pending: 8 },
        what: "The status of its registration on the AI Registry. An approved registration adds nothing. An AI asset managed within its platform has no registration of its own, so nothing is added.",
        points: (w, cap, n) => `Adds one of these: ${w(n.Expired)} when the approval is expired or suspended, ${w(n.Rejected)} when it was rejected, ${w(n.Pending)} while it awaits an approver.` },
      { key: "owner", label: "Accountable owner", cap: 10, n: { gap: 10 },
        what: "Whether its registration names an accountable owner who is still active. An AI asset with no registration of its own has no owner to check, so nothing is added.",
        points: (w, cap, n) => `Adds ${w(n.gap)} when its registration has no accountable owner, or the owner is terminated, on leave or inactive.` },
      { key: "coverage", label: "Review coverage", cap: 10, n: { gap: 10 },
        what: "Whether any reviewer can see its business group's AI activity. Without one, nobody can review its findings.",
        points: (w, cap, n) => `Adds ${w(n.gap)} when no reviewer has access to its business group's activity.` },
      { key: "drift", label: "Configuration drift", cap: 5, n: { changed: 5 },
        what: "Whether its configuration changed after its registration was last approved or reconfirmed, so the approval may no longer describe what is running.",
        points: (w, cap, n) => `Adds ${w(n.changed)}, once, when its instructions, knowledge files, Actions, capabilities or recommended model changed after that date. More changes add nothing more.` },
      { key: "reach", label: "Reach", cap: 8, n: { wide: 4, sharedKey: 4, outside: 2 },
        what: "How widely it is shared, and whether it can call other systems.",
        points: (w, cap, n) => `Adds ${w(n.wide)} when the whole workspace, or 100 or more people, can use it. Adds ${w(n.sharedKey)} when one of its Actions signs in to another system with a single key shared by everyone. Adds ${w(n.outside)} when one of its Actions calls a system outside your organization. Each counts once, and together they add at most ${cap}.` },
      { key: "remediation", label: "Open remediation", cap: 10, n: { each: 5 },
        what: "Escalations about it that are not finished: a reviewer said something must change, and an approver has not decided yet or the owner has not made the change.",
        points: (w, cap, n) => `Each unfinished escalation adds ${w(n.each)}. They add up, to at most ${cap}.` },
      { key: "recurrence", label: "Recurring conduct", cap: 9, n: { each: 3 },
        what: "People who repeatedly violate rules while using it. The points go to its score, not to the person.",
        points: (w, cap, n) => `Each person with three or more confirmed violations on it in the last 120 days adds ${w(n.each)}. They add up, to at most ${cap}.` },
      { key: "backlog", label: "Review backlog", cap: 8, n: { each: 2 },
        what: "Findings in its interactions that have waited too long for a reviewer to decide.",
        points: (w, cap, n) => `Each finding that has waited more than 30 days adds ${w(n.each)}. They add up, to at most ${cap}.` },
      { key: "origin", label: "Origin", cap: 8, n: { outsideGpt: 8, unclaimedKey: 6 },
        what: "How it came to be known, when that limits what Archive360 can check.",
        points: (w, cap, n) => `Adds one of these: ${w(n.outsideGpt)} when it is a GPT built outside your workspace, because its instructions, knowledge files and Actions cannot be archived; ${w(n.unclaimedKey)} when it is an AI system that was registered only after its API access was found in Unregistered AI.` }
    ]
  };
  /* Risk scoring (Gabriel, 2026-11-10): the customer weighs the product's eleven factors and sets the score at which each risk level starts,
     on AI Policy Rules, Risk scoring. A weight is Off, Lower (about half), Standard or Higher (about one and a half times), never a number, and every point value and limit is a whole number at every weight (Gabriel, 2026-11-10); the factors,
     the windows and the cadence rule stay the product's. A change is published at once as a new version with a required note and an audit
     event. Scores are never stored, so every score follows on its next view; the 30-day movement compares both dates under the scoring in
     force today, so a change here never shows as movement. Version 1 is the product default. "Risk level" is the word the user reads
     (Gabriel, 2026-11-10: never "risk band"); the code keeps band in its identifiers. */
  S.RISK_WEIGHTS = [["off", "Off", "left out"], ["lower", "Lower", "counts about half as much"], ["standard", "Standard", "counted as shown"], ["higher", "Higher", "counts about one and a half times as much"]];
  const WEIGHT = { off: 0, lower: 0.5, standard: 1, higher: 1.5 };
  S.riskDefaultThresholds = () => ({ Moderate: 25, High: 50, Critical: 75 });
  D.settings.riskScoring = D.settings.riskScoring || { version: 1, since: null, publishedByMemberId: null, note: "", weights: {}, thresholds: S.riskDefaultThresholds(), history: [{ version: 1, date: null, byMemberId: null, note: "", changes: [], productDefault: true }] };
  let scoringPreview = null, scoreOnly = false; // a staged scoring, only while its consequences are computed
  S.riskScoring = () => scoringPreview || D.settings.riskScoring;
  S.riskWeightOf = (key, sc) => ((sc || S.riskScoring()).weights[key] || "standard");
  S.riskWeightLabel = (w) => (S.RISK_WEIGHTS.find((x) => x[0] === w) || S.RISK_WEIGHTS[2])[1];
  S.riskWeightWords = (w) => (S.RISK_WEIGHTS.find((x) => x[0] === w) || S.RISK_WEIGHTS[2])[2];
  S.riskFactorCap = (key, sc) => { const def = S.RISK_MODEL.factors.find((x) => x.key === key); return def ? Math.round(def.cap * WEIGHT[S.riskWeightOf(key, sc)]) : 0; };
  const factorDef = (key) => S.RISK_MODEL.factors.find((x) => x.key === key);
  const weighted = (key, n, sc) => Math.round(n * WEIGHT[S.riskWeightOf(key, sc)]); // whole numbers only
  S.riskFactorWhat = (key) => (factorDef(key) || {}).what || "";
  S.riskFactorPoints = function (key, sc) { const def = factorDef(key); if (!def) return ""; if (!WEIGHT[S.riskWeightOf(key, sc)]) return "Not counted while the weight is Off."; return def.points((n) => weighted(key, n, sc), S.riskFactorCap(key, sc), def.n); };
  S.riskLevelRanges = function (sc) { const t = (sc || S.riskScoring()).thresholds; return [["Low", 0, t.Moderate - 1], ["Moderate", t.Moderate, t.High - 1], ["High", t.High, t.Critical - 1], ["Critical", t.Critical, 100]]; };
  S.riskScoringIsDefault = function (sc) { sc = sc || S.riskScoring(); const d = S.riskDefaultThresholds(); return !Object.keys(sc.weights).some((k) => sc.weights[k] && sc.weights[k] !== "standard") && ["Moderate", "High", "Critical"].every((k) => sc.thresholds[k] === d[k]); };
  /* A risk level the weights leave out of reach (Gabriel, 2026-11-10: a warning, never a block). No AI system or AI asset can score more than
     its factors' limits added together, so a risk level that starts above that total can never be reached: with every factor at Lower the
     limits add up to 66 and Critical, at 75, is out of reach. The total is an upper bound, so the warning fires only when a level is
     certainly unreachable. A business group adds its own two gaps to its riskiest item, so the sentence speaks of AI systems and AI assets. */
  S.riskUnreachable = function (sc) {
    sc = sc || S.riskScoring();
    const total = U.sum(S.RISK_MODEL.factors, (f) => S.riskFactorCap(f.key, sc)), t = sc.thresholds;
    const levels = ["Moderate", "High", "Critical"].filter((k) => Number.isInteger(t[k]) && total < t[k]), starts = levels.map((k) => t[k]);
    const words = (a, last) => (a.length < 2 ? String(a[0] === undefined ? "" : a[0]) : `${a.slice(0, -1).join(", ")} ${last} ${a[a.length - 1]}`);
    return { total, levels, starts, names: words(levels, "or"), startsText: words(starts, "and") };
  };
  S.riskUnreachableText = function (sc, lead) {
    const u = S.riskUnreachable(sc); if (!u.levels.length) return "";
    return `${lead || "With these weights"} the limits add up to ${u.total}, so no AI system or AI asset can reach ${u.names}, which ${u.levels.length === 1 ? "starts" : "start"} at ${u.startsText}.`;
  };
  S.riskBandOf = function (score) { const t = S.riskScoring().thresholds, b = score >= t.Critical ? "Critical" : score >= t.High ? "High" : score >= t.Moderate ? "Moderate" : "Low"; return { band: b, cls: b.toLowerCase() }; };
  S.riskIsHigh = (score) => score >= S.riskScoring().thresholds.High;
  const ownGap = (key) => weighted(key, factorDef(key).n.gap); // a business group's own gaps follow the two factors' weights
  const scoredUnder = () => (S.riskScoring().version > 1 ? `, under Risk scoring version ${S.riskScoring().version}` : "");
  const dayOf = (s_) => (s_ || "").slice(0, 10);
  const daysBefore = (a, b) => U.daysBetween(a, b); // days from a to b
  /* A finding's status as of a date: decided only once its decision date has passed. */
  function findingStatusAt(f, asOf) {
    if (dayOf(f.detectedAt) > asOf) return null;
    if (f.review && dayOf(f.review.decidedAt) <= asOf) return f.status;
    return "Detected";
  }
  /* A registration's status as of a date, replayed from its decision history, with expiry from the cadence in force. */
  function entryStatusAt(e, asOf) {
    if (!e) return null;
    if (asOf >= U.today()) return e.status;
    let st = null, lastApproval = null;
    (e.decisionHistory || []).filter((h) => h.date <= asOf).forEach((h) => {
      if (h.action === "Registered") { st = "Pending"; }
      else if (h.action === "Approved" || h.action === "Reconfirmed") { st = "Approved"; lastApproval = h.date; }
      else if (h.action === "Suspended") st = "Suspended";
      else if (h.action === "Retired") st = "Retired";
      else if (h.action === "Rejected") st = "Rejected";
      else if (h.action === "Expired") st = "Expired";
    });
    if (st === "Approved" && lastApproval && S.addMonths(lastApproval, e.reconfirmationIntervalMonths || D.settings.reconfirmation.intervalMonths) < asOf) st = "Expired";
    return st;
  }
  function memberActiveAt(m, asOf) {
    if (!m) return false;
    if (m.memberStatus === "Active") return true;
    const since = m.removedDate || m.statusSince;
    return !!(since && since > asOf); // the change had not happened yet
  }
  /* The score of one target: an AI asset (GPT, Project, Plugin, outside GPT) or an AI system's registration (platform or custom application). */
  function riskCompute(t, asOf) {
    asOf = asOf || U.today();
    const M = S.RISK_MODEL, win = (d) => { const n = daysBefore(dayOf(d), asOf); return n >= 0 && n < M.windowDays; };
    const sys = t.asset || null, e = t.entry || null, inst = t.inst || null;
    const groupId = sys ? sys.groupId : (e ? e.groupId : null), grp = groupId ? S.group(groupId) : null;
    const hrefSelf = sys && sys.type !== "Custom" ? `#/systems/${sys.id}` : (e ? `#/registry/${e.id}` : "#/registry");
    const hrefFindings = sys && sys.type !== "Custom" ? `#/systems/${sys.id}/interactions` : (groupId ? `#/groups/${groupId}/findings` : "#/findings");
    /* An activity factor opens its own evidence (Gabriel, 2026-10-22): the AI asset's or custom application's Interactions page narrowed to the
       interactions it counted, with the findings behind them listed on the right (?risk=<factor>). A platform's registration scores its direct
       chats, which no page lists, so its factors keep the Findings links. */
    const hrefEvidence = (key, fallback) => (sys ? `#/systems/${sys.id}/interactions?risk=${key}` : fallback);
    const evidence = (list, from, to) => ({ findingIds: list.map((f) => f.findingId), interactionIds: U.uniq(list.map((f) => f.interactionId)), from, to });
    const winFrom = U.addDays(asOf, -(M.windowDays - 1));
    /* The interactions and findings that belong to the target: an asset's own; an AI system's direct chats (its managed assets score on their own). */
    const ints = sys ? (S.interactionsBySystem[sys.id] || []) : (inst ? D.interactions.filter((x) => x.instanceId === inst.id && !x.aiSystemId) : []);
    const intIds = new Set(ints.map((x) => x.interactionId));
    const fs = D.findings.filter((f) => intIds.has(f.interactionId) && dayOf(f.detectedAt) <= asOf).map((f) => Object.assign({}, f, { statusAt: findingStatusAt(f, asOf) }));
    const factors = [];
    const N = (key) => factorDef(key).n, wv = (key, n) => weighted(key, n);
    const add = (key, points, detail, href, fix, ev) => { const def = factorDef(key), w = S.riskWeightOf(key), cap = S.riskFactorCap(key), p = Math.min(cap, points); if (p > 0) factors.push(Object.assign({ key, label: def.label, cap, points: p, detail, href, fix }, w !== "standard" ? { weight: w } : {}, ev ? { evidence: ev } : {})); };
    // 1. confirmed violations
    const conf = fs.filter((f) => f.statusAt === "Confirmed" && win(f.detectedAt));
    if (conf.length) add("violations", U.sum(conf, (f) => wv("violations", N("violations")[f.severity] || N("violations").Low)), `${conf.length} confirmed ${U.plural(conf.length, "violation")}: ${["Critical", "High", "Medium", "Low"].map((sv) => [sv, conf.filter((f) => f.severity === sv).length]).filter(([, n]) => n).map(([sv, n]) => `${n} ${sv}`).join(", ")}`, hrefEvidence("violations", groupId ? `#/groups/${groupId}/findings?view=confirmed` : "#/findings/confirmed"), "Fewer confirmed violations in the last 90 days: the oldest fall out of the window as time passes.", evidence(conf, winFrom, asOf));
    // 2. sensitive data handled
    const inWin = fs.filter((f) => win(f.detectedAt)), classes = U.uniq(inWin.map((f) => f.dataClassId)), carriers = U.uniq(inWin.map((f) => f.interactionId));
    if (classes.length) add("sensitive", Math.min(wv("sensitive", N("sensitive").classCap), wv("sensitive", N("sensitive").perClass) * classes.length) + Math.min(wv("sensitive", N("sensitive").interactionCap), wv("sensitive", N("sensitive").perInteraction) * carriers.length), `${classes.length} ${U.plural(classes.length, "class", "classes")} of sensitive data (${classes.map((id) => S.dcName(id)).join(", ")}) in ${carriers.length} ${U.plural(carriers.length, "interaction")}`, hrefEvidence("sensitive", hrefFindings), "Less sensitive data in its interactions, or a narrower approved purpose that keeps such data out of it.", evidence(inWin, winFrom, asOf));
    // 3. approval
    const st = entryStatusAt(e, asOf);
    const stPts = wv("approval", N("approval")[st] || 0);
    if (stPts) add("approval", stPts, st === "Expired" ? `Approval expired${e.reconfirmationDueDate ? ` on ${U.fmtDate(e.reconfirmationDueDate)}` : ""}` : st === "Suspended" ? "Registration suspended" : st === "Pending" ? "Awaiting an approver" : "Rejected", `#/registry/${e.id}`, st === "Expired" ? "The owner reconfirms the registration, or retires it." : st === "Suspended" ? "The owner completes the approved remediation and reconfirms." : st === "Pending" ? "An approver decides the registration." : "A new registration, or retirement.");
    // 4. owner
    if (e) { const o = S.member(e.ownerMemberId); if (!o || !memberActiveAt(o, asOf)) add("owner", wv("owner", N("owner").gap), o ? `Owner ${U.statusWord(o)}` : "No accountable owner", `#/registry/${e.id}`, "Name a new accountable owner on the registration."); }
    // 5. coverage
    if (grp && !S.coverage(grp.id).length) add("coverage", wv("coverage", N("coverage").gap), `No reviewer has access to ${grp.name}'s activity`, "#/settings/readiness", "An Archive360 Entitlement Policy covering the group, assigned to a reviewer, in Administration.");
    // 6. configuration drift
    if (sys && e && (e.approvedDate || e.lastReconfirmedDate)) {
      const since = [e.approvedDate, e.lastReconfirmedDate].filter(Boolean).sort().pop();
      const drift = (sys.configVersions || []).filter((v) => v.date > since && v.date <= asOf && ["instructions", "knowledge", "action", "capability", "model"].includes(v.kind));
      if (drift.length) add("drift", wv("drift", N("drift").changed), `${drift.length} ${U.plural(drift.length, "change")} since the approval of ${U.fmtDate(since)}, last ${drift[drift.length - 1].summary}`, hrefSelf, "The owner reconfirms the registration after reviewing the current configuration.");
    }
    // 7. reach
    if (sys) {
      let reach = 0; const why = [];
      if ((sys.sharing || {}).scope === "workspace" || (sys.accessibleUserCount || 0) >= 100) { reach += wv("reach", N("reach").wide); why.push(`${U.fmtNum(sys.accessibleUserCount || 0)} people can use it`); }
      const acts = sys.actions || [];
      if (acts.some((a) => /key/i.test(a.authType || a.auth || ""))) { reach += wv("reach", N("reach").sharedKey); why.push("an Action with a shared key"); }
      if (acts.some((a) => a.external || a.outside)) { reach += wv("reach", N("reach").outside); why.push("an Action calling an outside domain"); }
      if (reach) add("reach", reach, why.join(", "), hrefSelf, "Narrower sharing, or per-user authentication on its Actions.");
    }
    // 8. open remediation
    const escs = D.escalations.filter((x) => { const fin = x.completedAt || x.closedAt; return (sys ? x.aiSystemId === sys.id : (e && x.registerEntryId === e.id)) && dayOf(x.escalatedAt) <= asOf && (!fin || dayOf(fin) > asOf) && (asOf >= U.today() ? ["Open", "Approved", "Returned"].includes(x.status) : x.status !== "Rejected"); });
    const escWords = () => { const c = {}; escs.forEach((x) => { const w = x.status === "Open" ? "awaiting an approver" : x.status === "Returned" ? "returned to the reviewer" : `remediation ${(S.remediationStatus(x) || "Not started").toLowerCase()}`; c[w] = (c[w] || 0) + 1; }); return Object.keys(c).map((w) => (escs.length === 1 ? w : `${c[w]} ${w}`)).join(", "); };
    if (escs.length) add("remediation", wv("remediation", N("remediation").each) * escs.length, `${escs.length} unfinished ${U.plural(escs.length, "escalation")}${asOf >= U.today() ? `: ${escWords()}` : ""}`, e ? `#/registry/${e.id}` : hrefFindings, "The owner completes the approved remediation and reconfirms.");
    // 9. recurring conduct
    const recWin = (d) => { const n = daysBefore(dayOf(d), asOf); return n >= 0 && n < M.recurrenceDays; };
    const recFs = fs.filter((f) => f.statusAt === "Confirmed" && recWin(f.detectedAt)), byMember = U.countBy(recFs, "memberId");
    const rec = Object.entries(byMember).filter(([, n]) => n >= 3), recIds = new Set(rec.map(([id]) => id));
    if (rec.length) add("recurrence", wv("recurrence", N("recurrence").each) * rec.length, `${rec.length} ${U.plural(rec.length, "person", "people")} with three or more confirmed violations in 120 days: ${rec.map(([id]) => S.member(id) ? S.member(id).displayName : id).join(", ")}`, hrefEvidence("recurrence", hrefFindings), "A conduct remediation on the person's use of it.", evidence(recFs.filter((f) => recIds.has(f.memberId)), U.addDays(asOf, -(M.recurrenceDays - 1)), asOf));
    // 10. review backlog
    const old = fs.filter((f) => f.statusAt === "Detected" && daysBefore(dayOf(f.detectedAt), asOf) > M.backlogDays);
    if (old.length) add("backlog", wv("backlog", N("backlog").each) * old.length, `${old.length} ${U.plural(old.length, "finding")} awaiting review for more than 30 days`, hrefEvidence("backlog", groupId ? `#/groups/${groupId}/findings` : "#/findings"), "Reviewers decide the waiting findings.", evidence(old, null, U.addDays(asOf, -(M.backlogDays + 1))));
    // 11. origin
    if (sys && sys.external) add("origin", wv("origin", N("origin").outsideGpt), "GPT built outside the workspace; its instructions, knowledge and actions are not archived", hrefSelf, "Prohibit it, or replace it with a GPT built inside the workspace.");
    else if (inst && (inst.history || []).some((h) => h.action === "Added" && /API (access|key)/i.test(h.detail || ""))) add("origin", wv("origin", N("origin").unclaimedKey), "Added from an unclaimed API key, after its activity was found", `#/registry/${e.id}`, "Nothing: the fact stays on the record.");
    const score = Math.min(100, U.sum(factors, (f) => f.points));
    factors.sort((a, b) => b.points - a.points);
    return Object.assign({ score, factors, asOf, interactions: ints.length }, S.riskBandOf(score));
  }
  function riskWithTrend(t) {
    const now = riskCompute(t, U.today()), before = scoreOnly ? now : riskCompute(t, U.addDays(U.today(), -S.RISK_MODEL.trendDays));
    return Object.assign(now, { before: before.score, delta: now.score - before.score, model: S.riskScoring().version });
  }
  /* The target behind an AI asset or a registration. A GPT, Project or Plugin scores on its own record and its own registration if it has one;
     a platform's or custom application's registration scores on the AI system: its direct chats, its approval and owner. */
  S.riskForAsset = function (assetId) {
    const sys = S.system(assetId); if (!sys) return null;
    if (sys.type === "Custom") { const e = sys.registerEntryId ? S.entry(sys.registerEntryId) : null; return riskWithTrend({ asset: sys, entry: e, inst: e ? S.entryInstance(e) : null }); }
    const cov = S.systemCoverage(sys);
    return riskWithTrend({ asset: sys, entry: cov.key === "individual" ? cov.entry : null });
  };
  S.riskForEntry = function (entryId) {
    const e = S.entry(entryId); if (!e) return null;
    if (["GPT", "Project", "Plugin"].includes(e.level)) return S.riskForAsset(e.refId);
    const inst = S.entryInstance(e), sys = e.level === "Custom AI system" ? S.system(e.refId) : null;
    return riskWithTrend({ asset: sys, entry: e, inst });
  };
  S.riskForSystem = S.riskForAsset;
  /* Everything in a business group that carries a score: its AI assets with activity and the AI systems it owns. */
  S.riskItemsForGroup = function (groupId) {
    const out = [];
    (S.systemsByGroup[groupId] || []).forEach((s) => { if (s.type === "Custom") return; if ((s.conversationCount || 0) === 0 && s.registrationCoverage !== "individual") return; out.push({ kind: "asset", id: s.id, name: s.name, type: s.type, href: `#/systems/${s.id}`, risk: S.riskForAsset(s.id) }); });
    S.registryEntries().filter((e) => e.groupId === groupId && e.level === "Custom AI system").forEach((e) => out.push({ kind: "entry", id: e.id, name: e.name, type: "Custom AI application", href: `#/registry/${e.id}`, risk: S.riskForEntry(e.id) }));
    return out.sort((a, b) => b.risk.score - a.risk.score || a.name.localeCompare(b.name));
  };
  /* A group is as risky as its riskiest AI system or asset, plus its own gaps: an owner who is not active, no reviewer with access. */
  S.riskForGroup = function (groupId) {
    const g = S.group(groupId), items = S.riskItemsForGroup(groupId), r = S.groupReadiness(g), factors = [];
    const top = items[0];
    if (top) factors.push({ key: "top", label: `Riskiest: ${top.name}`, points: top.risk.score, detail: `${top.risk.band}, ${top.risk.factors.length} ${U.plural(top.risk.factors.length, "factor")}: ${top.risk.factors.slice(0, 3).map((f) => f.label.toLowerCase()).join(", ")}`, href: top.href, fix: "Open it: each of its factors says what would lower it." });
    if ((!r.owner || !U.isActive(r.owner)) && ownGap("owner")) factors.push({ key: "owner", label: "Accountable owner", weight: S.riskWeightOf("owner"), points: ownGap("owner"), detail: r.owner ? `Owner ${U.statusWord(r.owner)}` : "No accountable owner", href: `#/groups/${groupId}`, fix: "Name a new owner on the Business Groups page." });
    if (!r.coverage.length && ownGap("coverage")) factors.push({ key: "coverage", label: "Review coverage", weight: S.riskWeightOf("coverage"), points: ownGap("coverage"), detail: "No reviewer has access to the group's activity", href: "#/settings/readiness", fix: "An Archive360 Entitlement Policy covering the group, in Administration." });
    const score = Math.min(100, U.sum(factors, (f) => f.points));
    const high = items.filter((i) => S.riskIsHigh(i.risk.score)).length;
    const beforeTop = top ? top.risk.before : 0;
    return Object.assign({ score, factors, items, high, before: Math.min(100, beforeTop + U.sum(factors.filter((f) => f.key !== "top"), (f) => f.points)), model: S.riskScoring().version }, S.riskBandOf(score), { delta: 0 }, (function () { const b = Math.min(100, beforeTop + U.sum(factors.filter((f) => f.key !== "top"), (f) => f.points)); return { delta: score - b }; })());
  };
  /* Every score the module shows, under the scoring in force or under a staged one: the AI systems' registrations, every AI asset and the
     active business groups. The Risk scoring page compares the two before a change is published. */
  S.riskScoreboard = function (staged) {
    const run = () => {
      const rows = [], row = (kind, id, name, type, groupId, href, r) => rows.push({ kind, id, name, type, groupId: groupId || null, href, score: r.score, band: r.band, cls: r.cls });
      S.registryEntries().filter((e) => !["GPT", "Project", "Plugin"].includes(e.level)).forEach((e) => { const r = S.riskForEntry(e.id); if (r) row("system", e.id, e.name, e.level === "Custom AI system" ? "Custom AI application" : "AI platform", e.groupId, `#/registry/${e.id}`, r); });
      D.aiSystems.filter((x) => x.type !== "Custom").forEach((x) => { const r = S.riskForAsset(x.id); if (r) row("asset", x.id, x.name, x.type, x.groupId, `#/systems/${x.id}`, r); });
      S.activeGroups().forEach((g) => { const r = S.riskForGroup(g.id); row("group", g.id, g.name, "Business group", g.id, `#/groups/${g.id}`, r); });
      return rows;
    };
    const was = scoringPreview;
    scoringPreview = staged || null; scoreOnly = true;
    try { return run(); } finally { scoringPreview = was; scoreOnly = false; }
  };
  /* What a staged scoring changes against the one in force, in the words the page, the version and the audit event use. */
  S.riskScoringChanges = function (staged, base) {
    base = base || D.settings.riskScoring; const out = [];
    S.RISK_MODEL.factors.forEach((f) => { const a = S.riskWeightOf(f.key, base), b = S.riskWeightOf(f.key, staged); if (a !== b) out.push({ kind: "weight", key: f.key, text: `${f.label}: ${S.riskWeightLabel(a)} to ${S.riskWeightLabel(b)}` }); });
    ["Moderate", "High", "Critical"].forEach((k) => { if (base.thresholds[k] !== staged.thresholds[k]) out.push({ kind: "level", key: k, text: `${k} risk level: starts at ${staged.thresholds[k]}, was ${base.thresholds[k]}` }); });
    return out;
  };
  S.publishRiskScoring = function (staged, note) {
    const cur = D.settings.riskScoring, p = state.persona, changes = S.riskScoringChanges(staged, cur).map((c) => c.text), v = cur.version + 1, weights = {};
    S.RISK_MODEL.factors.forEach((f) => { const w = S.riskWeightOf(f.key, staged); if (w !== "standard") weights[f.key] = w; });
    cur.weights = weights; cur.thresholds = Object.assign({}, staged.thresholds); cur.version = v; cur.since = U.today(); cur.publishedByMemberId = p.memberId; cur.note = note || "";
    const isDefault = S.riskScoringIsDefault(cur);
    cur.history.push({ version: v, date: U.today(), byMemberId: p.memberId, note: note || "", changes, productDefault: isDefault });
    S.logAudit({ category: "Configuration", eventType: "Risk scoring published", refType: "riskScoring", refId: "riskScoring", summary: `Version ${v}${isDefault ? ", the product default restored" : ""}: ${changes.join("; ")}.${note ? ` ${/[.!?]$/.test(note.trim()) ? note.trim() : note.trim() + "."}` : ""}`, details: { version: v, changes } });
    return cur;
  };
  /* The reconfirmation cadence follows the risk level at approval or reconfirmation (Gabriel, 2026-10-21): six months for High and Critical,
     twelve otherwise, fixed until the next reconfirmation, so a due date never moves on its own. */
  S.cadenceForBand = (band) => (band === "High" || band === "Critical" ? 6 : 12);
  S.cadenceFor = function (e) { const r = S.riskForEntry(e.id); return { months: S.cadenceForBand(r ? r.band : "Low"), band: r ? r.band : "Low", score: r ? r.score : 0 }; };

  /* ---------- Attention items per persona ---------- */
  S.attention = function (groupId) {
    const p = state.persona;
    if (!p) return [];
    const items = [];
    const push = (level, icon, text, href, meta) => items.push({ level, icon, text, href, meta });
    const groups = groupId ? [S.group(groupId)] : S.activeGroups();
    const ent = S.entitledGroupIds();
    const mine = groupId ? [groupId] : S.activeGroups().filter((g) => g.ownerMemberId === p.memberId).map((g) => g.id);
    // Owner-oriented
    if (S.can("reconfirm")) {
      D.registerEntries.filter((e) => e.ownerMemberId === p.memberId && (!groupId || e.groupId === groupId)).forEach((e) => {
        if (e.status === "Expired") push("danger", "alert", `${e.name}: approval expired ${U.fmtDate(e.reconfirmationDueDate)}. Reconfirm or retire.`, `#/register/${e.id}`);
        else if (e.reconfirmationDueDate && U.daysUntil(e.reconfirmationDueDate) <= 30 && e.status !== "Pending") push("warn", "clock", `${e.name}: reconfirmation due ${U.fmtDate(e.reconfirmationDueDate)} (${U.daysUntil(e.reconfirmationDueDate)} days).`, `#/register/${e.id}`);
      });
      D.escalations.filter((e) => ["Approved", "Returned", "Open"].includes(e.status) && mine.includes(e.groupId)).forEach((e) => {
        const sys = e.aiSystemId ? S.system(e.aiSystemId) : null;
        if (e.status === "Approved") push("danger", "flag", `Remediation approved for ${sys ? sys.name : "your group"}: ${e.proposedRemediation.slice(0, 90)}… Complete it and reconfirm.`, `#/approvals/${e.escalationId}`);
        else if (e.status === "Open") push("info", "clock", `Escalation awaiting an approver's decision on ${sys ? sys.name : "your group"} (${e.target.toLowerCase()} remediation).`, `#/approvals/${e.escalationId}`);
      });
    }
    // Reviewer-oriented
    if (S.can("review")) {
      const aw = S.awaitingReview(ent).filter((f) => !groupId || f.groupId === groupId);
      if (aw.length) push("warn", "findings", `${aw.length} ${U.plural(aw.length, "finding")} awaiting your review${groupId ? "" : " across " + U.uniq(aw.map((f) => f.groupId)).length + " groups"}.`, groupId ? `#/groups/${groupId}/findings` : "#/findings");
      const crit = aw.filter((f) => f.severity === "Critical");
      if (crit.length) push("danger", "alert", `${crit.length} critical ${U.plural(crit.length, "finding")} in the queue.`, "#/findings");
    }
    // Approver-oriented
    if (S.can("approve")) {
      const its = S.approvalItems().filter((it) => !groupId || it.groupId === groupId);
      const mineToDecide = its.filter((it) => it.wait === "you");
      if (mineToDecide.length) push("warn", "approvals", `${mineToDecide.length} ${U.plural(mineToDecide.length, "decision")} awaiting you.`, "#/approvals");
      const cannot = its.filter((it) => it.finding && S.reviewedByPersona(it.finding));
      if (cannot.length) push("info", "lock", `${cannot.length} ${U.plural(cannot.length, "escalation")} you reviewed ${cannot.length === 1 ? "needs" : "need"} another approver.`, "#/approvals/others");
    }
    // Compliance-oriented
    if (S.can("register")) {
      groups.forEach((g) => { if (S.coverage(g.id).length === 0) push("danger", "coverage", `${g.name} has no reviewer coverage; its registration cannot be approved.`, `#/groups/${g.id}/policies`); });
      if (!groupId) {
        const unreg = S.unregOpenItems();
        if (unreg.length) push("warn", "unregistered", `${unreg.length} unregistered ${U.plural(unreg.length, "item")}: ${unreg.slice(0, 3).map((u) => u.name).join(", ")}${unreg.length > 3 ? "…" : ""}.`, "#/unregistered");
        D.registerEntries.filter((e) => e.status === "Expired").forEach((e) => push("danger", "alert", `${e.name} approval expired; owner ${S.member(e.ownerMemberId) && S.member(e.ownerMemberId).memberStatus !== "Active" ? "has left the organization" : "has not reconfirmed"}.`, `#/register/${e.id}`));
      } else {
        const e = S.entry(S.group(groupId).registerEntryId);
        if (e.status === "Expired") push("danger", "alert", `Group approval expired ${U.fmtDate(e.reconfirmationDueDate)}.`, `#/register/${e.id}`);
        if (e.status === "Pending" && !e.blockers.length) push("info", "clock", "Group registration is awaiting approval.", `#/register/${e.id}`);
      }
    }
    // Everyone: recurring conduct in group
    if (groupId) {
      const by = U.countBy((S.findingsByGroup[groupId] || []).filter((f) => f.status === "Confirmed" && U.daysAgo(f.detectedAt) <= 120), "memberId");
      const rep = Object.entries(by).filter(([, n]) => n >= 3);
      if (rep.length) push("warn", "trend", `${rep.length} ${U.plural(rep.length, "member")} with three or more confirmed violations in 120 days.`, `#/groups/${groupId}/findings`);
    }
    const order = { danger: 0, warn: 1, info: 2 };
    return items.sort((a, b) => order[a.level] - order[b.level]);
  };

  /* ---------- Notifications for the bell ---------- */
  S.notificationsFor = function () {
    const p = state.persona;
    if (!p) return [];
    return D.notifications.filter((n) => n.toMemberId === p.memberId || (p.profileId === "prof_admin")).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  };

  /* ---------- Evidence packages (Gabriel, 2026-10-20) ----------
     A package is the governance record of one registration for one period: module-owned facts inside (registration and approvals, configuration
     and rule versions, findings and decisions with reviewer authority, review coverage, collection method and gaps, activity volumes, the
     population listing, a documented sample as records with their Audit.txt), platform facts referenced and never copied (the eDiscovery
     production criteria, the Logs audit filter, the record class's retention policy). The export runs as a background job, downloaded and
     deleted on Archive360's Exports page; the prototype simulates the job over a few seconds and keeps the package in memory. */
  S.EVIDENCE_SAMPLE_METHOD = "Seeded random sample of up to 25 interactions per month, stratified by finding status";
  S.EVIDENCE_COMPONENTS = [
    { name: "Registration and approval history", how: "From the AI Registry: the registration as it stands and every decision on it, with who decided and when." },
    { name: "Configuration versions in force", how: "The AI asset's configuration versions dated in or before the period, as Archive360 collected them; for an AI system, its history in Settings." },
    { name: "AI Policy Rule versions that judged the activity", how: "Each rule at the version in force at the end of the period, and the versions the period's findings cite." },
    { name: "Findings and decisions, with reviewer authority", how: "Every finding on the period's interactions: rule and version, severity, status, the reviewer, the reason and note, and the Archive360 Entitlement Policy the reviewer acted under." },
    { name: "Review coverage snapshot", how: "Who can review the business group's activity when the package is produced, with the Archive360 Entitlement Policy that grants it." },
    { name: "Collection method and known gaps", how: "The connector or Ingestion API path, the record class, the collection status, and any gap the connector recorded in the period." },
    { name: "Monthly activity volumes", how: "Interactions, people and findings per month of the period, counted from the archive." },
    { name: "Population listing", how: "Every interaction of the AI system in the period as one row: identifier, dates, person, business group, AI asset, turns, chat status and finding status, so the auditor can choose items." },
    { name: "Documented sample", how: "A seeded random sample of up to 25 interactions per month, stratified by finding status, as records with their Audit.txt. The requester's Entitlement Policies apply, as in any export: without content entitlement the sample is withheld and the manifest says so." },
    { name: "Criteria for full production", how: "The record class, the AI system's identifier and the period, so eDiscovery can produce the full set or the auditor's picks on request." },
    { name: "References", how: "The Logs audit search filter for the AI system and period, and the record class's retention policy. Referenced, not copied." }
  ];
  S.evidencePackagesFor = (entryId) => D.evidencePackages.filter((p) => p.registerEntryId === entryId).sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
  S.evidencePeriodLabel = function (from, to) {
    const f = new Date(from + "T00:00:00Z"), y = f.getUTCFullYear(), m = f.getUTCMonth(), first = f.getUTCDate() === 1;
    const monthEnd = (yy, mm) => new Date(Date.UTC(yy, mm + 1, 0)).toISOString().slice(0, 10);
    if (first && m % 3 === 0 && to === monthEnd(y, m + 2)) return `Q${m / 3 + 1} ${y}`;
    if (first && m === 0 && to === `${y}-12-31`) return String(y);
    if (first && m === 0 && to === `${y}-06-30`) return `H1 ${y}`;
    if (first && m === 6 && to === `${y}-12-31`) return `H2 ${y}`;
    return `${U.fmtDate(from)} to ${U.fmtDate(to)}`;
  };
  function evHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function evRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const evName = (id) => { const m = S.member(id); return m ? m.displayName : (id === "system" ? "Archive360" : id || ""); };
  /* The population: a platform's interactions by instance, an individually registered AI asset's or a custom application's by the asset. */
  S.evidenceInteractions = function (e, from, to) {
    const inst = S.entryInstance(e), plat = e.level === "Platform";
    return D.interactions.filter((x) => (plat ? !!inst && x.instanceId === inst.id : x.aiSystemId === e.refId) && x.date >= from && x.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.interactionId.localeCompare(b.interactionId));
  };
  /* The documented sample: per month, up to perMonth interactions, the two strata (with findings, without) in proportion, drawn from a generator
     seeded by the package, so the same package always names the same records. */
  S.evidenceSample = function (ints, seed, perMonth) {
    const rnd = evRng(evHash(seed)), byMonth = {};
    ints.forEach((x) => { const k = x.date.slice(0, 7); (byMonth[k] = byMonth[k] || []).push(x); });
    const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    const out = [];
    Object.keys(byMonth).sort().forEach((k) => {
      const all = byMonth[k], withF = all.filter((x) => (x.findingIds || []).length), without = all.filter((x) => !(x.findingIds || []).length);
      const n = Math.min(perMonth, all.length);
      let kf = Math.round(n * withF.length / all.length), kn = n - kf;
      if (kf > withF.length) { kn += kf - withF.length; kf = withF.length; }
      if (kn > without.length) { kf = Math.min(withF.length, kf + kn - without.length); kn = without.length; }
      out.push(...shuffle(withF).slice(0, kf), ...shuffle(without).slice(0, kn));
    });
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.interactionId.localeCompare(b.interactionId)).map((x) => x.interactionId);
  };
  /* Everything a package holds or references, computed from the data; a completed package keeps its own sample and manifest. */
  S.evidenceScope = function (e, from, to, pkg) {
    const inst = S.entryInstance(e), plat = e.level === "Platform", sys = plat ? null : S.system(e.refId), grp = e.groupId ? S.group(e.groupId) : null;
    const rc = inst ? S.recordClass(inst.recordClassId) : null, platform = inst ? S.platform(inst.platformId) : (e.platformId ? S.platform(e.platformId) : null);
    const notArchived = !!(inst && !inst.recordClassId);
    const interactions = S.evidenceInteractions(e, from, to), ids = new Set(interactions.map((x) => x.interactionId));
    const findings = D.findings.filter((f) => ids.has(f.interactionId)).sort((a, b) => a.detectedAt.localeCompare(b.detectedAt));
    const counts = { confirmed: findings.filter((f) => f.status === "Confirmed").length, dismissed: findings.filter((f) => f.status === "Dismissed").length };
    counts.awaiting = findings.length - counts.confirmed - counts.dismissed;
    const seed = pkg && pkg.sampleSeed ? pkg.sampleSeed : `${e.id}|${from}|${to}`;
    const sampleIds = pkg && pkg.sampleInteractionIds ? pkg.sampleInteractionIds : S.evidenceSample(interactions, seed, 25);
    const isAdmin = !!(state.persona && state.persona.profile.id === "prof_admin");
    const sampleWithheld = pkg ? !!pkg.sampleWithheld : !(isAdmin || (grp ? S.canViewContent(grp.id) : S.entitledGroupIds().size > 0));
    const people = new Set(interactions.map((x) => x.memberId)).size;
    const configVersions = sys ? (sys.configVersions || []).filter((v) => v.date <= to).map((v) => ({ version: v.version, date: v.date, kind: v.kind || null, summary: v.summary, by: evName(v.changedByMemberId), inForceAtPeriodStart: v.date <= from }))
      : inst ? (inst.history || []).filter((h) => h.date <= to).map((h) => ({ date: h.date, action: h.action, detail: h.detail || "", by: evName(h.actorMemberId) })) : [];
    const cited = {}; findings.forEach((f) => { (cited[f.ruleId] = cited[f.ruleId] || new Set()).add(f.ruleVersion); });
    const ruleVersions = D.rules.map((r) => { const vs = (r.versions || []).filter((v) => v.effectiveDate <= to), inForce = vs.length ? vs[vs.length - 1] : null; return { ruleId: r.id, rule: r.name, family: r.family, status: r.status || "Active", versionInForceAtPeriodEnd: inForce ? inForce.version : null, effectiveSince: inForce ? inForce.effectiveDate : null, citedByFindings: cited[r.id] ? Array.from(cited[r.id]).sort() : [] }; })
      .filter((r) => r.versionInForceAtPeriodEnd !== null || r.citedByFindings.length);
    const reviewers = (grp ? S.coverage(grp.id) : S.reviewersAll().map((m) => ({ member: m, ep: null }))).map((c) => ({ name: c.member.displayName, title: c.member.jobTitle || "", employmentStatus: c.member.memberStatus, entitlementPolicy: c.ep ? (c.ep.name || c.ep.id) : null }));
    const months = [];
    { let d = new Date(from.slice(0, 7) + "-01T00:00:00Z"); const end = to.slice(0, 7);
      while (d.toISOString().slice(0, 7) <= end) {
        const k = d.toISOString().slice(0, 7), xs = interactions.filter((x) => x.date.slice(0, 7) === k), xids = new Set(xs.map((x) => x.interactionId)), fs = findings.filter((f) => xids.has(f.interactionId));
        months.push({ month: k, interactions: xs.length, people: new Set(xs.map((x) => x.memberId)).size, findings: fs.length, confirmed: fs.filter((f) => f.status === "Confirmed").length, dismissed: fs.filter((f) => f.status === "Dismissed").length, awaiting: fs.filter((f) => f.status !== "Confirmed" && f.status !== "Dismissed").length });
        d.setUTCMonth(d.getUTCMonth() + 1);
      } }
    const collection = { method: notArchived ? "Not archived, by decision" : (platform && platform.connectorName) || e.collectionMethod || "Archive360 connector", recordClass: rc ? rc.name : null, retentionYears: rc ? rc.retentionYears : null,
      collectionStatus: inst ? inst.status : null, activated: inst ? inst.activatedDate || null : null, notArchived, notArchivedReason: inst && inst.notArchived ? inst.notArchived.reason : null, gaps: (pkg && pkg.manifest && pkg.manifest.gaps) || "None recorded in the period." };
    const identifier = inst ? inst.externalIdentifier || null : (sys ? sys.externalIdentifier || null : null);
    const auditCount = D.auditEvents.filter((a) => a.date >= from && a.date <= to && ((a.refType === "register" && a.refId === e.id) || (sys && a.aiSystemId === sys.id) || (inst && a.refType === "instance" && a.refId === inst.id))).length;
    return { entry: e, inst, sys, grp, recordClass: rc, platform, notArchived, interactions, population: interactions.length, people, findings, counts, sampleIds, sampleSize: sampleIds.length, sampleWithheld, sampleSeed: seed, configVersions, ruleVersions, reviewers, months, collection, identifier, auditCount, aiSystemId: sys ? sys.id : null };
  };
  let evSeq = 0;
  S.generateEvidence = function (entryId, opts) {
    const e = S.entry(entryId), from = opts.from, to = opts.to, scope = S.evidenceScope(e, from, to), p = state.persona;
    const id = "ev_rt" + Math.random().toString(36).slice(2, 8), now = D.meta.now, label = S.evidencePeriodLabel(from, to);
    evSeq += 1;
    const pkg = { id, registerEntryId: e.id, aiSystemId: scope.aiSystemId, instanceId: scope.inst ? scope.inst.id : null, groupId: e.groupId || null, name: `${e.name} evidence package ${label}`, periodStart: from, periodEnd: to,
      requestedByMemberId: p ? p.memberId : "system", requestedAt: now, status: "Queued", progress: 0, completedAt: null, sizeMB: null,
      populationCount: scope.population, findingsCount: scope.findings.length, sampleSize: scope.sampleSize, sampleInteractionIds: scope.sampleIds, sampleMethod: S.EVIDENCE_SAMPLE_METHOD, sampleSeed: scope.sampleSeed, sampleWithheld: scope.sampleWithheld,
      components: S.EVIDENCE_COMPONENTS.map((c) => ({ name: c.name, how: c.how })),
      manifest: { scope: "One AI system, one period", registration: e.name, aiSystem: scope.inst ? scope.inst.name : (scope.sys ? scope.sys.name : e.name), recordClass: scope.recordClass ? scope.recordClass.name : null, collectionMethod: scope.collection.method, gaps: scope.collection.gaps,
        criteria: { recordClass: scope.recordClass ? scope.recordClass.name : null, aiSystem: e.name, identifier: scope.identifier, periodStart: from, periodEnd: to },
        producedBy: `Archive360 export job evidence-${D.meta.today}-${String(evSeq).padStart(3, "0")}`, exportName: `${e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-evidence-${from}-${to}.zip` } };
    D.evidencePackages.unshift(pkg); S.byId.evidence[id] = pkg;
    S.logAudit({ category: "Governance decision", eventType: "Evidence package requested", refType: "evidence", refId: id, groupId: e.groupId || null, aiSystemId: scope.aiSystemId, summary: `Requested: ${pkg.name}` });
    [[700, "In progress", 18], [1500, "In progress", 47], [2300, "In progress", 81], [3100, "Completed", 100]].forEach(([ms, status, progress]) => setTimeout(() => {
      pkg.status = status; pkg.progress = progress;
      if (status === "Completed") {
        pkg.completedAt = now; pkg.sizeMB = Math.round((0.6 + pkg.populationCount * 0.002 + (pkg.sampleWithheld ? 0 : pkg.sampleSize * 0.64)) * 10) / 10;
        S.logAudit({ category: "Governance decision", eventType: "Evidence package completed", actorType: "system", actorId: "system", timestamp: pkg.completedAt, refType: "evidence", refId: id, groupId: e.groupId || null, aiSystemId: scope.aiSystemId, summary: `Completed: ${pkg.name} (${pkg.sizeMB} MB)` });
        D.notifications.unshift({ id: "ntf_" + id, type: "Export", toMemberId: pkg.requestedByMemberId, sentAt: pkg.completedAt, subject: `Evidence package ready: ${pkg.name}`, refType: "evidence", refId: id, groupId: e.groupId || null, read: false });
      }
      if (S.onEvidenceProgress) S.onEvidenceProgress(pkg);
    }, ms));
    return pkg;
  };

  /* ---------- Mutations (in memory) ---------- */
  S.logAudit = function (ev) {
    const rec = Object.assign({ eventId: "aud_rt" + Math.random().toString(36).slice(2, 8), timestamp: AGC.data.meta.now, date: AGC.data.meta.today, category: "Governance decision", actorType: "member", actorId: state.persona ? state.persona.memberId : "system", details: {} }, ev);
    D.auditEvents.unshift(rec);
    state.audit.unshift(rec);
    return rec;
  };
  /* ---------- Unregistered AI queue (Version 1) ----------
     Four kinds; the Governance API lead stays in the data for later. A decision applies when its dialog confirms; mapping and
     exclusion publish a mapping version at once. Every decision goes to the item's history and to Audit History. */
  /* Three kinds since 2026-09-18: the Administrator declares archived AI sources in Settings, so there is no "unknown identity" to detect. */
  S.unregisteredKinds = ["Unmapped attribute value", "External AI object", "Unclaimed API key"];
  S.unregisteredItems = () => D.unregisteredItems.filter((u) => S.unregisteredKinds.includes(u.type));
  S.unregOpen = (u) => ["New", "Under investigation"].includes(u.status);
  S.unregOpenItems = () => S.unregisteredItems().filter(S.unregOpen);
  function unregEvent(u, action, detail) { (u.decisionHistory = u.decisionHistory || []).push({ date: U.today(), actorMemberId: state.persona ? state.persona.memberId : "system", action, detail: detail || "" }); }
  function unregResolve(u, status, resolution, action, detail, summary) {
    u.status = status;
    u.resolution = Object.assign({ date: U.today(), byMemberId: state.persona ? state.persona.memberId : "system" }, resolution || {});
    unregEvent(u, action, detail);
    S.logAudit({ category: "Register", eventType: "Unregistered item resolved", refType: "unregistered", refId: u.id, groupId: (u.seenInGroupIds || [])[0] || null, summary });
  }
  S.investigateUnregistered = function (id, note) {
    const u = S.byId.unregistered[id];
    u.status = "Under investigation"; unregEvent(u, "Investigation started", note);
    S.logAudit({ category: "Register", eventType: "Unregistered item under investigation", refType: "unregistered", refId: id, groupId: (u.seenInGroupIds || [])[0] || null, summary: `${u.name}: investigation started${note ? " · " + note : ""}` });
    return u;
  };
  S.endInvestigation = function (id, note) {
    const u = S.byId.unregistered[id];
    u.status = "New"; unregEvent(u, "Investigation ended", note || "Ended without a decision.");
    S.logAudit({ category: "Register", eventType: "Unregistered item investigation ended", refType: "unregistered", refId: id, groupId: (u.seenInGroupIds || [])[0] || null, summary: `${u.name}: investigation ended without a decision${note ? " · " + note : ""}` });
    return u;
  };
  S.mapUnregisteredValue = function (id, groupId, note) {
    const u = S.byId.unregistered[id];
    u.rawValues.forEach((raw) => { S.mappingDraft.rows[raw] = groupId; });
    const res = S.publishMapping(`${u.rawValues.join(", ")} mapped to ${S.groupName(groupId)} from Unregistered AI`);
    const text = `Mapped to ${S.groupName(groupId)} in mapping v${res.version}; ${res.affected} ${U.plural(res.affected, "person", "people")} re-attributed with their history.${note ? " " + note : ""}`;
    u.status = "Mapped"; u.resolution = { date: U.today(), byMemberId: state.persona.memberId, groupId, note: text };
    unregEvent(u, "Mapped", text);
    S.logAudit({ category: "Register", eventType: "Unregistered item resolved", refType: "unregistered", refId: id, groupId, summary: `Mapped attribute value ${u.name} to ${S.groupName(groupId)} (mapping v${res.version})` });
    return res;
  };
  S.excludeUnregisteredValue = function (id, reason) {
    const u = S.byId.unregistered[id];
    u.rawValues.forEach((raw) => { S.mappingDraft.rows[raw] = "__excluded__"; S.mappingDraft.excludeReasons[raw] = reason; });
    const res = S.publishMapping(`${u.rawValues.join(", ")} excluded from governance from Unregistered AI`);
    u.status = "Excluded"; u.resolution = { date: U.today(), byMemberId: state.persona.memberId, reason, note: `Excluded from governance in mapping v${res.version}.` };
    unregEvent(u, "Excluded from governance", reason);
    S.logAudit({ category: "Register", eventType: "Unregistered item resolved", refType: "unregistered", refId: id, summary: `Excluded attribute value ${u.name} from governance (mapping v${res.version}): ${reason}` });
    return res;
  };
  function claimAccess(inst, u) {
    (inst.apiAccess = inst.apiAccess || []).push({ name: u.name, redacted: u.keyRedacted, provider: u.provider, projectName: u.projectName, identityType: u.identityType, deployment: u.deployment || null, lastUsed: u.lastUsed, requests30d: u.requests30d, models: u.models || [], claimedDate: U.today() });
  }
  S.linkUnregistered = function (id, target, note) {
    const u = S.byId.unregistered[id];
    /* A credential is assigned to the registered AI system it belongs to ("Assign to a registered AI system", Gabriel's label). The status key stays "Linked". (An outside GPT had a link decision until 2026-09-21; see unregistered.js.) */
    const inst = S.instance(target.instanceId);
    claimAccess(inst, u);
    const resolution = { instanceId: inst.id, note: `Assigned to ${inst.name}.${note ? " " + note : ""}` }, summary = `Assigned ${u.provider || ""} ${(u.identityType || "credential").toLowerCase()} ${u.name} to ${inst.name}`;
    unregResolve(u, "Linked", resolution, "Assigned", resolution.note, summary);
    S.reindex();
    return u;
  };
  S.resolveUnregisteredAsInstance = function (id, inst) {
    const u = S.byId.unregistered[id];
    if (!(inst.apiAccess || []).some((k) => k.name === u.name)) claimAccess(inst, u);
    const note = `Added as a new AI system, ${inst.name}${inst.recordClassId ? "" : " (not archived)"}; registered as Pending.`;
    unregResolve(u, "Added as instance", { instanceId: inst.id, note }, "Added as a new AI system", note, `Added ${u.name} as a new AI system, ${inst.name}`);
    S.reindex();
    return u;
  };
  /* Allowing an outside GPT registers it: an individually registered AI asset with an owner, a purpose and a reconfirmation date. */
  S.allowExternal = function (id, spec) {
    const u = S.byId.unregistered[id], sys = u.aiSystemId ? S.system(u.aiSystemId) : null, owner = S.member(spec.ownerMemberId);
    let entry = null;
    if (sys) {
      entry = S.registerSystem({ aiSystemId: sys.id, ownerMemberId: spec.ownerMemberId, approvedPurpose: spec.approvedPurpose, permittedDataClasses: [] });
      entry.decisionHistory.push({ date: U.today(), actorMemberId: state.persona.memberId, action: "Allowed", detail: `GPT built outside the workspace, allowed from Unregistered AI.${spec.note ? " " + spec.note : ""}`, refType: "unregistered", refId: id });
      sys.sanction = "Allowed";
    }
    const note = `Allowed for: ${spec.approvedPurpose} Owner: ${owner ? owner.displayName : "unassigned"}.${spec.note ? " " + spec.note : ""}`;
    unregResolve(u, "Allowed", { ownerMemberId: spec.ownerMemberId, approvedPurpose: spec.approvedPurpose, registerEntryId: entry ? entry.id : null, note }, "Allowed with an owner", note, `Allowed outside GPT ${u.name} (owner ${owner ? owner.displayName : "unassigned"}): ${spec.approvedPurpose}`);
    return u;
  };
  S.markUnsanctioned = function (id, reason) {
    const u = S.byId.unregistered[id], sys = u.aiSystemId ? S.system(u.aiSystemId) : null;
    if (sys) { sys.sanction = "Unsanctioned"; sys.unsanctionedDate = U.today(); sys.unsanctionedReason = reason; sys.unsanctionedByMemberId = state.persona ? state.persona.memberId : null; }
    unregResolve(u, "Unsanctioned", { reason, note: "Prohibited for business use." }, "Prohibited", reason, `Prohibited ${u.name}: ${reason}`);
    return u;
  };
  S.dismissUnregistered = function (id, category, note) {
    const u = S.byId.unregistered[id];
    unregResolve(u, "Dismissed", { reason: category, note: note || `Dismissed: ${category.toLowerCase()}.` }, "Dismissed", `${category}${note ? ". " + note : ""}`, `Dismissed ${u.name}: ${category}`);
    return u;
  };

  /* ---------- AI Registry ---------- */
  S.registryLevels = ["Platform", "Custom AI system", "GPT", "Project", "Plugin"];
  S.registryEntries = () => D.registerEntries.filter((e) => S.registryLevels.includes(e.level));
  /* What a group's AI assets sub-page lists on its All tile (Gabriel, 2026-09-29: the Groups card's KPI must count the same): the custom AI
     applications the group owns, and every GPT and Project discovered in the group, the outside GPTs its people use included. */
  S.groupAssetCount = (gid) => D.registerEntries.filter((e) => e.groupId === gid && (e.level === "Platform" || e.level === "Custom AI system")).length + D.aiSystems.filter((s) => s.groupId === gid && s.type !== "Custom").length;
  S.entryInstance = (e) => (D.instances || []).find((i) => i.registerEntryId === e.id) || null;
  S.addMonths = function (dateStr, months) { const d = new Date(dateStr + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + months); return d.toISOString().slice(0, 10); };
  S.entryDue = function (e) {
    if (!e.reconfirmationDueDate || ["Retired", "Rejected", "Pending"].includes(e.status)) return { days: null, dueSoon: false, expired: e.status === "Expired" };
    const days = Math.round((new Date(e.reconfirmationDueDate + "T00:00:00Z") - new Date(U.today() + "T00:00:00Z")) / 86400000);
    return { days, dueSoon: days >= 0 && days <= 60, expired: e.status === "Expired" || days < 0 };
  };
  /* Why a discovered AI asset may be used: its own registration, its platform's approval ("Managed": created within an approved platform), or nothing. */
  S.systemCoverage = function (sys) {
    const e = sys.registerEntryId ? S.entry(sys.registerEntryId) : null;
    if (e) return { key: "individual", label: `Registered individually · ${e.status}`, entry: e };
    if (sys.external && sys.sanction === "Unsanctioned") { const by = S.member(sys.unsanctionedByMemberId); return { key: "external", decided: true, label: `Prohibited on ${U.fmtDate(sys.unsanctionedDate)}${by ? " by " + by.displayName : ""}`, reason: sys.unsanctionedReason || "", entry: null }; }
    if (sys.external) return { key: "external", label: "Built outside your workspace · nobody has allowed or prohibited it yet", entry: null };
    if (sys.registrationCoverage === "none") return { key: "none", label: "No platform approval covers it", entry: null };
    const inst = sys.instanceId ? S.instance(sys.instanceId) : null, pe = inst ? S.instanceEntry(inst) : null;
    if (pe && pe.status === "Approved") return { key: "platform", label: `Created within ${inst.name}`, entry: pe };
    if (pe) return { key: "platformPending", label: pe.status === "Pending" ? `${inst.name} is not approved yet` : `${inst.name} is ${pe.status.toLowerCase()}`, entry: pe };
    return { key: "none", label: "No platform approval covers it", entry: null };
  };
  function decision(e, action, detail, refType, refId) {
    e.decisionHistory.push({ date: U.today(), actorMemberId: state.persona ? state.persona.memberId : "system", action, detail: detail || "", refType: refType || null, refId: refId || null });
  }
  S.registerSystem = function (spec) {
    const p = state.persona, sys = S.system(spec.aiSystemId), g = S.group(sys.groupId);
    let id = "re_" + sys.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24);
    while (S.byId.entry[id]) id += "_2";
    /* The cadence follows the risk level of the asset at registration (Gabriel, 2026-10-21): six months for High and Critical, twelve otherwise. */
    const r0 = S.riskForAsset(sys.id), band0 = r0 ? r0.band : "Low", months = S.cadenceForBand(band0);
    const e = { id, level: sys.type === "Project" || sys.type === "Plugin" ? sys.type : "GPT", refId: sys.id, name: sys.name, groupId: sys.groupId, platformId: sys.platformId, ownerMemberId: spec.ownerMemberId, cadenceBand: band0, cadenceSetOn: U.today(), cadenceScoringVersion: S.riskScoring().version,
      approvedPurpose: spec.approvedPurpose, permittedDataClasses: spec.permittedDataClasses || [], status: "Approved", registeredDate: U.today(), registeredByMemberId: p.memberId,
      approvedDate: U.today(), approvedByMemberId: p.memberId, lastReconfirmedDate: null, reconfirmationDueDate: S.addMonths(U.today(), months), reconfirmationIntervalMonths: months,
      externalIdentifier: sys.externalIdentifier || null, collectionMethod: "Connector", decisionHistory: [], blockers: [], notes: null };
    decision(e, "Registered", `Registered individually in ${g ? g.name : "its group"}; approved on registration by the registrant. Reconfirm every ${months} months: the risk level was ${band0} (${r0 ? r0.score : 0}) at registration${scoredUnder()}.`, "system", sys.id);
    D.registerEntries.push(e); S.byId.entry[id] = e; S.entryBySystem[sys.id] = e; (S.entriesByGroup[sys.groupId] = S.entriesByGroup[sys.groupId] || []).push(e);
    sys.registerEntryId = id; sys.registrationCoverage = "individual";
    S.logAudit({ category: "Register", eventType: "Registered", groupId: sys.groupId, aiSystemId: sys.id, refType: "register", refId: id, summary: `Registered ${sys.name} individually (owner ${S.member(spec.ownerMemberId) ? S.member(spec.ownerMemberId).displayName : ""}); approved on registration, reconfirm every ${months} months` });
    return e;
  };
  /* ---------- Findings review (Gabriel, 2026-09-25) ---------- */
  /* The findings a persona may see: those of the groups their Entitlement Policies cover or that they own (an owner sees them as facts);
     the Administrator all of them. */
  S.visibleFindings = function () {
    const p = state.persona; if (!p) return [];
    if (S.can("settings")) return D.findings.slice();
    const owned = new Set(D.groups.filter((g) => g.ownerMemberId === p.memberId).map((g) => g.id));
    return D.findings.filter((f) => f.groupId && (S.isEntitled(f.groupId) || owned.has(f.groupId)));
  };
  /* A reviewer's decision on a finding: Confirmed with a cause or Dismissed with a reason, a severity change with its reason, an
     escalation (target, proposed remediation, whether to notify the owner now) on a confirmed finding, and a flag on the rule. Every
     part is an audit event; an escalation of the AI system suspends the asset's own registration pending the approver's decision. */
  S.decideFinding = function (id, d) {
    const f = S.finding(id), p = state.persona, r = S.rule(f.ruleId), now = D.meta.now;
    const ep = (p.eps || []).find((x) => (x.groupIds || []).includes(f.groupId));
    f.status = d.decision;
    f.review = { reviewerMemberId: p.memberId, decision: d.decision, reason: d.reason, note: d.note || "", decidedAt: now, entitlementPolicyId: ep ? (ep.id || ep.policyId || null) : null };
    if (d.severity && d.severity.to && d.severity.to !== f.severity) { f.severityAdjustment = { fromSeverity: f.severity, toSeverity: d.severity.to, reason: d.severity.reason || "", byMemberId: p.memberId }; f.severity = d.severity.to; }
    S.logAudit({ category: "Governance decision", eventType: `Finding ${d.decision.toLowerCase()}`, groupId: f.groupId, aiSystemId: f.aiSystemId || null, refType: "finding", refId: f.findingId, summary: `${d.decision}: ${r ? r.name : f.ruleId} (${d.reason})`, details: { reason: d.reason, note: d.note || "", ruleVersion: f.ruleVersion, severity: f.severity } });
    if (d.flagRule && r) {
      f.ruleFlaggedForReview = true;
      (r.flaggedForReview = r.flaggedForReview || []).push({ findingId: f.findingId, byMemberId: p.memberId, date: U.today(), note: d.note || "" });
      S.logAudit({ category: "Configuration", eventType: "Rule flagged for review", groupId: f.groupId, refType: "rule", refId: r.id, summary: `Flagged for review: ${r.name}`, details: { findingId: f.findingId } });
    }
    let esc = null;
    if (d.decision === "Confirmed" && d.escalate) {
      const sys = f.aiSystemId ? S.system(f.aiSystemId) : null, cov = sys ? S.systemCoverage(sys) : null;
      const entry = d.escalate.target === "AI system" && cov && cov.key === "individual" ? cov.entry : null;
      esc = { escalationId: "esc_rt" + Math.random().toString(36).slice(2, 8), findingId: f.findingId, target: d.escalate.target, proposedRemediation: d.escalate.remediation, escalatedByMemberId: p.memberId, escalatedAt: now,
        requiredApprovals: ((D.settings.approvals || {}).requiredBySeverity || {})[f.severity] || 1, approvals: [], status: "Open", registerEntryId: entry ? entry.id : null, ownerTaskStatus: null, completedAt: null, reconfirmedAt: null, returnNote: null, groupId: f.groupId, aiSystemId: f.aiSystemId || null };
      D.escalations.push(esc); S.byId.escalation[esc.escalationId] = esc; (S.escalationsByGroup[f.groupId] = S.escalationsByGroup[f.groupId] || []).push(esc);
      f.escalationId = esc.escalationId; f.notifyOwnerNow = !!d.escalate.notifyOwner;
      if (entry) { entry.status = "Suspended"; decision(entry, "Suspended", `Suspended pending a decision on the escalation of a ${f.severity} finding.`, "escalation", esc.escalationId); }
      S.logAudit({ category: "Governance decision", eventType: "Finding escalated", groupId: f.groupId, aiSystemId: f.aiSystemId || null, refType: "escalation", refId: esc.escalationId, summary: `Escalated for ${d.escalate.target === "Conduct" ? "conduct" : "AI system"} remediation: ${d.escalate.remediation}`, details: { target: d.escalate.target, requiredApprovals: esc.requiredApprovals } });
      if (d.escalate.notifyOwner) { const g = S.group(f.groupId), o = g ? S.member(g.ownerMemberId) : null; S.logAudit({ category: "Notification", eventType: "Immediate notification sent", actorType: "system", actorId: "system", groupId: f.groupId, aiSystemId: f.aiSystemId || null, refType: "escalation", refId: esc.escalationId, summary: `${o ? o.displayName : "The accountable owner"} notified now: a ${f.severity} finding${sys ? ` on ${sys.name}` : ""} was escalated`, details: {} }); }
    }
    return { finding: f, escalation: esc };
  };
  /* ---------- Approvals (built 2026-09-25): the approver's response to an escalation, and the reviewer's revision after a return ---------- */
  const escEvent = (e, eventType, summary, details) => S.logAudit({ category: "Governance decision", eventType, groupId: e.groupId || null, aiSystemId: e.aiSystemId || null, refType: "escalation", refId: e.escalationId, summary, details: details || {} });
  const escSubject = (e) => { const s = e.aiSystemId ? S.system(e.aiSystemId) : null; return s ? s.name : (S.group(e.groupId) ? S.group(e.groupId).name : "the group"); };
  /* An immediate notification to the group's accountable owner, in the cases Notifications lists as unable to wait for the digest:
     a registration's status changed, or a remediation was sent back or rejected. */
  const notifyOwnerNow = (e, why) => { const g = S.group(e.groupId), o = g ? S.member(g.ownerMemberId) : null; S.logAudit({ category: "Notification", eventType: "Immediate notification sent", actorType: "system", actorId: "system", groupId: e.groupId || null, aiSystemId: e.aiSystemId || null, refType: "escalation", refId: e.escalationId, summary: `${o ? o.displayName : "The accountable owner"} notified now: ${why}`, details: {} }); };
  const liftSuspension = (e, detail) => { const en = e.registerEntryId ? S.entry(e.registerEntryId) : null; if (en && en.status === "Suspended") { en.status = "Approved"; decision(en, "Suspension lifted", detail, "escalation", e.escalationId); return en; } return null; };
  S.approveEscalation = function (id, d) {
    const e = S.escalation(id), p = state.persona, now = AGC.data.meta.now, f = S.finding(e.findingId);
    d = d || {};
    e.approvals.push({ approverMemberId: p.memberId, decision: "Approved", decidedAt: now, reasoning: d.note || "" });
    let lifted = null, closedByRetirement = null;
    if (d.downgrade && e.target === "AI system") {
      /* The approver's call: the AI system is not the problem, this person's use of it is. The registration is no longer in question. */
      e.downgrade = { byMemberId: p.memberId, at: now, reason: d.downgradeReason || "", entryId: e.registerEntryId || null };
      lifted = liftSuspension(e, `Escalation downgraded to a conduct remediation by the approver: ${d.downgradeReason || ""}`);
      e.target = "Conduct"; e.registerEntryId = null;
      escEvent(e, "Escalation downgraded", `Downgraded to a conduct remediation: ${d.downgradeReason || ""}`, { reason: d.downgradeReason || "" });
    }
    const given = e.approvals.filter((a) => a.decision === "Approved").length, done = given >= e.requiredApprovals;
    if (done) {
      e.status = "Approved"; e.ownerTaskStatus = "Not started"; e.approvedAt = now;
      const en = e.registerEntryId ? S.entry(e.registerEntryId) : null;
      if (en && en.status === "Retired") {
        /* The registration was retired while the escalation waited. The escalation stays in the approvers' queue (Gabriel, 2026-11-12), so the
           approval is recorded; and because a remediation on a retired registration is closed by retirement whichever came first, the
           remediation this approval creates is closed at once: the approved change is not made, and the record says so. */
        const rt = (en.decisionHistory || []).slice().reverse().find((h) => h.action === "Retired") || {};
        e.status = "Completed"; e.ownerTaskStatus = "Closed by retirement"; e.closedAt = now; e.closedByMemberId = rt.actorMemberId || null; e.closedReason = rt.detail || ""; e.closedRetiredOn = rt.date || null;
        closedByRetirement = en;
        decision(en, "Remediation closed by retirement", `Approved after the retirement, so the approved change was not made: ${e.proposedRemediation}`, "escalation", e.escalationId);
      } else if (en) decision(en, "Remediation approved", `${e.proposedRemediation} Stays suspended until the owner completes it and reconfirms.`, "escalation", e.escalationId);
    }
    escEvent(e, "Escalation approved", `${done ? "Approved" : `Approved (${given} of ${e.requiredApprovals}), waiting for another approver`}: ${e.target === "Conduct" ? "conduct" : "AI system"} remediation on ${escSubject(e)}${d.note ? " · " + d.note : ""}`, { approvals: `${given} of ${e.requiredApprovals}`, note: d.note || "", severity: f ? f.severity : null });
    if (closedByRetirement) escEvent(e, "Remediation closed by retirement", `${closedByRetirement.name} had been retired before this approval, so the remediation was closed without the approved change.${e.closedReason ? ` Reason for retiring: ${e.closedReason}` : ""}`, { reason: e.closedReason || "" });
    if (lifted) notifyOwnerNow(e, `${lifted.name} is approved again; the escalation was downgraded to this person's conduct${done ? ", and the remediation is now theirs to complete" : ""}`);
    return e;
  };
  S.rejectEscalation = function (id, d) {
    const e = S.escalation(id), p = state.persona, now = AGC.data.meta.now;
    d = d || {};
    e.approvals.push({ approverMemberId: p.memberId, decision: "Rejected", decidedAt: now, reasoning: d.reason || "" });
    e.status = "Rejected"; e.rejectedAt = now;
    const lifted = liftSuspension(e, `Escalation rejected as accepted risk: ${d.reason || ""}`);
    escEvent(e, "Escalation rejected", `Rejected as accepted risk: ${d.reason || ""}`, { reason: d.reason || "" });
    notifyOwnerNow(e, `the escalation on ${escSubject(e)} was rejected as accepted risk${lifted ? `; ${lifted.name} is approved again` : ""}`);
    return e;
  };
  S.returnEscalation = function (id, d) {
    const e = S.escalation(id), p = state.persona, now = AGC.data.meta.now;
    d = d || {};
    e.approvals.push({ approverMemberId: p.memberId, decision: "Returned", decidedAt: now, reasoning: d.note || "" });
    e.status = "Returned"; e.returnNote = d.note || ""; e.returnedAt = now; e.returnedByMemberId = p.memberId;
    escEvent(e, "Escalation returned", `Returned to the reviewer: ${d.note || ""}`, { note: d.note || "" });
    notifyOwnerNow(e, `the escalation on ${escSubject(e)} went back to the reviewer for clarification`);
    return e;
  };
  /* The reviewer's answer to a return: the escalation, revised, goes back to the approvers with a clean count, and the registration follows
     the target (suspended again for the AI system, released for conduct). The earlier decisions stay in Audit History. */
  S.reviseEscalation = function (id, d) {
    const e = S.escalation(id), p = state.persona, now = AGC.data.meta.now, f = S.finding(e.findingId), sys = e.aiSystemId ? S.system(e.aiSystemId) : null;
    const before = e.target;
    e.priorApprovals = (e.priorApprovals || []).concat(e.approvals); e.approvals = [];
    e.lastReturn = { note: e.returnNote || "", byMemberId: e.returnedByMemberId || null, at: e.returnedAt || null };
    e.target = d.target; e.proposedRemediation = d.remediation; e.revision = { byMemberId: p.memberId, at: now, note: d.note || "" }; e.revisedAt = now;
    e.status = "Open"; e.returnNote = null;
    if (before !== d.target) {
      if (d.target === "Conduct") { liftSuspension(e, "The revised escalation targets the person's conduct, not the AI system."); e.registerEntryId = null; }
      else { const cov = sys ? S.systemCoverage(sys) : null, en = cov && cov.key === "individual" ? cov.entry : null; if (en) { e.registerEntryId = en.id; if (en.status === "Approved") { en.status = "Suspended"; decision(en, "Suspended", `Suspended pending a decision on the revised escalation of a ${f ? f.severity : ""} finding.`, "escalation", e.escalationId); } } }
    }
    escEvent(e, "Escalation revised", `Revised and resubmitted for ${d.target === "Conduct" ? "conduct" : "AI system"} remediation: ${d.remediation}${d.note ? " · " + d.note : ""}`, { target: d.target, note: d.note || "" });
    return e;
  };
  /* ---------- The owner's response (built 2026-09-28): an approved remediation is started, completed, or closed by retiring ---------- */
  /* A remediation's four statuses (Gabriel, 2026-11-12: "Choose the best set of states to use that will be clear to a user. Ensure it is
     all consistent."). A remediation exists from the moment the approvers approve an escalation. Not started: approved, and nobody has
     recorded any work. In progress: someone recorded that work has begun. Completed: someone recorded what was done. Closed by retirement:
     the registration was retired before the change was made, so the change was never made. "Open" is not one of them: it is the data value
     of an escalation still awaiting an approver, and the everyday word for anything unfinished. Every screen takes the status, its words
     and its sentence from these helpers, so no page can word it differently. The escalation's own data status stays Approved while the
     remediation is Not started or In progress, and is Completed once the remediation is Completed or Closed by retirement. */
  S.REMEDIATION_STATUSES = ["Not started", "In progress", "Completed", "Closed by retirement"];
  S.remediationStatus = (e) => (!e || !["Approved", "Completed"].includes(e.status) ? null : S.REMEDIATION_STATUSES.includes(e.ownerTaskStatus) ? e.ownerTaskStatus : (e.status === "Completed" ? "Completed" : "Not started"));
  S.remediationOpen = (e) => ["Not started", "In progress"].includes(S.remediationStatus(e));
  /* Who it waits for: the accountable owner of the registration when the AI system must change, of the business group when a person's use must. */
  S.remediationOwner = (e) => { const en = e && e.registerEntryId ? S.entry(e.registerEntryId) : null, g = e ? S.group(e.groupId) : null; return S.member(en ? en.ownerMemberId : (g ? g.ownerMemberId : null)) || null; };
  /* Nobody completes a remediation about their own use of AI (separation of duties, 2026-09-28). When the finding is about the owner
     themselves, the remediation therefore waits for Compliance or an Administrator, and every page says that instead of naming the owner. */
  S.remediationOwnUse = (e) => { const o = S.remediationOwner(e), f = e ? S.finding(e.findingId) : null; return !!(o && f && f.memberId === o.memberId); };
  S.REMEDIATION_OWN_USE = "Compliance or an Archive360 Administrator";
  S.remediationApprovedAt = (e) => { const a = (e.approvals || []).filter((x) => x.decision === "Approved").slice(-1)[0]; return e.approvedAt || (a ? a.decidedAt : e.escalatedAt); };
  /* The escalation in words: the approvers' decision until it is approved, the remediation's status from then on. */
  S.escalationWord = (e) => ({ Open: "Awaiting approval", Returned: "Returned to the reviewer", Rejected: "Rejected as accepted risk" })[e.status] || `Remediation ${(S.remediationStatus(e) || e.status).toLowerCase()}`;
  /* The remediation's status with its facts, as html: the status, its date and who; and what was recorded with it on a line of its own.
     opt.owner replaces the owner's name (a link, or "you"). */
  S.remediationLine = function (e, opt) {
    opt = opt || {};
    const st = S.remediationStatus(e); if (!st) return "";
    const nm = (id) => { const m = id ? S.member(id) : null; return m ? U.esc(m.displayName) : ""; }, o = S.remediationOwner(e);
    const owner = opt.owner || (o ? U.esc(o.displayName) : "the accountable owner"), en = e.registerEntryId ? S.entry(e.registerEntryId) : null;
    const own = S.remediationOwnUse(e);
    const main = st === "Not started" ? `Not started · waiting for ${own ? S.REMEDIATION_OWN_USE : owner} since ${U.fmtDate(S.remediationApprovedAt(e))}`
      : st === "In progress" ? `In progress${e.startedAt ? ` since ${U.fmtDate(e.startedAt)}` : ""}${nm(e.startedByMemberId) ? `, started by ${nm(e.startedByMemberId)}` : ""}`
      : st === "Completed" ? `Completed${e.completedAt ? ` ${U.fmtDate(e.completedAt)}` : ""}${nm(e.completedByMemberId) ? ` by ${nm(e.completedByMemberId)}` : ""}${e.reconfirmedAt ? ` · reconfirmed ${U.fmtDate(e.reconfirmedAt)}` : ""}`
      : `Closed by retirement${e.closedAt ? ` ${U.fmtDate(e.closedAt)}` : ""}`;
    const note = st === "Not started" ? (own ? `It is about ${owner}'s own use of AI, so ${owner} cannot complete it.` : "") : st === "In progress" ? U.esc(e.startNote || "") : st === "Completed" ? U.esc(e.completionNote || "")
      : st === "Closed by retirement" ? `${en ? U.esc(en.name) : "The AI system"} was retired${e.closedRetiredOn ? ` on ${U.fmtDate(e.closedRetiredOn)}` : ""}${nm(e.closedByMemberId) ? ` by ${nm(e.closedByMemberId)}` : ""} before the approved change was made, so the change was not made.${e.closedReason ? ` Reason for retiring: ${U.esc(e.closedReason)}` : ""}` : "";
    return `${main}${note ? `<div class="small muted">${note}</div>` : ""}`;
  };
  S.ownerTasks = () => D.escalations.filter(S.remediationOpen);
  S.entryRemediation = (entryId) => D.escalations.find((e) => e.registerEntryId === entryId && S.remediationOpen(e)) || null;
  S.entryPendingEscalation = (entryId) => D.escalations.find((e) => e.registerEntryId === entryId && ["Open", "Returned"].includes(e.status)) || null;
  S.startRemediation = function (id, d) {
    const e = S.escalation(id), p = state.persona, now = AGC.data.meta.now; d = d || {};
    e.ownerTaskStatus = "In progress"; e.startedAt = now; e.startedByMemberId = p.memberId; e.startNote = d.note || "";
    const en = e.registerEntryId ? S.entry(e.registerEntryId) : null;
    if (en) decision(en, "Remediation started", d.note || "Work on the remediation has begun.", "escalation", e.escalationId);
    escEvent(e, "Remediation started", d.note || "Work on the remediation has begun.", { note: d.note || "" });
    return e;
  };
  /* Completing a remediation on a suspended registration and confirming the AI system is fit again are the same act for the owner
     (Gabriel, 2026-09-28: one dialog); someone completing it on the owner's behalf leaves the reconfirmation to the owner. */
  S.completeRemediation = function (id, d) {
    const e = S.escalation(id), p = state.persona, now = AGC.data.meta.now; d = d || {};
    e.ownerTaskStatus = "Completed"; e.status = "Completed"; e.completedAt = now; e.completedByMemberId = p.memberId; e.completionNote = d.note || "";
    const en = e.registerEntryId ? S.entry(e.registerEntryId) : null, owner = (S.remediationOwner(e) || {}).memberId === p.memberId;
    if (en) decision(en, "Remediation completed", d.note || "", "escalation", e.escalationId);
    escEvent(e, "Remediation completed", `${owner ? "Owner marked the remediation complete" : "Marked complete on the owner's behalf"}: ${d.note || ""}`, { note: d.note || "" });
    if (d.reconfirm && en && en.status === "Suspended") { S.reconfirmEntry(en.id, `After completing the remediation of the escalation of ${U.fmtDate(e.escalatedAt)}.`); e.reconfirmedAt = AGC.data.meta.now; }
    return e;
  };
  /* ---------- AI Policy Rules (built 2026-09-28): the rulebook's facts, and every change as a published version ---------- */
  /* A rule's kind, from its scope: named groups (scope), none (absolute prohibition), or its own condition (conditional). */
  S.ruleKind = (r) => (Array.isArray(r.permittedGroupIds) ? (r.permittedGroupIds.length ? "scope" : "absolute") : "conditional");
  S.ruleFindings = (r) => D.findings.filter((f) => f.ruleId === r.id);
  S.openRuleFlags = (r) => (r.flaggedForReview || []).filter((f) => !f.resolution);
  /* The rules that apply to a group: every rule except the scope rules that permit the group. */
  S.rulesForGroup = (gid) => D.rules.filter((r) => S.ruleKind(r) !== "scope" || !r.permittedGroupIds.includes(gid));
  /* Findings by outcome in the last N days (or all time), the dismissal reasons, the groups it fires in, and the permitted detections
     a scope rule let through, from the aggregated permitted-use detections. */
  S.ruleStats = function (r, days) {
    const since = days ? U.addDays(U.today(), -days) : null;
    const list = S.ruleFindings(r).filter((f) => !since || f.detectedAt.slice(0, 10) >= since);
    const reasons = {}, byGroup = {};
    list.forEach((f) => { if (f.status === "Dismissed" && f.review) reasons[f.review.reason] = (reasons[f.review.reason] || 0) + 1; if (f.groupId) byGroup[f.groupId] = (byGroup[f.groupId] || 0) + 1; });
    const sorted = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
    const monthFrom = since ? since.slice(0, 7) : null, permittedIn = new Set(Array.isArray(r.permittedGroupIds) ? r.permittedGroupIds : []);
    const permitted = (D.detections || []).filter((d) => d.permitted && r.dataClassIds.includes(d.dataClassId) && permittedIn.has(d.groupId) && (!monthFrom || d.month >= monthFrom)).reduce((n, d) => n + (d.count || 0), 0);
    return { total: list.length, confirmed: list.filter((f) => f.status === "Confirmed").length, dismissed: list.filter((f) => f.status === "Dismissed").length, awaiting: list.filter((f) => f.status === "Detected").length,
      reasons: sorted(reasons), topDismiss: (sorted(reasons)[0] || [null])[0], byGroup: sorted(byGroup), permitted };
  };
  /* The permitted-data matrix: for every group and sensitive data tag, what the active rules say. A scope rule decides the cell; an absolute
     rule on the same tag (full SSNs within Personal Identifiers) is named beside it; a tag with only conditional rules is conditional. */
  S.ruleMatrix = function () {
    const active = D.rules.filter((r) => r.status === "Active"), out = {};
    S.groupsOrdered().forEach((g) => {
      out[g.id] = {};
      D.dataClasses.forEach((dc) => {
        const on = active.filter((r) => r.dataClassIds.includes(dc.id));
        const scope = on.filter((r) => S.ruleKind(r) === "scope"), abs = on.filter((r) => S.ruleKind(r) === "absolute"), cond = on.filter((r) => S.ruleKind(r) === "conditional");
        let key, label;
        if (scope.length) { const ok = scope.every((r) => r.permittedGroupIds.includes(g.id)); key = ok ? "ok" : "no"; label = ok ? "Permitted" : "Not permitted"; }
        else if (abs.length) { key = "prohibited"; label = "Prohibited"; }
        else if (cond.length) { key = "cond"; label = "Conditional"; }
        else { key = "none"; label = "No rule"; }
        const lines = on.map((r) => `${r.name}${S.ruleKind(r) === "absolute" && scope.length ? " (prohibited everywhere)" : S.ruleKind(r) === "conditional" ? " (conditional)" : ""}`);
        out[g.id][dc.id] = { key, label, rules: on, title: lines.length ? lines.join("\n") : "No active rule detects this here." };
      });
    });
    return out;
  };
  S.nextRuleVersion = (r) => { const parts = String(r.currentVersion || "1.0").split("."); return `${parts[0]}.${(parseInt(parts[1] || "0", 10) || 0) + 1}`; };
  const ruleEvent = (r, eventType, summary, details) => S.logAudit({ category: "Configuration", eventType, groupId: null, refType: "rule", refId: r.id, summary, details: details || {} });
  const RULE_LABEL = { name: "name", defaultSeverity: "default severity", basisDetail: "basis detail", remediationGuidance: "remediation guidance" };
  S.publishRuleVersion = function (id, patch, note) {
    const r = S.rule(id), p = state.persona, v = S.nextRuleVersion(r), changes = [];
    patch = patch || {};
    Object.keys(RULE_LABEL).forEach((k) => { if (patch[k] !== undefined && patch[k] !== (r[k] || "")) { changes.push(RULE_LABEL[k]); r[k] = patch[k]; } });
    if (patch.regulatoryBasis && JSON.stringify(patch.regulatoryBasis) !== JSON.stringify(r.regulatoryBasis)) { changes.push("regulatory basis"); r.regulatoryBasis = patch.regulatoryBasis; }
    if (patch.permittedGroupIds && S.ruleKind(r) === "scope" && patch.permittedGroupIds.length && JSON.stringify(patch.permittedGroupIds) !== JSON.stringify(r.permittedGroupIds)) { changes.push("where permitted"); r.permittedGroupIds = patch.permittedGroupIds; }
    r.versions.push({ version: v, effectiveDate: U.today(), changeNote: note || "", changedByMemberId: p.memberId, changed: changes });
    r.currentVersion = v;
    const answered = S.openRuleFlags(r);
    answered.forEach((f) => { f.resolution = { kind: "version", version: v, byMemberId: p.memberId, date: U.today(), note: note || "" }; });
    ruleEvent(r, "Rule version published", `${r.name} v${v}: ${note || ""}${changes.length ? ` (${changes.join(", ")})` : ""}${answered.length ? `; answers ${answered.length} reviewer ${U.plural(answered.length, "flag")}` : ""}`, { version: v, changes, flagsAnswered: answered.length });
    return r;
  };
  S.createRule = function (spec) {
    const p = state.persona;
    let id = "r_" + spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 28);
    while (S.byId.rule[id]) id += "_2";
    const r = { id, name: spec.name, family: spec.kind === "absolute" ? "Absolute prohibition" : "Purpose scope", dataClassIds: spec.dcs.slice(), permittedGroupIds: spec.kind === "absolute" ? [] : spec.groups.slice(),
      defaultSeverity: spec.severity || "High", regulatoryBasis: spec.basis.slice(), basisDetail: spec.basisDetail || "", remediationGuidance: spec.guidance || "", status: "Active",
      versions: [{ version: "1.0", effectiveDate: U.today(), changeNote: "Initial rule.", changedByMemberId: p.memberId }], currentVersion: "1.0", ownerMemberId: p.memberId, flaggedForReview: [], createdAt: AGC.data.meta.now, createdByMemberId: p.memberId };
    D.rules.push(r); S.byId.rule[id] = r;
    ruleEvent(r, "Rule created", `${r.name} v1.0: ${r.family}, ${r.defaultSeverity} by default, ${r.regulatoryBasis.join(", ")}; detects ${r.dataClassIds.map((x) => S.dcName(x)).join(", ")}; permitted ${spec.kind === "absolute" ? "nowhere" : "in " + r.permittedGroupIds.map((g) => S.groupName(g)).join(", ")}`, { version: "1.0" });
    return r;
  };
  S.setRuleStatus = function (id, active, reason) {
    const r = S.rule(id), p = state.persona;
    r.status = active ? "Active" : "Inactive"; r.statusChangedAt = U.today(); r.statusChangedByMemberId = p.memberId; r.statusReason = reason || "";
    (r.statusHistory = r.statusHistory || []).push({ status: r.status, date: U.today(), byMemberId: p.memberId, reason: reason || "" });
    ruleEvent(r, active ? "Rule activated" : "Rule deactivated", `${r.name}${reason ? ": " + reason : ""}`, { reason: reason || "" });
    return r;
  };
  /* Delete exists only while nothing refers to the rule; a rule with findings is deactivated instead. */
  S.deleteRule = function (id) {
    const r = S.rule(id);
    if (!r || S.ruleFindings(r).length) return false;
    D.rules.splice(D.rules.indexOf(r), 1); delete S.byId.rule[id];
    S.logAudit({ category: "Configuration", eventType: "Rule deleted", groupId: null, refType: "rule", refId: id, summary: `${r.name} deleted before it produced any finding`, details: { version: r.currentVersion } });
    return true;
  };
  S.answerRuleFlags = function (id, note) {
    const r = S.rule(id), p = state.persona, open = S.openRuleFlags(r);
    open.forEach((f) => { f.resolution = { kind: "kept", byMemberId: p.memberId, date: U.today(), note: note || "" }; });
    ruleEvent(r, "Rule flags answered", `${r.name}: reviewed and kept as it is, answering ${open.length} reviewer ${U.plural(open.length, "flag")}: ${note || ""}`, { flagsAnswered: open.length, note: note || "" });
    return r;
  };
  S.approveEntry = function (id, note) {
    const e = S.entry(id), p = state.persona, cad = S.cadenceFor(e), months = cad.months;
    e.status = "Approved"; e.approvedDate = U.today(); e.approvedByMemberId = p.memberId; e.reconfirmationIntervalMonths = months; e.cadenceBand = cad.band; e.cadenceSetOn = U.today(); e.cadenceScoringVersion = S.riskScoring().version; e.reconfirmationDueDate = S.addMonths(U.today(), months); e.blockers = [];
    decision(e, "Approved", `${note || "Approved for use."} Reconfirm every ${months} months: the risk level was ${cad.band} (${cad.score}) at approval${scoredUnder()}.`);
    S.logAudit({ category: "Register", eventType: "Approved", groupId: e.groupId, refType: "register", refId: id, summary: `Approved: ${e.name}${note ? " · " + note : ""}` });
    return e;
  };
  S.rejectEntry = function (id, reason) {
    const e = S.entry(id);
    e.status = "Rejected"; decision(e, "Rejected", reason);
    S.logAudit({ category: "Register", eventType: "Rejected", groupId: e.groupId, refType: "register", refId: id, summary: `Rejected: ${e.name} · ${reason}` });
    return e;
  };
  S.reconfirmEntry = function (id, note) {
    const e = S.entry(id), cad = S.cadenceFor(e), months = cad.months;
    /* How early or late the attestation came, so an auditor sees it without reading the note. */
    const days = e.reconfirmationDueDate ? Math.round((new Date(e.reconfirmationDueDate + "T00:00:00Z") - new Date(U.today() + "T00:00:00Z")) / 86400000) : null;
    const span = (n) => (n >= 45 ? `${Math.round(n / 30)} ${U.plural(Math.round(n / 30), "month")}` : `${n} ${U.plural(n, "day")}`);
    const timing = days === null || days === 0 ? "" : days > 0 ? ` Reconfirmed ${span(days)} before it was due.` : ` Reconfirmed ${span(-days)} after it was due.`;
    e.status = "Approved"; e.lastReconfirmedDate = U.today(); e.reconfirmationIntervalMonths = months; e.cadenceBand = cad.band; e.cadenceSetOn = U.today(); e.cadenceScoringVersion = S.riskScoring().version; e.reconfirmationDueDate = S.addMonths(U.today(), months);
    e.blockers = (e.blockers || []).filter((b) => b !== "Owner terminated");
    decision(e, "Reconfirmed", `Owner confirmed that it is still needed and still used for its approved purpose.${timing}${note ? " " + note : ""} Reconfirm every ${months} months: the risk level was ${cad.band} (${cad.score}) at reconfirmation${scoredUnder()}.`);
    S.logAudit({ category: "Register", eventType: "Reconfirmed", groupId: e.groupId, refType: "register", refId: id, summary: `Reconfirmed: ${e.name}; next due ${e.reconfirmationDueDate}` });
    return e;
  };
  S.reconfirm = (entryId) => S.reconfirmEntry(entryId, "");
  S.retireEntry = function (id, reason) {
    const e = S.entry(id);
    e.status = "Retired"; e.reconfirmationDueDate = null; decision(e, "Retired", reason);
    /* Retiring is the other way out of a suspension: a remediation on the registration that is not finished is closed by retirement, with
       the reason. It is never called completed, because the approved change was not made (Gabriel, 2026-11-12). */
    D.escalations.filter((x) => x.registerEntryId === id && S.remediationOpen(x)).forEach((x) => {
      x.ownerTaskStatus = "Closed by retirement"; x.status = "Completed"; x.closedAt = AGC.data.meta.now; x.closedByMemberId = state.persona.memberId; x.closedReason = reason; x.closedRetiredOn = U.today();
      decision(e, "Remediation closed by retirement", `The approved change was not made: ${x.proposedRemediation}`, "escalation", x.escalationId);
      escEvent(x, "Remediation closed by retirement", `${e.name} was retired before the approved change was made, so the remediation was closed without it. Reason for retiring: ${reason}`, { reason });
    });
    /* Retiring changes the registration only. The AI asset keeps the status its platform reports (Active or Deleted; 2026-09-30):
       Archive360 switches nothing off, so the asset is never shown as retired in ChatGPT Enterprise. */
    S.logAudit({ category: "Register", eventType: "Retired", groupId: e.groupId, refType: "register", refId: id, summary: `Retired: ${e.name} · ${reason}` });
    return e;
  };
  S.updateRegistration = function (id, patch) {
    const e = S.entry(id), changes = [];
    if (patch.ownerMemberId && patch.ownerMemberId !== e.ownerMemberId) { const from = S.member(e.ownerMemberId), to = S.member(patch.ownerMemberId); changes.push(`owner changed to ${to ? to.displayName : ""}`); decision(e, "Owner changed", `Accountable owner changed from ${from ? from.displayName : "unassigned"} to ${to ? to.displayName : ""}.`); e.ownerMemberId = patch.ownerMemberId; e.blockers = (e.blockers || []).filter((b) => b !== "Owner terminated"); }
    if (patch.approvedPurpose !== undefined && patch.approvedPurpose !== e.approvedPurpose) { changes.push("purpose updated"); e.approvedPurpose = patch.approvedPurpose; }
    if (patch.permittedDataClasses && patch.permittedDataClasses.join() !== (e.permittedDataClasses || []).join()) { changes.push("permitted data classes updated"); e.permittedDataClasses = patch.permittedDataClasses; }
    if (changes.length) { decision(e, "Updated", changes.join("; ")); S.logAudit({ category: "Register", eventType: "Registration updated", groupId: e.groupId, refType: "register", refId: id, summary: `${e.name}: ${changes.join("; ")}` }); }
    return { entry: e, changes };
  };

  /* ---------- Settings defaults (fill in anything the generator did not emit) ---------- */
  (function initSettings() {
    const st = D.settings;
    st.digest.immediateEnabled = st.digest.immediateEnabled || Object.fromEntries(st.digest.immediateCases.map((c) => [c, true]));
    st.digest.reviewerSummary = st.digest.reviewerSummary || "Daily";
    st.reconfirmation.autoExpire = st.reconfirmation.autoExpire !== false;
    st.reconfirmation.ownerDepartureGraceDays = st.reconfirmation.ownerDepartureGraceDays || 30;
    st.evidence.sampleSize = st.evidence.sampleSize || 25;
    st.evidence.stratify = st.evidence.stratify !== false;
    st.assuranceSample = st.assuranceSample || { enabled: false, perGroupPerMonth: 25 };
    st.governanceApi = st.governanceApi || { status: "Active", lastLookup: "2026-09-03T17:42:00Z", lookups30d: 212, noMatch30d: 14, keyRotated: "2026-07-01" };
  })();
  S.saveSettings = function (section, patch, summary) {
    Object.assign(D.settings[section], patch);
    S.logAudit({ category: "Configuration", eventType: "Settings changed", refType: "settings", refId: section, summary: summary || `${section} settings updated` });
  };

  /* ---------- Index rebuild after mapping changes or group creation ---------- */
  S.reindex = function () {
    S.membersByGroup = U.groupBy(D.members.filter((m) => m.primaryGroupId), "primaryGroupId");
    S.systemsByGroup = U.groupBy(D.aiSystems.filter((s) => s.groupId), "groupId");
    S.interactionsByGroup = U.groupBy(D.interactions.filter((i) => i.groupId), "groupId");
    S.findingsByGroup = U.groupBy(D.findings.filter((f) => f.groupId), "groupId");
    S.escalationsByGroup = U.groupBy(D.escalations, "groupId");
    S.entriesByGroup = U.groupBy(D.registerEntries.filter((e) => e.groupId), "groupId");
    S.auditByGroup = U.groupBy(D.auditEvents.filter((e) => e.groupId), "groupId");
    S.byId.group = index(D.groups, "id");
    S.byId.entry = index(D.registerEntries, "id");
    S.byId.unregistered = index(D.unregisteredItems, "id");
  };

  /* ---------- Business Group Mapping: staged draft, publish as a version ---------- */
  S.resetMappingDraft = function () { S.mappingDraft = { rows: {}, newGroups: [], overridesAdd: [], overridesRemove: [], excludeReasons: {}, sourceAttribute: null, managerFallback: null }; };
  S.resetMappingDraft();
  /* Attribute helpers. The published attribute is M.sourceAttribute; a staged change lives in the draft until published. */
  S.attributeOptions = () => D.mapping.attributeOptions || [{ key: "department", label: "Department", technical: "department" }];
  S.attributeOption = (key) => S.attributeOptions().find((o) => o.key === key) || { key, label: key, technical: key };
  S.activeAttribute = () => (S.mappingDraft.sourceAttribute !== null ? S.mappingDraft.sourceAttribute : D.mapping.sourceAttribute);
  S.attributeChangeStaged = () => S.mappingDraft.sourceAttribute !== null && S.mappingDraft.sourceAttribute !== D.mapping.sourceAttribute;
  S.attrValue = (m, attr) => (m[attr || D.mapping.sourceAttribute] || "");
  S.membersForValue = function (rawValue, attr) {
    return S.sortMembers(D.members.filter((m) => m.sourceSystem !== "Archive360 local account" && S.attrValue(m, attr) === rawValue));
  };
  S.attributePreview = function (attr) {
    const vals = new Set();
    let members = 0;
    D.members.forEach((m) => { if (m.memberStatus === "Active" && m.sourceSystem !== "Archive360 local account" && S.attrValue(m, attr)) { vals.add(S.attrValue(m, attr)); members += 1; } });
    return { values: vals.size, members };
  };
  function ints90(ms) { return U.sum(ms, (m) => (S.interactionsByMember[m.memberId] || []).filter((i) => U.daysAgo(i.date) <= 90).length); }
  function groupBreakdown(ms) {
    const c = U.countBy(ms.filter((m) => m.memberStatus === "Active"), (m) => m.primaryGroupId || "__none__");
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([gid, n]) => ({ groupId: gid === "__none__" ? null : gid, count: n }));
  }
  /* Rows of the mapping table. Under the published attribute these are M.rows plus any value seen on members that has no row yet.
     While an attribute change is staged, the rows are the distinct values of the new attribute, unmapped unless the draft says otherwise. */
  S.mappingRowsView = function () {
    const dr = S.mappingDraft, attr = S.activeAttribute();
    const people = D.members.filter((m) => m.sourceSystem !== "Archive360 local account" && m.memberStatus === "Active");
    if (!S.attributeChangeStaged()) {
      const seen = new Set(D.mapping.rows.map((r) => r.rawValue));
      const extra = [];
      people.forEach((m) => { const v = S.attrValue(m, attr); if (v && !seen.has(v)) { seen.add(v); extra.push({ rawValue: v, groupId: null, excluded: false, memberCount: 0, interactionCount90d: 0, mappedSince: null, firstSeen: U.today(), history: [] }); } });
      return D.mapping.rows.concat(extra).map((r) => {
        const ms = people.filter((m) => S.attrValue(m, attr) === r.rawValue);
        const draft = dr.rows[r.rawValue];
        const target = draft !== undefined ? draft : (r.excluded ? "__excluded__" : (r.groupId || ""));
        return { rawValue: r.rawValue, row: r, currentGroupId: r.groupId || null, excluded: !!r.excluded, target, status: target === "__excluded__" ? "Excluded" : target ? "Mapped" : "Unmapped",
          members: ms.length, interactions90d: ints90(ms), mappedSince: r.mappedSince, firstSeen: r.firstSeen, changed: draft !== undefined, memberIds: ms.map((m) => m.memberId), currentGroups: groupBreakdown(ms), switching: false };
      });
    }
    const byValue = {};
    people.forEach((m) => { const v = S.attrValue(m, attr); if (!v) return; (byValue[v] = byValue[v] || []).push(m); });
    return Object.keys(byValue).sort().map((v) => {
      const ms = byValue[v], draft = dr.rows[v], target = draft !== undefined ? draft : "";
      return { rawValue: v, row: null, currentGroupId: null, excluded: false, target, status: target === "__excluded__" ? "Excluded" : target ? "Mapped" : "Unmapped",
        members: ms.length, interactions90d: ints90(ms), mappedSince: null, firstSeen: null, changed: draft !== undefined, memberIds: ms.map((m) => m.memberId), currentGroups: groupBreakdown(ms), switching: true };
    });
  };
  S.draftTargetLabel = function (target) {
    if (!target) return "Unmapped";
    if (target === "__excluded__") return "Excluded from governance";
    return S.groupName(target);
  };
  S.draftHasChanges = function () {
    const dr = S.mappingDraft;
    return Object.keys(dr.rows).length > 0 || dr.overridesAdd.length > 0 || dr.overridesRemove.length > 0 || S.attributeChangeStaged() ||
      (dr.managerFallback !== null && dr.managerFallback !== D.mapping.managerFallback);
  };
  S.draftImpact = function () {
    const dr = S.mappingDraft, switching = S.attributeChangeStaged();
    const view = S.mappingRowsView();
    const rows = view.filter((r) => r.changed);
    const memberIds = new Set();
    if (switching) D.members.forEach((m) => { if (m.memberStatus === "Active" && m.sourceSystem !== "Archive360 local account" && (m.primaryGroupId || S.attrValue(m, dr.sourceAttribute))) memberIds.add(m.memberId); });
    else rows.forEach((r) => r.memberIds.forEach((id) => memberIds.add(id)));
    dr.overridesAdd.forEach((o) => memberIds.add(o.memberId));
    dr.overridesRemove.forEach((id) => memberIds.add(id));
    let ints = 0;
    memberIds.forEach((id) => { ints += (S.interactionsByMember[id] || []).length; });
    const unmappedMembers = switching ? U.sum(view.filter((r) => r.status === "Unmapped"), (r) => r.members) : 0;
    return { rows: rows.length, rowList: rows, newGroups: [], overrides: dr.overridesAdd.length + dr.overridesRemove.length, members: memberIds.size, interactions: ints,
      attributeChanged: switching, unmappedMembersAfterSwitch: unmappedMembers, fallbackChanged: dr.managerFallback !== null && dr.managerFallback !== D.mapping.managerFallback };
  };
  S.createGroup = function (spec) {
    const p = state.persona;
    let id = "grp_" + spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    while (S.byId.group[id]) id += "_2";
    const code = spec.code || spec.name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 3) || "NEW";
    const owner = S.member(spec.ownerMemberId);
    const g = { id, name: spec.name, code, description: spec.description !== undefined ? spec.description : spec.purpose, ownerMemberId: spec.ownerMemberId, registerEntryId: "re_" + id.slice(4),
      rawDepartmentValues: spec.rawValues || [], permittedDataClassIds: spec.permitted || [], approvedPurpose: spec.purpose, platformGroups: [], workspaceIds: ["wks_corporate"],
      firstSynchronized: U.today(), governance: { legalHolds: [], recordClass: "AI Interaction Record", retentionYears: 7, dispositionEligibleItems: 0, retainedInteractions: 0, platformGroups: [] }, createdInSession: true,
      state: "Active", createdDate: U.today(), createdByMemberId: p.memberId, deactivation: null,
      history: [{ date: U.today(), actorMemberId: p.memberId, action: "Created", detail: `Business group created; accountable owner ${owner ? owner.displayName : "unassigned"}.` }] };
    D.groups.push(g);
    const e = { id: g.registerEntryId, level: "Business group", refId: id, name: spec.name, groupId: id, platformId: null, ownerMemberId: spec.ownerMemberId, approvedPurpose: spec.purpose,
      permittedDataClasses: spec.permitted || [], status: "Pending", registeredDate: U.today(), registeredByMemberId: p.memberId, approvedDate: null, approvedByMemberId: null, lastReconfirmedDate: null,
      reconfirmationDueDate: null, reconfirmationIntervalMonths: D.settings.reconfirmation.intervalMonths, externalIdentifier: null, collectionMethod: "Connector",
      decisionHistory: [{ date: U.today(), actorMemberId: p.memberId, action: "Registered", detail: spec.source || "Business group created; registration submitted for approval.", refType: "mapping", refId: null }], blockers: [], notes: null };
    D.registerEntries.push(e);
    D.settings.digest.perGroup[id] = D.settings.digest.defaultFrequency;
    S.byId.group[id] = g; S.byId.entry[e.id] = e;
    S.logAudit({ category: "Configuration", eventType: "Business group created", groupId: id, refType: "group", refId: id, summary: `${spec.name} created (owner ${owner ? owner.displayName : "unassigned"}); registration submitted as Pending.` });
    return g;
  };
  S.reattributeMember = function (m, groupId, source, reason) {
    if (m.groupHistory && m.groupHistory.length) { const last = m.groupHistory[m.groupHistory.length - 1]; if (!last.toDate && last.groupId !== groupId) last.toDate = U.today(); }
    const changed = m.primaryGroupId !== groupId;
    m.primaryGroupId = groupId;
    m.assignmentSource = source;
    m.overrideReason = reason || null;
    if (groupId && changed) (m.groupHistory = m.groupHistory || []).push({ groupId, fromDate: U.today(), toDate: null });
    (S.interactionsByMember[m.memberId] || []).forEach((i) => { i.groupId = groupId; if (groupId) i.unregisteredItemId = null; });
    (S.findingsByMember[m.memberId] || []).forEach((f) => { f.groupId = groupId; });
  };
  S.refreshMappingCounts = function () {
    const attr = D.mapping.sourceAttribute;
    D.mapping.rows.forEach((r) => {
      const ms = D.members.filter((m) => S.attrValue(m, attr) === r.rawValue);
      r.memberCount = ms.length;
      r.interactionCount90d = ints90(ms);
    });
    D.mapping.unmappedValues = D.mapping.rows.filter((r) => !r.groupId && !r.excluded).map((r) => r.rawValue);
  };
  S.refreshBlockers = function () {
    D.registerEntries.filter((e) => e.groupId).forEach((e) => {
      const cov = S.coverage(e.groupId).length;
      e.blockers = e.blockers.filter((b) => b !== "No reviewer coverage");
      if (!cov && e.status === "Pending") e.blockers.push("No reviewer coverage");
    });
  };
  /* Publishing writes one version. Row edits append to each row's history; an attribute change archives the old rows, builds the new
     attribute's rows and re-attributes every non-override member. Publishing with unmapped values is allowed: those members become
     Unassigned and surface in Unregistered AI, the designed safety net, and the publish dialog says so first. */
  S.publishMapping = function (summary) {
    const dr = S.mappingDraft, p = state.persona, M = D.mapping;
    const affected = new Set();
    const version = M.currentVersion + 1;
    const stamp = (from, to) => ({ version, date: U.today(), byMemberId: p.memberId, fromTarget: from, toTarget: to });
    const targetOf = (row) => (row.excluded ? "__excluded__" : (row.groupId || null));
    const people = D.members.filter((m) => m.sourceSystem !== "Archive360 local account");
    const switching = S.attributeChangeStaged();
    const previousAttribute = M.sourceAttribute;
    if (switching) {
      const attr = dr.sourceAttribute;
      (M.archivedRows = M.archivedRows || []).push({ attribute: previousAttribute, version: M.currentVersion, archivedAtVersion: version, date: U.today(), rows: M.rows });
      M.rows = S.mappingRowsView().map((r) => {
        const gid = r.target && r.target !== "__excluded__" ? r.target : null, excluded = r.target === "__excluded__";
        const reason = excluded ? (dr.excludeReasons[r.rawValue] || "") : null;
        return { rawValue: r.rawValue, groupId: gid, excluded, excludedReason: reason, memberCount: r.members, interactionCount90d: r.interactions90d, mappedSince: gid ? U.today() : null, firstSeen: U.today(), history: r.target ? [Object.assign(stamp(null, r.target), { reason })] : [] };
      });
      M.sourceAttribute = attr;
      people.filter((m) => m.assignmentSource !== "override").forEach((m) => {
        const v = S.attrValue(m, attr);
        const row = v ? M.rows.find((r) => r.rawValue === v) : null;
        let gid = row ? row.groupId : null, source = row && row.excluded ? "excluded" : (gid ? "mapping" : "unmapped");
        if (!v) { const mgr = S.member(m.managerMemberId); if (M.managerFallback && mgr && mgr.primaryGroupId) { gid = mgr.primaryGroupId; source = "manager-fallback"; } else source = "none"; }
        if (m.primaryGroupId !== gid || m.assignmentSource !== source) affected.add(m.memberId);
        S.reattributeMember(m, gid, source);
      });
      D.unregisteredItems.filter((u) => u.type === "Unmapped attribute value" && u.status === "New").forEach((u) => {
        const ms = (u.memberIds || []).map((id) => S.member(id)).filter(Boolean);
        if (ms.length && ms.every((m) => m.primaryGroupId)) { u.status = "Mapped"; u.resolution = { date: U.today(), byMemberId: p.memberId, groupId: null, note: `Attribute changed to ${S.attributeOption(attr).label}; these members are now attributed by it.` }; }
      });
    } else {
      Object.entries(dr.rows).forEach(([raw, target]) => {
        let row = M.rows.find((r) => r.rawValue === raw);
        if (!row) { row = { rawValue: raw, groupId: null, excluded: false, memberCount: 0, interactionCount90d: 0, mappedSince: null, firstSeen: U.today(), history: [] }; M.rows.push(row); }
        const from = targetOf(row);
        const gid = target && target !== "__excluded__" ? target : null, excluded = target === "__excluded__";
        const reason = excluded ? (dr.excludeReasons[raw] || row.excludedReason || "") : null;
        row.groupId = gid; row.excluded = excluded; row.excludedReason = reason; row.mappedSince = gid ? (from === gid ? row.mappedSince : U.today()) : null;
        (row.history = row.history || []).push(Object.assign(stamp(from, target || null), { reason }));
        people.filter((m) => S.attrValue(m, M.sourceAttribute) === raw && m.assignmentSource !== "override").forEach((m) => { affected.add(m.memberId); S.reattributeMember(m, gid, excluded ? "excluded" : (gid ? "mapping" : "unmapped")); });
        D.unregisteredItems.filter((u) => u.type === "Unmapped attribute value" && u.rawValues.includes(raw)).forEach((u) => {
          const done = u.rawValues.every((v) => { const rr = M.rows.find((x) => x.rawValue === v); return rr && (rr.groupId || rr.excluded); });
          if (done) { u.status = excluded ? "Excluded" : "Mapped"; u.resolution = { date: U.today(), byMemberId: p.memberId, groupId: gid, note: excluded ? "Excluded from governance" : `Mapped to ${S.groupName(gid)}` }; }
        });
      });
    }
    dr.overridesAdd.forEach((o) => { const m = S.member(o.memberId); affected.add(m.memberId); S.reattributeMember(m, o.groupId, "override", o.reason); M.overrides.push({ memberId: o.memberId, groupId: o.groupId, impliedGroupId: o.impliedGroupId, reason: o.reason, setByMemberId: p.memberId, setDate: U.today() }); });
    dr.overridesRemove.forEach((mid) => { const m = S.member(mid); const row = M.rows.find((r) => r.rawValue === S.attrValue(m, M.sourceAttribute)); affected.add(mid); S.reattributeMember(m, row && row.groupId ? row.groupId : null, row && row.groupId ? "mapping" : "unmapped"); M.overrides = M.overrides.filter((o) => o.memberId !== mid); });
    if (dr.managerFallback !== null) M.managerFallback = dr.managerFallback;
    M.currentVersion = version;
    M.versions.push({ version, date: U.today(), byMemberId: p.memberId, summary, affectedMembers: affected.size, attribute: M.sourceAttribute, attributeChangedFrom: switching ? previousAttribute : null });
    S.refreshMappingCounts();
    S.reindex();
    S.refreshBlockers();
    S.logAudit({ category: "Configuration", eventType: switching ? "Business group attribute changed" : "Business group mapping changed", refType: "mapping", refId: String(version), summary: `Mapping v${version}: ${summary}`, details: { affectedMembers: affected.size } });
    const result = { version, affected: affected.size, newGroupIds: [], switched: switching };
    S.resetMappingDraft();
    return result;
  };
  S.rowHistory = function (row) { return (row && row.history ? row.history.slice() : []).sort((a, b) => b.version - a.version); };

  /* ---------- Access, collection and digest helpers ---------- */
  S.assignPolicy = function (memberId, epId) {
    const m = S.member(memberId);
    if (!m.entitlementPolicyIds.includes(epId)) m.entitlementPolicyIds.push(epId);
    S.refreshBlockers();
    S.logAudit({ category: "Configuration", eventType: "Entitlement Policy assigned", refType: "member", refId: memberId, summary: `${S.byId.ep[epId].name} assigned to ${m.displayName} (Administration)` });
  };
  S.addGroupToPolicy = function (epId, groupId) {
    const ep = S.byId.ep[epId];
    if (!ep.groupIds.includes(groupId)) ep.groupIds.push(groupId);
    S.refreshBlockers();
    S.logAudit({ category: "Configuration", eventType: "Entitlement Policy changed", groupId, refType: "policy", refId: epId, summary: `${S.groupName(groupId)} added to ${ep.name} (Administration)` });
  };
  S.activateConnector = function (platformId) {
    const pl = S.platform(platformId);
    pl.connectorStatus = "Active";
    pl.firstCollected = pl.firstCollected || U.today();
    pl.lastSync = D.meta.now;
    const e = D.registerEntries.find((x) => x.level === "Platform" && x.refId === platformId);
    if (e) e.blockers = e.blockers.filter((b) => b !== "Connector pending activation");
    S.logAudit({ category: "Collection", eventType: "Connector activated", refType: "platform", refId: platformId, summary: `${pl.connectorName} activated`, collectionMethod: pl.collectionMethod });
  };
  S.digestPreview = function (groupId) {
    const g = S.group(groupId);
    const freq = D.settings.digest.perGroup[groupId] || D.settings.digest.defaultFrequency;
    const days = { Daily: 1, Weekly: 7, Monthly: 30 }[freq] || 7;
    const end = U.today(), start = U.addDays(U.today(), -days);
    const all = S.findingsByGroup[groupId] || [];
    const confirmed = all.filter((f) => f.status === "Confirmed" && f.review && f.review.decidedAt.slice(0, 10) > start && f.review.decidedAt.slice(0, 10) <= end);
    return { group: g, owner: S.member(g.ownerMemberId), freq, start, end, confirmed, byRule: U.groupBy(confirmed, "ruleId"),
      remediations: (S.escalationsByGroup[groupId] || []).filter((e) => ["Open", "Approved", "Returned"].includes(e.status)), entry: S.entry(g.registerEntryId),
      coverage: S.coverage(groupId).length, awaiting: all.filter((f) => f.status === "Detected").length,
      systemsDue: D.registerEntries.filter((e) => e.groupId === groupId && e.level !== "Business group" && e.reconfirmationDueDate && (U.daysUntil(e.reconfirmationDueDate) <= 30 || e.status === "Expired")) };
  };

  /* ---------- AI Systems (Version 1 Settings; "AI Platform Instances" until 2026-09-21, and "instance" in the code) ---------- */
  S.byId.instance = index(D.instances || [], "id");
  S.byId.recordClass = index(D.recordClasses || [], "id");
  S.instance = (id) => S.byId.instance[id];
  S.recordClass = (id) => S.byId.recordClass[id];
  S.recordClassClaim = (rcId) => (D.instances || []).find((x) => x.recordClassId === rcId) || null;
  S.instanceArchive = function (inst) {
    const rc = inst ? S.recordClass(inst.recordClassId) : null;
    return rc && rc.archive ? rc.archive : { items: 0, firstItem: null, lastItem: null, users: 0, gpts: 0, projects: 0, workspaces: [] };
  };
  S.instanceEntry = (inst) => (inst && inst.registerEntryId ? S.entry(inst.registerEntryId) : null);
  S.instanceHistory = function (inst) {
    const ints = D.interactions.filter((i) => i.instanceId === inst.id);
    let findings = 0, decisions = 0, escalations = 0;
    ints.forEach((i) => i.findingIds.forEach((fid) => { const f = S.finding(fid); if (!f) return; findings++; if (f.review) decisions++; if (f.escalationId) escalations++; }));
    const e = S.instanceEntry(inst);
    const registerDecisions = e ? e.decisionHistory.filter((h) => h.action !== "Registered").length : 0;
    return { interactions: ints.length, findings, decisions, escalations, registerDecisions, hasHistory: findings > 0 || registerDecisions > 0 };
  };
  S.addInstance = function (spec) {
    const p = state.persona;
    const rc = S.recordClass(spec.recordClassId);
    let id = "inst_" + spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    while (S.byId.instance[id]) id += "_2";
    /* No record class means the customer decided not to archive this AI system's interactions (Gabriel, 2026-10-01): the decision carries its reason,
       who made it and when, and Edit can associate a record class later. The identifier used to be set twice here, the second time to null, so
       an AI system added from an unclaimed API key lost it; fixed the same day. */
    const notArchived = spec.recordClassId ? null : { reason: spec.notArchivedReason || "", byMemberId: p.memberId, date: U.today() };
    const inst = { id, name: spec.name, platformType: spec.platformType, platformId: D.platformIdOfType[spec.platformType], recordClassId: spec.recordClassId || null, collection: spec.recordClassId ? (spec.platformType === "Custom AI application" ? "Ingestion API" : "Connector") : "Not archived", notArchived, externalIdentifier: spec.externalIdentifier || null, apiAccess: spec.apiAccess ? [Object.assign({ claimedDate: U.today() }, spec.apiAccess)] : [],
      status: spec.activate ? "Active" : "Inactive", ownerMemberId: spec.ownerMemberId, approvedPurpose: spec.approvedPurpose || "", registerEntryId: "re_" + id.slice(5), reconfirmationIntervalMonths: spec.reconfirmationIntervalMonths || D.settings.reconfirmation.intervalMonths, addedDate: U.today(), addedByMemberId: p.memberId,
      activatedDate: spec.activate ? U.today() : null, deactivation: null,
      workspaces: (rc && rc.archive ? rc.archive.workspaces : []).map((w, i) => ({ id: id + "_ws" + i, name: w })),
      history: [{ date: U.today(), actorMemberId: p.memberId, action: "Added", detail: rc ? `AI system added and mapped to ${rc.name}.` : `AI system added without a record class: its interactions are not archived. Reason: ${notArchived.reason}` }], createdInSession: true };
    if (spec.activate) inst.history.push({ date: U.today(), actorMemberId: p.memberId, action: "Activated", detail: rc ? "Governance active." : "In use; nothing is collected." });
    if (spec.externalIdentifier) inst.externalIdentifier = spec.externalIdentifier;
    D.instances.push(inst);
    S.byId.instance[id] = inst;
    if (rc) rc.claimedByInstanceId = id;
    inst.workspaces.forEach((w) => D.workspaces.push({ id: w.id, platformId: inst.platformId, instanceId: id, name: w.name, groupIds: [] })); S.byId.workspace = index(D.workspaces, "id");
    /* Adding the instance registers it: a Pending register entry with the owner of the vendor relationship and the approved purpose. */
    const e = { id: inst.registerEntryId, level: spec.platformType === "Custom AI application" ? "Custom AI system" : "Platform", refId: id, name: spec.name, groupId: null, platformId: inst.platformId,
      ownerMemberId: spec.ownerMemberId, approvedPurpose: spec.approvedPurpose || "", permittedDataClasses: [], status: "Pending", registeredDate: U.today(), registeredByMemberId: p.memberId,
      approvedDate: null, approvedByMemberId: null, lastReconfirmedDate: null, reconfirmationDueDate: null, reconfirmationIntervalMonths: spec.reconfirmationIntervalMonths || D.settings.reconfirmation.intervalMonths, externalIdentifier: null,
      collectionMethod: spec.recordClassId ? (spec.platformType === "Custom AI application" ? "Ingestion API" : "Connector") : "None",
      decisionHistory: [{ date: U.today(), actorMemberId: p.memberId, action: "Registered", detail: "Registered when the AI system was added; awaiting approval.", refType: "instance", refId: id }], blockers: [], notes: null };
    if (spec.externalIdentifier) e.externalIdentifier = spec.externalIdentifier;
    D.registerEntries.push(e); S.byId.entry[e.id] = e;
    S.logAudit({ category: "Configuration", eventType: "AI system added", refType: "instance", refId: id, summary: `Added AI system ${inst.name} (${inst.platformType}) ${rc ? "mapped to " + rc.name : `without a record class, its interactions not archived (${notArchived.reason})`}; registered as Pending with owner ${S.member(spec.ownerMemberId) ? S.member(spec.ownerMemberId).displayName : "unassigned"}` });
    return inst;
  };
  S.updateInstance = function (id, patch) {
    const inst = S.instance(id), p = state.persona, changes = [];
    if (patch.name !== undefined && patch.name !== inst.name) { changes.push(`name ${inst.name} to ${patch.name}`); inst.name = patch.name; }
    const e = S.instanceEntry(inst);
    if (patch.approvedPurpose !== undefined && patch.approvedPurpose !== inst.approvedPurpose) { changes.push("approved purpose"); inst.approvedPurpose = patch.approvedPurpose; if (e) e.approvedPurpose = patch.approvedPurpose; }
    if (patch.ownerMemberId && patch.ownerMemberId !== inst.ownerMemberId) {
      const from = S.member(inst.ownerMemberId), to = S.member(patch.ownerMemberId);
      changes.push(`owner ${from ? from.displayName : "unassigned"} to ${to ? to.displayName : patch.ownerMemberId}`);
      inst.ownerMemberId = patch.ownerMemberId;
      if (e) { e.ownerMemberId = patch.ownerMemberId; e.decisionHistory.push({ date: U.today(), actorMemberId: p.memberId, action: "Owner changed", detail: `Accountable owner changed from ${from ? from.displayName : "unassigned"} to ${to ? to.displayName : ""}.`, refType: "instance", refId: id }); }
    }
    if (patch.name !== undefined && e && e.name !== inst.name) e.name = inst.name;
    if (patch.platformType && patch.platformType !== inst.platformType) { changes.push(`platform type to ${patch.platformType}`); inst.platformType = patch.platformType; inst.platformId = D.platformIdOfType[patch.platformType]; }
    if (patch.notArchivedReason !== undefined && inst.notArchived && !patch.recordClassId && patch.notArchivedReason !== inst.notArchived.reason) { changes.push("reason its interactions are not archived"); inst.notArchived.reason = patch.notArchivedReason; }
    if (patch.recordClassId && patch.recordClassId !== inst.recordClassId) {
      const old = S.recordClass(inst.recordClassId), nw = S.recordClass(patch.recordClassId);
      if (old && old.claimedByInstanceId === id) old.claimedByInstanceId = null;
      if (nw) nw.claimedByInstanceId = id;
      inst.recordClassId = patch.recordClassId;
      D.workspaces = D.workspaces.filter((w) => w.instanceId !== id); S.byId.workspace = index(D.workspaces, "id");
      inst.workspaces = (nw && nw.archive ? nw.archive.workspaces : []).map((w, i) => ({ id: id + "_ws" + i, name: w }));
      inst.workspaces.forEach((w) => D.workspaces.push({ id: w.id, platformId: inst.platformId, instanceId: id, name: w.name, groupIds: [] })); S.byId.workspace = index(D.workspaces, "id");
      if (!old && nw) {
        /* Associating a record class with an AI system registered without archiving (Gabriel, 2026-10-01): the approval stands, because it covers
           the owner and the purpose, not the collection path; the change is a history line on the AI system and on its registration, and an audit event. */
        const na = inst.notArchived;
        inst.notArchived = null;
        inst.collection = inst.platformType === "Custom AI application" ? "Ingestion API" : "Connector";
        inst.history.push({ date: U.today(), actorMemberId: p.memberId, action: "Record class associated", detail: `${nw.name} associated: its interactions are archived, classified and reviewed from now on.${na && na.reason ? ` It had been registered without archiving: ${na.reason}` : ""}` });
        if (e) { e.collectionMethod = inst.collection; e.decisionHistory.push({ date: U.today(), actorMemberId: p.memberId, action: "Record class associated", detail: `Archive360 now archives its interactions in ${nw.name}; the approval stands.`, refType: "instance", refId: id }); }
        S.logAudit({ category: "Configuration", eventType: "Record class associated", refType: "instance", refId: id, summary: `Associated record class ${nw.name} with ${inst.name}, registered without archiving until now; its interactions are archived and reviewed from now on` });
      } else changes.push(`record class to ${nw ? nw.name : patch.recordClassId}`);
    }
    if (changes.length) {
      inst.history.push({ date: U.today(), actorMemberId: p.memberId, action: "Updated", detail: changes.join("; ") });
      S.logAudit({ category: "Configuration", eventType: "AI system updated", refType: "instance", refId: id, summary: `Updated ${inst.name}: ${changes.join("; ")}` });
    }
    return inst;
  };
  S.setInstanceStatus = function (id, status, reason) {
    const inst = S.instance(id), p = state.persona;
    inst.status = status;
    if (status === "Inactive") {
      inst.deactivation = { date: U.today(), byMemberId: p.memberId, reason: reason || "" };
      inst.history.push({ date: U.today(), actorMemberId: p.memberId, action: "Deactivated", detail: reason || "" });
    } else {
      inst.deactivation = null;
      inst.activatedDate = inst.activatedDate || U.today();
      inst.history.push({ date: U.today(), actorMemberId: p.memberId, action: "Activated", detail: inst.recordClassId ? "Governance active." : "In use; nothing is collected." });
    }
    S.logAudit({ category: "Configuration", eventType: status === "Inactive" ? "AI system deactivated" : "AI system activated", refType: "instance", refId: id, summary: `${status === "Inactive" ? "Deactivated" : "Activated"} ${inst.name}${reason ? ": " + reason : ""}` });
  };
  S.deleteInstance = function (id) {
    const inst = S.instance(id);
    if (S.instanceHistory(inst).hasHistory) throw new Error("AI system has governance history");
    const rc = S.recordClass(inst.recordClassId);
    if (rc && rc.claimedByInstanceId === id) rc.claimedByInstanceId = null;
    D.instances = D.instances.filter((x) => x.id !== id);
    delete S.byId.instance[id];
    if (inst.registerEntryId) { D.registerEntries = D.registerEntries.filter((x) => x.id !== inst.registerEntryId); S.byId.entry = index(D.registerEntries, "id"); }
    D.workspaces = D.workspaces.filter((w) => w.instanceId !== id); S.byId.workspace = index(D.workspaces, "id");
    S.logAudit({ category: "Configuration", eventType: "AI system deleted", refType: "instance", refId: id, summary: `Deleted ${inst.name}; archived interactions remain in Archive360 under ${rc ? rc.name : "its record class"}` });
  };

  /* ---------- Misc lookups ---------- */
  /* A group is ready when it has an active accountable owner and at least one entitled reviewer. It is never registered itself. */
  S.groupReadiness = function (g) {
    const owner = S.member(g.ownerMemberId), coverage = S.coverage(g.id), gaps = [];
    if (!owner) gaps.push({ kind: "owner", text: "No accountable owner" });
    else if (!U.isActive(owner)) gaps.push({ kind: "owner", text: `Owner ${U.statusWord(owner)}` });
    if (!coverage.length) gaps.push({ kind: "reviewer", text: "No reviewer has access" });
    return { ready: !gaps.length, gaps, owner, coverage };
  };
  /* ---------- Business Groups (Version 1 Settings) ---------- */
  S.activeGroups = () => D.groups.filter((g) => g.state !== "Inactive");
  S.groupsOrdered = (includeInactive) => (includeInactive ? D.groups : S.activeGroups()).slice().sort((a, b) => a.name.localeCompare(b.name));
  S.groupMappedValues = (groupId) => (D.mapping.rows || []).filter((r) => r.groupId === groupId && !r.excluded);
  S.groupOverrides = (groupId) => (D.mapping.overrides || []).filter((o) => o.groupId === groupId);
  /* Deactivation is blocked while anything in the mapping still points at the group, so nobody silently becomes Unassigned. */
  S.groupDeactivateBlock = function (g) {
    const v = S.groupMappedValues(g.id).length, o = S.groupOverrides(g.id).length;
    if (!v && !o) return null;
    const parts = [];
    if (v) parts.push(`${v} attribute ${U.plural(v, "value")}`);
    if (o) parts.push(`${o} member ${U.plural(o, "override")}`);
    return `${parts.join(" and ")} still ${v + o === 1 ? "maps" : "map"} to this group. Remap ${v + o === 1 ? "it" : "them"} on the Business Group Mapping page first.`;
  };
  S.groupHistory = function (g) {
    const members = (S.membersByGroup[g.id] || []).length, interactions = (S.interactionsByGroup[g.id] || []).length;
    const findings = (S.findingsByGroup[g.id] || []).length, systems = (S.systemsByGroup[g.id] || []).length;
    const entry = S.entry(g.registerEntryId);
    const decisions = entry ? entry.decisionHistory.filter((h) => h.action !== "Registered").length : 0;
    const deactivated = (g.history || []).some((h) => h.action === "Deactivated");
    return { members, interactions, findings, systems, decisions, hasHistory: members > 0 || interactions > 0 || findings > 0 || systems > 0 || decisions > 0 || deactivated };
  };
  S.groupHistoryEvent = function (g, action, detail) { (g.history = g.history || []).push({ date: U.today(), actorMemberId: state.persona ? state.persona.memberId : "system", action, detail }); };
  S.addGroup = function (spec) {
    return S.createGroup({ name: spec.name, description: spec.description || "", ownerMemberId: spec.ownerMemberId, purpose: "", permitted: [], rawValues: [], source: spec.source });
  };
  S.updateGroup = function (id, patch) {
    const g = S.group(id), e = S.entry(g.registerEntryId), changes = [];
    if (patch.name && patch.name !== g.name) { S.groupHistoryEvent(g, "Renamed", `Renamed from ${g.name} to ${patch.name}.`); changes.push(`renamed to ${patch.name}`); g.name = patch.name; if (e) e.name = patch.name; }
    if (patch.description !== undefined && (patch.description || "") !== (g.description || "")) { g.description = patch.description; changes.push("description updated"); }
    if (patch.ownerMemberId && patch.ownerMemberId !== g.ownerMemberId) {
      const from = S.member(g.ownerMemberId), to = S.member(patch.ownerMemberId);
      S.groupHistoryEvent(g, "Owner changed", `Accountable owner changed from ${from ? from.displayName : "unassigned"} to ${to.displayName}.`);
      changes.push(`owner changed to ${to.displayName}`);
      g.ownerMemberId = patch.ownerMemberId;
      if (e) { e.ownerMemberId = patch.ownerMemberId; e.blockers = (e.blockers || []).filter((b) => b !== "Owner terminated"); }
    }
    if (changes.length) S.logAudit({ category: "Configuration", eventType: "Business group updated", groupId: id, refType: "group", refId: id, summary: `${g.name}: ${changes.join("; ")}` });
    return { group: g, changes };
  };
  S.setGroupState = function (id, value, reason) {
    const g = S.group(id);
    if (value === "Inactive") {
      const block = S.groupDeactivateBlock(g);
      if (block) throw new Error(block);
      g.state = "Inactive"; g.deactivation = { date: U.today(), actorMemberId: state.persona ? state.persona.memberId : "system", reason: reason || "" };
      S.groupHistoryEvent(g, "Deactivated", reason || "");
      S.logAudit({ category: "Configuration", eventType: "Business group deactivated", groupId: id, refType: "group", refId: id, summary: `${g.name} deactivated: ${reason || ""}` });
    } else {
      g.state = "Active"; g.deactivation = null;
      S.groupHistoryEvent(g, "Activated", "Group reactivated.");
      S.logAudit({ category: "Configuration", eventType: "Business group activated", groupId: id, refType: "group", refId: id, summary: `${g.name} activated` });
    }
    return g;
  };
  S.deleteGroup = function (id) {
    const g = S.group(id);
    if (S.groupHistory(g).hasHistory) throw new Error("This group has governance history and cannot be deleted.");
    D.groups = D.groups.filter((x) => x.id !== id);
    D.registerEntries = D.registerEntries.filter((x) => x.id !== g.registerEntryId);
    delete D.settings.digest.perGroup[id];
    S.reindex();
    S.logAudit({ category: "Configuration", eventType: "Business group deleted", refType: "group", refId: id, summary: `${g.name} deleted (no governance history)` });
    return g;
  };

  S.groupName = (id) => (S.group(id) ? S.group(id).name : (id ? id : "Unassigned"));
  S.systemName = (id) => (S.system(id) ? S.system(id).name : "Direct chat");
  S.ruleName = (id) => (S.rule(id) ? S.rule(id).name : id);
  S.dcName = (id) => (S.dataClass(id) ? S.dataClass(id).name : id);
  S.entryForSystem = (systemId) => S.entryBySystem[systemId] || null;
  S.pendingApprovalsCountForPersona = () => S.queueCounts().approvals || 0;
})();
