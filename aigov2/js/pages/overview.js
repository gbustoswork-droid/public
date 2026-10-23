/* Overview: everyone's landing page. Reworked with Gabriel on 2026-09-22 to Version 1 facts: what needs a decision or a fix across the
   business, five facts with the one number that matters under each, AI use by business group over the last 30 days (most active first: until
   risk scoring exists, activity is the honest ranking; how much, and how badly, per group), and what AI is used for. The Recent activity
   card went on 2026-09-29: nothing in it needed a decision, and Audit History is one click away. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.overview = {});
  const DAYS = 30;
  const since = () => { const d = new Date(U.today() + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - DAYS); return d.toISOString().slice(0, 10); };
  const names = (list) => list.map((e) => `<a href="#/registry/${e.id}">${U.esc(e.name)}</a>`).join(", ");

  /* What needs a decision or a fix, across every business group: each line names the items and links to where the work is done. The fix
     links follow the persona, as on the group page: the Administrator is sent to Settings, anyone else is told to ask an Administrator. */
  /* Everyone lands here (Gabriel, 2026-09-28), so the lines that name the signed-in person's own work come first, and an owner whose group
     needs nothing from them still gets a one-click path to it. */
  function attention() {
    const items = [], mineLines = [], mineGroups = new Set(), canSettings = S.can("settings"), groups = S.activeGroups(), me = S.persona() || {};
    const own = (e) => e.ownerMemberId === me.memberId;
    /* The reviewer's own queue (Gabriel, 2026-09-29): the same count as the Findings tab's badge, so the click lands on that number; a persona
       who cannot review gets no line, because the table below and the group page give them the counts. */
    const review = S.queueCounts().findings || 0;
    if (review) mineLines.push(`${I.clock} ${U.fmtNum(review)} ${U.plural(review, "finding is", "findings are")} awaiting review. <a href="#/findings">Review ${review === 1 ? "it" : "them"}.</a>`);
    groups.forEach((g) => {
      const r = S.groupReadiness(g);
      r.gaps.forEach((x) => items.push(x.kind === "owner"
        ? `${I.alert} <a href="#/groups/${g.id}">${U.esc(g.name)}</a> has no active accountable owner. ${canSettings ? '<a href="#/settings/groups">Name a new owner on the Business Groups page.</a>' : "Ask an Archive360 Administrator to name a new owner."}`
        : `${I.alert} <a href="#/groups/${g.id}">${U.esc(g.name)}</a> has no reviewer with access. ${canSettings ? '<a href="#/settings/access">See the Readiness check.</a>' : "Ask an Archive360 Administrator to grant a reviewer access."}`));
    });
    const entries = S.registryEntries();
    const pending = entries.filter((e) => e.status === "Pending");
    if (pending.length) items.push(`${I.clock} ${pending.length} ${U.plural(pending.length, "registration is", "registrations are")} awaiting approval: ${names(pending)}.`);
    const trouble = entries.filter((e) => ["Expired", "Suspended"].includes(e.status));
    const troubleMine = trouble.filter(own);
    if (trouble.length) (troubleMine.length ? mineLines : items).push(`${I.alert} ${trouble.length} ${U.plural(trouble.length, "registration is", "registrations are")} expired or suspended: ${names(trouble)}${troubleMine.length ? `, ${troubleMine.length} of them yours` : ""}.`);
    troubleMine.forEach((e) => mineGroups.add(e.groupId));
    const due = entries.filter((e) => e.status === "Approved" && S.entryDue(e).dueSoon);
    const dueMine = due.filter(own);
    if (due.length) (dueMine.length ? mineLines : items).push(`${I.clock} ${due.length} ${U.plural(due.length, "reconfirmation is", "reconfirmations are")} due within 60 days: ${names(due)}${dueMine.length ? `, ${dueMine.length} of them yours` : ""}.`);
    dueMine.forEach((e) => mineGroups.add(e.groupId));
    if (S.can("unregistered")) {
      const open = S.unregOpenItems(), by = U.countBy(open, "type"), parts = [];
      if (by["Unmapped attribute value"]) parts.push(`${by["Unmapped attribute value"]} ${U.esc(S.attributeOption(D.mapping.sourceAttribute).label)} ${U.plural(by["Unmapped attribute value"], "value", "values")} not mapped to a group`);
      if (by["External AI object"]) parts.push(`${by["External AI object"]} outside ${U.plural(by["External AI object"], "GPT", "GPTs")} undecided`);
      if (by["Unclaimed API key"]) parts.push(`${by["Unclaimed API key"]} API access unclaimed`);
      if (open.length) items.push(`${I.flag} ${open.length} ${U.plural(open.length, "item", "items")} in <a href="#/unregistered">Unregistered AI</a> ${U.plural(open.length, "needs", "need")} a decision: ${parts.join(", ")}.`);
    }
    /* Escalations are decisions waiting too (Approvals, 2026-09-25): an approver is sent to the queue; a reviewer sees them wait on Findings. */
    const approver = S.can("approve"), vis = new Set(S.visibleFindings().map((f) => f.findingId));
    const openEsc = AGC.data.escalations.filter((e) => e.status === "Open" && (approver || vis.has(e.findingId))), retEsc = AGC.data.escalations.filter((e) => e.status === "Returned" && (approver || vis.has(e.findingId)));
    if (openEsc.length) {
      const mine = approver ? S.approvalQueue().filter((it) => it.kind === "escalation" && it.wait === "you").length : 0;
      (approver && mine ? mineLines : items).push(`${I.flag} ${openEsc.length} ${U.plural(openEsc.length, "escalation is", "escalations are")} awaiting an approver's decision${approver ? `, ${mine} of them for you` : ""}. ${approver ? (mine ? `<a href="#/approvals">Decide ${mine === 1 ? "it" : "them"} on Approvals.</a>` : `<a href="#/approvals/others">See them on Approvals.</a>`) : (S.can("review") ? `<a href="#/findings/escalated">See ${openEsc.length === 1 ? "it" : "them"} on Findings.</a>` : "")}`);
    }
    /* The link opens the oldest returned escalation the reader may see; any others sit tagged at the top of the queue (2026-09-29). */
    const retVis = retEsc.filter((e) => vis.has(e.findingId)).sort((a, b) => (a.escalatedAt || "").localeCompare(b.escalatedAt || ""));
    if (retEsc.length) items.push(`${I.flag} ${retEsc.length} ${U.plural(retEsc.length, "escalation was", "escalations were")} returned to the reviewer and ${U.plural(retEsc.length, "waits", "wait")} for a revision.${S.can("review") && retVis.length ? ` <a href="#/findings/escalated/${retVis[0].findingId}">Revise ${retEsc.length === 1 ? "it" : "them"} on Findings.</a>` : ""}`);
    /* Approved remediations waiting for their owners (the owner's response, 2026-09-28): a fix pending, named with its owner. */
    const tasks = AGC.data.escalations.filter((e) => e.status === "Approved" && ["Open", "In progress"].includes(e.ownerTaskStatus || "Open") && (approver || S.can("settings") || vis.has(e.findingId) || (S.group(e.groupId) || {}).ownerMemberId === me.memberId));
    if (tasks.length) {
      const mine = tasks.filter((e) => (S.group(e.groupId) || {}).ownerMemberId === me.memberId).length;
      const names = tasks.map((e) => { const en = e.registerEntryId ? S.entry(e.registerEntryId) : null, g = S.group(e.groupId); return en ? `<a href="#/registry/${en.id}">${U.esc(en.name)}</a> (${U.esc(g ? g.name : "")})` : `<a href="#/groups/${e.groupId}/findings?open=${e.findingId}">${U.esc(g ? g.name : "")}, conduct</a>`; });
      (mine ? mineLines : items).push(`${I.alert} ${tasks.length} approved ${U.plural(tasks.length, "remediation waits", "remediations wait")} for ${tasks.length === 1 ? "its owner" : "their owners"}${mine ? `, ${mine} for you` : ""}: ${names.join(", ")}.`);
      tasks.filter((e) => (S.group(e.groupId) || {}).ownerMemberId === me.memberId).forEach((e) => mineGroups.add(e.groupId));
    }
    /* An owner's group that needs nothing from them today still gets its line, so the group page is one click away. */
    groups.filter((g) => g.ownerMemberId === me.memberId && !mineGroups.has(g.id)).forEach((g) => mineLines.push(`${I.checkCircle} ${U.esc(g.name)}, the group you own, needs nothing from you today. <a href="#/groups/${g.id}">Open ${U.esc(g.name)}.</a>`));
    const all = mineLines.concat(items);
    if (!all.length) return `<div class="notice notice-ok">${I.checkCircle}<span>Nothing needs attention. Every group has an owner and a reviewer, every registration is current, nothing is waiting in Unregistered AI, and no escalation waits for a decision.</span></div>`;
    return C.attentionBox(all);
  }

  /* Six facts, each with the one number that matters under it. They link to their pages; they filter nothing. */
  function facts() {
    const groups = S.activeGroups(), notReady = groups.filter((g) => !S.groupReadiness(g).ready).length;
    /* People synchronized from the identity source and still employed (Active, On leave or Inactive), the same people the Groups page counts
       as members (Gabriel, 2026-09-29); the Archive360 local Administrator account is not a governed person. */
    const people = D.members.filter((m) => m.memberStatus !== "Terminated" && m.assignmentSource !== "excluded" && m.sourceSystem !== "Archive360 local account");
    const governed = people.filter((m) => m.primaryGroupId).length, unassigned = people.length - governed;
    /* The registrations tile counts what the Registry's Registered tab lists (Gabriel, 2026-09-28, Option A: the tile's words match the tab
       it opens), split into the two levels: AI systems (platforms and custom AI applications, added in Settings) and AI assets registered
       individually. It links to the Registry, never to Settings, which three of the four profiles cannot open. */
    const entries = S.registryEntries(), regSystems = entries.filter((e) => e.level === "Platform" || e.level === "Custom AI system").length;
    const regAssets = entries.length - regSystems, pendingReg = entries.filter((e) => e.status === "Pending").length;
    /* A retired registration is not "registered individually" (Gabriel, 2026-09-29); the Registry's tile counts the same way. */
    const assets = D.aiSystems.filter((s) => s.type !== "Custom"), individual = assets.filter((s) => { const c = S.systemCoverage(s); return c.key === "individual" && c.entry && c.entry.status !== "Retired"; }).length;
    const open = S.can("unregistered") ? S.unregOpenItems().length : null;
    /* The same tile as every other page's (Gabriel, 2026-10-02): the colored edge says what the number means, red for a gap, amber for
       something waiting, green for nothing to do, and the border lights on hover. These tiles open their pages; they filter nothing, so none is
       ever selected. */
    const tile = (href, value, label, sub, edge, cls) => `<a class="ready-tile tile-link${edge ? " " + edge : ""}" href="${href}"><div class="ready-val">${value}</div><div class="ready-label">${U.esc(label)}</div><div class="ready-sub${cls ? " " + cls : ""}">${sub}</div></a>`;
    const tiles = [
      tile("#/groups", U.fmtNum(groups.length), "Business groups", notReady ? `${notReady} with no owner or no reviewer` : "every group has an owner and a reviewer", notReady ? "gap" : "ok", notReady ? "danger-text" : "ok-text"),
      tile("#/people", U.fmtNum(governed), "People governed", unassigned ? `${unassigned} not in a group yet` : "everyone in a group", unassigned ? "gap" : "ok", unassigned ? "danger-text" : "ok-text"),
      tile("#/registry", U.fmtNum(entries.length), "Registrations", `${regSystems} AI ${U.plural(regSystems, "system", "systems")} and ${regAssets} AI ${U.plural(regAssets, "asset", "assets")}<br><span class="${pendingReg ? "warn-text" : "ok-text"}">${pendingReg ? `${pendingReg} awaiting approval` : "all approved"}</span>`, pendingReg ? "warn" : "ok", ""),
      tile("#/registry/assets", U.fmtNum(assets.length), "AI assets", `${U.fmtNum(individual)} registered individually`, "", ""),
    ];
    if (open !== null) tiles.push(tile("#/unregistered", U.fmtNum(open), "Unregistered AI", open ? `open ${U.plural(open, "item", "items")}` : "nothing waiting", open ? "warn" : "ok", open ? "warn-text" : "ok-text"));
    return `<div class="ready-strip ov-facts${tiles.length === 5 ? " ready-strip-5" : ""}">${tiles.join("")}</div>`;
  }

  /* A few words on what is wrong in a group: the same facts as the group page's Needs attention strip. */
  function groupAttention(g) {
    const r = S.groupReadiness(g), parts = [];
    r.gaps.forEach((x) => parts.push(`<span class="danger-text">${x.kind === "owner" ? (r.owner ? `Owner ${U.statusWord(r.owner)}` : "No owner") : "No reviewer"}</span>`));
    const entries = S.registryEntries().filter((e) => e.groupId === g.id);
    const count = (list, word, cls) => { if (list.length) parts.push(`<span class="${cls}">${list.length} ${word}</span>`); };
    count(entries.filter((e) => e.status === "Pending"), "awaiting approval", "warn-text");
    count(entries.filter((e) => e.status === "Expired"), "expired", "danger-text");
    count(entries.filter((e) => e.status === "Suspended"), "suspended", "danger-text");
    count(entries.filter((e) => e.status === "Approved" && S.entryDue(e).dueSoon), "due soon", "warn-text");
    count(entries.filter((e) => { const o = S.member(e.ownerMemberId); return o && !["Retired", "Rejected"].includes(e.status) && o.primaryGroupId !== g.id && (o.groupHistory || []).some((h) => h.groupId === g.id && h.toDate); }), "owner moved", "warn-text");
    const outside = (S.systemsByGroup[g.id] || []).filter((s) => s.external && !s.sanction && !s.registerEntryId).length;
    if (outside) parts.push(`<span class="warn-text">${outside} outside ${U.plural(outside, "GPT", "GPTs")} undecided</span>`);
    return parts.join(" · ");
  }
  function groupTable() {
    const from = since();
    const rows = S.activeGroups().map((g) => {
      const ints = (S.interactionsByGroup[g.id] || []).filter((x) => x.date >= from);
      /* How badly, beside how much (Gabriel, 2026-09-29): violations confirmed on findings detected in the period, the group page's rule, and
         the group's whole open queue beneath, because a finding that has waited longer than the period must not fall out of sight. */
      const fnd = S.findingsByGroup[g.id] || [];
      const confirmed = fnd.filter((f) => f.status === "Confirmed" && f.detectedAt.slice(0, 10) >= from).length, awaiting = fnd.filter((f) => f.status === "Detected").length;
      return { g, n: ints.length, people: new Set(ints.map((x) => x.memberId)).size, assets: S.groupAssetCount(g.id), confirmed, awaiting, attn: groupAttention(g), risk: S.riskForGroup(g.id) };
    }).sort((a, b) => b.n - a.n || a.g.name.localeCompare(b.g.name));
    const max = Math.max(1, ...rows.map((r) => r.n));
    /* No row click (Gabriel, 2026-10-02, Option 2): each number opens the page that shows the same number, and only for a reader who may open
       it (the Members rule for Interactions and Findings). The 30-day numbers carry their period in the link, so the group page arrives with its
       date range set and says so. People using AI stays plain, because no page shows that number; Needs attention is a summary of the strip
       the group name opens. */
    const period = `from=${from}&to=${U.today()}`;
    const canSee = (g) => (AGC.pages.group && AGC.pages.group.canSeeMembers ? AGC.pages.group.canSeeMembers(g) : S.can("settings"));
    return C.card(`AI use by business group, last ${DAYS} days`, `<div class="tbl-wrap"><table class="tbl tbl-ov"><thead><tr><th>Business group</th><th>Risk</th><th>Interactions</th><th class="num">Confirmed violations</th><th class="num">People using AI</th><th class="num">AI assets</th><th>Needs attention</th></tr></thead><tbody>${rows.map((r) => { const see = canSee(r.g), id = r.g.id; return `<tr>
        <td><a class="strong" href="#/groups/${id}">${U.esc(r.g.name)}</a></td>
        <td><a href="#/groups/${id}" class="risk-cell-link" title="Open ${U.esc(r.g.name)}: its Risk card lists the factors">${C.riskPill(r.risk)}</a></td>
        <td><div class="ov-bar">${U.meter(r.n, max)}${see ? `<a class="ov-n strong" href="#/groups/${id}/interactions?${period}">${U.fmtNum(r.n)}</a>` : `<span class="ov-n">${U.fmtNum(r.n)}</span>`}</div></td>
        <td class="num">${see ? `<a class="strong" href="#/groups/${id}/findings?view=confirmed&${period}">${U.fmtNum(r.confirmed)}</a>` : `<span class="strong">${U.fmtNum(r.confirmed)}</span>`}${r.awaiting ? `<div class="small ov-awaiting">${see ? `<a class="warn-text" href="#/groups/${id}/findings?view=awaiting">${U.fmtNum(r.awaiting)} awaiting review</a>` : `<span class="warn-text">${U.fmtNum(r.awaiting)} awaiting review</span>`}</div>` : ""}</td>
        <td class="num">${U.fmtNum(r.people)}</td>
        <td class="num"><a href="#/groups/${id}/registry">${U.fmtNum(r.assets)}</a></td>
        <td class="small">${r.attn || '<span class="muted">—</span>'}</td>
      </tr>`; }).join("")}</tbody></table></div>`, { action: `<a class="link" href="#/groups">Groups ${I.arrowRight}</a>` });
  }

  /* What AI is used for, across the business: each category with its count and share, and the groups using it most (Gabriel, 2026-09-25). */
  function useMix() {
    const from = since(), ints = D.interactions.filter((x) => x.date >= from && x.groupId);
    /* Every business group with a count for the category, most first, opened in place from the row's chevron (Gabriel, 2026-09-29). */
    const rows = S.useMix(ints).map((r) => { const by = {}; ints.forEach((x) => { if (x.useCategory === r.cat.id) by[x.groupId] = (by[x.groupId] || 0) + 1; }); return Object.assign(r, { groups: Object.entries(by).sort((a, b) => b[1] - a[1] || S.groupName(a[0]).localeCompare(S.groupName(b[0]))).map(([gid, n]) => ({ id: gid, name: S.groupName(gid), n })) }); });
    return C.card(`What AI is used for, last ${DAYS} days`, `<p class="small muted">Each interaction is classified by what the person asked for. Open a category to see the business groups using it.</p>${C.useMixList(rows, ints.length)}`);
  }
  P.render = function () {
    const nav = AGC.shell.navMeta("overview");
    AGC.shell.render({ kind: "list", navKey: "overview", title: nav.title, description: nav.description, icon: "overview", html: `${attention()}${facts()}${groupTable()}${useMix()}` });
  };
})();
