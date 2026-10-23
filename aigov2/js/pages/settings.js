/* Settings tab: left rail and the configuration pages. Business Group Mapping lives in mapping.js and registers itself here. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.settings = { sections: {} });

  // Version 1 Settings, in the order a brand-new customer's Administrator works through them.
  // Sections built earlier (notifications, approvals, reconfirmation, evidence, collection) stay in the code but are not listed.
  P.RAIL = [
    { key: "instances", label: "AI Systems", icon: "platform", feature: "settings", desc: "The AI platforms and custom applications Archive360 archives, and the record class that holds each one's data." },
    { key: "groups", label: "Business Groups", icon: "groups", feature: "settings", desc: "Create and manage the groups that are the unit of governance." },
    { key: "mapping", label: "Business Group Mapping", icon: "mapping", feature: "settings", desc: "How attribute values from the identity source become business groups." },
    { key: "notifications", label: "Notifications", icon: "mail", feature: "settings", desc: "How accountable owners are told: the group digest and the few emails that cannot wait." },
    { key: "access", label: "Readiness check", icon: "coverage", feature: "settings", desc: "The last step before governance runs: every group has an owner and a reviewer with access, and there are enough approvers." },
  ];
  P.canEdit = function (key) { const r = P.RAIL.find((x) => x.key === key); return r ? S.can(r.feature) : false; };
  P.dis = (key) => (P.canEdit(key) ? "" : "disabled");
  P.saveBar = function (feature, label) {
    return `<div class="save-bar">${AGC.shell.permButton(feature, {}, `${I.check} ${label || "Save changes"}`, 'data-action="save"', "btn-primary")}<span class="save-note muted small">Saved settings apply immediately in this prototype and are recorded in Audit History.</span></div>`;
  };
  P.readOnlyBanner = function (rail) {
    if (S.can(rail.feature)) return "";
    const perm = S.permission(rail.feature, {});
    return `<div class="notice notice-info ro-banner">${I.lock}<span>Read-only for your profile. ${U.esc(perm.reason)} An Archive360 Administrator can change these settings.</span></div>`;
  };

  /* Owner cell shared by the Settings grids: avatar, name, the employment status as a tag when it is not Active, title underneath. */
  /* groupId, when given, is the registration's business group: an owner who sits in another group gets that group as a tag, because
     ownership is about authority, not org placement, and the reader must see it (Gabriel, 2026-09-24). */
  P.ownerCell = function (m, groupId) {
    if (!m) return '<span class="danger-text">No owner</span>';
    const elsewhere = groupId && m.primaryGroupId && m.primaryGroupId !== groupId ? ` <span class="tag" title="Accountable owner from ${U.esc(S.groupName(m.primaryGroupId))}, not ${U.esc(S.groupName(groupId))}">${U.esc(S.groupName(m.primaryGroupId))}</span>` : "";
    return `<div class="owner-cell">${U.avatar(m, "sm")}<div><div>${U.esc(m.displayName)}${U.statusTag(m)}${elsewhere}</div><div class="small muted">${U.esc(m.jobTitle || "")}</div></div></div>`;
  };
  /* Per-row Actions menu item. An action the current state does not allow is shown disabled with its reason, never hidden. */
  P.menuItem = function (o) {
    const dis = o.disabledReason ? ` disabled aria-disabled="true" title="${U.esc(o.disabledReason)}"` : "";
    return `<button type="button" class="group-card-actions-menu-item${o.cls ? " " + o.cls : ""}${o.disabledReason ? " is-disabled" : ""}" role="menuitem" ${o.attr}="${o.action}" data-id="${o.id}"${dis}><span class="action-menu-icon">${U.icon(o.icon)}</span><span class="action-menu-label">${o.label}${o.disabledReason ? `<span class="menu-reason">${U.esc(o.disabledReason)}</span>` : ""}</span></button>`;
  };
  P.render = function (params) {
    const listed = P.RAIL.map((r) => r.key);
    const key = params.page && P.sections[params.page] && listed.includes(params.page) ? params.page : "instances";
    const sec = P.sections[key];
    const rail = P.RAIL.find((r) => r.key === key);
    const nav = AGC.shell.navMeta("settings");
    // Page access comes from Profiles and Entitlement Policies: a persona without the settings feature does not see the tab, and a
    // direct link lands here rather than on a read-only copy (Gabriel, 2026-09-08).
    if (!S.can("settings")) {
      AGC.shell.render({ kind: "list", navKey: "overview", title: nav.title, description: nav.description, icon: "settings", html: `<div class="placeholder-card"><div class="ph-title">${I.lock} Settings is not available for your profile</div><div class="ph-body">Access to Settings comes from your Profile and Entitlement Policies. An Archive360 Administrator configures AI Systems, Business Groups, Business Group Mapping and roles.</div><div class="ph-note"><a href="#/overview">Back to Overview</a></div></div>` });
      return;
    }
    const html = `<div class="settings-layout">
      <nav class="settings-rail" aria-label="Settings sections">${P.RAIL.map((r) => `<a class="rail-item${r.key === key ? " active" : ""}" href="#/settings/${r.key}"><span class="rail-ic">${U.icon(r.icon)}</span><span class="rail-text"><span class="rail-label">${U.esc(r.label)}</span><span class="rail-desc">${U.esc(r.desc)}</span></span>${S.can(r.feature) ? "" : `<span class="rail-lock" title="Read-only for your profile">${I.lock}</span>`}</a>`).join("")}</nav>
      <div class="settings-content"><h2 class="settings-title">${U.icon(rail.icon)} ${U.esc(rail.label)}</h2>${P.readOnlyBanner(rail)}${sec.render()}</div>
    </div>`;
    AGC.shell.render({ kind: "list", navKey: "settings", title: nav.title, description: nav.description, icon: "settings", html, after(root) { if (sec.after) sec.after(root); } });
  };

  /* ---------- Notifications (Version 1) ----------
     Each business group's accountable owner receives a scheduled digest; a few exceptional events go out immediately. Recipients are
     derived (the owner from the Business Groups page, the address from the identity source); the page sets the rhythm and shows what
     was sent. Every group starts at Weekly; there is no separate "default" control. */
  P.IMMEDIATE_CASES = [
    { key: "Register entry status changed", label: "An AI system's approval status changes", desc: "When one of the group's registered AI systems is approved, suspended, expired, rejected or retired, so a change in what is sanctioned never waits." },
    { key: "Confirmed finding on an expired or suspended system", label: "A violation is confirmed on a system that is expired or suspended", desc: "Use of an AI system or AI asset whose approval has expired or been suspended is exceptional, so the owner hears the same day." },
    { key: "Critical finding confirmed", label: "A Critical violation is confirmed", desc: "The most serious findings, such as a card number or credentials pasted into a prompt, reach the owner the moment a reviewer confirms them." },
    { key: "Remediation returned or rejected", label: "A remediation is sent back or rejected", desc: "When an approver returns a remediation for rework or rejects it as accepted risk, the owner learns at once that the plan changed." },
  ];
  P.sections.notifications = {
    render() {
      const st = D.settings.digest, rc = D.settings.reconfirmation, can = P.canEdit("notifications"), dis = can ? "" : "disabled";
      const freq = ["Daily", "Weekly", "Monthly"].map((v) => ({ value: v, label: v }));
      const enabled = st.immediateEnabled || {};
      const rows = S.groupsOrdered().map((g) => {
        const owner = S.member(g.ownerMemberId);
        const gone = !owner || owner.memberStatus !== "Active";
        const last = D.digests.filter((x) => x.groupId === g.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
        /* "Last notification" (Gabriel, 2026-10-01): the date of the most recent of the group's digest and its immediate emails, and nothing else. */
        const lastImm = (D.auditEvents || []).filter((e) => e.eventType === "Immediate notification sent" && e.groupId === g.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
        const lastAt = [last && last.sentAt, lastImm && lastImm.timestamp].filter(Boolean).sort().slice(-1)[0];
        const lastCell = lastAt ? U.fmtDate(lastAt) : '<span class="muted">Nothing sent yet</span>';
        return `<tr class="${gone ? "row-gap" : ""}">
          <td><a class="strong" href="#/groups/${g.id}">${U.esc(g.name)}</a></td>
          <td>${owner ? `<div class="owner-cell">${U.avatar(owner, "sm")}<div><div>${U.esc(owner.displayName)}${U.statusTag(owner)}</div><div class="small muted">${U.esc(owner.jobTitle || "")}</div></div></div>` : '<span class="danger-text">No owner</span>'}${gone ? `<div class="small gap-text">${owner ? `Owner ${U.statusWord(owner)}.` : "No owner."} <a href="#/settings/groups">Name ${owner ? "a new" : "an"} owner on the Business Groups page.</a></div>` : ""}</td>
          <td>${C.select("freq:" + g.id, freq, st.perGroup[g.id] || "Weekly", dis)}</td>
          <td class="small">${lastCell}</td>
          <td class="nowrap"><button type="button" class="btn btn-sm" data-action="preview-digest" data-group="${g.id}">${I.mail} Preview next digest</button></td>
        </tr>`;
      }).join("");
      const toggles = P.IMMEDIATE_CASES.map((c) => C.toggle("imm:" + c.key, enabled[c.key] !== false, `<span class="strong">${U.esc(c.label)}</span><span class="small muted">${U.esc(c.desc)}</span>`, { disabled: !can })).join("");
      return `<div class="page-head"><p class="lead lead-wide">Each Business Group owner receives a scheduled summary of the group's AI governance activity, along with immediate email notifications for events that require timely attention. Recipients are the owners assigned on the <a href="#/settings/groups">Business Groups</a> page. Notifications include relevant counts and links back to the appropriate area of the module, but never include AI interaction content.</p></div>
        ${C.card("Digest schedule", `<p class="lead">Weekly unless changed below. Digests go out at 7:00 AM Eastern: on business days for Daily, on Mondays for Weekly, on the first business day of the month for Monthly.</p>
          ${can ? `<div class="toolbar set-all"><span class="small">Set all to</span>${C.select("setAll", freq, "Weekly")}<button type="button" class="btn btn-sm" data-action="set-all">Apply</button><span class="small muted">Fills every row; adjust any group before saving.</span></div>` : ""}
          <div class="tbl-wrap"><table class="tbl tbl-digest"><thead><tr><th>Business group</th><th>Accountable owner</th><th>Frequency</th><th>Last notification</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`)}
        ${C.card("Immediate notifications", `<p class="lead">Sent at once to the accountable owner of the group concerned. Everything else waits for the group's digest.</p>
          <div class="toggle-list toggle-list-rich">${toggles}</div>`)}
        ${C.card("Reconfirmation reminders", `<p class="lead">Every registration on the AI Registry reconfirms on a cadence set from its risk band at approval or reconfirmation: High and Critical every 6 months, others every 12, fixed until the next reconfirmation. As the due date approaches, the owner is reminded in their digest until they reconfirm. On the due date an unreconfirmed registration expires, which is a status change and sends the immediate email above.</p>
          <div class="form-grid form-grid-3">
            ${C.field("Reminders begin", C.select("rcStart", [14, 30, 60].map((d) => ({ value: d, label: `${d} days before the due date` })), rc.reminderStartDays || 30, dis), "In every digest from that day until reconfirmed.")}
            ${C.field("Immediate reminder", `<div class="toggle-list">${C.toggle("rcImmediate", rc.immediateReminder !== false, "Also email the owner one week before the due date", { disabled: !can })}</div>`, "For owners on a monthly digest, this is the reminder they will actually see in time.")}
          </div>`)}
        ${P.saveBar("settings")}`;
    },
    after(root) {
      root.querySelectorAll("[data-action='preview-digest']").forEach((b) => b.addEventListener("click", () => P.previewDigest(b.dataset.group)));
      const setAll = root.querySelector("[data-action='set-all']");
      if (setAll) setAll.addEventListener("click", () => { const v = root.querySelector("select[name='setAll']").value; root.querySelectorAll("select[name^='freq:']").forEach((s) => { s.value = v; }); AGC.shell.toast(`Every group set to ${v}. Save to apply.`, "info"); });
      const save = root.querySelector("[data-action='save']");
      if (save) save.addEventListener("click", () => {
        const st = D.settings.digest, perGroup = Object.assign({}, st.perGroup), immediateEnabled = Object.assign({}, st.immediateEnabled || {});
        root.querySelectorAll("select[name^='freq:']").forEach((s) => { perGroup[s.name.slice(5)] = s.value; });
        root.querySelectorAll("input[name^='imm:']").forEach((c) => { immediateEnabled[c.name.slice(4)] = c.checked; });
        S.saveSettings("digest", { defaultFrequency: "Weekly", perGroup, immediateEnabled }, "Notification settings updated");
        S.saveSettings("reconfirmation", { reminderStartDays: parseInt(root.querySelector("select[name='rcStart']").value, 10), immediateReminder: root.querySelector("input[name='rcImmediate']").checked, immediateReminderDays: 7 }, "Reconfirmation reminder settings updated");
        AGC.shell.toast("Notification settings saved. Recorded in Audit History.", "success");
        AGC.router.refresh();
      });
    },
  };
  /* The digest, in the owner's words (reviewed with Gabriel on 2026-10-01): confirmed violations (never "confirmed findings"), the escalations
     and remediations as the Needs attention strip says them, the group's registrations (changes in the period, then what is expired or due),
     readiness, and a link on every item to where the work is done. Counts and links only, never interaction content. */
  P.previewDigest = function (groupId) {
    const d = S.digestPreview(groupId), g = d.group, gid = g.id;
    const name = (id) => (S.member(id) ? S.member(id).displayName : "");
    const link = (href, text) => `<a href="${href}" data-modal-close class="strong">${U.esc(text)}</a>`;
    const ruleRows = Object.entries(d.byRule).map(([rid, fs]) => {
      const r = S.rule(rid), people = U.uniq(fs.map((f) => name(f.memberId)).filter(Boolean));
      return `<li>${link(`#/groups/${gid}/findings?open=${fs[0].findingId}`, r.name)} ${U.sevChip(r.defaultSeverity)} <span class="muted">· ${fs.length} ${U.plural(fs.length, "violation")} · ${U.esc(people.slice(0, 3).join(", "))}${people.length > 3 ? ` and ${people.length - 3} more` : ""}</span></li>`;
    }).join("");
    const escRows = d.remediations.map((e) => {
      const f = S.finding(e.findingId), person = f ? name(f.memberId) : "", asset = e.aiSystemId ? S.systemName(e.aiSystemId) : "a direct chat";
      const entry = e.registerEntryId ? S.entry(e.registerEntryId) : null, href = entry ? `#/registry/${entry.id}` : `#/groups/${gid}/findings?open=${e.findingId}`;
      const a = link(href, asset), approvedOn = (e.approvals || []).map((x) => x.decidedAt).sort().slice(-1)[0] || e.approvedAt || "";
      const state = e.ownerTaskStatus === "In progress" ? `is in progress since ${U.fmtDate(e.startedAt || approvedOn)}` : "is waiting for you";
      if (e.status === "Approved") return e.target === "AI system"
        ? `<li>${a} is suspended: the remediation approved on ${U.fmtDate(approvedOn)} ${state}. Complete it and reconfirm.</li>`
        : `<li>The remediation approved on ${U.fmtDate(approvedOn)} for ${U.esc(person)}'s use of ${a} ${state}. Complete it.</li>`;
      if (e.status === "Returned") return `<li>The escalation about ${e.target === "AI system" ? a : `${U.esc(person)}'s use of ${a}`} was returned to the reviewer and waits for a revision.</li>`;
      return e.target === "AI system" ? `<li>${a} is suspended pending an approver's decision on its escalation.</li>` : `<li>An escalation about ${U.esc(person)}'s use of ${a} awaits an approver's decision.</li>`;
    }).join("");
    const mine = d.remediations.filter((e) => e.status === "Approved").length, awaitingApprover = d.remediations.filter((e) => e.status === "Open").length, returned = d.remediations.filter((e) => e.status === "Returned").length;
    const entries = D.registerEntries.filter((e) => e.groupId === gid && e.level !== "Business group");
    const changes = [];
    entries.forEach((e) => (e.decisionHistory || []).forEach((h) => { if (h.date > d.start && h.date <= d.end) changes.push({ e, h }); }));
    changes.sort((x, y) => y.h.date.localeCompare(x.h.date));
    const regRows = changes.map(({ e, h }) => `<li>${link(`#/registry/${e.id}`, e.name)} <span class="muted">· ${U.esc(h.action)} on ${U.fmtDate(h.date)}${name(h.actorMemberId) ? ` by ${U.esc(name(h.actorMemberId))}` : ""}</span></li>`).join("")
      + d.systemsDue.map((e) => `<li>${link(`#/registry/${e.id}`, e.name)} <span class="muted">· ${e.status === "Expired" ? `approval expired on ${U.fmtDate(e.reconfirmationDueDate)}; reconfirm it on the AI Registry` : `reconfirmation due ${U.fmtDate(e.reconfirmationDueDate)}`}</span></li>`).join("");
    const rr = S.groupReadiness(g);
    const readiness = rr.ready ? "Ready." : `Not ready: ${U.esc(rr.gaps.map((x) => x.text.charAt(0).toLowerCase() + x.text.slice(1)).join("; "))}.`;
    const headParts = [`${d.confirmed.length} new confirmed ${U.plural(d.confirmed.length, "violation")}`];
    if (mine) headParts.push(`${mine} ${U.plural(mine, "remediation")} waiting for you`);
    if (awaitingApprover) headParts.push(`${awaitingApprover} ${U.plural(awaitingApprover, "escalation")} awaiting an approver`);
    if (returned) headParts.push(`${returned} ${U.plural(returned, "escalation")} returned to the reviewer`);
    const lastSent = D.digests.filter((x) => x.groupId === gid).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
    C.modal({ title: "Preview of the next digest", size: "modal-lg", body: `<p class="small muted">If the ${U.esc(d.freq.toLowerCase())} digest for ${U.esc(g.name)} went out today, ${U.fmtDate(d.end)}, this is what it would say, built from the module's data as it stands now. ${lastSent ? `The last digest went out on ${U.fmtDate(lastSent.sentAt)}.` : "No digest has gone out yet."}</p><div class="email">
        <div class="email-meta"><div><span class="email-label">To</span> ${U.esc(d.owner ? d.owner.displayName : "")} &lt;${U.esc(d.owner ? d.owner.email : "")}&gt;${d.owner && d.owner.memberStatus === "Terminated" ? ' <span class="tag tag-danger">Terminated · undeliverable</span>' : d.owner ? U.statusTag(d.owner) : ""}</div><div><span class="email-label">Subject</span> ${U.esc(d.freq)} AI governance digest · ${U.esc(g.name)} · ${U.esc(U.fmtDateLong(d.end))}</div></div>
        <h3>${U.esc(g.name)}: ${headParts.join(" · ")}</h3>
        <p>Period ${U.fmtDate(d.start)} to ${U.fmtDate(d.end)}. You are receiving this as the accountable owner of ${U.esc(g.name)}.</p>
        <h4>Confirmed violations</h4>${ruleRows ? `<ul class="email-list">${ruleRows}</ul>` : '<p class="muted">None confirmed in this period.</p>'}
        <h4>Escalations and remediations</h4>${escRows ? `<ul class="email-list">${escRows}</ul>` : '<p class="muted">None open.</p>'}
        <h4>Registrations</h4>${regRows ? `<ul class="email-list">${regRows}</ul>` : '<p class="muted">No changes in this period, and nothing due within 30 days.</p>'}
        <h4>Readiness</h4><ul class="email-list"><li>${readiness}</li><li>${d.awaiting} ${U.plural(d.awaiting, "finding")} awaiting review · ${d.coverage} ${U.plural(d.coverage, "reviewer")} with access to the group's activity</li></ul>
        <p class="email-cta"><a href="#/groups/${gid}" data-modal-close>Open ${U.esc(g.name)} in the AI Governance Center</a></p>
        <p class="email-foot">This digest contains no interaction content. Sent by Archive360 for ${U.esc(D.meta.company.name)}. Delivery is recorded in Audit History.</p></div>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Close</button>` });
  };

  /* ---------- Approvals ---------- */
  P.sections.approvals = {
    render() {
      const st = D.settings.approvals, dis = P.dis("approvals");
      const n = [1, 2, 3].map((v) => ({ value: v, label: v === 1 ? "1 approver" : v + " approvers" }));
      const approvers = S.sortMembers(D.members.filter((m) => m.memberStatus === "Active" && m.sourceSystem !== "Archive360 local account" && S.byId.profile[m.profileId].features.includes("approve")));
      const decided = (mid) => D.escalations.reduce((a, e) => a + e.approvals.filter((x) => x.approverMemberId === mid).length, 0);
      return `
        ${C.card("Required approvals", `<p class="lead">How many designated approvers must approve an escalation before its remediation takes effect. The requirement is captured on each escalation when it is raised, so a change here never alters decisions already in progress.</p>
          <div class="form-grid form-grid-4">${["Critical", "High", "Medium", "Low"].map((sev) => C.field(`${U.sevChip(sev)} findings`, C.select("req:" + sev, n, st.requiredBySeverity[sev], dis))).join("")}</div>
          <div class="form-grid">${C.field("New registrations and reconfirmation reviews", C.select("registrationApprovals", n, st.registrationApprovals, dis), "Applies to platform, group, GPT, Project and custom system registrations.")}</div>`)}
        ${C.card("Separation of duties", `<div class="toggle-list">${C.toggle("sod", true, "An approver cannot decide an escalation on a finding they reviewed; the Approve action is disabled with the reason and the overlap is written to Audit History", { disabled: true, locked: true })}${C.toggle("allowOwnerAsApprover", st.allowOwnerAsApprover, "Allow the accountable owner to approve remediations for systems in their own group", { disabled: !!dis })}</div>
          <p class="small muted">The requirements allow the owner to act as approver in smaller organizations. ${U.esc(D.meta.company.shortName)} keeps it off so that review, decision and execution stay with three different people.</p>`)}
        ${C.card(`Approver roster <span class="count-badge">${approvers.length}</span>`, `<p class="small muted">Members whose Profile includes the approval feature. Managed in Administration; listed here so Compliance can see who decides.</p>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Approver</th><th>Title</th><th>Group</th><th>Entitlement</th><th class="num">Decisions recorded</th></tr></thead><tbody>${approvers.map((m) => `<tr><td>${U.memberLink(m)}</td><td>${U.esc(m.jobTitle)}</td><td>${U.esc(S.groupName(m.primaryGroupId))}</td><td class="small">${m.entitlementPolicyIds.map((id) => U.esc(S.byId.ep[id].name)).join(", ") || '<span class="muted">none</span>'}</td><td class="num">${decided(m.memberId)}</td></tr>`).join("")}</tbody></table></div>`)}
        ${P.saveBar("settings")}`;
    },
    after(root) {
      const save = root.querySelector("[data-action='save']");
      if (save) save.addEventListener("click", () => {
        const req = {};
        ["Critical", "High", "Medium", "Low"].forEach((sev) => { req[sev] = parseInt(root.querySelector(`select[name='req:${sev}']`).value, 10); });
        S.saveSettings("approvals", { requiredBySeverity: req, registrationApprovals: parseInt(root.querySelector("select[name='registrationApprovals']").value, 10), allowOwnerAsApprover: root.querySelector("input[name='allowOwnerAsApprover']").checked }, "Approval requirements updated");
        AGC.shell.toast("Approval settings saved.", "success");
        AGC.router.refresh();
      });
    },
  };

  /* ---------- Reconfirmation ---------- */
  P.sections.reconfirmation = {
    render() {
      const st = D.settings.reconfirmation, dis = P.dis("reconfirmation");
      const due = D.registerEntries.filter((e) => (e.reconfirmationDueDate && e.status === "Approved" && U.daysUntil(e.reconfirmationDueDate) <= 60) || e.status === "Expired").sort((a, b) => (a.reconfirmationDueDate || "").localeCompare(b.reconfirmationDueDate || ""));
      return `
        ${C.card("Reconfirmation cycle", `<p class="lead">Every register entry is reconfirmed by its accountable owner: the system is still needed and still serves its approved purpose. Reconfirmation is the owner's act and needs no approver unless the purpose changes.</p>
          <div class="form-grid form-grid-3">${C.field("Interval", C.select("intervalMonths", [6, 12, 24].map((v) => ({ value: v, label: v + " months" })), st.intervalMonths, dis))}${C.field("Reminders before the due date", `<input class="inp" name="reminders" value="${U.esc(st.reminderDaysBefore.join(", "))}" ${dis}/>`, "Days, comma separated. Reminders reach the owner by digest and appear in their attention strip.")}${C.field("Grace period after an owner leaves", `<span class="inline-input"><input class="inp inp-num" type="number" min="0" max="180" name="ownerDepartureGraceDays" value="${st.ownerDepartureGraceDays}" ${dis}/> days</span>`, "Entries owned by a departed member are flagged immediately and expire if no new owner is assigned within the grace period.")}</div>
          <div class="toggle-list">${C.toggle("autoExpire", st.autoExpire, "Expire an entry automatically when the due date passes without reconfirmation", { disabled: !!dis })}${C.toggle("lockx", true, "Collection, classification and rule evaluation continue for expired entries; expiry changes what is sanctioned, never what is retained", { disabled: true, locked: true })}</div>`)}
        ${C.card(`Due within 60 days or expired <span class="count-badge">${due.length}</span>`, due.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Entry</th><th>Level</th><th>Owner</th><th>Status</th><th>Due</th></tr></thead><tbody>${due.map((e) => { const o = S.member(e.ownerMemberId); const dd = U.daysUntil(e.reconfirmationDueDate); return `<tr><td><a class="strong" href="#/register/${e.id}">${U.esc(e.name)}</a></td><td>${U.esc(e.level)}</td><td>${U.memberLink(o, { noAvatar: true })}</td><td>${U.statusPill(e.status)}</td><td class="${dd < 0 ? "danger-text" : dd <= 14 ? "warn-text" : ""}">${U.fmtDate(e.reconfirmationDueDate)}${dd < 0 ? ` (${-dd} days overdue)` : ` (${dd} days)`}</td></tr>`; }).join("")}</tbody></table></div>` : C.emptyState("Nothing due", "No entries are due within 60 days."))}
        ${P.saveBar("settings")}`;
    },
    after(root) {
      const save = root.querySelector("[data-action='save']");
      if (save) save.addEventListener("click", () => {
        const rem = root.querySelector("input[name='reminders']").value.split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => !isNaN(x) && x > 0).sort((a, b) => b - a);
        S.saveSettings("reconfirmation", { intervalMonths: parseInt(root.querySelector("select[name='intervalMonths']").value, 10), reminderDaysBefore: rem.length ? rem : [30, 14, 3], ownerDepartureGraceDays: parseInt(root.querySelector("input[name='ownerDepartureGraceDays']").value, 10) || 30, autoExpire: root.querySelector("input[name='autoExpire']").checked }, "Reconfirmation settings updated");
        AGC.shell.toast("Reconfirmation settings saved.", "success");
        AGC.router.refresh();
      });
    },
  };

  /* ---------- Evidence and sampling ---------- */
  P.sections.evidence = {
    render() {
      const ev = D.settings.evidence, as = D.settings.assuranceSample, dis = P.dis("evidence");
      const comps = ["Register entry and approval history", "Configuration versions active in the period", "Findings summary with rule versions", "Reviewer decisions and notes", "Review coverage snapshot", "Retention treatment and disposition evidence", "Monthly activity volumes", "Collection method per source and known gaps", "Interaction sample", "Saved search for eDiscovery production"];
      return `
        ${C.card("Evidence packages", `<p class="lead">An evidence package captures one AI system for one period as a background job with a manifest. These defaults pre-fill every request; Compliance can adjust them per package.</p>
          <div class="form-grid form-grid-3">${C.field("Interaction sample per month per system", `<input class="inp inp-num" type="number" min="5" max="500" name="sampleSize" value="${ev.sampleSize}" ${dis}/>`)}${C.field("Retain packages for", `<span class="inline-input"><input class="inp inp-num" type="number" min="1" max="15" name="retainPackagesYears" value="${ev.retainPackagesYears}" ${dis}/> years</span>`, "Packages are records in their own right.")}${C.field("Sample composition", `<div class="toggle-list">${C.toggle("stratify", ev.stratify, "Stratify by finding status: confirmed, dismissed and clean interactions in proportion", { disabled: !!dis })}</div>`)}</div>
          ${C.field("Documented sample method", `<textarea class="inp" name="sampleMethod" rows="2" ${dis}>${U.esc(ev.sampleMethod)}</textarea>`, "Printed in every manifest so an auditor can reproduce the selection.")}
          <div class="small muted" style="margin-top:12px">Components included in every package</div><ul class="check-list check-list-2col">${comps.map((c) => `<li>${I.check} ${U.esc(c)}</li>`).join("")}</ul>`)}
        ${C.card("Assurance sample", `<p class="lead">Findings only surface what the rules were written to find. An assurance sample reads a small random set of interactions that produced no finding, so misses feed back into rule changes. It is a hook in this prototype: the setting shows on each group's Policies and Coverage facet and no assurance review queue exists yet.</p>
          <div class="form-grid"><div class="toggle-list">${C.toggle("assuranceEnabled", as.enabled, "Enable a monthly assurance sample per business group", { disabled: !!dis })}</div>${C.field("Interactions per group per month", `<input class="inp inp-num" type="number" min="5" max="200" name="perGroupPerMonth" value="${as.perGroupPerMonth}" ${dis}/>`)}</div>`)}
        ${P.saveBar("settings")}`;
    },
    after(root) {
      const save = root.querySelector("[data-action='save']");
      if (save) save.addEventListener("click", () => {
        S.saveSettings("evidence", { sampleSize: parseInt(root.querySelector("input[name='sampleSize']").value, 10) || 25, retainPackagesYears: parseInt(root.querySelector("input[name='retainPackagesYears']").value, 10) || 7, stratify: root.querySelector("input[name='stratify']").checked, sampleMethod: root.querySelector("textarea[name='sampleMethod']").value.trim() }, "Evidence package defaults updated");
        S.saveSettings("assuranceSample", { enabled: root.querySelector("input[name='assuranceEnabled']").checked, perGroupPerMonth: parseInt(root.querySelector("input[name='perGroupPerMonth']").value, 10) || 25 }, "Assurance sample settings updated");
        AGC.shell.toast("Evidence and sampling settings saved.", "success");
        AGC.router.refresh();
      });
    },
  };

  /* ---------- Collection ---------- */
  P.sections.collection = {
    render() {
      const ga = D.settings.governanceApi;
      const custom = D.aiSystems.filter((s) => s.type === "Custom");
      const nomatch = D.unregisteredItems.filter((u) => u.type === "Governance API no-match" && u.status === "New");
      const unknown = D.unregisteredItems.filter((u) => u.type === "Unknown AI identity" && ["New", "Under investigation"].includes(u.status));
      return `
        ${C.card("AI platform connectors", `<p class="lead">Connectors collect from platforms that expose a compliance API. A connector's coverage is what Archive360 can verify; anything outside it is recorded as a known gap in evidence packages.</p>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Platform</th><th>Connector</th><th>Status</th><th>Coverage</th><th>Workspaces</th><th>First collected</th><th>Last sync</th><th></th></tr></thead><tbody>${D.platforms.map((pl) => { const wss = D.workspaces.filter((w) => w.platformId === pl.id); const entry = D.registerEntries.find((e) => e.level === "Platform" && e.refId === pl.id); return `<tr><td><span class="strong">${U.esc(pl.name)}</span><div class="small muted">${U.esc(pl.vendor)}${entry ? ` · register entry ${U.esc(entry.status)}` : ""}</div></td><td class="small">${U.esc(pl.connectorName)}<div class="muted">${U.esc(pl.collectionMethod)}</div></td><td>${pl.connectorStatus === "Active" ? `<span class="pill pill-ok">${I.checkCircle}<span>Active</span></span>` : `<span class="pill pill-pending">${I.clock}<span>${U.esc(pl.connectorStatus)}</span></span>`}</td><td class="small">${U.esc(pl.coverage)}</td><td class="small">${wss.map((w) => U.esc(w.name)).join("<br>")}</td><td class="small">${pl.firstCollected ? U.fmtDate(pl.firstCollected) : '<span class="muted">Not yet</span>'}</td><td class="small">${pl.lastSync ? U.relTime(pl.lastSync) : '<span class="muted">Never</span>'}</td><td class="nowrap">${pl.connectorStatus === "Active" ? `<button type="button" class="btn btn-sm" data-action="sync" data-platform="${pl.id}">Sync now</button>` : AGC.shell.permButton("settings", {}, "Activate", `data-action="activate" data-platform="${pl.id}"`, "btn-primary btn-sm")}</td></tr>`; }).join("")}</tbody></table></div>`)}
        ${C.card("Ingestion API", `<p class="lead">Custom AI systems send their activity to the Ingestion API and authenticate as a registered AI identity. An identity that matches no registration is retained and flagged in Unregistered AI, never treated as approved.</p>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Identity</th><th>AI system</th><th>Group</th><th>Owner</th><th>Registration</th><th class="num">Interactions</th><th>Last activity</th></tr></thead><tbody>${custom.map((s) => { const e = S.entryForSystem(s.id); return `<tr><td><code>${U.esc(s.externalIdentifier)}</code></td><td><a class="strong" href="#/systems/${s.id}">${U.esc(s.name)}</a></td><td>${U.esc(S.groupName(s.groupId))}</td><td>${e ? U.memberLink(S.member(e.ownerMemberId), { noAvatar: true }) : '<span class="muted">Unknown</span>'}</td><td>${e ? U.statusPill(e.status) : `<a class="pill pill-unreg" href="#/unregistered">${I.unregistered}<span>Unregistered</span></a>`}</td><td class="num">${U.fmtNum((S.interactionsBySystem[s.id] || []).length)}</td><td class="small">${U.fmtDate(s.lastActivityDate)}</td></tr>`; }).join("")}</tbody></table></div>
          ${unknown.length ? `<div class="notice notice-warn">${I.alert}<span>${unknown.length} unknown ${U.plural(unknown.length, "identity is", "identities are")} sending activity. <a href="#/unregistered">Review in Unregistered AI</a>.</span></div>` : ""}`)}
        ${C.card("Governance API", `<p class="lead">A read-only interface that lets security and AI platforms ask whether an AI identity is sanctioned, who owns it, its approval status and whether confirmed violations remain open. It never returns archived content. A lookup with no match becomes a lead in Unregistered AI.</p>
          <dl class="kv kv-wide"><dt>Status</dt><dd><span class="pill pill-ok">${I.checkCircle}<span>${U.esc(ga.status)}</span></span></dd><dt>Lookups, 30 days</dt><dd>${U.fmtNum(ga.lookups30d)} · ${ga.noMatch30d} with no match · <a href="#/unregistered">${nomatch.length} ${U.plural(nomatch.length, "lead")} open</a></dd><dt>Last lookup</dt><dd>${U.fmtDateTime(ga.lastLookup)}</dd><dt>Calling systems</dt><dd>Aegis AI Security Platform</dd><dt>API key rotated</dt><dd><span class="inline-input">${U.fmtDate(ga.keyRotated)} ${AGC.shell.permButton("settings", {}, "Rotate key", 'data-action="rotate-key"', "btn-sm")}</span></dd></dl>`)}`;
    },
    after(root) {
      root.querySelectorAll("[data-action='sync']").forEach((b) => b.addEventListener("click", () => { const pl = S.platform(b.dataset.platform); pl.lastSync = D.meta.now; AGC.shell.toast(`${U.esc(pl.name)}: sync requested. The connector runs as a background job.`, "info"); AGC.router.refresh(); }));
      root.querySelectorAll("[data-action='activate']").forEach((b) => b.addEventListener("click", () => {
        const pl = S.platform(b.dataset.platform);
        if (!confirm(`Activate ${pl.connectorName}?\n\nCollection begins with the next scheduled run. The platform's register entry still needs an approver's decision before its use is sanctioned.`)) return;
        S.activateConnector(pl.id);
        AGC.shell.toast(`${U.esc(pl.connectorName)} activated.`, "success");
        AGC.router.refresh();
      }));
      root.querySelectorAll("[data-action='rotate-key']").forEach((b) => b.addEventListener("click", () => {
        D.settings.governanceApi.keyRotated = U.today();
        S.logAudit({ category: "Configuration", eventType: "Governance API key rotated", refType: "settings", refId: "governanceApi", summary: "Governance API key rotated" });
        AGC.shell.toast("Governance API key rotated. Calling systems must update within 7 days.", "success");
        AGC.router.refresh();
      }));
    },
  };

  /* ---------- Readiness check (Version 1; renamed from Roles and coverage): read-only ----------
     Owners come from the Business Groups page. Who may review or approve comes from Archive360 Profiles and Entitlement Policies,
     managed in Administration; this page derives coverage from them and reports gaps with the place to fix each one. */
  (AGC.personaHooks = AGC.personaHooks || []).push(() => { AGC.state.ui.readyTile = "all"; });
  P.sections.access = {
    render() {
      const ui = AGC.state.ui; if (!ui.readyTile) ui.readyTile = "all";
      const groups = S.groupsOrdered();
      /* The one customer-wide gap, too few approvers, is a warning strip shown only when it exists (Gabriel, 2026-10-02); the page-level
         "Manage in Administration" button went the same day, because every gap carries its own fix. */
      const approvers = S.sortMembers(D.members.filter((m) => m.memberStatus === "Active" && m.sourceSystem !== "Archive360 local account" && S.byId.profile[m.profileId] && S.byId.profile[m.profileId].features.includes("approve")));
      const required = Math.max.apply(null, Object.values(D.settings.approvals.requiredBySeverity));
      const approverStrip = approvers.length < required ? `<div class="notice notice-warn">${I.alert}<span><strong>${approvers.length ? `Only ${approvers.length} ${U.plural(approvers.length, "approver")}` : "No approvers"}.</strong> An escalation of a Critical finding requires ${required} approvals, so one could not be decided${approvers.length ? `: ${approvers.map((m) => U.esc(m.displayName)).join(", ")}` : ""}. <button type="button" class="link-btn" data-action="open-admin">Add approvers in Administration.</button></span></div>` : "";
      const rows = groups.map((g) => {
        const owner = S.member(g.ownerMemberId), cov = S.coverage(g.id), pols = D.entitlementPolicies.filter((ep) => ep.groupIds.includes(g.id));
        const gaps = [];
        if (!owner) gaps.push({ kind: "owner", text: "No accountable owner.", fix: `<a href="#/settings/groups">Name one on the Business Groups page.</a>` });
        else if (!U.isActive(owner)) gaps.push({ kind: "owner", text: `Owner ${U.statusWord(owner)}.`, fix: `<a href="#/settings/groups">Name a new owner on the Business Groups page.</a>` });
        if (!cov.length) gaps.push({ kind: "reviewer", text: pols.length ? `No reviewer has access: the Archive360 Entitlement ${U.plural(pols.length, "Policy", "Policies")} ${pols.map((p) => `“${U.esc(p.name)}”`).join(" and ")} ${pols.length === 1 ? "is" : "are"} assigned to nobody who can review.` : "No Archive360 Entitlement Policy covers this group.", fix: `<button type="button" class="link-btn" data-action="open-admin">Fix in Administration.</button>` });
        return { g, owner, cov, pols, gaps };
      });
      const ready = rows.filter((r) => !r.gaps.length).length;
      const reviewerGaps = rows.filter((r) => r.gaps.some((x) => x.kind === "reviewer")), ownerGaps = rows.filter((r) => r.gaps.some((x) => x.kind === "owner"));
      /* Tiles are the only filter, as on every list page (Option A, Gabriel, 2026-10-02): the four about the groups in the table. All, or the
         selected tile again, resets. The two customer-wide facts, approvers and AI systems not archived, sit in their own card below. */
      const tiles = [["all", "All groups", rows.length, ""], ["ready", "Ready", ready, "ok"], ["reviewer", "No reviewer has access", reviewerGaps.length, reviewerGaps.length ? "gap" : "ok"], ["owner", "No active owner", ownerGaps.length, ownerGaps.length ? "gap" : "ok"]];
      const strip = `<div class="ready-strip">${tiles.map(([k, l, n, cls]) => `<button type="button" class="ready-tile tile-btn${cls ? " " + cls : ""}${ui.readyTile === k ? " active" : ""}" data-action="ready-tile" data-tile="${k}" aria-pressed="${ui.readyTile === k}"><div class="ready-val">${U.fmtNum(n)}</div><div class="ready-label">${U.esc(l)}</div></button>`).join("")}</div>`;
      const shown = rows.filter((r) => ui.readyTile === "all" || (ui.readyTile === "ready" ? !r.gaps.length : r.gaps.some((x) => x.kind === ui.readyTile)));
      const attrPlural = `${S.attributeOption(D.mapping.sourceAttribute).label.toLowerCase()}s`;
      const table = `<div class="tbl-wrap"><table class="tbl tbl-cov"><thead><tr><th>Business group</th><th>Accountable owner</th><th>Reviewers with access to its activity</th><th>Readiness</th><th>Reason</th></tr></thead><tbody>${shown.length ? shown.map((r) => `<tr class="${r.gaps.length ? "row-gap" : ""}">
          <td><a class="strong" href="#/groups/${r.g.id}">${U.esc(r.g.name)}</a><div class="small muted">${U.fmtNum((S.membersByGroup[r.g.id] || []).filter((m) => m.memberStatus === "Active").length)} active members · ${U.fmtNum(S.groupMappedValues(r.g.id).length)} ${U.esc(S.groupMappedValues(r.g.id).length === 1 ? attrPlural.slice(0, -1) : attrPlural)}</div></td>
          <td>${r.owner ? `<div class="owner-cell">${U.avatar(r.owner, "sm")}<div><div>${U.esc(r.owner.displayName)}${U.statusTag(r.owner)}</div><div class="small muted">${U.esc(r.owner.jobTitle || "")}</div></div></div>` : '<span class="danger-text">No owner</span>'}</td>
          <td>${r.cov.length ? r.cov.map((c) => U.esc(c.member.displayName)).join(", ") : '<span class="danger-text">Nobody</span>'}</td>
          <td>${r.gaps.length ? `<span class="pill pill-danger">${I.alert}<span>Not ready</span></span>` : `<span class="pill pill-ok">${I.checkCircle}<span>Ready</span></span>`}</td>
          <td class="small">${r.gaps.length ? r.gaps.map((x) => `<div class="reason-line"><div>${x.text}</div><div>${x.fix}</div></div>`).join("") : '<span class="muted">—</span>'}</td>
        </tr>`).join("") : `<tr><td colspan="5">${C.emptyState(ui.readyTile === "ready" ? "No group is ready" : "No group has this gap", "Choose another tile, or All groups.")}</td></tr>`}</tbody></table></div>`;
      return `<div class="page-head"><p class="lead lead-wide">Before governance can run, make sure the right people are in place. A Business Group is ready when it has an active, accountable owner and at least one reviewer who has permission to view its AI activity. Business Group owners are assigned on the <a href="#/settings/groups">Business Groups</a> page. Archive360 Profiles and Entitlement Policies determine reviewer and approver access.</p></div>
        ${strip}
        ${approverStrip}
        ${C.card(`Readiness by business group${ui.readyTile === "all" ? "" : ` <span class="count-badge">${shown.length}</span>`}`, table)}`;
    },
    after(root) {
      root.querySelectorAll("[data-action='open-admin']").forEach((b) => b.addEventListener("click", () => AGC.shell.toast("Opens the Administration application: Profiles and Entitlement Policies. Not part of this prototype.", "info")));
      root.querySelectorAll("[data-action='ready-tile']").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.tile, ui = AGC.state.ui; ui.readyTile = k === "all" || k === ui.readyTile ? "all" : k; AGC.router.refresh(); }));
    },
  };
})();
