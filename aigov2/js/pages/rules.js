/* AI Policy Rules (agreed with Gabriel on 2026-09-28): the rulebook a compliance reader can defend, its tuning history, and how each rule
   performs. Two views: Rules, every rule with its sensitive data, where it is permitted, its severity, its basis and its findings, and
   Permitted data by business group, one matrix derived from the active rules and never edited directly. A rule page carries the rule,
   its performance, the reviewers' flags and its versions. Every change publishes a version at once and is audited; what a rule detects is
   set when it is created and never changes afterwards, so a version always means the same detection tuned differently. Readable by
   every governance role; changed by Compliance and the Administrator (the rules feature). */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.rules = {});
  const SP = () => AGC.pages.settings;
  const TILES = [["all", "All rules"], ["flagged", "Flagged by reviewers"], ["inactive", "Inactive"]];
  const SEVS = ["Critical", "High", "Medium", "Low"];
  const FAMILIES = ["Purpose scope", "Absolute prohibition", "Unsanctioned system", "Preservation", "Fair treatment", "Consumer protection", "Bulk exposure", "Confidential business"];
  /* Where a conditional rule permits its sensitive data: wherever its own condition holds. */
  const CONDITION = { "Unsanctioned system": "Only in a registered AI system", "Preservation": "Not while the content is under legal hold", "Fair treatment": "Only with a suitability review", "Consumer protection": "Only with principal review", "Bulk exposure": "Not in bulk", "Confidential business": "Only within the validated purpose" };
  const DAYS = 90;
  const fresh = () => ({ view: "rules", tile: "all", family: "all", group: "all", search: "" });
  let ui = fresh();
  P.ui = () => ui;
  (AGC.personaHooks = AGC.personaHooks || []).push(() => { ui = fresh(); });
  const perm = () => S.permission("rules");
  const badge = (r) => `<span class="type-ic rule-ic" title="${U.esc(r.family)}">${I.rules}</span>`;
  const statusPill = (r) => (r.status === "Active" ? `<span class="pill pill-ok">${I.checkCircle}<span>Active</span></span>` : `<span class="pill pill-muted">${I.pause}<span>Inactive</span></span>`);
  const lastVersion = (r) => r.versions[r.versions.length - 1];
  const whereText = (r) => { const k = S.ruleKind(r); if (k === "absolute") return "Nowhere: prohibited everywhere"; if (k === "scope") return r.permittedGroupIds.map((g) => S.groupName(g)).join(", "); return CONDITION[r.family] || "Everywhere, unless the rule's condition applies"; };
  /* The sensitive data by its full name wherever there is room (Gabriel, 2026-10-06: Comms, Investig. and CBI meant nothing); the matrix alone keeps the short names, with the full name on hover. */
  const dcChips = (r) => r.dataClassIds.map((id) => S.dataClass(id)).filter(Boolean).map((d) => `<span class="chip chip-muted" title="${U.esc(d.examples || d.name)}">${U.esc(d.name)}</span>`).join(" ");
  const inTile = (r, k) => k === "all" || (k === "flagged" && S.openRuleFlags(r).length > 0) || (k === "inactive" && r.status !== "Active");
  const canSee = () => { const p = S.persona(); return !!p && p.profile.features.length > 0; };
  const notAvailable = () => `<div class="placeholder-card"><div class="ph-title">${I.lock} AI Policy Rules are not available for your profile</div><div class="ph-body">Reading the rules needs a governance role; changing them needs a Profile that includes AI Policy Rule administration, managed by an Archive360 Administrator.</div></div>`;

  /* ---------- Actions per rule, following the persona and the rule's history ---------- */
  function actionsFor(r) {
    const item = (action, icon, label, o) => SP().menuItem(Object.assign({ attr: "data-rule-action", action, id: r.id, icon, label }, o || {}));
    const p = perm(), why = p.allowed ? null : p.reason, n = S.ruleFindings(r).length;
    const menu = [item("view", "coverage", "View"), item("edit", "settings", "Edit rule…", { disabledReason: why })];
    menu.push(r.status === "Active" ? item("deactivate", "pause", "Deactivate…", { disabledReason: why }) : item("activate", "check", "Activate…", { disabledReason: why }));
    menu.push(item("delete", "trash", "Delete…", { cls: "menu-danger", disabledReason: why || (n ? `This rule has ${U.fmtNum(n)} ${U.plural(n, "finding")}; deactivate it instead.` : null) }));
    return `<div class="group-card-actions group-card-actions--grid"><button type="button" class="group-card-actions-btn" data-menu-toggle="rule-${r.id}" aria-haspopup="true">Actions <span class="group-card-actions-caret">&#9660;</span></button><div class="group-card-actions-menu menu-pop" id="menu-actions-rule-${r.id}" role="menu" hidden>${menu.join("")}</div></div>`;
  }

  /* ---------- The rulebook ---------- */
  const words = (r) => `${r.name} ${r.family} ${r.regulatoryBasis.join(" ")} ${r.basisDetail || ""} ${r.dataClassIds.map((id) => S.dcName(id)).join(" ")} ${whereText(r)}`;
  function matches(r) {
    if (!inTile(r, ui.tile)) return false;
    if (ui.family !== "all" && r.family !== ui.family) return false;
    if (ui.group !== "all" && !S.rulesForGroup(ui.group).includes(r)) return false;
    if (ui.search && !words(r).toLowerCase().includes(ui.search.toLowerCase())) return false;
    return true;
  }
  function ruleRow(r) {
    const st = S.ruleStats(r, DAYS), flags = S.openRuleFlags(r).length, decided = st.confirmed + st.dismissed, share = decided ? Math.round(100 * st.dismissed / decided) : null;
    return `<tr class="${r.status === "Active" ? "" : "row-dim"}">
      <td><div class="cell-with-badge">${badge(r)}<div class="cell-main"><span class="strong">${U.esc(r.name)}</span>${flags ? ` <span class="tag tag-warn" title="${flags} open ${U.plural(flags, "flag")} from reviewers">Flagged</span>` : ""}${r.status !== "Active" ? ' <span class="tag">Inactive</span>' : ""}<div class="small muted">${U.esc(r.family)} · version ${U.esc(r.currentVersion)} since ${U.fmtDate(lastVersion(r).effectiveDate)}</div></div></div></td>
      <td>${dcChips(r)}</td>
      <td class="small">${U.esc(whereText(r))}</td>
      <td>${U.sevChip(r.defaultSeverity)}</td>
      <td class="small">${r.regulatoryBasis.map(U.esc).join(", ")}<div class="small muted">${U.esc(r.basisDetail || "")}</div></td>
      <td>${U.fmtNum(st.total)}<div class="small muted">${st.confirmed} confirmed ${U.plural(st.confirmed, "violation")} · ${st.dismissed} dismissed${share !== null ? ` (${share}%)` : ""} · ${st.awaiting} awaiting review${st.topDismiss ? `<br/>Dismissed mostly as ${U.esc(st.topDismiss.toLowerCase())}` : ""}</div></td>
      <td>${actionsFor(r)}</td>
    </tr>`;
  }
  function rulesHtml(all) {
    const shown = all.filter(matches).sort((a, b) => FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family) || a.name.localeCompare(b.name));
    const body = shown.length ? `<table class="grid rules-grid"><thead><tr><th>Rule</th><th>Sensitive data detected</th><th>Where permitted</th><th>Severity</th><th>Regulatory basis</th><th>Findings, last ${DAYS} days</th><th>Actions</th></tr></thead><tbody>${shown.map(ruleRow).join("")}</tbody></table>` : `<div class="empty-state"><div class="empty-title">${all.length ? "Nothing matches. Choose another tile, or clear the filters." : "No rules yet."}</div></div>`;
    return C.card("Rules", body + `<p class="small muted">Findings keep the version of the rule they were evaluated under; a change to a rule never rewrites them.</p>`);
  }

  /* ---------- Permitted data by business group: one matrix derived from the active rules ---------- */
  function matrixHtml() {
    const groups = S.groupsOrdered(), classes = D.dataClasses, M = S.ruleMatrix();
    const rows = groups.map((g) => `<tr><th class="mx-group"><a href="#/groups/${g.id}">${U.esc(g.name)}</a></th>${classes.map((dc) => { const c = M[g.id][dc.id]; return `<td class="mx-cell"><span class="mx-pill mx-${c.key}" title="${U.esc(c.title)}">${U.esc(c.label)}</span></td>`; }).join("")}</tr>`).join("");
    const legend = [["ok", "Permitted", "a rule names this group"], ["no", "Not permitted", "a rule names other groups"], ["prohibited", "Prohibited", "prohibited everywhere"], ["cond", "Conditional", "permitted only when the rule's condition holds"], ["none", "No rule", "no active rule detects it"]].map(([k, l, t]) => `<span class="mx-legend-item"><span class="mx-pill mx-${k}">${l}</span><span class="small muted">${t}</span></span>`).join("");
    return C.card("Permitted sensitive data by business group", `<p class="small muted">Derived from the active rules and never edited here: change a rule and the matrix follows. Hover a cell for the rules behind it.</p><table class="grid mx-table"><thead><tr><th>Business group</th>${classes.map((dc) => `<th title="${U.esc(dc.name)}">${U.esc(dc.short)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table><div class="mx-legend">${legend}</div>`);
  }

  P.render = function (view) {
    if (view && view !== ui.view) { ui.view = view; }
    const nav = AGC.shell.navMeta("rules");
    if (!canSee()) { AGC.shell.render({ kind: "list", navKey: "rules", title: nav.title, description: nav.description, icon: "rules", html: notAvailable() }); return; }
    const all = D.rules.slice(), rules = ui.view === "rules";
    const tiles = `<div class="ready-strip ready-strip-3">${TILES.map(([k, l]) => { const n = all.filter((r) => inTile(r, k)).length; return `<button type="button" class="ready-tile tile-btn${ui.tile === k ? " active" : ""}${k === "flagged" && n ? " gap" : ""}" data-action="rule-tile" data-tile="${k}" aria-pressed="${ui.tile === k}"><div class="ready-val">${U.fmtNum(n)}</div><div class="ready-label">${U.esc(l)}</div></button>`; }).join("")}</div>`;
    const p = perm();
    const create = p.allowed ? `<button type="button" class="btn btn-primary btn-sm" data-action="rule-create">${I.rules} Create rule</button>` : `<span class="btn-disabled-wrap"><button type="button" class="btn btn-primary btn-sm is-disabled" disabled>${I.rules} Create rule</button><span class="btn-reason">${U.esc(p.reason)}</span></span>`;
    const toolbar = `<div class="toolbar reg-toolbar">
        <div class="filter-chips">${[["rules", `Rules <span class="count-badge">${all.length}</span>`], ["matrix", "Permitted data by business group"]].map(([k, l]) => `<button type="button" class="fchip${ui.view === k ? " active" : ""}" data-action="rule-view" data-view="${k}">${l}</button>`).join("")}</div>
        ${rules ? C.select("ruleFamily", [{ value: "all", label: "All families" }].concat(FAMILIES.map((f) => ({ value: f, label: f }))), ui.family) : ""}
        ${rules ? C.select("ruleGroup", [{ value: "all", label: "All business groups" }].concat(S.groupsOrdered().map((g) => ({ value: g.id, label: `Rules that apply to ${g.name}` }))), ui.group) : ""}
        ${rules ? `<input type="search" id="ruleSearch" class="inp toolbar-search" placeholder="Search rules, sensitive data, groups or the regulatory basis" value="${U.esc(ui.search)}"/>` : ""}
        <span class="toolbar-spacer"></span>
        <button type="button" class="btn btn-sm" data-action="rule-export">${I.list} Export</button>
        ${create}
      </div>`;
    AGC.shell.render({ kind: "list", navKey: "rules", title: nav.title, description: nav.description, icon: "rules", html: `${rules ? tiles : ""}${toolbar}${rules ? rulesHtml(all) : matrixHtml()}`, after: P.after });
  };

  /* ---------- The rule page ---------- */
  function statsRows(r) {
    const s90 = S.ruleStats(r, DAYS), sAll = S.ruleStats(r, null);
    const line = (s) => `${U.fmtNum(s.total)} ${U.plural(s.total, "finding")} · ${s.confirmed} confirmed ${U.plural(s.confirmed, "violation")} · ${s.dismissed} dismissed · ${s.awaiting} awaiting review${s.reasons.length ? `<div class="small muted">Dismissed as ${s.reasons.map(([k, n]) => `${U.esc(k.toLowerCase())} ×${n}`).join(", ")}</div>` : ""}`;
    const groups = sAll.byGroup.slice(0, 3).map(([gid, n]) => `<a href="#/groups/${gid}">${U.esc(S.groupName(gid))}</a> ${n}`).join(" · ");
    const permitted = S.ruleKind(r) === "scope" ? `<dt>Permitted detections</dt><dd>${U.fmtNum(s90.permitted)} in the last ${DAYS} days, ${U.fmtNum(sAll.permitted)} since the rule began<div class="small muted">Detections of this sensitive data inside the groups the rule permits: seen, counted and let through with no finding.</div></dd>` : "";
    return `<dl class="kv kv-wide kv-detail">
      <dt>Last ${DAYS} days</dt><dd>${line(s90)}</dd>
      <dt>Since the rule began</dt><dd>${line(sAll)}</dd>
      <dt>Fires most in</dt><dd>${groups || '<span class="muted">No findings yet</span>'}</dd>
      ${permitted}
    </dl>`;
  }
  function flagsHtml(r) {
    const open = S.openRuleFlags(r), done = (r.flaggedForReview || []).filter((f) => f.resolution), p = perm();
    const li = (f) => { const by = S.member(f.byMemberId), fnd = S.finding(f.findingId); return `<li><span class="strong">${by ? U.esc(by.displayName) : "A reviewer"}</span> · ${U.fmtDate(f.date)}${f.note ? `: ${U.esc(f.note)}` : ""}${fnd ? ` · <a href="#/findings/all/${fnd.findingId}">Open the finding</a> (${U.esc(fnd.status === "Detected" ? "awaiting review" : fnd.status === "Confirmed" ? "confirmed violation" : fnd.status.toLowerCase())})` : ""}${f.resolution ? `<div class="small muted">${f.resolution.kind === "version" ? `Answered by version ${U.esc(f.resolution.version)} on ${U.fmtDate(f.resolution.date)}` : `Reviewed on ${U.fmtDate(f.resolution.date)}, kept as it is`}${f.resolution.note ? `: ${U.esc(f.resolution.note)}` : ""}</div>` : ""}</li>`; };
    const actions = open.length ? (p.allowed ? `<div class="btn-row"><button type="button" class="btn btn-primary" data-rule-action="edit" data-id="${r.id}">${I.settings} Change the rule…</button><button type="button" class="btn btn-secondary" data-rule-action="keep" data-id="${r.id}">${I.check} Keep it as it is…</button></div>` : `<div class="notice notice-warn">${I.lock}<span>${U.esc(p.reason)} The flags wait for Compliance.</span></div>`) : "";
    const body = `${open.length ? `<p class="small">A reviewer flags a rule from the review screen when the rule, not the person, seems wrong. ${open.length === 1 ? "One flag is" : `${open.length} flags are`} open: answer ${open.length === 1 ? "it" : "them"} by changing the rule, which publishes a version, or by keeping it as it is with a note.</p><ul class="plain-list fq-hist">${open.map(li).join("")}</ul>${actions}` : '<p class="small muted">No open flag. A reviewer flags a rule from the review screen when the rule, not the person, seems wrong.</p>'}${done.length ? `<h4 class="fq-sub">Answered</h4><ul class="plain-list fq-hist">${done.map(li).join("")}</ul>` : ""}`;
    return C.card(`Flagged by reviewers${open.length ? ` <span class="count-badge">${open.length}</span>` : ""}`, body, { cls: open.length && p.allowed ? "fq-decision fq-decision-open" : "" });
  }
  function versionsHtml(r) {
    const li = r.versions.slice().reverse().map((v) => { const by = S.member(v.changedByMemberId); return `<li><span class="strong">Version ${U.esc(v.version)}</span> · ${U.fmtDate(v.effectiveDate)}${by ? ` · ${U.esc(by.displayName)}` : ""}<div class="small muted">${U.esc(v.changeNote || "")}${v.changed && v.changed.length ? ` (${v.changed.map(U.esc).join(", ")})` : ""}</div></li>`; }).join("");
    const status = (r.statusHistory || []).slice().reverse().map((h) => { const by = S.member(h.byMemberId); return `<li><span class="strong">${h.status === "Active" ? "Activated" : "Deactivated"}</span> · ${U.fmtDate(h.date)}${by ? ` · ${U.esc(by.displayName)}` : ""}<div class="small muted">${U.esc(h.reason || "")}</div></li>`; }).join("");
    return C.card("Versions", `<p class="small muted">Findings keep the version they were evaluated under; a new version applies from its effective date.</p><ul class="plain-list fq-hist">${status}${li}</ul>`);
  }
  P.rule = function (id) {
    const r = S.rule(id);
    if (!r) { AGC.router.navigate("#/rules"); return; }
    if (!canSee()) { AGC.shell.render({ kind: "list", navKey: "rules", title: "AI Policy Rule", description: "", icon: "rules", html: notAvailable() }); return; }
    const owner = S.member(r.ownerMemberId), last = lastVersion(r), p = perm(), n = S.ruleFindings(r).length, kind = S.ruleKind(r);
    const sentence = `${U.esc(r.family)} · ${U.esc(r.defaultSeverity)} by default · ${r.regulatoryBasis.map(U.esc).join(", ")}${r.basisDetail ? `: ${U.esc(r.basisDetail)}` : ""}. Version ${U.esc(r.currentVersion)} in force since ${U.fmtDate(last.effectiveDate)}${owner ? `, owned by ${U.esc(owner.displayName)}` : ""}.${r.status !== "Active" ? ` Inactive${r.statusChangedAt ? ` since ${U.fmtDate(r.statusChangedAt)}` : ""}: it produces no new findings.` : ""}`;
    const btn = (action, label, icon, cls, reason) => (!reason ? `<button type="button" class="btn ${cls}" data-rule-action="${action}" data-id="${r.id}">${icon} ${label}</button>` : `<span class="btn-disabled-wrap"><button type="button" class="btn ${cls} is-disabled" disabled>${icon} ${label}</button><span class="btn-reason">${U.esc(reason)}</span></span>`);
    const why = p.allowed ? null : p.reason;
    const actions = [btn("edit", "Edit rule…", I.settings, "btn-primary", why), r.status === "Active" ? btn("deactivate", "Deactivate…", I.pause, "btn-secondary", why) : btn("activate", "Activate…", I.check, "btn-secondary", why), btn("delete", "Delete…", I.trash, "btn-secondary", why || (n ? `This rule has ${U.fmtNum(n)} ${U.plural(n, "finding")}; deactivate it instead.` : null))].join("");
    const ruleCard = C.card("Rule", `<dl class="kv kv-wide kv-detail">
        <dt>Sensitive data detected</dt><dd>${dcChips(r)}<div class="small muted">Set when the rule was created; a rule that must detect something else is a new rule.</div></dd>
        <dt>Where permitted</dt><dd>${U.esc(whereText(r))}${kind === "scope" ? '<div class="small muted">Anywhere else, a detection is a finding.</div>' : kind === "absolute" ? '<div class="small muted">Every detection is a finding, whatever the group.</div>' : '<div class="small muted">A detection is a finding only when the condition fails.</div>'}</dd>
        <dt>Looks at</dt><dd>The person's prompts, the AI's responses, files attached to a prompt, an AI asset's knowledge files and content an app retrieved.</dd>
        <dt>Default severity</dt><dd>${U.sevChip(r.defaultSeverity)}<div class="small muted">A reviewer may change it on a finding, with a reason.</div></dd>
        <dt>Regulatory basis</dt><dd>${r.regulatoryBasis.map(U.esc).join(", ")}${r.basisDetail ? `<div class="small muted">${U.esc(r.basisDetail)}</div>` : ""}</dd>
        <dt>Remediation guidance</dt><dd>${U.esc(r.remediationGuidance || "")}<div class="small muted">Pre-filled into an escalation's proposed remediation.</div></dd>
        <dt>Owner</dt><dd>${owner ? `<a href="#/members/${owner.memberId}">${U.esc(owner.displayName)}</a>${U.statusTag(owner)}` : '<span class="muted">Unassigned</span>'}</dd>
      </dl><div class="btn-row">${actions}</div>`);
    const html = `<div class="two-col"><div class="col-main">${ruleCard}${C.card("Performance", statsRows(r))}</div><div>${flagsHtml(r)}${versionsHtml(r)}</div></div>`;
    const bc = C.originCrumbs({ label: r.name, href: `#/rules/${r.id}` }, { nav: "rules", crumbs: [{ label: "AI Policy Rules", href: "#/rules" }, { label: r.name, href: `#/rules/${r.id}` }] });
    AGC.shell.render({ kind: "item", navKey: bc.nav || "rules", title: r.name, breadcrumb: bc.crumbs, item: { badgeHtml: badge(r), name: r.name, statusHtml: statusPill(r), sentence }, html, after: P.after });
  };

  /* ---------- Dialogs ---------- */
  const groupChecks = (name, chosen) => `<div class="chips chips-select">${S.groupsOrdered().map((g) => `<label class="chip chip-check"><input type="checkbox" name="${name}" value="${g.id}" ${chosen.includes(g.id) ? "checked" : ""}/>${U.esc(g.name)}</label>`).join("")}</div>`;
  const basisChecks = (chosen) => `<div class="chips chips-select">${D.regulatoryBases.map((b) => `<label class="chip chip-check"><input type="checkbox" name="basis" value="${U.esc(b)}" ${chosen.includes(b) ? "checked" : ""}/>${U.esc(b)}</label>`).join("")}</div>`;
  const checked = (wrap, name) => [...wrap.querySelectorAll(`input[name='${name}']:checked`)].map((i) => i.value);
  const val = (wrap, name) => { const el = wrap.querySelector(`[name='${name}']`); return el ? String(el.value).trim() : ""; };
  P.editDialog = function (r) {
    const kind = S.ruleKind(r), open = S.openRuleFlags(r).length;
    C.modal({ title: `Edit ${U.esc(r.name)}`, size: "modal-lg", body: `<p>Saving publishes version ${U.esc(S.nextRuleVersion(r))}, effective today. Findings already decided keep version ${U.esc(r.currentVersion)}.${open ? ` The ${open === 1 ? "open flag is" : `${open} open flags are`} answered by the new version.` : ""}</p>
        ${C.field("Name", `<input class="inp" name="name" value="${U.esc(r.name)}"/>`)}
        ${C.field("Sensitive data detected", dcChips(r), "Set when the rule was created. A rule that must detect something else is a new rule.")}
        ${kind === "scope" ? C.field("Where permitted", groupChecks("groups", r.permittedGroupIds), "Required. Anywhere else, a detection is a finding.") : ""}
        ${C.field("Default severity", C.select("severity", SEVS.map((s) => ({ value: s, label: s })), r.defaultSeverity))}
        ${C.field("Regulatory basis", basisChecks(r.regulatoryBasis), "Required. One or more of the five bases the module uses.")}
        ${C.field("Basis detail", `<input class="inp" name="basisDetail" value="${U.esc(r.basisDetail || "")}" placeholder="The rule, requirement or standard behind it"/>`)}
        ${C.field("Remediation guidance", `<textarea class="inp" name="guidance" rows="3">${U.esc(r.remediationGuidance || "")}</textarea>`, "Pre-filled into an escalation's proposed remediation.")}
        ${C.field("Change note", `<textarea class="inp" name="note" rows="2" placeholder="Required. What changed and why; recorded on the version and in Audit History."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-save">${I.check} Publish version ${U.esc(S.nextRuleVersion(r))}</button>`,
      onOpen(wrap) {
        const missing = () => { if (!val(wrap, "name")) return "Name the rule."; if (kind === "scope" && !checked(wrap, "groups").length) return "Choose at least one business group."; if (!checked(wrap, "basis").length) return "Choose a regulatory basis."; if (!val(wrap, "note")) return "Enter the change note first."; return ""; };
        C.guard(wrap, () => !missing(), missing, "[data-action='do-save']");
        wrap.querySelector("[data-action='do-save']").addEventListener("click", () => {
          if (missing()) return;
          const v = S.publishRuleVersion(r.id, { name: val(wrap, "name"), permittedGroupIds: kind === "scope" ? checked(wrap, "groups") : undefined, defaultSeverity: val(wrap, "severity"), regulatoryBasis: checked(wrap, "basis"), basisDetail: val(wrap, "basisDetail"), remediationGuidance: val(wrap, "guidance") }, val(wrap, "note"));
          C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`Version ${U.esc(v.currentVersion)} of ${U.esc(v.name)} published. Recorded in Audit History.`, "success"), 30);
        });
      } });
  };
  P.createWizard = function () {
    const st = { step: 1, name: "", kind: "scope", dcs: [], groups: [], severity: "High", basis: [], basisDetail: "", guidance: "" };
    const steps = ["Rule", "Summary and Commit"];
    const stepsHtml = () => `<ol class="wizard-steps">${steps.map((s, i) => `<li class="wstep${st.step === i + 1 ? " active" : st.step > i + 1 ? " done" : ""}"><span class="wstep-num">${st.step > i + 1 ? I.check : i + 1}</span><span>Step ${i + 1}. ${s}</span></li>`).join("")}</ol>`;
    const body = () => {
      if (st.step === 1) return `${stepsHtml()}<div class="notice notice-info">${I.info}<span>A rule joins what classification detects with where it is permitted. Every detection outside that scope becomes a finding for a reviewer, under this rule's severity and guidance.</span></div>
        ${C.field("Name", `<input class="inp" name="name" value="${U.esc(st.name)}" placeholder="Required. Say what is not allowed, and where: for example Vendor contracts outside Procurement and Legal"/>`)}
        ${C.field("Kind of rule", `<label class="qf-opt"><input type="radio" name="kind" value="scope"${st.kind === "scope" ? " checked" : ""}/> Permitted only in the business groups named below</label><label class="qf-opt"><input type="radio" name="kind" value="absolute"${st.kind === "absolute" ? " checked" : ""}/> Prohibited everywhere</label>`)}
        ${C.field("Sensitive data detected", `<div class="chips chips-select">${D.dataClasses.map((dc) => `<label class="chip chip-check" title="${U.esc(dc.examples || dc.name)}"><input type="checkbox" name="dc" value="${dc.id}" ${st.dcs.includes(dc.id) ? "checked" : ""}/>${U.esc(dc.name)}</label>`).join("")}</div>`, "Required. What classification finds in prompts, responses, files, knowledge files and content an app retrieved. It cannot be changed once the rule exists.")}
        <div data-scope-only${st.kind === "scope" ? "" : " hidden"}>${C.field("Where permitted", groupChecks("groups", st.groups), "Required for this kind of rule. Anywhere else, a detection is a finding.")}</div>
        ${C.field("Default severity", C.select("severity", SEVS.map((s) => ({ value: s, label: s })), st.severity), "A reviewer may change it on a finding, with a reason.")}
        ${C.field("Regulatory basis", basisChecks(st.basis), "Required. One or more of the five bases the module uses.")}
        ${C.field("Basis detail", `<input class="inp" name="basisDetail" value="${U.esc(st.basisDetail)}" placeholder="The rule, requirement or standard behind it"/>`)}
        ${C.field("Remediation guidance", `<textarea class="inp" name="guidance" rows="3" placeholder="Required. What must change when this rule is broken; pre-filled into an escalation.">${U.esc(st.guidance)}</textarea>`)}`;
      const dcs = st.dcs.map((id) => S.dcName(id)).join(", "), where = st.kind === "absolute" ? "Nowhere: prohibited everywhere" : st.groups.map((g) => S.groupName(g)).join(", ");
      return `${stepsHtml()}<dl class="kv kv-wide kv-detail">
        <dt>Name</dt><dd>${U.esc(st.name)}</dd>
        <dt>Kind of rule</dt><dd>${st.kind === "absolute" ? "Absolute prohibition" : "Purpose scope"}</dd>
        <dt>Sensitive data detected</dt><dd>${U.esc(dcs)}</dd>
        <dt>Where permitted</dt><dd>${U.esc(where)}</dd>
        <dt>Default severity</dt><dd>${U.sevChip(st.severity)}</dd>
        <dt>Regulatory basis</dt><dd>${st.basis.map(U.esc).join(", ")}${st.basisDetail ? `<div class="small muted">${U.esc(st.basisDetail)}</div>` : ""}</dd>
        <dt>Remediation guidance</dt><dd>${U.esc(st.guidance)}</dd>
      </dl><div class="notice notice-info">${I.info}<span>Saved as version 1.0, active today, owned by you, and recorded in Audit History. It applies to interactions from now on; nothing already reviewed changes.</span></div>`;
    };
    const footer = () => `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>${st.step > 1 ? `<button type="button" class="btn btn-secondary" data-wz="back">Back</button>` : ""}${st.step < 2 ? `<button type="button" class="btn btn-primary" data-wz="next">Next</button>` : `<button type="button" class="btn btn-primary" data-wz="save">${I.check} Save and Close</button>`}`;
    const capture = (wrap) => { if (st.step !== 1) return; st.name = val(wrap, "name"); st.kind = (wrap.querySelector("[name='kind']:checked") || {}).value || "scope"; st.dcs = checked(wrap, "dc"); st.groups = checked(wrap, "groups"); st.severity = val(wrap, "severity"); st.basis = checked(wrap, "basis"); st.basisDetail = val(wrap, "basisDetail"); st.guidance = val(wrap, "guidance"); };
    const missing = () => { if (!st.name) return "Name the rule."; if (!st.dcs.length) return "Choose the sensitive data it detects."; if (st.kind === "scope" && !st.groups.length) return "Choose where it is permitted."; if (!st.basis.length) return "Choose a regulatory basis."; if (!st.guidance) return "Write the remediation guidance."; return ""; };
    const paint = (wrap) => {
      wrap.querySelector(".modal-body").innerHTML = body(); wrap.querySelector(".modal-foot").innerHTML = footer(); C.placeModal(wrap);
      if (st.step === 1) C.guard(wrap, () => { capture(wrap); return !missing(); }, () => { capture(wrap); return missing(); }, "[data-wz='next']");
      wrap.querySelectorAll("[data-wz]").forEach((b) => b.addEventListener("click", () => {
        capture(wrap);
        if (b.dataset.wz === "next") { if (missing()) return; st.step = 2; paint(wrap); }
        else if (b.dataset.wz === "back") { st.step = 1; paint(wrap); }
        else { const r = S.createRule(st); C.closeModal(); AGC.router.navigate(`#/rules/${r.id}`); setTimeout(() => AGC.shell.toast(`${U.esc(r.name)} created as version 1.0. Recorded in Audit History.`, "success"), 30); }
      }));
      wrap.querySelectorAll("[name='kind']").forEach((i) => i.addEventListener("change", () => { const box = wrap.querySelector("[data-scope-only]"); if (box) box.hidden = i.value !== "scope"; }));
    };
    const wrap = C.modal({ title: "Create rule", size: "modal-lg", body: "", footer: "" });
    paint(wrap);
  };
  P.statusDialog = function (r, activate) {
    C.modal({ title: `${activate ? "Activate" : "Deactivate"} ${U.esc(r.name)}`, body: activate ? `<p>The rule produces findings again from today. Its versions and its findings are unchanged.</p>${C.field("Note", `<textarea class="inp" name="reason" rows="2" placeholder="Optional. Recorded in Audit History."></textarea>`)}` : `<p>The rule stops producing findings from today. Its findings, versions and flags stay as they are, and the permitted-data matrix shows its sensitive data as unrestricted where only this rule applied.</p>${C.field("Reason", `<textarea class="inp" name="reason" rows="2" placeholder="Required. Recorded on the rule and in Audit History."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary${activate ? "" : " btn-danger"}" data-action="do-status">${activate ? I.check : I.pause} ${activate ? "Activate" : "Deactivate"}</button>`,
      onOpen(wrap) {
        if (!activate) C.guard(wrap, () => val(wrap, "reason"), "Enter the reason first.", "[data-action='do-status']");
        wrap.querySelector("[data-action='do-status']").addEventListener("click", () => { if (!activate && !val(wrap, "reason")) return; S.setRuleStatus(r.id, activate, val(wrap, "reason")); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(r.name)} ${activate ? "activated" : "deactivated"}. Recorded in Audit History.`, "success"), 30); });
      } });
  };
  P.deleteDialog = function (r) {
    C.modal({ title: `Delete ${U.esc(r.name)}`, body: `<p>Nothing refers to this rule yet: no finding, no flag. Deleting removes it and its ${r.versions.length === 1 ? "version" : "versions"}; the deletion itself stays in Audit History. A rule that has produced findings is deactivated instead, never deleted.</p>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary btn-danger" data-action="do-delete">${I.trash} Delete</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='do-delete']").addEventListener("click", () => { const ok = S.deleteRule(r.id); C.closeModal(); if (ok) { AGC.router.navigate("#/rules"); setTimeout(() => AGC.shell.toast(`${U.esc(r.name)} deleted. Recorded in Audit History.`, "success"), 30); } else AGC.router.refresh(); }); } });
  };
  P.keepDialog = function (r) {
    const open = S.openRuleFlags(r).length;
    C.modal({ title: `Keep ${U.esc(r.name)} as it is`, body: `<p>Answers the ${open === 1 ? "open flag" : `${open} open flags`} without changing the rule. The reviewers' notes stay on the rule with your answer, dated, and Audit History records it.</p>${C.field("Why the rule stays as it is", `<textarea class="inp" name="note" rows="3" placeholder="Required. For example: the group's approved purpose covers this use; the finding was dismissed as permitted use."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="do-keep">${I.check} Keep as it is</button>`,
      onOpen(wrap) { C.guard(wrap, () => val(wrap, "note"), "Enter the reason first.", "[data-action='do-keep']"); wrap.querySelector("[data-action='do-keep']").addEventListener("click", () => { if (!val(wrap, "note")) return; S.answerRuleFlags(r.id, val(wrap, "note")); C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(`${U.esc(r.name)} kept as it is; the flags are answered. Recorded in Audit History.`, "success"), 30); }); } });
  };
  P.act = function (action, r) {
    if (!r) return;
    if (action === "view") AGC.router.navigate(`#/rules/${r.id}`);
    else if (action === "edit") P.editDialog(r);
    else if (action === "deactivate") P.statusDialog(r, false);
    else if (action === "activate") P.statusDialog(r, true);
    else if (action === "delete") P.deleteDialog(r);
    else if (action === "keep") P.keepDialog(r);
  };

  /* ---------- Behaviour ---------- */
  P.after = function (root) {
    const rerender = () => AGC.router.refresh();
    root.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-rule-action], [data-action]");
      if (!t) return;
      if (t.dataset.ruleAction) { if (!t.disabled) P.act(t.dataset.ruleAction, S.rule(t.dataset.id)); return; }
      switch (t.dataset.action) {
        case "rule-tile": { const k = t.dataset.tile; if (k === "all" || ui.tile === k) { ui.tile = "all"; ui.family = "all"; ui.group = "all"; ui.search = ""; } else ui.tile = k; rerender(); break; }
        case "rule-view": AGC.router.navigate(t.dataset.view === "matrix" ? "#/rules/matrix" : "#/rules"); break;
        case "rule-export": AGC.shell.toast(ui.view === "matrix" ? "Exports the matrix as CSV: every business group with what it may and may not put into AI, and the rules behind each cell." : "Exports the rules as CSV: every rule with its sensitive data, where it is permitted, severity, basis, version and its findings in the period."); break;
        case "rule-create": P.createWizard(); break;
        default: break;
      }
    });
    root.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.name === "ruleFamily") { ui.family = el.value; rerender(); }
      else if (el.name === "ruleGroup") { ui.group = el.value; rerender(); }
    });
    const s = root.querySelector("#ruleSearch"); if (s) s.addEventListener("input", U.debounce(() => { ui.search = s.value; const pos = s.selectionStart; rerender(); const s2 = document.querySelector("#ruleSearch"); if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); } }, 220));
  };
})();
