/* Unregistered AI: the exceptions queue for setup. Everything here is something Archive360 found that the configuration does not
   account for: an attribute value nobody mapped, an external AI object used from inside a registered platform, or an API key the vendor's admin interfaces report as active that no registered application claims.
   Working an item means deciding what it is and where it belongs. Decisions apply when the dialog's confirming button is clicked;
   mapping and exclusion publish a mapping version at once (Gabriel, 2026-09-11). Every decision goes to Audit History. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.unregistered = {});
  const SP = () => AGC.pages.settings;
  const ui = (P.ui = { kind: "all", group: "all" });
  (AGC.personaHooks = AGC.personaHooks || []).push(() => Object.assign(ui, { kind: "all", group: "all" }));

  const KINDS = [
    { key: "Unmapped attribute value", code: "DNG", codeTitle: "Department Not Grouped", tile: () => `${S.attributeOption(D.mapping.sourceAttribute).label} values not mapped to a group`, label: "Unmapped identity attribute value", short: "Unmapped identity attribute values", one: "unmapped identity attribute value",
      lead: () => "Map the value to a business group so that its people, and their history, get an owner and reviewers. Exclude it only if these people should stay outside governance." },
    { key: "External AI object", code: "EXT", tile: () => "Outside AI tools in use", label: "GPT built outside your workspace", short: "GPTs built outside your workspace", one: "GPT built outside your workspace",
      lead: () => "Allow it with an accountable owner, or prohibit it. Dismiss it only if it is a duplicate or a false positive. Someone outside your workspace built and owns it, for example a public GPT from the GPT Store, so Archive360 archives your people's interactions with it but not its instructions, knowledge or actions, and what is typed into it can leave your control." },
    { key: "Unclaimed API key", code: "KEY", tile: () => "API access nobody claims", label: "Unclaimed API access", short: "Unclaimed API access", one: "API access",
      lead: () => "Assign it to the registered AI system that uses it, or add that AI system if it is new to Archive360. Archive360 sees who owns the credential and how much it is used, never the key itself and never the prompts." },
  ];
  const kindOf = (u) => KINDS.find((k) => k.key === u.type) || KINDS[0];
  const badge = (u) => `<span class="type-ic" title="${U.esc(kindOf(u).codeTitle || kindOf(u).label)}">${kindOf(u).code}</span>`;
  const isOpen = (u) => S.unregOpen(u);
  const OUTCOME = { Allowed: "Allowed", Mapped: "Mapped", Excluded: "Excluded", Linked: "Assigned", "Added as instance": "Added as AI system", Unsanctioned: "Prohibited", Dismissed: "Dismissed" };
  function statusPill(u) {
    if (u.status === "New") return `<span class="pill pill-pending">${I.alert}<span>New</span></span>`;
    if (u.status === "Under investigation") return `<span class="pill pill-pending">${I.search}<span>Under investigation</span></span>`;
    const good = ["Allowed", "Mapped", "Linked", "Added as instance"].includes(u.status), bad = u.status === "Unsanctioned";
    return `<span class="pill ${good ? "pill-ok" : bad ? "pill-danger" : "pill-muted"}">${good ? I.checkCircle : bad ? I.alert : I.minus}<span>${U.esc(OUTCOME[u.status] || u.status)}</span></span>`;
  }
  /* The business group of the people involved: an outside GPT's users, a credential's owner. The people behind an unmapped value have none
     yet, so the grid says so and suggests nothing (Gabriel, 2026-09-21: "Do not suggest anything"). He did not understand the earlier label, "Seen in"; the data key keeps its name. */
  const businessGroup = (u) => {
    if (u.type === "Unmapped attribute value") return '<span class="muted">None yet</span>';
    const ids = (u.seenInGroupIds || []).filter((g) => S.group(g));
    return ids.length ? ids.map((g) => `<a href="#/groups/${g}">${U.esc(S.groupName(g))}</a>`).join(", ") : '<span class="muted">None yet</span>';
  };
  const activity = (u) => {
    if (u.type === "Unclaimed API key") return `${U.fmtNum(u.requests30d || 0)} requests in 30 days<div class="small muted">${(u.models || []).map((m) => U.esc(m)).join(", ")}</div>`;
    return `${U.fmtNum(u.interactionCount || 0)} ${U.plural(u.interactionCount || 0, "interaction")}`;
  };
  const people = (u) => (u.type === "Unclaimed API key" ? (S.member(u.ownerMemberId) ? `<div class="small">${U.esc(S.member(u.ownerMemberId).displayName)}<div class="muted">owner</div></div>` : "—") : `${U.fmtNum((u.memberIds || []).length)}`);

  /* ---------- Permissions: the queue is Gabriel's and the Administrator's; Settings changes are the Administrator's ---------- */
  const queueReason = () => { const p = S.permission("unregistered", {}); return p.allowed ? null : p.reason; };
  const adminReason = (what) => (S.can("settings") ? null : `${what} managed by an Archive360 Administrator.`);
  const ACTIONS = {
    "Unmapped attribute value": [
      { key: "map", label: "Map to a business group…", icon: "groups", reason: () => adminReason("Business Group Mapping is") },
      { key: "exclude", label: "Exclude from governance…", icon: "x", reason: () => adminReason("Business Group Mapping is"), danger: true },
    ],
    "External AI object": [
      { key: "allow", label: "Allow with an owner…", icon: "checkCircle", reason: () => { const p = S.permission("register", {}); return p.allowed ? null : p.reason; } },
      { key: "unsanctioned", label: "Prohibit…", icon: "alert", reason: queueReason, danger: true },
      { key: "dismiss", label: "Dismiss…", icon: "minus", reason: queueReason },
    ],
    "Unclaimed API key": [
      { key: "link", label: "Assign to a registered AI system…", icon: "coverage", reason: () => adminReason("AI Systems are") },
      { key: "add-instance", label: "Add as a new AI system…", icon: "platform", reason: () => adminReason("AI Systems are") },
      { key: "unsanctioned", label: "Prohibit…", icon: "alert", reason: queueReason, danger: true },
      { key: "dismiss", label: "Dismiss…", icon: "minus", reason: queueReason },
    ],
  };
  const actionList = (u) => (isOpen(u) ? [u.status === "New" ? { key: "investigate", label: "Start investigation…", icon: "search", reason: queueReason } : { key: "end-investigation", label: "End investigation…", icon: "x", reason: queueReason }].concat(ACTIONS[u.type] || []) : []);
  /* Who is looking into an item, since when, and with what note: the last "Investigation started" in its history. */
  const investigation = (u) => { if (u.status !== "Under investigation") return null; const h = (u.decisionHistory || []).slice().reverse().find((x) => x.action === "Investigation started"); return h ? { member: S.member(h.actorMemberId), date: h.date, note: h.detail || "" } : null; };
  function actionsMenu(u) {
    const items = [SP().menuItem({ attr: "data-unreg-action", action: "view", id: u.id, icon: "overview", label: "View" })].concat(actionList(u).map((a) => SP().menuItem({ attr: "data-unreg-action", action: a.key, id: u.id, icon: a.icon, label: a.label, cls: a.danger ? "menu-danger" : "", disabledReason: a.reason() })));
    return `<div class="group-card-actions group-card-actions--grid"><button type="button" class="group-card-actions-btn" data-menu-toggle="unreg-${u.id}" aria-haspopup="true">Actions <span class="group-card-actions-caret">&#9660;</span></button><div class="group-card-actions-menu menu-pop" id="menu-actions-unreg-${u.id}" role="menu" hidden>${items.join("")}</div></div>`;
  }

  /* ---------- The tab, simplified with Gabriel on 2026-09-18 ----------
     The tiles are the only kind filter and "All" puts the page back as it first loaded. One flat grid: what the item is and what is
     riding on it in a sentence, the business group of the people involved, its status, and the same Actions menu as before. Only open work is listed: a decided item leaves the page, and its record lives where the decision landed (the mapping row's Version
     History, the AI Registry registration, the application's API access, the asset's row in All AI Assets) and in Audit History. The
     business group filter and Export stay; the kind chips, the search box and the section rows with their paragraphs are gone. */
  function matches(u) {
    if (!isOpen(u)) return false;
    if (ui.kind !== "all" && u.type !== ui.kind) return false;
    if (ui.group !== "all" && !(u.seenInGroupIds || []).includes(ui.group)) return false;
    return true;
  }
  const amount = (u) => (u.type === "Unclaimed API key" ? (u.requests30d || 0) : (u.interactionCount || 0));
  /* What an outside GPT or a credential is, without its numbers. An attribute value needs no such line in the list, where the tile and the badge say it. */
  function whatIs(u) {
    if (u.type === "External AI object") { const groups = (u.seenInGroupIds || []).filter((g) => S.group(g)).map((g) => S.groupName(g)).join(" and "); return `GPT built outside your workspace${groups ? `, used by ${U.esc(groups)}` : ""}.`; }
    if (u.type === "Unclaimed API key") { const owner = S.member(u.ownerMemberId); return `${U.esc(u.identityType || "Credential")} in ${U.esc(u.provider || "")} project ${U.esc(u.projectName || "")}${owner ? `, owned by ${U.esc(owner.displayName)}` : ""}.`; }
    return "";
  }
  function sentence(u) {
    if (!isOpen(u) && u.resolution) return U.esc(u.resolution.note || "");
    const n = u.interactionCount || 0;
    if (u.type === "Unmapped attribute value") { const p = (u.memberIds || []).length; return `${U.fmtNum(p)} ${U.plural(p, "person belongs", "people belong")} to no business group. ${U.fmtNum(n)} ${U.plural(n, "interaction")} nobody reviews.`; }
    if (u.type === "External AI object") return `${whatIs(u)} ${U.fmtNum(n)} ${U.plural(n, "interaction")} left your control.`;
    return `${whatIs(u)} ${U.fmtNum(u.requests30d || 0)} requests in 30 days, nothing archived.`;
  }
  /* The item page's header sentence. It says what the item is first, because a reader may arrive from a link with no list around it, then
     what is riding on it. The page shows no suggestion: Gabriel had the "Archive360 suggests" notice removed (2026-09-21). Once decided, it says the item has left
     the queue; the outcome itself is in the Decision card. */
  function headline(u) {
    const attr = U.esc(S.attributeOption(D.mapping.sourceAttribute).label);
    if (!isOpen(u)) {
      const w = u.type === "Unmapped attribute value" ? `${attr} value from ${U.esc(D.mapping.identitySource || "the identity source")}.` : whatIs(u);
      return `${w} Decided${u.resolution && u.resolution.date ? ` on ${U.fmtDate(u.resolution.date)}` : ""}, so it no longer appears in the queue.`;
    }
    if (u.type !== "Unmapped attribute value") return sentence(u);
    const p = (u.memberIds || []).length, n = u.interactionCount || 0;
    return `${attr} value not mapped to a business group. ${U.fmtNum(p)} ${U.plural(p, "person belongs", "people belong")} to no business group, and ${U.fmtNum(n)} ${U.plural(n, "interaction is", "interactions are")} reviewed by nobody.`;
  }
  const ucfirst = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  function row(u) {
    const inv = investigation(u);
    return `<tr class="${isOpen(u) && u.status === "New" ? "row-gap" : ""}">
      <td><div class="inst-name">${badge(u)}<div><span class="strong">${U.esc(u.name)}</span>${inv ? ` <span class="pill pill-pending unreg-inv">${I.search}<span>Under investigation</span></span>` : ""}<div class="small muted unreg-sentence">${sentence(u)}</div>${inv ? `<div class="small muted unreg-sentence">${inv.member ? U.esc(inv.member.displayName) : "Someone"} has been looking into it since ${U.fmtDate(inv.date)}.</div>` : ""}</div></div></td>
      <td class="small">${businessGroup(u)}</td>
      <td class="unreg-seen">${u.lastSeen ? `${ucfirst(U.relTime(u.lastSeen))}<div class="small muted">${U.fmtDate(u.lastSeen)}</div>` : '<span class="muted">—</span>'}</td>
      <td class="groups-grid-actions-cell">${actionsMenu(u)}</td>
    </tr>`;
  }
  /* Page access follows the Profile: a persona without the queue feature does not see the tab, and a direct link lands on a notice. */
  function notAvailable() {
    const nav = AGC.shell.navMeta("unregistered");
    AGC.shell.render({ kind: "list", navKey: "overview", title: nav.title, description: nav.description, icon: "unregistered", html: `<div class="placeholder-card"><div class="ph-title">${I.lock} Unregistered AI is not available for your profile</div><div class="ph-body">Access to the Unregistered AI queue comes from your Profile. The AI Governance Manager and the Archive360 Administrator work it.</div><div class="ph-note"><a href="#/overview">Back to Overview</a></div></div>` });
  }
  P.render = function () {
    if (!S.can("unregistered")) { notAvailable(); return; }
    const nav = AGC.shell.navMeta("unregistered");
    const all = S.unregisteredItems(), inTab = all.filter(isOpen);
    const tile = (kind, val, label, cls) => `<button type="button" class="ready-tile tile-btn ${cls || ""}${ui.kind === kind ? " active" : ""}" data-action="tile" data-kind="${U.esc(kind)}" aria-pressed="${ui.kind === kind}"><div class="ready-val">${val}</div><div class="ready-label">${U.esc(label)}</div></button>`;
    const strip = `<div class="ready-strip">
        ${tile("all", inTab.length, "All open items", "")}
        ${KINDS.map((k) => { const n = inTab.filter((u) => u.type === k.key).length; return tile(k.key, n, k.tile(), n ? "gap" : "ok"); }).join("")}
      </div>`;
    const groups = S.groupsOrdered();
    const toolbar = `<div class="toolbar reg-toolbar">
        ${C.select("unregGroup", [{ value: "all", label: "All business groups" }].concat(groups.map((g) => ({ value: g.id, label: g.name }))), ui.group)}
        <span class="toolbar-spacer"></span>
        <button type="button" class="btn btn-sm" data-action="export">${I.list} Export</button>
      </div>`;
    const order = KINDS.map((k) => k.key);
    const shown = all.filter(matches).sort((a, b) => (order.indexOf(a.type) - order.indexOf(b.type)) || (amount(b) - amount(a)));
    const filtered = ui.kind !== "all" || ui.group !== "all";
    const empty = filtered ? C.emptyState("Nothing matches", "Choose All to see every item again.") : C.emptyState("Nothing is waiting", "Every value is mapped, every application is registered and every credential is claimed.");
    const body = C.card("", `<div class="tbl-wrap"><table class="tbl tbl-registry tbl-unreg"><thead><tr><th>Item</th><th>Business group</th><th>Last detected</th><th class="groups-grid-actions-header" style="text-align:right">Actions</th></tr></thead><tbody>${shown.map(row).join("") || `<tr><td colspan="4">${empty}</td></tr>`}</tbody></table></div>`);
    const html = `${strip}${toolbar}${body}`;
    AGC.shell.render({ kind: "list", navKey: "unregistered", title: nav.title, description: nav.description, icon: "unregistered", html, after: P.after });
  };
  P.after = function (root) {
    const rerender = () => AGC.router.refresh();
    /* A tile selects its kind; the selected tile, or All, puts the page back as it first loaded for this tab (kind and business group). */
    root.querySelectorAll("[data-action='tile']").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.kind; if (k === "all" || ui.kind === k) { ui.kind = "all"; ui.group = "all"; } else ui.kind = k; rerender(); }));
    const g = root.querySelector("select[name='unregGroup']"); if (g) g.addEventListener("change", () => { ui.group = g.value; rerender(); });
    const ex = root.querySelector("[data-action='export']"); if (ex) ex.addEventListener("click", () => AGC.shell.toast("Exports the rows shown as CSV: each item with its age, its activity and its business group.", "info"));
    root.querySelectorAll("[data-unreg-action]").forEach((b) => b.addEventListener("click", () => { AGC.shell.closeMenus(); P.act(b.dataset.unregAction, S.byId.unregistered[b.dataset.id]); }));
  };
  P.act = function (action, u) {
    if (action === "view") AGC.router.navigate("#/unregistered/" + u.id);
    else if (action === "investigate") P.investigateDialog(u);
    else if (action === "end-investigation") P.endInvestigationDialog(u);
    else if (action === "map") P.mapDialog(u);
    else if (action === "exclude") P.excludeDialog(u);
    else if (action === "allow") P.allowDialog(u);
    else if (action === "link") P.linkDialog(u);
    else if (action === "add-instance") P.addInstance(u);
    else if (action === "unsanctioned") P.unsanctionedDialog(u);
    else if (action === "dismiss") P.dismissDialog(u);
  };

  /* ---------- The item page ---------- */
  P.item = function (id) {
    if (!S.can("unregistered")) { notAvailable(); return; }
    const u = S.byId.unregistered[id];
    if (!u || !S.unregisteredKinds.includes(u.type)) { AGC.router.navigate("#/unregistered"); return; }
    const k = kindOf(u), owner = S.member(u.ownerMemberId), members = S.sortMembers((u.memberIds || []).map((m) => S.member(m)).filter(Boolean));
    const facts = [], isValue = u.type === "Unmapped attribute value", attr = U.esc(S.attributeOption(D.mapping.sourceAttribute).label);
    if (isValue) {
      /* Gabriel's labels, 2026-09-21. The attribute's own name labels its value, so the rows read "Identity attribute: Department" and
         "Department: Mortgage Servicing". Both statuses stay true once the item is decided: a mapped value is governed in its group. */
      const to = u.resolution && u.resolution.groupId && S.group(u.resolution.groupId) ? u.resolution.groupId : null;
      facts.push(["Mapping status", u.status === "Mapped" ? (to ? `Mapped to <a href="#/groups/${to}">${U.esc(S.groupName(to))}</a>` : "Mapped") : u.status === "Excluded" ? "Excluded from governance" : `${badge(u)} ${U.esc(k.label)}`]);
      facts.push(["Identity attribute", attr]);
      facts.push([attr, (u.rawValues || []).map((v) => `<span class="chip chip-muted">${U.esc(v)}</span>`).join(" ")]);
      facts.push(["Governance status", u.status === "Mapped" ? `<span class="ok-text">Governed</span>: these people now belong to ${to ? U.esc(S.groupName(to)) : "a business group"}` : u.status === "Excluded" ? "<span class=\"muted\">Excluded</span>: these people are not attributed or reviewed; Archive360 still archives their activity" : '<span class="danger-text">Unassigned</span>: nobody owns their activity and nobody reviews it']);
    }
    /* The other two kinds follow the same pattern (Gabriel, 2026-09-21): a status row first that stays true once the item is decided, then
       plain nouns. "API project" and "Credential owner" keep a vendor's project and a key's owner apart from a ChatGPT Project and an accountable owner. */
    const res = u.resolution || {}, linkedEntry = res.registerEntryId ? S.entry(res.registerEntryId) : null, linkedInst = res.instanceId ? S.instance(res.instanceId) : null;
    if (u.type === "External AI object") {
      const decided = { Allowed: `Allowed${linkedEntry ? `: <a href="#/registry/${linkedEntry.id}">registered individually</a>` : ""}`, Unsanctioned: '<span class="danger-text">Prohibited</span>', Dismissed: "Dismissed" };
      facts.push(["Approval status", decided[u.status] || `${badge(u)} <span class="warn-text">Undecided</span>: nobody has allowed or prohibited it yet`]);
      facts.push(["AI platform", (u.platformIds || []).map((p) => U.esc((S.platform(p) || {}).name || p)).join(", ") || U.esc(u.source || "—")]);
      facts.push(["GPT identifier", `<code>${U.esc(u.identity || u.name)}</code>`]);
    }
    if (u.type === "Unclaimed API key") {
      const decided = { Linked: `Assigned${linkedInst ? ` to ${U.esc(linkedInst.name)}` : ""}`, "Added as instance": `Assigned${linkedInst ? ` to ${U.esc(linkedInst.name)}` : ""}, added as a new AI system`, Unsanctioned: '<span class="danger-text">Prohibited</span>', Dismissed: "Dismissed" };
      facts.push(["Claim status", decided[u.status] || `${badge(u)} <span class="danger-text">Unclaimed</span>: no registered AI system claims it`]);
      facts.push(["Provider", U.esc(u.provider || "")]); facts.push(["Vendor account", U.esc(u.source || "")]); facts.push(["API project", U.esc(u.projectName || "")]); facts.push(["Credential", `<code>${U.esc(u.keyRedacted || "")}</code> · ${U.esc(u.identityType || "")}${u.deployment ? ` · ${U.esc(u.deployment)}` : ""}<div class="small muted">Archive360 never holds the key itself, only this redacted form.</div>`]);
      facts.push(["Credential owner", SP().ownerCell(owner)]); facts.push(["Created", U.fmtDate(u.createdDate)]); facts.push(["Last used", `${U.fmtDate(u.lastUsed)} · ${U.relTime(u.lastUsed)}`]);
      facts.push(["Usage, 30 days", `${U.fmtNum(u.requests30d || 0)} requests · ${U.fmtNum(u.tokens30d || 0)} tokens · ${(u.models || []).map((m) => U.esc(m)).join(", ")}`]);
      facts.push(["Content archived", linkedInst ? (linkedInst.recordClassId ? `Yes, through ${U.esc(linkedInst.name)}, which sends its prompts and responses to Archive360` : `<span class="warn-text">None</span>. ${U.esc(linkedInst.name)} is registered without archiving its interactions.`) : '<span class="warn-text">None</span>. Nothing this credential produces reaches Archive360.']);
    } else {
      facts.push(["First detected", U.fmtDate(u.firstSeen)]); facts.push(["Last detected", `${U.fmtDate(u.lastSeen)} · ${U.relTime(u.lastSeen)}`]); facts.push(["Recorded activity", activity(u)]);
    }
    if (!isValue) facts.push(["Business group", `${businessGroup(u)}${u.type === "Unclaimed API key" ? '<div class="small muted">The credential owner\'s business group.</div>' : ""}`]);
    const what = C.card(isValue ? `${attr} mapping details` : u.type === "External AI object" ? "Outside GPT details" : `${U.esc(u.identityType || "API key")} details`, `<dl class="kv kv-wide kv-detail">${facts.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}</dl>`);
    const tags = Object.entries(u.detectionSummary || {}).sort((a, b) => b[1] - a[1]);
    const tagsCard = C.card("Sensitive data tags detected", tags.length ? `<div class="chips">${tags.map(([dc, n]) => `<span class="chip chip-muted" title="${U.esc(S.dcName(dc))}">${U.esc((S.dataClass(dc) || {}).short || dc)} <strong>${U.fmtNum(n)}</strong></span>`).join(" ")}</div><p class="small muted">Classification ran on the archived activity even though nobody is accountable for it yet.</p>` : `<p class="small muted">${u.type === "Unclaimed API key" ? "No content is archived for this credential, so nothing was classified." : "Nothing detected."}</p>`);
    /* Who the item is about, under a title that says what the list is (Gabriel, 2026-09-21: "People involved" did not). A Department value lists
       everyone the identity source reports with that value, because mapping or excluding it affects all of them, each with their archived
       activity, the most active first, so the people who use AI stand out from those who have not yet. An outside GPT lists the people who used
       it, with their business group. A credential has no such card: its owner is a row in the details card, and the vendor does not report
       the application's end users. */
    /* Each person's activity on this item, the most active first on both kinds of page (Gabriel, 2026-09-21: the two lists were not consistent).
       For a Department value it is everything archived for the person. For an outside GPT it is their interactions with that GPT: the
       interaction is the employee's and is archived with their identity, so Archive360 knows who used the GPT and how often; only the GPT's own
       configuration is out of sight. The business group shows under the count only when the people come from more than one group; otherwise the
       details card already says it once. */
    const withGpt = {};
    if (!isValue && u.aiSystemId) (S.interactionsBySystem[u.aiSystemId] || []).forEach((x) => { withGpt[x.memberId] = (withGpt[x.memberId] || 0) + 1; });
    const activityOf = (m) => (isValue ? (S.interactionsByMember[m.memberId] || []).length : (withGpt[m.memberId] || 0));
    const people = S.sortMembers(members, (a, b) => (activityOf(b) - activityOf(a)) || a.displayName.localeCompare(b.displayName));
    const groupOf = (m) => (m.primaryGroupId ? U.esc(S.groupName(m.primaryGroupId)) : "No business group");
    const severalGroups = !isValue && new Set(people.map((m) => m.primaryGroupId || "")).size > 1;
    const beside = (m) => { const n = activityOf(m); return isValue ? (n ? `${U.fmtNum(n)} ${U.plural(n, "interaction")}` : "No AI activity yet") : (n ? `${U.fmtNum(n)} ${U.plural(n, "interaction")}${severalGroups ? `<div>${groupOf(m)}</div>` : ""}` : groupOf(m)); };
    const peopleCard = u.type === "Unclaimed API key" ? "" : C.card(`${isValue ? `People in this ${attr.toLowerCase()}` : "People who used it"} <span class="count-badge">${people.length}</span>`, people.length ? `<ul class="people-list">${people.map((m, i) => `<li${i >= 8 ? " hidden data-more" : ""}>${U.avatar(m, "sm")}<span><a class="strong" href="#/members/${m.memberId}">${U.esc(m.displayName)}</a><span class="muted"> · ${U.esc(m.jobTitle || "")}</span>${U.statusTag(m)}</span><span class="small muted people-side">${beside(m)}</span></li>`).join("")}</ul>${people.length > 8 ? `<p class="small muted"><button type="button" class="link-btn" data-action="people-more" data-all="Show all ${people.length}" data-fewer="Show the first 8">Show all ${people.length}</button></p>` : ""}` : `<p class="small muted">No people recorded.</p>`);
    const acts = actionList(u);
    const btn = (a) => { const r = a.reason(); return r ? `<span class="btn-disabled-wrap"><button type="button" class="btn ${a.danger ? "btn-secondary" : "btn-secondary"} is-disabled" disabled>${U.icon(a.icon)} ${a.label}</button><span class="btn-reason">${U.esc(r)}</span></span>` : `<button type="button" class="btn ${["investigate", "end-investigation", "dismiss"].includes(a.key) ? "btn-secondary" : "btn-primary"}${a.danger ? " btn-danger" : ""}" data-unreg-action="${a.key}" data-id="${u.id}">${U.icon(a.icon)} ${a.label}</button>`; };
    const by = u.resolution && S.member(u.resolution.byMemberId);
    const decision = C.card("Decision", `${investigation(u) ? `<p class="small">${investigation(u).member ? U.esc(investigation(u).member.displayName) : "Someone"} has been looking into this since ${U.fmtDate(investigation(u).date)}${investigation(u).note ? `: ${U.esc(investigation(u).note)}` : "."} It stays under investigation until someone decides it below, or ends the investigation.</p>` : ""}${isOpen(u) ? `<p class="small muted">${U.esc(k.lead())}</p><div class="btn-row">${acts.map(btn).join("")}</div>` : `<p>${U.esc((u.resolution || {}).note || "")}${u.resolution && u.resolution.reason ? ` <span class="muted">(${U.esc(u.resolution.reason)})</span>` : ""}</p><p class="small muted">Decided ${U.fmtDate((u.resolution || {}).date)}${by ? ` by ${U.esc(by.displayName)}` : ""}.${u.resolution && u.resolution.instanceId && S.instance(u.resolution.instanceId) ? ` <a href="#/settings/instances">Open ${U.esc(S.instance(u.resolution.instanceId).name)} in Settings.</a>` : ""}${u.resolution && u.resolution.groupId && S.group(u.resolution.groupId) ? ` <a href="#/groups/${u.resolution.groupId}">Open ${U.esc(S.groupName(u.resolution.groupId))}.</a>` : ""}${u.resolution && u.resolution.registerEntryId ? ` <a href="#/registry/${u.resolution.registerEntryId}">Open the registration.</a>` : ""}</p>`}`);
    const history = C.card("Decision history", `<ul class="history-list">${(u.decisionHistory || []).slice().reverse().map((h) => `<li><span class="hist-date">${U.fmtDate(h.date)}</span><span class="hist-action">${U.esc(h.action)}</span><span class="hist-detail">${U.esc(h.detail || "")}${h.actorMemberId && S.member(h.actorMemberId) ? ` <span class="muted">· ${U.esc(S.member(h.actorMemberId).displayName)}</span>` : (h.actorMemberId === "system" ? ' <span class="muted">· Archive360</span>' : "")}</span></li>`).join("")}</ul>`);
    const html = `<div class="two-col"><div>${what}${tagsCard}</div><div>${decision}${peopleCard}${history}</div></div>`;
    /* An item has no sub-pages and nothing on this page depends on a period, so it gets the item header, not the group page's band with
       its date range: the badge as the list shows it, the name, the status in words and what the item is (Gabriel, 2026-09-21). */
    AGC.shell.render({ kind: "item", navKey: "unregistered", title: u.name,
      breadcrumb: [{ label: "Unregistered AI", href: "#/unregistered" }, { label: u.name, href: `#/unregistered/${u.id}` }],
      item: { badgeHtml: badge(u), name: u.name, statusHtml: statusPill(u), sentence: headline(u) },
      html, after(root) {
        root.querySelectorAll("[data-unreg-action]").forEach((b) => b.addEventListener("click", () => P.act(b.dataset.unregAction, S.byId.unregistered[b.dataset.id])));
        /* The list shows the eight most active people; the rest open in place, so nobody who used the item is out of reach and the page just grows (one scrollbar). */
        const more = root.querySelector("[data-action='people-more']");
        if (more) more.addEventListener("click", () => { const open = more.dataset.open === "1"; root.querySelectorAll(".people-list li[data-more]").forEach((li) => { li.hidden = open; }); more.dataset.open = open ? "" : "1"; more.textContent = open ? more.dataset.all : more.dataset.fewer; });
      } });
  };

  /* ---------- Dialogs. Each applies on its confirming button, never on a dropdown change. ---------- */
  /* A confirming button stays disabled, with the reason beside it, until the dialog's required input is there. A missing choice is never
     reported only by a toast, which is easy to miss and leaves the item looking as if the decision had been made (Gabriel, 2026-09-21). */
  const guard = (wrap, isReady, reason) => C.guard(wrap, isReady, reason);
  const done = (msg, kind) => { C.closeModal(); AGC.router.refresh(); setTimeout(() => AGC.shell.toast(msg, kind || "success"), 30); };
  P.investigateDialog = function (u) {
    C.modal({ title: `Investigate ${U.esc(u.name)}`, body: `<p>Marks the item as being looked into, so the other person working this queue leaves it to you. The investigation ends when someone decides the item, for example by mapping it, or when you choose End investigation.</p>${C.field("Note", `<textarea class="inp" name="note" rows="2" placeholder="Optional. What you are checking and with whom."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="go">${I.search} Start investigation</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='go']").addEventListener("click", () => { S.investigateUnregistered(u.id, wrap.querySelector("textarea[name='note']").value.trim()); done(`${U.esc(u.name)} is under investigation.`); }); } });
  };
  P.endInvestigationDialog = function (u) {
    C.modal({ title: `End the investigation of ${U.esc(u.name)}`, body: `<p>Returns the item to New without a decision, for example when your question is answered and the decision belongs to someone else. The item's history keeps the investigation and your note. Making any decision on the item also ends the investigation, so use this only when there is nothing to decide yet.</p>${C.field("Note", `<textarea class="inp" name="note" rows="2" placeholder="Optional. What you found."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="go">${I.x} End investigation</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='go']").addEventListener("click", () => { S.endInvestigation(u.id, wrap.querySelector("textarea[name='note']").value.trim()); done(`The investigation of ${U.esc(u.name)} has ended. The item is New again.`); }); } });
  };
  P.mapDialog = function (u, preselect) {
    const groups = S.groupsOrdered();
    const opts = [{ value: "", label: "Choose a business group" }].concat([{ value: "__new__", label: "New business group…", group: "Actions" }], groups.map((g) => ({ value: g.id, label: g.name, group: "Business groups" })));
    const n = (u.memberIds || []).length;
    C.modal({ title: `Map ${U.esc(u.name)} to a business group`, size: "modal-lg", body: `<p>${U.esc((u.rawValues || []).join(" and "))}: ${U.fmtNum(n)} ${U.plural(n, "person", "people")} and ${U.fmtNum(u.interactionCount || 0)} archived ${U.plural(u.interactionCount || 0, "interaction")} attributed to nobody today.</p>
        ${C.field("Business group", C.select("target", opts, preselect || ""), `"New business group…" opens the same form as the Business Groups page.`)}
        ${C.field("Note", `<textarea class="inp" name="note" rows="2" placeholder="Optional. Recorded with the decision."></textarea>`)}
        <div class="notice notice-info">${I.info}<span>People are assigned to the group; their history stays with them, and the group owner will see them in the next digest.</span></div>`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="go">${I.check} Map and publish</button>`,
      onOpen(wrap) {
        const sel = wrap.querySelector("select[name='target']");
        guard(wrap, () => sel.value && sel.value !== "__new__", "Choose a business group first.");
        sel.addEventListener("change", () => { if (sel.value === "__new__") { C.closeModal(); SP().groupForm(null, { rawValue: (u.rawValues || [])[0], onCreate: (g) => P.mapDialog(u, g.id), onCancel: () => P.mapDialog(u) }); } });
        wrap.querySelector("[data-action='go']").addEventListener("click", () => {
          const gid = sel.value; if (!gid || gid === "__new__") { AGC.shell.toast("Choose the business group.", "warn"); return; }
          const res = S.mapUnregisteredValue(u.id, gid, wrap.querySelector("textarea[name='note']").value.trim());
          done(`${U.esc(u.name)} mapped to ${U.esc(S.groupName(gid))}. Mapping v${res.version} published; ${res.affected} ${U.plural(res.affected, "person", "people")} re-attributed.`);
        });
      } });
  };
  P.excludeDialog = function (u) {
    const n = (u.memberIds || []).length;
    /* Gabriel's wording, 2026-09-21. The name is the identity attribute value: these people have no business group yet. */
    C.modal({ title: `Exclude ${U.esc(u.name)} from governance`, body: `<p>${U.fmtNum(n)} ${U.plural(n, "person", "people")} assigned to ${U.esc((u.rawValues || []).join(" and "))} will no longer be included in governance, reviewed, or shown here. Archive360 will continue to archive their activity. This change will be published immediately. You can reverse it at any time by selecting "Include in governance" on the Business Group Mapping page.</p>${C.field("Reason", `<textarea class="inp" name="reason" rows="2" placeholder="Required. Shown in the row history and Audit History."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary btn-danger" data-action="go">${I.x} Exclude and publish</button>`,
      onOpen(wrap) { guard(wrap, () => wrap.querySelector("textarea[name='reason']").value.trim(), "Enter the reason first."); wrap.querySelector("[data-action='go']").addEventListener("click", () => { const r = wrap.querySelector("textarea[name='reason']").value.trim(); if (!r) { AGC.shell.toast("A reason is required.", "warn"); return; } const res = S.excludeUnregisteredValue(u.id, r); done(`${U.esc(u.name)} excluded from governance. Mapping v${res.version} published.`); }); } });
  };
  /* Link is a credential's decision only: the key belongs to an application that is already registered. An outside GPT had a Link decision too
     ("it is really one of our registered AI assets") until Gabriel asked what it was for (2026-09-21): it could only target the few individually
     registered assets, a GPT seen twice is a Dismiss as duplicate, and recognizing a GPT from another of the customer's own workspaces is the
     connector's job, not a person's. It was removed. */
  P.linkDialog = function (u) {
    const insts = S.instancesOrdered().filter((i) => i.platformType === "Custom AI application");
    const opts = [{ value: "", label: "Choose an AI system" }].concat(insts.map((i) => ({ value: i.id, label: `${i.name}${i.recordClassId ? "" : " · not archived"}` })));
    const label = "Registered AI system", help = "The credential belongs to this AI system. It is recorded on the system's registration with its usage.";
    C.modal({ title: `Assign ${U.esc(u.name)} to a registered AI system`, size: "modal-lg", body: `${C.field(label, C.select("target", opts, ""), help)}${C.field("Note", `<textarea class="inp" name="note" rows="2" placeholder="Optional. Recorded with the decision."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="go">${I.check} Assign</button>`,
      onOpen(wrap) { guard(wrap, () => wrap.querySelector("select[name='target']").value, "Choose an AI system first."); wrap.querySelector("[data-action='go']").addEventListener("click", () => { const v = wrap.querySelector("select[name='target']").value; if (!v) { AGC.shell.toast("Choose an AI system.", "warn"); return; } S.linkUnregistered(u.id, { instanceId: v }, wrap.querySelector("textarea[name='note']").value.trim()); done(`${U.esc(u.name)} assigned to ${U.esc(S.instance(v).name)}. Recorded in Audit History.`); }); } });
  };
  /* Allow with an owner (Gabriel, 2026-09-18): the customer looked at an outside GPT and accepts it. It records who approved it and for
     what purpose, and the GPT joins the AI Registry as an individually registered AI asset whose owner reconfirms it like any other. */
  P.allowDialog = function (u) {
    const gid = (u.seenInGroupIds || []).find((g) => S.group(g)), grp = gid ? S.group(gid) : null, gOwner = grp ? S.member(grp.ownerMemberId) : null;
    /* The owner of the business group the GPT is used within is proposed, as in the Register individually wizard, and the help text says whose
       name it is and that it can be changed (Gabriel's wording, 2026-09-21; he first took the prefilled name for an arbitrary default). A departed
       owner is never proposed. */
    const months = D.settings.reconfirmation.intervalMonths;
    const proposed = gOwner && gOwner.memberStatus === "Active" ? gOwner.memberId : "";
    const ownerHelp = proposed ? `Required. The business group owner is ${U.esc(gOwner.displayName)}. You can assign a different owner for this AI asset if needed.` : gOwner ? `Required. ${U.esc(grp.name)}'s business group owner, ${U.esc(gOwner.displayName)}, left the organization, so nobody is proposed. Choose an owner for this AI asset.` : "Required. Choose an owner for this AI asset.";
    let picker;
    C.modal({ title: `Allow ${U.esc(u.name)}`, size: "modal-lg", body: `<p>Records that this GPT, built outside your workspace, is allowed for the purpose below, and who answers for it. It joins the AI Registry as an individually registered AI asset${grp ? ` of ${U.esc(grp.name)}` : ""}, and its owner reconfirms it every ${months} months like any other. Archive360 still sees only your people's interactions with it, never its instructions, knowledge or actions.</p>
        ${C.field("Accountable owner", C.memberPicker("allowOwner", { value: proposed }), ownerHelp)}
        ${C.field("Approved purpose", `<textarea class="inp" name="purpose" rows="2" placeholder="Required. What your people may use this GPT for."></textarea>`)}
        ${C.field("Note", `<textarea class="inp" name="note" rows="2" placeholder="Optional. For example, what was checked before allowing it."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="go">${I.checkCircle} Allow</button>`,
      onOpen(wrap) {
        const draw = C.bindOwnerNote(wrap, "allowOwner", grp ? grp.id : null, "AI asset");
        picker = C.bindMemberPicker(wrap, "allowOwner", null, draw);
        const purposeOf = () => wrap.querySelector("textarea[name='purpose']").value.trim();
        guard(wrap, () => picker.value() && purposeOf(), () => (picker.value() ? "State the approved purpose first." : purposeOf() ? "Choose the accountable owner first." : "Choose the owner and state the purpose first."));
        wrap.querySelector("[data-action='go']").addEventListener("click", () => {
          const owner = picker.value(), purpose = wrap.querySelector("textarea[name='purpose']").value.trim();
          if (!owner) { AGC.shell.toast("Choose the accountable owner.", "warn"); return; }
          if (!purpose) { AGC.shell.toast("State the approved purpose.", "warn"); return; }
          S.allowExternal(u.id, { ownerMemberId: owner, approvedPurpose: purpose, note: wrap.querySelector("textarea[name='note']").value.trim() });
          done(`${U.esc(u.name)} allowed. It is now on the AI Registry with ${U.esc(S.member(owner).displayName)} as its owner.`);
        });
      } });
  };
  P.unsanctionedDialog = function (u) {
    const gids = (u.seenInGroupIds || []).filter((g) => S.group(g));
    C.modal({ title: `Prohibit ${U.esc(u.name)}`, body: `<p>Records that this ${kindOf(u).one} is prohibited for business use. Archive360 keeps archiving whatever it sees; business data sent to it is flagged for review under the Unsanctioned system rule; ${gids.length ? `the ${U.plural(gids.length, "owner", "owners")} of ${gids.map((g) => U.esc(S.groupName(g))).join(" and ")} ${gids.length === 1 ? "hears" : "hear"} about it in the next digest` : "no group owner is notified because nobody is attributed"}. Nothing is switched off: ${u.type === "Unclaimed API key" ? "revoking the credential happens with the vendor" : "blocking it for everyone happens in the platform's admin console, and stopping the use is the group's job"}.</p>${C.field("Reason", `<textarea class="inp" name="reason" rows="2" placeholder="Required. Recorded with the decision."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary btn-danger" data-action="go">${I.alert} Prohibit</button>`,
      onOpen(wrap) { guard(wrap, () => wrap.querySelector("textarea[name='reason']").value.trim(), "Enter the reason first."); wrap.querySelector("[data-action='go']").addEventListener("click", () => { const r = wrap.querySelector("textarea[name='reason']").value.trim(); if (!r) { AGC.shell.toast("A reason is required.", "warn"); return; } S.markUnsanctioned(u.id, r); done(`${U.esc(u.name)} prohibited.`); }); } });
  };
  P.dismissDialog = function (u) {
    const cats = ["Test traffic", "Duplicate", "False positive", "Retired, no longer in use"].map((c) => ({ value: c, label: c }));
    C.modal({ title: `Dismiss ${U.esc(u.name)}`, body: `<p>Closes the item without a governance decision. It leaves the queue, the dismissal and its reason go to Audit History, and it reappears as a new item if the activity continues.</p>${C.field("Reason", C.select("category", cats, cats[0].value))}${C.field("Note", `<textarea class="inp" name="note" rows="2" placeholder="Optional."></textarea>`)}`,
      footer: `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button><button type="button" class="btn btn-primary" data-action="go">${I.minus} Dismiss</button>`,
      onOpen(wrap) { wrap.querySelector("[data-action='go']").addEventListener("click", () => { S.dismissUnregistered(u.id, wrap.querySelector("select[name='category']").value, wrap.querySelector("textarea[name='note']").value.trim()); done(`${U.esc(u.name)} dismissed.`); }); } });
  };
  /* Hands off to the Settings wizard, pre-filled. An unknown identity's content already sits in the unassigned Ingestion API record
     class, so that class is proposed; a credential has no content, so "Not archived" is proposed and the Administrator gives the reason, or
     chooses the record class if one exists for it. Saving resolves the item. */
  P.addInstance = function (u) {
    const pretty = (s) => s.replace(/^sp-|^svc-/, "").split(/[-_\s]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    /* The person who created the API access is proposed as the owner, and the help text says so (Gabriel, 2026-09-22: keep the default, explain it). */
    const ownerId = u.ownerMemberId || "", creator = S.member(u.ownerMemberId);
    const ownerHelp = creator ? `Required. ${U.esc(creator.displayName)} created this API access originally and is proposed as its owner. You can assign a different owner for this AI system if needed.` : undefined;
    (AGC.pages.instances || AGC.pages.settings).instanceWizard(null, { name: pretty(u.name), platformType: "Custom AI application", ownerMemberId: ownerId, ownerHelp, externalIdentifier: u.identity || u.name, unregisteredItemId: u.id,
      recordClassId: "", noArchive: u.type === "Unclaimed API key",
      apiAccess: u.type === "Unclaimed API key" ? { name: u.name, redacted: u.keyRedacted, provider: u.provider, projectName: u.projectName, identityType: u.identityType, lastUsed: u.lastUsed, requests30d: u.requests30d, models: u.models } : null,
      onCreated: (inst) => { S.resolveUnregisteredAsInstance(u.id, inst); AGC.router.navigate("#/unregistered/" + u.id); setTimeout(() => AGC.shell.toast(`${U.esc(u.name)} added as a new AI system, ${U.esc(inst.name)}, and registered as Pending.`, "success"), 60); } });
  };
})();
