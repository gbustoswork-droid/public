/* Audit History: who did what, and when, across the module. Read-only, dated and exportable; the record an auditor asks for.
   Agreed with Gabriel on 2026-09-22: six categories under plain names are the only filter, with "All events" first; one toolbar with the
   business group, a From and To date pair (as in the A2Z Logs application), free-text search and Export; one grid, newest first, with no
   Actions column, because an audit row is not something you act on: its subject is the link. Everyone whose Profile includes audit sees the
   tab, and each person sees the events of the business groups they are entitled to or own, the customer-wide events, and their own actions;
   the Administrator sees everything. The group page's Audit History sub-page shows the same rows for one group, with the band's date range
   as its period. Governance API events ("AI activity") stay out of Version 1 with that capability. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.audit = {});
  const PAGE = 100;
  const shift = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const defaults = () => ({ cat: "all", group: "all", from: shift(U.today(), -30), to: U.today(), search: "", limit: PAGE });
  const ui = (P.ui = defaults());
  (AGC.personaHooks = AGC.personaHooks || []).push(() => Object.assign(ui, defaults()));

  const CATS = [
    { key: "register", label: "Registrations and approvals", cats: ["Register"] },
    { key: "setup", label: "Setup changes", cats: ["Configuration", "Collection"] },
    { key: "people", label: "People synchronized", cats: ["Membership"] },
    { key: "notify", label: "Notifications sent", cats: ["Notification"] },
    { key: "review", label: "Review decisions", cats: ["Governance decision"] },
    { key: "access", label: "Content viewed", cats: ["Access"] },
  ];
  const catOf = (e) => CATS.find((c) => c.cats.includes(e.category)) || null;

  /* What a person may see: the events of the groups their Archive360 Entitlement Policies cover or that they own, the customer-wide events
     (no business group), and their own actions. The Administrator sees everything. */
  function visible(e) {
    if (!catOf(e)) return false;
    if (S.can("settings")) return true;
    const p = S.persona(); if (!p) return false;
    if (!e.groupId) return true;
    if (e.actorType === "member" && e.actorId === p.memberId) return true;
    if (S.isEntitled(e.groupId)) return true;
    const g = S.group(e.groupId);
    return !!(g && g.ownerMemberId === p.memberId);
  }
  P.visibleEvents = () => (D.auditEvents || []).filter(visible);

  /* The event's subject, to link: a registration, a queue item, a group, a person, a rule, an AI asset, an escalation, an evidence package. */
  function subjectOf(e) {
    const id = e.refId;
    switch (e.refType) {
      case "register": { const x = S.entry(id); return x ? { name: x.name, href: `#/registry/${id}` } : null; }
      case "unregistered": { const x = S.byId.unregistered[id]; return x ? { name: x.name, href: `#/unregistered/${id}` } : null; }
      case "group": { const x = S.group(id); return x ? { name: x.name, href: `#/groups/${id}` } : null; }
      case "member": { const x = S.member(id); return x ? { name: x.displayName, href: `#/members/${id}` } : null; }
      case "rule": { const x = S.rule(id); return x ? { name: x.name, href: `#/rules/${id}` } : null; }
      case "interaction": { const x = S.interaction(id); return x ? { name: x.chatName || "Interaction", href: `#/interactions/${id}` } : null; }
      case "aiSystem": { const x = S.system(id); return x ? { name: x.name, href: `#/systems/${id}` } : null; }
      case "evidence": { const x = S.byId.evidence[id]; return x ? { name: x.name, href: `#/evidence/${id}` } : null; }
      case "escalation": { const x = S.byId.escalation[id]; if (!x) return null; const sys = x.aiSystemId && S.system(x.aiSystemId); return sys ? { name: sys.name, href: `#/approvals/${id}` } : { name: "the escalation", href: `#/approvals/${id}`, append: true }; }
      case "finding": return S.byId.finding[id] ? { name: "the finding", href: `#/findings/all/${id}`, append: true } : null;
      case "mapping": return S.can("settings") ? { name: "Business Group Mapping", href: "#/settings/mapping", append: true } : null;
      case "riskScoring": return { name: "Risk scoring", href: "#/rules/risk", append: true };
      default: return null;
    }
  }
  const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const kindName = (s) => (s ? (s.type === "Custom" ? "Custom AI application" : s.type) : "");
  /* Whose interaction a finding is about (Gabriel, 2026-09-28, on asking whether Who was the person who caused the finding or the
     reviewer). The Who column is always the actor; this clause, built from the finding record when the row is drawn, names the rule and
     the person whose interaction it was, so the two are never confused. Plain text; the caller escapes it. */
  /* Whose interaction a Content viewed event is about, built from the record when the row is drawn (2026-09-30): the chat's name, then the
     same clause the finding rows use, so "Interaction content viewed" is never followed by "Viewed interaction content". */
  function interactionSubject(x) {
    const m = S.member(x.memberId), s = x.aiSystemId ? S.system(x.aiSystemId) : null, g = x.groupId ? S.group(x.groupId) : null;
    const who = m ? m.displayName : "an unknown person";
    return `${x.chatName || "Interaction"}, ${s ? `${who}'s interaction with ${s.name} (${kindName(s)}${g ? `, ${g.name}` : ""})` : `${who}'s direct chat${g ? ` in ${g.name}` : ""}`}`;
  }
  function findingSubject(f) {
    const r = S.rule(f.ruleId), m = S.member(f.memberId), s = f.aiSystemId ? S.system(f.aiSystemId) : null, g = f.groupId ? S.group(f.groupId) : null;
    const who = m ? m.displayName : "an unknown person";
    const where = s ? `${who}'s interaction with ${s.name} (${kindName(s)}${g ? `, ${g.name}` : ""})` : `${who}'s direct chat${g ? ` in ${g.name}` : ""}`;
    return `${r ? r.name : f.ruleId}, in ${where}`;
  }
  /* The finding behind an event about a finding or an escalation, or null. */
  function findingOf(e) {
    if (e.refType === "finding") return S.byId.finding[e.refId] || null;
    if (e.refType === "escalation") { const x = S.byId.escalation[e.refId]; return x && x.findingId ? S.byId.finding[x.findingId] || null : null; }
    return null;
  }
  /* One plain sentence: the event's name, then the summary without the repeated lead word, with the subject linked where it is named.
     A finding event reads "<rule>, in <person>'s interaction with <AI asset> (<kind>, <group>). Cause: <reason>." and an escalation
     event keeps its own sentence and adds "Finding: <the same clause>", so the AI asset's name is linked in place. */
  function what(e) {
    const type = e.eventType || "";
    let text = e.summary || "";
    text = text.replace(new RegExp("^" + escRe(type) + ":\\s*", "i"), "");
    const last = type.split(" ").pop(); if (last) text = text.replace(new RegExp("^" + escRe(last) + ":\\s*", "i"), "");
    if (e.category === "Access") {
      const x = e.refType === "interaction" ? S.interaction(e.refId) : null;
      text = x ? `${interactionSubject(x)}.` : text.replace(/^Viewed\s+/i, "");
    }
    const f = findingOf(e);
    if (f && e.refType === "finding") {
      const paren = text.match(/\(([^()]*)\)\s*$/);
      const reason = (f.review && f.review.reason) || (paren ? paren[1] : "");
      text = `${findingSubject(f)}.${reason ? ` ${type === "Finding confirmed" ? "Cause" : "Reason"}: ${reason}.` : ""}`;
    } else if (f) {
      const t = text.trim();
      text = `${t}${t && !/[.!?]$/.test(t) ? "." : ""} Finding: ${findingSubject(f)}.`;
    }
    let html = U.esc(text);
    const subj = subjectOf(e);
    if (subj) {
      const name = U.esc(subj.name);
      if (!subj.append && html.includes(name)) html = html.replace(name, `<a href="${subj.href}">${name}</a>`);
      else html += ` <a href="${subj.href}">${subj.append ? "Open " + name : name}</a>`;
    }
    const sys = e.aiSystemId && S.system(e.aiSystemId) ? S.system(e.aiSystemId).name : null;
    const ctx = sys && !text.includes(sys) && !(subj && subj.name === sys) ? `<div class="small muted">${U.esc(sys)}</div>` : "";
    return `<div class="strong">${U.esc(type)}</div><div class="small audit-text">${html}</div>${ctx}`;
  }
  function who(e) {
    if (e.actorType === "member") { const m = S.member(e.actorId); return m ? `${U.memberLink(m)}<div class="small muted audit-title">${U.esc(m.jobTitle || "")}</div>` : `<span class="muted">${U.esc(e.actorId || "")}</span>`; }
    return `<span class="strong">Archive360</span><div class="small muted">automatic</div>`;
  }
  const when = (e) => { const d = U.parseDate(e.timestamp); const t = d ? `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC` : ""; return `${U.fmtDate(e.date)}<div class="small muted">${t}</div>`; };
  const groupCell = (e) => (e.groupId && S.group(e.groupId) ? `<a href="#/groups/${e.groupId}">${U.esc(S.groupName(e.groupId))}</a>` : '<span class="muted">All groups</span>');
  function haystack(e) {
    const m = e.actorType === "member" ? S.member(e.actorId) : null, subj = subjectOf(e), sys = e.aiSystemId && S.system(e.aiSystemId), f = findingOf(e);
    return [e.eventType, e.summary, m ? m.displayName : "Archive360", e.groupId ? S.groupName(e.groupId) : "", subj ? subj.name : "", sys ? sys.name : "", f ? findingSubject(f) : ""].join(" ").toLowerCase();
  }
  const row = (e) => `<tr><td class="audit-when">${when(e)}</td><td>${who(e)}</td><td>${what(e)}</td><td class="small">${groupCell(e)}</td></tr>`;

  /* The page and the group sub-page share one builder. opts.groupId fixes the group and uses the band's date range as the period. */
  function build(opts) {
    const fixed = opts && opts.groupId ? opts.groupId : null;
    const all = P.visibleEvents().filter((e) => (fixed ? e.groupId === fixed : true));
    const inPeriod = all.filter((e) => (fixed ? S.inRange(e.date) : e.date >= ui.from && e.date <= ui.to));
    const tile = (key, val, label) => `<button type="button" class="ready-tile tile-btn${ui.cat === key ? " active" : ""}" data-action="audit-tile" data-cat="${key}" aria-pressed="${ui.cat === key}"><div class="ready-val">${U.fmtNum(val)}</div><div class="ready-label">${U.esc(label)}</div></button>`;
    const strip = `<div class="ready-strip audit-strip">${tile("all", inPeriod.length, "All events")}${CATS.map((c) => tile(c.key, inPeriod.filter((e) => catOf(e).key === c.key).length, c.label)).join("")}</div>`;
    const groups = S.groupsOrdered();
    const toolbar = `<div class="toolbar reg-toolbar">
        ${fixed ? "" : C.select("auditGroup", [{ value: "all", label: "All business groups" }].concat(groups.map((g) => ({ value: g.id, label: g.name }))), ui.group)}
        ${fixed ? "" : `<label class="audit-range"><span class="kv-label">From</span><input type="date" class="inp audit-date" name="from" value="${ui.from}" max="${U.today()}"/></label>
        <label class="audit-range"><span class="kv-label">To</span><input type="date" class="inp audit-date" name="to" value="${ui.to}" max="${U.today()}"/></label>`}
        <input type="search" id="auditSearch" class="inp toolbar-search" placeholder="Search events, people or names" value="${U.esc(ui.search)}"/>
        <span class="toolbar-spacer"></span>
        <button type="button" class="btn btn-sm" data-action="audit-export">${I.list} Export</button>
      </div>`;
    const q = ui.search.trim().toLowerCase();
    const matches = inPeriod.filter((e) => (ui.cat === "all" || catOf(e).key === ui.cat) && (fixed || ui.group === "all" || e.groupId === ui.group) && (!q || haystack(e).includes(q)));
    const shown = matches.slice(0, ui.limit), remaining = matches.length - shown.length;
    const filtered = ui.cat !== "all" || (!fixed && ui.group !== "all") || !!q;
    const empty = inPeriod.length === 0
      ? C.emptyState(fixed ? "Nothing happened in this period" : `Nothing happened between ${U.fmtDate(ui.from)} and ${U.fmtDate(ui.to)}`, fixed ? "Choose a longer date range." : "Widen the dates to see earlier events.")
      : C.emptyState("Nothing matches", filtered ? "Choose All events, another business group, or clear the search." : "");
    const foot = matches.length ? `<div class="audit-foot small muted">Showing ${U.fmtNum(shown.length)} of ${U.fmtNum(matches.length)} ${U.plural(matches.length, "event")}${remaining ? ` · <button type="button" class="link-btn" data-action="audit-more">Show ${U.fmtNum(Math.min(PAGE, remaining))} more</button>` : ""}</div>` : "";
    const body = C.card("", `<div class="tbl-wrap"><table class="tbl tbl-audit"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Business group</th></tr></thead><tbody>${shown.map(row).join("") || `<tr><td colspan="4">${empty}</td></tr>`}</tbody></table></div>${foot}`);
    return `${strip}${toolbar}${body}`;
  }

  function notAvailable() {
    const nav = AGC.shell.navMeta("audit");
    AGC.shell.render({ kind: "list", navKey: "overview", title: nav.title, description: nav.description, icon: "audit", html: `<div class="placeholder-card"><div class="ph-title">${I.lock} Audit History is not available for your profile</div><div class="ph-body">Access to Audit History comes from your Profile and Entitlement Policies, managed by an Archive360 Administrator.</div></div>` });
  }
  P.render = function () {
    if (!S.can("audit")) { notAvailable(); return; }
    const nav = AGC.shell.navMeta("audit");
    AGC.shell.render({ kind: "list", navKey: "audit", title: nav.title, description: nav.description, icon: "audit", html: build(), after: P.after });
  };
  P.groupHtml = (gid) => build({ groupId: gid });

  P.after = function (root) {
    const rerender = () => AGC.router.refresh();
    /* A tile selects its category; the selected tile, or All, puts the page back as it first loaded (category, group, dates, search). */
    root.querySelectorAll("[data-action='audit-tile']").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.cat; if (k === "all" || ui.cat === k) Object.assign(ui, defaults()); else { ui.cat = k; ui.limit = PAGE; } rerender(); }));
    const g = root.querySelector("select[name='auditGroup']"); if (g) g.addEventListener("change", () => { ui.group = g.value; ui.limit = PAGE; rerender(); });
    const from = root.querySelector("input[name='from']"), to = root.querySelector("input[name='to']");
    const dates = () => {
      const f = from.value, t = to.value;
      if (!f || !t) return;
      if (f > t) { AGC.shell.toast("The From date must be on or before the To date.", "warn"); from.value = ui.from; to.value = ui.to; return; }
      ui.from = f; ui.to = t; ui.limit = PAGE; rerender();
    };
    if (from && to) { from.addEventListener("change", dates); to.addEventListener("change", dates); }
    const s = root.querySelector("#auditSearch"); if (s) s.addEventListener("input", U.debounce(() => { ui.search = s.value; ui.limit = PAGE; const pos = s.selectionStart; rerender(); const s2 = document.querySelector("#auditSearch"); if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); } }, 220));
    const more = root.querySelector("[data-action='audit-more']"); if (more) more.addEventListener("click", () => { ui.limit += PAGE; rerender(); });
    const ex = root.querySelector("[data-action='audit-export']"); if (ex) ex.addEventListener("click", () => AGC.shell.toast("Exports the events shown as CSV: when, who, what and the business group.", "info"));
  };
})();
