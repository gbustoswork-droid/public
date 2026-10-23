/* Interactions (agreed with Gabriel, 2026-09-23; redesigned to the shape of his old prototype on 2026-09-24). The group's Interactions
   sub-page is the home of interactions: a tree of the group's people, current members, former members and the people of other groups
   who used its AI assets, each opening to their interactions, on the left; the chosen interaction, every archived turn of it, on the right.
   The tree pane sticks and scrolls on its own, the one deliberate exception to the one-scrollbar rule, because the tree must stay put
   while a long conversation scrolls. Quick filters narrow the tree; "Find in this interaction" searches and dates the turns on the right.
   A person's Interactions sub-page is the same split view with the person as the root and one node per business group. Who may see a
   list follows the People rule; the content of an interaction needs an Archive360 Entitlement Policy covering the group, and every open
   is written to Audit History as "Interaction content viewed". The conversation card is the component the Findings review will reuse. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.interactions = {});
  const STATUSES = [["Active", "Active"], ["Archived", "Archived"], ["Deleted", "Deleted"], ["Temporary", "Temporary chat"]];
  const fresh = () => ({ scope: "", members: "all", statuses: new Set(STATUSES.map(([k]) => k)), findingStatuses: new Set(), apps: new Set(), actions: false, memberName: "", chatName: "", asset: null, risk: null, expanded: new Set(), collapsed: new Set(), selected: null, find: "", from: "", to: "", details: false, ctx: new Set() });
  let ui = fresh();
  P.ui = () => ui;
  (AGC.personaHooks = AGC.personaHooks || []).push(() => { ui = fresh(); });
  const viewed = new Set();
  const current = { scope: null };
  const extra = { mark: null, focusTurn: null };  // set by conversationHtml for the review screen: the values to mark, the turn to focus
  let map = null;
  P.get = (id) => { if (!map) { map = {}; D.interactions.forEach((x) => { map[x.interactionId] = x; }); } return map[id] || null; };
  const query = () => { const o = {}; (location.hash.split("?")[1] || "").split("&").forEach((kv) => { const [k, v] = kv.split("="); if (k) o[decodeURIComponent(k)] = decodeURIComponent(v || ""); }); return o; };
  /* Drops ?open= from the address once the reader moves on. ?asset= stays: it locks a person's page to one AI asset (Gabriel, 2026-09-24).
     ?risk= stays too: it narrows an AI asset's page to the evidence behind one risk factor (2026-10-22), and only "Show all" drops it. */
  const dropQuery = () => { const [path, qs] = location.hash.split("?"); if (!qs) return; const keep = qs.split("&").filter((kv) => kv.startsWith("asset=") || kv.startsWith("risk=")); history.replaceState(null, "", path + (keep.length ? "?" + keep.join("&") : "")); };
  const dropRisk = () => { const [path, qs] = location.hash.split("?"); if (!qs) return; const keep = qs.split("&").filter((kv) => !kv.startsWith("risk=")); history.replaceState(null, "", path + (keep.length ? "?" + keep.join("&") : "")); };
  const assetOf = (x) => (x.aiSystemId ? S.system(x.aiSystemId) : null);
  const canSeeGroup = (g) => !!(AGC.pages.group && AGC.pages.group.canSeeMembers && AGC.pages.group.canSeeMembers(g));
  const canSeePerson = (m) => !!(m && AGC.pages.people && AGC.pages.people.canSee && AGC.pages.people.canSee(m));
  const groupAt = (m, date) => (m && AGC.pages.people && AGC.pages.people.groupAt ? AGC.pages.people.groupAt(m, date) : (m ? m.primaryGroupId : null));
  const canOpen = (x) => S.can("settings") || (!!x.groupId && S.isEntitled(x.groupId));  // content, never granted by ownership
  const personLink = (m) => (m ? `${canSeePerson(m) ? `<a href="#/members/${m.memberId}">${U.esc(m.displayName)}</a>` : U.esc(m.displayName)}${U.statusTag(m)}` : '<span class="muted">Unknown person</span>');
  const notAvailable = (what) => `<div class="placeholder-card"><div class="ph-title">${I.lock} ${what} not available for your profile</div><div class="ph-body">Access to people and their activity comes from your Profile and Entitlement Policies, managed by an Archive360 Administrator.</div></div>`;
  const newest = (a, b) => (b.timestamp || b.date).localeCompare(a.timestamp || a.date);
  const dayOf = (ts) => (ts || "").slice(0, 10);
  const nextDay = (iso) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  const kindName = (s) => (s ? (s.type === "Custom" ? "Custom AI application" : s.type) : "");

  /* The chat's state in ChatGPT as the daily collection last saw it (Gabriel, 2026-09-24): Archive360 keeps the content whatever it is. */
  const STATUS_UI = { Active: { label: "Active", icon: I.interactions, pill: "pill-managed" }, Archived: { label: "Archived", icon: I.archive, pill: "pill-pending" }, Deleted: { label: "Deleted", icon: I.trash, pill: "pill-danger" }, Temporary: { label: "Temporary chat", icon: I.temp, pill: "pill-muted" } };
  function statusOf(x) {
    const key = STATUS_UI[x.chatStatus] ? x.chatStatus : "Active", st = STATUS_UI[key], plat = (S.platform(x.platformId) || {}).name || "the platform";
    const title = key === "Active" ? `Active in ${plat} at the last daily collection` : key === "Temporary" ? `A temporary chat, not kept in the person's ${plat} history; archived by Archive360` : `${st.label} by the person in ${plat}${x.chatStatusDate ? `, detected by the daily sync of ${U.fmtDate(x.chatStatusDate)}` : ""}; Archive360 keeps the content`;
    return Object.assign({ key, title }, st);
  }

  /* A finding is what the rules flagged; it is a violation only once a reviewer confirmed it, and nothing once dismissed (Gabriel,
     2026-09-24). Every count and tag on these pages says which, so a red number is always a confirmed violation. */
  const FINDING_STATUSES = [["Confirmed", "Confirmed violations"], ["Detected", "Findings awaiting review"], ["Dismissed", "Dismissed findings"]];
  /* An app call on a turn (Gabriel, 2026-09-30): the app, what it did, and the item only where the record carries it, with where that came
     from. The record is the app-call log, which proves the call and not every object the app touched. */
  const EVIDENCE = { cited: "cited in the answer", response: "named in the app's response", none: "item not recorded" };
  const ITEM_WORD = { file: "file", channel: "channel", email: "email", message: "message", site: "site", folder: "folder", meeting: "meeting" };
  const appCallsHtml = (calls) => (calls || []).map((c) => `<div class="small app-call">${I.link || I.stack} <span class="strong">${U.esc(c.app)}</span> ${U.esc(c.action)}${c.item ? `: ${U.esc(ITEM_WORD[c.item.kind] || c.item.kind || "item")} <span class="strong">${U.esc(c.item.name)}</span>${c.item.container ? ` <span class="muted">(${U.esc(c.item.container)})</span>` : ""}` : ""} <span class="muted">· ${EVIDENCE[c.evidence] || ""}</span></div>`).join("");
  /* An Action call on a turn (2026-09-30): the Action, the operation ChatGPT chose, the domain it called, and what the app-call log
     recorded of it. The confirmation ChatGPT shows for a consequential operation is in no log, so a call never claims it. */
  const actionCallsHtml = (calls) => (calls || []).map((c) => `<div class="small app-call">${I.external || I.link} <span class="strong">Action ${U.esc(c.action)}</span> · <span class="mono">${U.esc(c.operationId)}</span> ${U.esc(c.method)} ${U.esc(c.path)} · ${U.esc(c.domain)}${c.external ? ' <span class="tag tag-pending" title="Outside Brookhaven Financial: what people type can be sent to a third party">Outside Brookhaven</span>' : ""} <span class="muted">· request ${c.inputRecorded ? "recorded" : "not recorded"} · response ${c.outputRecorded ? "recorded" : "not recorded"}${c.consequential ? " · confirmation asked, not logged" : ""}</span></div>`).join("");
  const actionsUsedChips = (x) => { const t = {}; (x.actionCalls || []).forEach((c) => { t[c.action] = (t[c.action] || 0) + 1; }); return Object.entries(t).map(([a, n]) => `<span class="chip chip-muted">${U.esc(a)} · ${n} ${U.plural(n, "call")}</span>`).join(" "); };
  const appsUsedChips = (x) => { const t = {}; (x.appCalls || []).forEach((c) => { t[c.app] = (t[c.app] || 0) + 1; }); return Object.entries(t).map(([a, n]) => `<span class="chip chip-muted">${U.esc(a)} · ${n} ${U.plural(n, "call")}</span>`).join(" "); };
  function findingTally(x) {
    const t = { Confirmed: 0, Detected: 0, Dismissed: 0 };
    (x.findingIds || []).forEach((fid) => { const f = S.byId.finding ? S.byId.finding[fid] : null; if (f && t[f.status] != null) t[f.status]++; });
    return t;
  }
  const findingWord = (f) => { const rv = f.review || {}, who = rv.reviewerMemberId ? S.member(rv.reviewerMemberId) : null, by = who ? ` by ${U.esc(who.displayName)}` : "", on = rv.decidedAt ? `, ${U.fmtDate(rv.decidedAt)}` : ""; return f.status === "Confirmed" ? `confirmed violation${by}${on}` : f.status === "Dismissed" ? `dismissed${by}${on}${rv.reason ? `: ${U.esc(rv.reason)}` : ""}` : "awaiting review"; };

  /* ---------- Filters (the Quick filters popover) ---------- */
  const assetMatch = (x) => !ui.asset || (ui.asset === "direct" ? !x.aiSystemId : x.aiSystemId === ui.asset);
  const riskMatch = (x) => !ui.risk || ui.risk.ints.has(x.interactionId);  // the evidence behind one risk factor (2026-10-22), read from the address, not a Quick filter
  const intMatches = (x) => riskMatch(x) && assetMatch(x) && ui.statuses.has(x.chatStatus || "Active") && (!ui.findingStatuses.size || Array.from(ui.findingStatuses).some((k) => findingTally(x)[k] > 0)) && (!ui.chatName || (x.chatName || "").toLowerCase().includes(ui.chatName.trim().toLowerCase())) && (!ui.apps.size || (x.appCalls || []).some((c) => ui.apps.has(c.app))) && (!ui.actions || (x.actionCalls || []).length > 0);
  const nameOk = (m) => !ui.memberName || (m.displayName || "").toLowerCase().includes(ui.memberName.trim().toLowerCase());
  const activeFilters = () => (ui.members !== "all" ? 1 : 0) + (ui.statuses.size < STATUSES.length ? 1 : 0) + (ui.findingStatuses.size ? 1 : 0) + (ui.memberName.trim() ? 1 : 0) + (ui.chatName.trim() ? 1 : 0) + (ui.apps.size ? 1 : 0) + (ui.actions ? 1 : 0);

  /* ---------- The tree ---------- */
  /* A group's people: current members, former members (terminated, or moved to another group) and the people of other groups who used
     its AI assets, so every interaction attributed to the group is reachable. */
  function groupModel(g) {
    const pool = S.scoped(S.interactionsByGroup[g.id] || []);
    const people = S.membersByGroup[g.id] || [];
    const currentMembers = S.sortMembers(people.filter((m) => m.memberStatus !== "Terminated"));
    const movers = D.members.filter((m) => m.primaryGroupId !== g.id && (m.groupHistory || []).some((h) => h.groupId === g.id && h.toDate));
    const former = S.sortMembers(people.filter((m) => m.memberStatus === "Terminated").concat(movers));
    const known = new Set(currentMembers.concat(former).map((m) => m.memberId));
    const others = S.sortMembers(U.uniq(pool.map((x) => x.memberId)).filter((id) => !known.has(id)).map((id) => S.member(id)).filter(Boolean));
    const left = (m) => { if (m.memberStatus === "Terminated") return `Terminated ${U.fmtDate(m.removedDate)}`; const h = (m.groupHistory || []).filter((r) => r.groupId === g.id && r.toDate).slice(-1)[0]; return h ? `Left ${U.fmtDate(h.toDate)} for ${U.esc(S.groupName(m.primaryGroupId))}` : ""; };
    return { pool, sections: [{ key: "members", label: "Members", people: currentMembers, always: true }, { key: "former", label: "Former members", people: former, sub: left }, { key: "others", label: "People from other business groups", people: others, sub: (m) => U.esc(S.groupName(m.primaryGroupId)) }] };
  }
  /* A person's interactions, one node per business group they belong to: the AI asset's group, or the group they were in at the time. */
  function personModel(m) {
    const pool = (S.interactionsByMember[m.memberId] || []).slice();
    const count = {}; pool.forEach((x) => { const k = x.groupId || "none"; count[k] = (count[k] || 0) + 1; });
    const groups = Object.keys(count).map((gid) => ({ key: `g:${gid}`, gid, label: gid === "none" ? "No business group" : S.groupName(gid) }))
      .sort((a, b) => (a.gid === m.primaryGroupId ? -1 : b.gid === m.primaryGroupId ? 1 : count[b.gid] - count[a.gid]));
    return { pool, groups };
  }
  /* An AI asset's interactions: everyone who used it, the asset's own group's people first, then the people of other business groups. */
  function assetModel(s) {
    const pool = (S.interactionsBySystem[s.id] || []).slice();
    const people = U.uniq(pool.map((x) => x.memberId)).map((id) => S.member(id)).filter(Boolean);
    const g = s.groupId ? S.group(s.groupId) : null;
    const own = g ? S.sortMembers(people.filter((m) => m.primaryGroupId === g.id)) : [];
    const others = S.sortMembers(people.filter((m) => !g || m.primaryGroupId !== g.id));
    const sections = g
      ? [{ key: "members", label: `People in ${U.esc(g.name)}`, people: own, always: true }, { key: "others", label: "People from other business groups", people: others, sub: (m) => U.esc(S.groupName(m.primaryGroupId)) }]
      : [{ key: "others", label: "People who used it", people: others, always: true, sub: (m) => U.esc(S.groupName(m.primaryGroupId)) }];
    return { pool, sections };
  }
  /* A row in the tree. The date is the day of the last turn, the last daily collection that found new turns, and the only handle when
     chat names repeat; the AI asset is named only where the page is not already locked to one (Gabriel, 2026-09-24). */
  function leaf(x) {
    const st = statusOf(x), t = findingTally(x), s = assetOf(x), locked = !!(current.scope && (current.scope.assetId || ui.asset));
    const flags = `${t.Confirmed ? `<span class="tree-flag" title="${t.Confirmed} confirmed ${U.plural(t.Confirmed, "violation")}">${t.Confirmed}</span>` : ""}${t.Detected ? `<span class="tree-flag tree-flag-pending" title="${t.Detected} ${U.plural(t.Detected, "finding")} awaiting review">${t.Detected}</span>` : ""}`;
    return `<li><button type="button" class="tree-leaf${ui.selected === x.interactionId ? " selected" : ""}" data-tree="int" data-id="${x.interactionId}" aria-pressed="${ui.selected === x.interactionId}"><span class="tree-ic" title="${U.esc(st.title)}">${st.icon}</span><span class="tree-leaf-main"><span class="tree-leaf-name">${U.esc(x.chatName || "Untitled")}</span><span class="tree-leaf-sub small muted" title="The day of the last turn: the last daily collection that found new turns">Last turn ${U.fmtDate(x.date)}${locked ? "" : ` · ${s ? U.esc(s.name === x.chatName ? kindName(s) : s.name) : "Direct chat"}`}</span></span>${flags}</button></li>`;
  }
  function node(key, main, sub, ints, opts) {
    const o = opts || {}, open = ui.expanded.has(key), has = ints.length > 0;
    return `<li class="tree-node"><button type="button" class="tree-row${o.cls ? " " + o.cls : ""}" data-tree="node" data-key="${key}" aria-expanded="${open && has}"${has ? "" : " disabled"}><span class="tree-chev">${has ? I.chevronRight : ""}</span>${o.avatar || ""}<span class="tree-name"><span>${main}</span>${sub ? `<span class="tree-sub small muted">${sub}</span>` : ""}</span>${has ? `<span class="count-badge tree-count">${U.fmtNum(ints.length)}</span>` : '<span class="small muted tree-none">none</span>'}</button>${open && has ? `<ul class="tree-children">${ints.map(leaf).join("")}</ul>` : ""}</li>`;
  }
  function treeHtml(scope, model) {
    if (scope.groupId || scope.assetId) {
      return `<ul class="tree">${model.sections.map((sec) => {
        const rows = sec.people.map((m) => ({ m, ints: model.pool.filter((x) => x.memberId === m.memberId && intMatches(x)).sort(newest) })).filter((r) => nameOk(r.m) && ((ui.members === "all" && !scope.assetId) || r.ints.length));
        if (!rows.length && !sec.always) return "";
        const open = !ui.collapsed.has(sec.key);
        return `<li class="tree-section"><button type="button" class="tree-row tree-section-row" data-tree="section" data-key="${sec.key}" aria-expanded="${open}"><span class="tree-chev">${I.chevronRight}</span><span>${sec.label}</span><span class="count-badge">${rows.length}</span></button>${open ? `<ul>${rows.map((r) => node(`${sec.key}:${r.m.memberId}`, `${U.esc(r.m.displayName)}${U.statusTag(r.m)}`, sec.sub ? sec.sub(r.m) : "", r.ints, { avatar: U.avatar(r.m, "sm") })).join("") || '<li class="tree-empty small muted">Nobody matches the Quick filters.</li>'}</ul>` : ""}</li>`;
      }).join("")}</ul>`;
    }
    const m = scope.member, all = model.pool.filter(intMatches);
    const groups = model.groups.map((gr) => ({ gr, ints: all.filter((x) => (x.groupId || "none") === gr.gid).sort(newest) })).filter((r) => r.ints.length);
    return `<ul class="tree"><li class="tree-node"><div class="tree-row tree-root">${U.avatar(m, "sm")}<span class="tree-name"><span>${U.esc(m.displayName)}${U.statusTag(m)}</span><span class="tree-sub small muted">${U.esc(m.jobTitle || "")}</span></span><span class="count-badge tree-count">${U.fmtNum(all.length)}</span></div><ul class="tree-children">${groups.map((r) => node(r.gr.key, U.esc(r.gr.label), "", r.ints)).join("") || '<li class="tree-empty small muted">No interaction matches the Quick filters.</li>'}</ul></li></ul>`;
  }
  function qfHtml(scope) {
    const st = STATUSES.map(([k, l]) => `<label class="qf-opt"><input type="checkbox" name="qfStatus" value="${k}"${ui.statuses.has(k) ? " checked" : ""}/> ${l}</label>`).join("");
    return `<div class="qf-title">Quick filters</div>
      ${scope.groupId ? `<div class="qf-group"><div class="qf-label">Members</div><label class="qf-opt"><input type="radio" name="qfMembers" value="all"${ui.members === "all" ? " checked" : ""}/> All members</label><label class="qf-opt"><input type="radio" name="qfMembers" value="with"${ui.members === "with" ? " checked" : ""}/> Members with interactions only</label></div>` : ""}
      <div class="qf-group"><div class="qf-label">Chat status</div><div class="small muted qf-help">As the platform reported it at the last daily collection. Archive360 keeps the content in every state.</div>${st}</div>
      <div class="qf-group"><div class="qf-label">Show only interactions with</div>${FINDING_STATUSES.map(([k, l]) => `<label class="qf-opt"><input type="checkbox" name="qfFinding" value="${k}"${ui.findingStatuses.has(k) ? " checked" : ""}/> ${l}</label>`).join("")}</div>
      <div class="qf-group"><div class="qf-label">Apps used</div><div class="small muted qf-help">Interactions in which ChatGPT called a connected app, from the app-call log.</div>${(AGC.data.apps || []).map((a) => `<label class="qf-opt"><input type="checkbox" name="qfApp" value="${U.esc(a.app)}"${ui.apps.has(a.app) ? " checked" : ""}/> ${U.esc(a.app)}</label>`).join("")}</div>
      <div class="qf-group"><div class="qf-label">Actions</div><label class="qf-opt"><input type="checkbox" name="qfActions"${ui.actions ? " checked" : ""}/> Only interactions in which ChatGPT called a GPT's Action</label></div>
      ${scope.groupId || scope.assetId ? `<div class="qf-group"><label class="qf-label" for="qfMember">Member name</label><input type="search" class="inp" id="qfMember" placeholder="Search by name" value="${U.esc(ui.memberName)}"/></div>` : ""}
      <div class="qf-group"><label class="qf-label" for="qfChat">Interaction name</label><input type="search" class="inp" id="qfChat" placeholder="Search by name" value="${U.esc(ui.chatName)}"/></div>
      <div class="qf-foot"><button type="button" class="btn btn-sm" data-qf="clear">Clear</button><button type="button" class="btn btn-sm btn-primary" data-qf="close">Close</button></div>`;
  }
  function shownCount(scope, model) {
    if (scope.memberId) return model.pool.filter(intMatches).length;
    const ok = new Set();
    model.sections.forEach((sec) => sec.people.forEach((m) => { if (nameOk(m)) ok.add(m.memberId); }));
    return model.pool.filter((x) => intMatches(x) && ok.has(x.memberId)).length;
  }
  function paneHtml(scope, model) {
    const n = activeFilters(), shown = shownCount(scope, model), total = model.pool.length;
    const s = ui.asset && ui.asset !== "direct" ? S.system(ui.asset) : null;
    const chip = ui.asset ? `<div class="tree-scope small" id="intScope">${I.filter} Only ${ui.asset === "direct" ? "direct chats" : `interactions with <strong>${U.esc(s ? s.name : ui.asset)}</strong>`}</div>` : "";
    const evLine = ui.risk ? riskLineHtml(model) : "";
    return `<div class="int-tree-head">
        <div class="int-tree-title"><span class="strong">${scope.groupId ? "People and interactions" : scope.assetId ? "People who used it" : "Interactions"}</span><span id="intTreeCount"><span class="count-badge">${U.fmtNum(shown)}</span><span class="small muted"> of ${U.fmtNum(total)}${scope.groupId ? " in this period" : ""}</span></span></div>
        <div class="int-tree-tools">
          <button type="button" class="btn btn-sm" data-menu="qf" aria-haspopup="true" aria-controls="menu-qf">${I.filter} Quick filters<span id="qfBadge">${n ? ` <span class="count-badge">${n}</span>` : ""}</span></button>
          <button type="button" class="btn btn-sm" data-action="int-export">${I.list} Export</button>
        </div>
        ${chip}${evLine}
        <div class="menu-pop qf-pop" id="menu-qf" hidden role="dialog" aria-label="Quick filters">${qfHtml(scope)}</div>
      </div>
      <div class="int-tree-body" id="intTree">${treeHtml(scope, model)}</div>`;
  }

  /* ---------- The evidence behind a risk factor (Gabriel, 2026-10-22) ----------
     A factor on the Risk card links here with ?risk=<factor>. The tree is narrowed to the interactions the factor counted, a line above it
     says so and offers the only way to widen it, and the right side lists the findings behind the points until the reader opens one, so no
     content is read, and logged, without a choice. The Quick filters are untouched: they work inside the narrowed set, Clear leaves the
     line in place and the badge does not count it. The numbers are read from the live score, so they agree with the card that linked here. */
  function riskEvidence(s, key) {
    const r = S.riskForAsset(s.id), f = r ? r.factors.find((x) => x.key === key && x.evidence) : null;
    if (!f) return null;
    const findings = f.evidence.findingIds.map((id) => (S.byId.finding ? S.byId.finding[id] : D.findings.find((y) => y.findingId === id))).filter(Boolean);
    const def = S.RISK_MODEL.factors.find((x) => x.key === key) || {};
    return { key, label: f.label, points: f.points, detail: f.detail, how: def.how || "", findings, ints: new Set(f.evidence.interactionIds), from: f.evidence.from, to: f.evidence.to };
  }
  function riskWindowText(r) {
    const nf = r.findings.length, ni = r.ints.size, span = r.from ? `${U.fmtDate(r.from)} to ${U.fmtDate(r.to)}` : "";
    switch (r.key) {
      case "violations": return `${nf} confirmed ${U.plural(nf, "violation")} on ${ni} ${U.plural(ni, "interaction")}, ${span}`;
      case "sensitive": return `${ni} ${U.plural(ni, "interaction")} that carried sensitive data, ${span}`;
      case "recurrence": { const people = U.uniq(r.findings.map((f) => f.memberId)).length; return `${people} ${U.plural(people, "person", "people")} with three or more confirmed violations, ${nf} on ${ni} ${U.plural(ni, "interaction")}, ${span}`; }
      case "backlog": return `${nf} ${U.plural(nf, "finding")} awaiting review for more than 30 days, detected on or before ${U.fmtDate(r.to)}, on ${ni} ${U.plural(ni, "interaction")}`;
      default: return `${ni} ${U.plural(ni, "interaction")}`;
    }
  }
  function riskLineHtml(model) {
    const r = ui.risk;
    return `<div class="tree-scope small" id="intRisk">${I.alert} <span>Showing the evidence for <strong>${U.esc(r.label)}</strong>: ${riskWindowText(r)}. <button type="button" class="link-btn" data-action="risk-show-all">Show all ${U.fmtNum(model.pool.length)}</button></span></div>`;
  }
  function riskListHtml() {
    const r = ui.risk;
    const rows = r.findings.slice().sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).map((f) => {
      const m = S.member(f.memberId), x = P.get(f.interactionId), rule = S.rule(f.ruleId);
      const age = f.status === "Detected" ? ` <span class="muted">· waiting ${U.daysAgo(f.detectedAt)} days</span>` : "";
      return `<tr><td>${U.fmtDate(f.detectedAt)}</td><td><a href="#/findings/all/${f.findingId}">${U.esc(rule ? rule.name : f.ruleId)}</a><div class="small muted">${m ? U.esc(m.displayName) : "Unknown person"} · ${U.esc(S.dcName(f.dataClassId))}${x ? ` · ${U.esc(x.chatName || "Untitled")}` : ""}</div></td><td>${U.sevChip(f.severity)}</td><td class="small">${findingWord(f)}${age}</td><td class="num"><button type="button" class="btn btn-sm" data-action="risk-open" data-id="${f.interactionId}" data-turn="${f.turnNumber || ""}"${x ? "" : " disabled"}>Open</button></td></tr>`;
    }).join("");
    /* The counting rule first (Gabriel, 2026-10-22): two factors can rest on the same records and score them differently, so the card says how
       this one counts before it says what it found. The sentence is the model's own, as the How risk is scored dialog prints it. */
    const lead = `<p class="small muted"><span class="strong">How it is counted:</span> ${U.esc(r.how)}</p><p class="small muted">${U.esc(r.detail)}. Open shows the interaction here, with the flagged turn in view; the rule's name opens the finding.</p>`;
    return C.card(U.esc(r.label), `${lead}<table class="tbl risk-ev"><thead><tr><th>Detected</th><th>Finding</th><th>Severity</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`, { cls: "risk-ev-card", action: `<span class="pill pill-muted">+${r.points} ${U.plural(r.points, "point")}</span>` });
  }

  /* ---------- The conversation: every archived turn, with the day each collection ended, files, edits and findings ---------- */
  const rxEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /* Escapes the text and wraps every match of the search in a highlight. */
  function hl(text, q) {
    const t = text || "", parts = [];
    if (q) parts.push(rxEsc(q));
    if (extra.mark) parts.push(extra.mark instanceof RegExp ? extra.mark.source : rxEsc(String(extra.mark)));
    if (!parts.length) return U.esc(t);
    const re = new RegExp(parts.join("|"), "gi");
    let out = "", last = 0, m;
    while ((m = re.exec(t))) { out += U.esc(t.slice(last, m.index)) + `<mark class="hit">${U.esc(m[0])}</mark>`; last = m.index + m[0].length; if (!m[0].length) re.lastIndex++; }
    return out + U.esc(t.slice(last));
  }
  const attData = (a) => `data-att="${U.esc(a.file || "")}" data-name="${U.esc(a.name || "")}" data-type="${a.type || "file"}" data-size="${a.sizeKB || ""}"`;
  function attachmentsHtml(list) {
    if (!(list || []).length) return "";
    return `<div class="att-list">${list.map((a) => a.type === "image"
      ? `<span class="att-thumb-wrap"><img class="att-thumb" src="${U.esc(a.file)}" alt="${U.esc(a.name)}" title="Open the image" ${attData(a)}/><span class="small muted">${I.image} ${U.esc(a.name)} · ${a.sizeKB} KB</span></span>`
      : `<button type="button" class="att-chip" title="Preview the file" ${attData(a)}>${I.file} ${U.esc(a.name)} <span class="muted">· ${a.sizeKB} KB</span></button>`).join("")}</div>`;
  }
  function daySep(d) {
    const sync = nextDay(d), label = sync <= U.today() ? `collected by the daily sync of ${U.fmtDate(sync)}` : "collected today";
    return `<li class="turn-day"><span>${U.fmtDate(d)} · ${label}</span></li>`;
  }
  function turnHtml(t, x, m, s, q, mode) {
    /* mode: null when every turn is shown; "match" or "context" while a search or the dates narrow the list (Gabriel, 2026-10-06). */
    const fnd = (fid) => { const f = S.byId.finding ? S.byId.finding[fid] : null; if (!f) return ""; const r = S.rule(f.ruleId), rn = U.esc(r ? r.name : ""), sev = U.esc(f.severity || "");
      if (f.status === "Confirmed") return `<span class="tag tag-danger" title="${rn}">Violation · ${sev} · confirmed</span>`;
      if (f.status === "Dismissed") return `<span class="tag" title="${rn}">Finding dismissed${f.review && f.review.reason ? ` · ${U.esc(f.review.reason)}` : ""}</span>`;
      return `<span class="tag tag-pending" title="${rn}">Finding · ${sev} · awaiting review</span>`; };
    const flagged = (t.violationFlags || []).map((fid) => (S.byId.finding ? S.byId.finding[fid] : null)).filter(Boolean);
    const tint = flagged.some((f) => f.status === "Confirmed") ? " turn-flagged" : flagged.some((f) => f.status === "Detected") ? " turn-detected" : flagged.length ? " turn-dismissed" : "";
    const prev = t.wasEdited && (t.editHistory || []).length ? t.editHistory[0] : null;
    const where = mode ? ` <span class="muted small turn-no">turn ${t.turnNumber} of ${mode.total}</span>` : "";
    const ctxTag = mode && mode.kind === "context" ? ` <span class="tag">Context</span> <button type="button" class="link-btn small" data-action="ctx-hide" data-turn="${t.turnNumber}">Hide</button>` : "";
    return `<li class="turn${tint}${extra.focusTurn === t.turnNumber ? " turn-focus" : ""}${mode && mode.kind === "context" ? " turn-context" : ""}" id="turn-${t.turnNumber}">
        <div class="turn-side">${m ? U.avatar(m, "sm") : ""}</div>
        <div class="turn-main">
          <div class="turn-head"><span class="strong">${m ? U.esc(m.displayName) : "Person"}</span><span class="muted"> · ${U.fmtDateTime(t.promptTimestamp)}</span>${where}${ctxTag}${prev ? ` <span class="tag tag-info">Latest version</span> <button type="button" class="link-btn small" data-action="turn-prev" aria-expanded="false">Show the earlier version</button>` : ""}${(t.violationFlags || []).map(fnd).join(" ")}</div>
          <div class="turn-body">${hl(t.userPrompt, q)}</div>
          ${prev ? `<div class="turn-prev" hidden><div class="turn-head"><span class="tag">Earlier version (edited)</span><span class="muted small">replaced ${U.fmtDateTime(prev.editedAt)}</span></div><div class="turn-body turn-body-prev">${hl(prev.previousPrompt, q)}</div></div>` : ""}
          ${attachmentsHtml(t.attachments)}
          ${appCallsHtml(t.appCalls)}${actionCallsHtml(t.actionCalls)}
          <div class="turn-ai">
            <div class="turn-head"><span class="ai-badge">AI</span><span class="strong">${s ? U.esc(s.name) : U.esc((S.platform(x.platformId) || {}).name || "AI")}</span><span class="muted"> · ${U.fmtDateTime(t.responseTimestamp)}${t.model ? ` · ${U.esc(t.model)}` : ""}${t.tokensUsed ? ` · ${U.fmtNum(t.tokensUsed)} tokens` : ""}</span></div>
            <div class="turn-body">${hl(t.aiResponse, q)}</div>
          </div>
        </div>
      </li>`;
  }
  /* While a search or the dates narrow the list, the turns that match stay where they are in the transcript, and the reader can open the
     turn before or after any shown turn, one turn per click, without touching the search (Gabriel, 2026-10-06: the context around a match).
     A gap between two shown turns says how many turns it hides and offers the next turn below the upper one and the previous turn above the
     lower one; at the ends of the interaction the control is unavailable and the line says why. A revealed turn is marked Context and can be
     hidden again; the search term stays highlighted wherever it occurs. */
  function gapHtml(turns, a, b, total) {
    const n = b - a + 1, first = turns[a], last = turns[b];
    const btn = (t, label) => `<button type="button" class="link-btn small" data-action="ctx-reveal" data-turn="${t.turnNumber}">${label}</button>`;
    if (n === 1) return `<li class="turn-gap">${btn(first, `Show turn ${first.turnNumber} of ${total}`)}</li>`;
    const next = a > 0 ? btn(first, `▼ Show the next turn (${first.turnNumber})`) : "";
    const prevB = b < total - 1 ? btn(last, `▲ Show the previous turn (${last.turnNumber})`) : "";
    return `<li class="turn-gap">${next}<span class="small muted">${n} turns not shown</span>${prevB}</li>`;
  }
  const edgeHtml = (which, total) => `<li class="turn-edge small muted">${which === "start" ? "Start of the interaction: there is no turn before turn 1." : `End of the interaction: there is no turn after turn ${total}.`}</li>`;
  function turnsHtml(x, m, s, turns) {
    const q = ui.find.trim(), from = ui.from, to = ui.to, ql = q.toLowerCase(), total = turns.length;
    const filtering = !!(q || from || to);
    const hit = (t) => !q || [t.userPrompt, t.aiResponse].concat((t.editHistory || []).map((e) => e.previousPrompt)).some((v) => (v || "").toLowerCase().includes(ql));
    const inDates = (t) => { const d = dayOf(t.promptTimestamp); return (!from || d >= from) && (!to || d <= to); };
    const matchSet = new Set(turns.filter((t) => hit(t) && inDates(t)).map((t) => t.turnNumber));
    const ctx = filtering ? ui.ctx : new Set();
    const shown = filtering ? turns.filter((t) => matchSet.has(t.turnNumber) || ctx.has(t.turnNumber)) : turns;
    const ctxShown = filtering ? shown.filter((t) => !matchSet.has(t.turnNumber)).length : 0;
    const what = q && (from || to) ? `mention "${U.esc(q)}" within the dates` : q ? `mention "${U.esc(q)}"` : "fall within the dates";
    const note = filtering ? `<div class="small muted conv-find-note">${matchSet.size} of ${total} ${U.plural(total, "turn")} ${what}.${ctxShown ? ` ${ctxShown} more ${U.plural(ctxShown, "turn")} shown for context. <button type="button" class="link-btn small" data-action="ctx-hide-all">Hide context</button>` : ""}</div>` : "";
    const index = new Map(turns.map((t, i) => [t.turnNumber, i]));
    let lastDay = null, items = "";
    shown.forEach((t, k) => {
      const i = index.get(t.turnNumber);
      if (filtering) {
        const pi = k > 0 ? index.get(shown[k - 1].turnNumber) : -1;
        if (i - pi > 1) items += gapHtml(turns, pi + 1, i - 1, total);
        else if (k === 0 && i === 0) items += edgeHtml("start", total);
      }
      const d = dayOf(t.promptTimestamp); if (d !== lastDay) { items += daySep(d); lastDay = d; }
      items += turnHtml(t, x, m, s, q, filtering ? { kind: matchSet.has(t.turnNumber) ? "match" : "context", total } : null);
    });
    if (filtering && shown.length) { const li = index.get(shown[shown.length - 1].turnNumber); items += li < total - 1 ? gapHtml(turns, li + 1, total - 1, total) : edgeHtml("end", total); }
    const cap = turns.length < (x.turnCount || 0) ? `<p class="small muted">Showing the first ${turns.length} of ${x.turnCount} turns in this prototype.</p>` : "";
    return `${note}<ol class="turns">${items || '<li class="small muted turn-none">No turn matches. Clear the search or widen the dates.</li>'}</ol>${cap}`;
  }
  function detailsHtml(x, m, s, g, w, plat, turns) {
    const who = m ? U.esc(m.displayName) : "An unknown person", atTime = m ? groupAt(m, x.date) : null;
    const version = s ? (s.configVersions || []).filter((v) => v.date <= x.date).slice(-1)[0] : null;
    const findings = (x.findingIds || []).map((fid) => (S.byId.finding ? S.byId.finding[fid] : null)).filter(Boolean);
    const st = statusOf(x), days = U.uniq(turns.map((t) => dayOf(t.promptTimestamp)));
    const first = turns.length ? turns[0].promptTimestamp : (x.threadCreatedDate || x.date), last = turns.length ? turns[turns.length - 1].promptTimestamp : (x.timestamp || x.date);
    const statusLine = st.key === "Active" ? `<div class="small muted">In ${U.esc(plat.name || "the platform")} at the last daily collection.</div>` : st.key === "Temporary" ? `<div class="small muted">Not kept in the person's ${U.esc(plat.name || "")} history. Archive360 archived it all the same.</div>` : `<div class="small muted">${st.label} by the person in ${U.esc(plat.name || "the platform")}${x.chatStatusDate ? `, detected by the daily sync of ${U.fmtDate(x.chatStatusDate)}` : ""}. Archive360 keeps the content.</div>`;
    return `<dl class="kv kv-wide kv-detail conv-details"${ui.details ? "" : " hidden"}>
        <dt>Person</dt><dd>${personLink(m)}${m && m.jobTitle ? `<div class="small muted">${U.esc(m.jobTitle)}</div>` : ""}</dd>
        <dt>Business group</dt><dd>${g ? `<a href="#/groups/${g.id}">${U.esc(g.name)}</a>` : '<span class="muted">None</span>'}${s && atTime && g && atTime !== g.id ? `<div class="small muted">The AI asset's group. ${who} was in ${U.esc(S.groupName(atTime))} at the time.</div>` : ""}</dd>
        <dt>AI asset</dt><dd>${s ? `${s.type === "Custom" && s.registerEntryId ? `<a href="#/registry/${s.registerEntryId}">${U.esc(s.name)}</a>` : `<a href="#/systems/${s.id}">${U.esc(s.name)}</a>`} · ${U.esc(kindName(s))}${s.external ? " · built outside your workspace" : ""}${version ? `<div class="small muted">Instructions in force: version ${version.version} of ${U.fmtDate(version.date)}</div>` : ""}` : '<span class="muted">None: a direct chat</span>'}</dd>
        <dt>AI system</dt><dd>${U.esc(plat.name || "")}${w ? ` · ${U.esc(w.name)} workspace` : ""}</dd>
        <dt>When</dt><dd>${days.length > 1 ? `${U.fmtDateTime(first)} to ${U.fmtDateTime(last)}<div class="small muted">Turns on ${days.length} days, collected by ${days.length} daily syncs.</div>` : `${U.fmtDateTime(x.timestamp || x.date)}${x.threadCreatedDate && x.threadCreatedDate !== x.date ? `<div class="small muted">Thread started ${U.fmtDate(x.threadCreatedDate)}</div>` : ""}`}</dd>
        <dt>Chat status</dt><dd>${st.label}${statusLine}</dd>
        <dt>Turns</dt><dd>${U.fmtNum(x.turnCount || 0)}${x.tokenCount ? ` · ${U.fmtNum(x.tokenCount)} tokens` : ""}</dd>
        <dt>Models</dt><dd>${(x.models || []).length ? x.models.map((mm) => U.esc(mm)).join(", ") : '<span class="muted">Not recorded</span>'}</dd>
        <dt>Files shared</dt><dd>${(x.attachedFiles || []).length ? `<div class="att-list att-list-tight">${x.attachedFiles.map((a) => `<button type="button" class="att-chip" title="Preview the file" ${attData(a)}>${a.type === "image" ? I.image : I.file} ${U.esc(a.name)} <span class="muted">· ${a.sizeKB} KB · turn ${a.turnNumber}</span></button>`).join("")}</div>` : '<span class="muted">None</span>'}</dd>
        ${(x.appCalls || []).length ? `<dt>Apps used</dt><dd>${appsUsedChips(x)}</dd>` : ""}
        ${(x.actionCalls || []).length ? `<dt>Actions called</dt><dd>${actionsUsedChips(x)}</dd>` : ""}
        <dt>Content</dt><dd>${x.contentRetained ? "Retained" : "Not retained; metadata only"}</dd>
        <dt>Findings</dt><dd>${findings.length ? `<ul class="plain-list">${findings.map((f) => { const r = S.rule(f.ruleId); return `<li>${U.sevChip(f.severity)} ${U.esc(r ? r.name : f.ruleId)} <span class="muted">· ${findingWord(f)}</span></li>`; }).join("")}</ul>` : '<span class="muted">None</span>'}</dd>
      </dl>`;
  }
  /* The conversation card: the interaction's header, its facts behind "Show details", the find bar and the turns. Reused by the Findings review. */
  P.conversationHtml = function (x, opts) {
    extra.mark = opts && opts.mark ? opts.mark : null; extra.focusTurn = opts && opts.focusTurn ? opts.focusTurn : null;
    const m = S.member(x.memberId), s = assetOf(x), g = x.groupId ? S.group(x.groupId) : null, w = x.workspaceId ? S.byId.workspace[x.workspaceId] : null, plat = S.platform(x.platformId) || {};
    const conv = (D.conversations || {})[x.interactionId], turns = conv ? conv.turns || [] : [];
    const open = canOpen(x) || S.canViewContent(x.groupId, { escalated: !!(opts && opts.escalated) }), st = statusOf(x), ft = findingTally(x);
    const fpills = [ft.Confirmed ? `<span class="pill pill-danger">${I.alert}<span>${ft.Confirmed} confirmed ${U.plural(ft.Confirmed, "violation")}</span></span>` : "", ft.Detected ? `<span class="pill pill-pending">${I.clock}<span>${ft.Detected} ${U.plural(ft.Detected, "finding")} awaiting review</span></span>` : "", ft.Dismissed ? `<span class="pill pill-muted">${I.check}<span>${ft.Dismissed} ${U.plural(ft.Dismissed, "finding")} dismissed</span></span>` : ""].join("");
    const pills = `<span class="pill ${st.pill}" title="${U.esc(st.title)}">${st.icon}<span>${st.label}</span></span>${fpills || `<span class="pill pill-ok">${I.checkCircle}<span>No findings</span></span>`}`;
    const who = m ? U.esc(m.displayName) : "An unknown person", days = U.uniq(turns.map((t) => dayOf(t.promptTimestamp)));
    const when = days.length > 1 ? `${U.fmtDate(days[0])} to ${U.fmtDate(days[days.length - 1])}, collected by ${days.length} daily syncs` : U.fmtDate(x.date);
    const sentence = `${who} ${s ? `with ${U.esc(s.name)} (${U.esc(kindName(s))}${g ? `, ${U.esc(g.name)}` : ""})` : "in a direct chat"} in ${U.esc(plat.name || "")}${w ? `, ${U.esc(w.name)} workspace` : ""} · ${when} · ${U.fmtNum(x.turnCount || 0)} ${U.plural(x.turnCount || 0, "turn")}.`;
    const badge = s ? AGC.pages.registry.badge(kindName(s)) : `<span class="type-ic" title="Direct chat">${I.interactions}</span>`;
    const head = C.card(`<span class="conv-title">${badge}<span>${U.esc(x.chatName || "Interaction")}</span></span>`, `<p class="conv-sentence">${sentence}</p><button type="button" class="link-btn small" data-action="conv-details" aria-expanded="${ui.details}">${ui.details ? "Hide details" : "Show details"}</button>${detailsHtml(x, m, s, g, w, plat, turns)}`, { action: `<span class="conv-pills">${pills}</span>`, cls: "conv-head-card" });
    let body;
    if (!open) body = `<div class="notice notice-warn">${I.lock}<span>The content of this interaction is not available for your profile. Access to content comes from Archive360 Entitlement Policies; owning the business group does not grant it.</span></div>`;
    else if (!x.contentRetained) body = `<div class="notice notice-info">${I.info}<span>The content of this interaction was not retained; its metadata was. Nothing to show below.</span></div>`;
    else if (!turns.length) body = '<p class="small muted">No conversation text is archived for this interaction.</p>';
    else {
      if (!viewed.has(x.interactionId)) { viewed.add(x.interactionId); S.logAudit({ category: "Access", eventType: "Interaction content viewed", groupId: x.groupId || null, aiSystemId: x.aiSystemId || null, refType: "interaction", refId: x.interactionId, summary: "Viewed interaction content", entitlementScope: null }); }
      body = `<div class="conv-find" role="search"><label class="conv-find-label" for="convFind">Find in this interaction</label><input type="search" class="inp" id="convFind" placeholder="A word or phrase in the prompts and responses" value="${U.esc(ui.find)}"/><label class="small muted">From <input type="date" class="inp" id="convFrom" value="${ui.from}"/></label><label class="small muted">To <input type="date" class="inp" id="convTo" value="${ui.to}"/></label><button type="button" class="btn btn-sm" data-action="conv-clear"${ui.find || ui.from || ui.to ? "" : " disabled"}>Clear</button></div><div id="turnsWrap">${turnsHtml(x, m, s, turns)}</div>`;
    }
    if (opts && opts.noHead) return C.card("Conversation", body, { cls: "conv-card", action: `<span class="conv-pills"><span class="pill ${st.pill}" title="${U.esc(st.title)}">${st.icon}<span>${st.label}</span></span></span>` });
    return head + C.card("Conversation", body, { cls: "conv-card" });
  };
  const emptyConv = (scope) => C.card("Interaction", C.emptyState("Choose an interaction", scope.memberId ? "Choose an interaction in the list on the left to read it here, every turn of it." : "Open a person in the list on the left and choose an interaction to read it here, every turn of it."));

  /* ---------- Building a page ---------- */
  function enter(scope) {
    const key = scope.groupId ? `g:${scope.groupId}` : scope.assetId ? `a:${scope.assetId}` : `m:${scope.memberId}`;
    if (ui.scope !== key) { ui = fresh(); ui.scope = key; }
    const q = query();
    ui.asset = scope.memberId && q.asset ? q.asset : null;  // the lock is in the address, read on every visit
    ui.risk = scope.assetId && q.risk ? riskEvidence(scope.asset, q.risk) : null;  // so is the evidence narrowing (2026-10-22)
    if (scope.assetId && q.risk && !ui.risk) dropRisk();  // the factor adds no points today, so there is nothing to show: the page opens whole
    const model = scope.groupId ? groupModel(scope.group) : scope.assetId ? assetModel(scope.asset) : personModel(scope.member);
    if (ui.risk) { ui.selected = null; model.sections.forEach((sec) => { if (sec.people.some((m) => model.pool.some((x) => x.memberId === m.memberId && ui.risk.ints.has(x.interactionId)))) ui.collapsed.delete(sec.key); sec.people.forEach((m) => { if (model.pool.some((x) => x.memberId === m.memberId && ui.risk.ints.has(x.interactionId))) ui.expanded.add(`${sec.key}:${m.memberId}`); }); }); }  // arriving from a Risk card shows the factor's evidence list, never a conversation nobody chose, with the interactions behind it in view
    if (scope.memberId && !ui.expanded.size) model.groups.forEach((gr) => ui.expanded.add(gr.key));
    if (q.open) { const x = P.get(q.open); if (x && model.pool.some((y) => y.interactionId === x.interactionId)) { ui.selected = x.interactionId; ui.statuses = new Set(STATUSES.map(([k]) => k)); ui.findingStatuses = new Set(); ui.chatName = ""; ui.memberName = ""; ui.asset = ui.asset && !assetMatch(x) ? null : ui.asset; expandFor(scope, model, x); } }
    if (ui.selected && !model.pool.some((y) => y.interactionId === ui.selected)) ui.selected = null;
    current.scope = scope;
    return model;
  }
  function expandFor(scope, model, x) {
    if (scope.memberId) { ui.expanded.add(`g:${x.groupId || "none"}`); return; }
    const sec = model.sections.find((se) => se.people.some((m) => m.memberId === x.memberId));
    if (sec) { ui.collapsed.delete(sec.key); ui.expanded.add(`${sec.key}:${x.memberId}`); }
  }
  function splitHtml(scope, model) {
    const x = ui.selected ? P.get(ui.selected) : null;
    return `<div class="int-split"><aside class="int-tree-pane" aria-label="People and interactions">${paneHtml(scope, model)}</aside><div class="int-conv" id="intConv">${x ? P.conversationHtml(x) : ui.risk ? riskListHtml() : emptyConv(scope)}</div></div>`;
  }
  P.groupHtml = function (gid) {
    const g = S.group(gid);
    if (!g || !canSeeGroup(g)) return notAvailable(`The interactions of ${g ? U.esc(g.name) : "this group"} are`);
    const scope = { groupId: gid, group: g };
    return splitHtml(scope, enter(scope));
  };
  P.person = function (id) {
    const m = S.member(id);
    if (!m || !canSeePerson(m)) { AGC.shell.render({ kind: "list", navKey: "people", title: "Interactions", description: "", icon: "interactions", html: notAvailable("This person's interactions are") }); return; }
    const all = S.interactionsByMember[m.memberId] || [], groups = U.uniq(all.map((x) => x.groupId).filter(Boolean));
    const sentence = all.length ? `${U.fmtNum(all.length)} ${U.plural(all.length, "interaction")} across ${groups.length} ${U.plural(groups.length, "business group")}, each attributed to the group it belongs to: the AI asset's group, or the group ${U.esc(m.displayName)} was in at the time of a direct chat.` : `No interactions archived for ${U.esc(m.displayName)} yet.`;
    const scope = { memberId: m.memberId, member: m };
    const lockId = query().asset, lockAsset = lockId && lockId !== "direct" ? S.system(lockId) : null;
    const lock = lockId ? { label: lockId === "direct" ? "Direct chats" : (lockAsset ? lockAsset.name : lockId), href: `#/members/${m.memberId}/interactions?asset=${lockId}` } : null;
    const personCrumb = { label: m.displayName, href: `#/members/${m.memberId}` };
    const bc = C.originCrumbs(personCrumb, { nav: "people", crumbs: [{ label: "People", href: "#/people" }, personCrumb] });
    const crumbs = bc.crumbs.slice();
    if (crumbs.length >= 2 && crumbs[crumbs.length - 2].href === personCrumb.href) crumbs.pop();  // opened from the person page itself
    crumbs.push({ label: "Interactions", href: `#/members/${m.memberId}/interactions` });
    if (lock) crumbs.push(lock);
    AGC.shell.render({ kind: "item", navKey: bc.nav, title: `${m.displayName} · Interactions`,
      breadcrumb: crumbs,
      item: { badgeHtml: U.avatar(m, "sm"), name: `${m.displayName}: interactions`, statusHtml: U.employmentPill(m), sentence },
      html: splitHtml(scope, enter(scope)), after: P.after });
  };
  /* An AI asset's interactions, locked to that asset (Gabriel, 2026-09-24): reached from "View interactions" on the asset's row and from
     its Use card; the breadcrumb leads back to where the reader came from, and the header says where the group's other interactions are.
     Nothing on the page widens the list to the group. */
  function headerPill(s) {
    if (s.type === "Custom" && s.registerEntryId) { const e = S.entry(s.registerEntryId); return e ? U.statusPill(e.status) : ""; }
    return AGC.pages.asset && AGC.pages.asset.approval ? AGC.pages.asset.approval(s).pill : "";
  }
  P.asset = function (id) {
    const s = S.system(id);
    if (!s) { AGC.router.navigate("#/registry/assets"); return; }
    const g = s.groupId ? S.group(s.groupId) : null;
    const assetCrumb = { label: s.name, href: `#/systems/${s.id}` };
    const bc = C.originCrumbs(assetCrumb, { nav: g ? "groups" : "registry", crumbs: g ? [{ label: "Groups", href: "#/groups" }, { label: g.name, href: `#/groups/${g.id}` }, { label: "AI assets", href: `#/groups/${g.id}/registry` }, assetCrumb] : [{ label: "AI Registry", href: "#/registry" }, { label: "All AI Assets", href: "#/registry/assets" }, assetCrumb] });
    const crumbs = bc.crumbs.slice();
    if (crumbs.length >= 2 && crumbs[crumbs.length - 2].href === assetCrumb.href) crumbs.pop();  // opened from the asset page itself, which is already a crumb
    crumbs.push({ label: "Interactions", href: `#/systems/${s.id}/interactions` });
    const badge = AGC.pages.registry.badge(kindName(s)), title = `${s.name} · Interactions`;
    const listOk = g ? canSeeGroup(g) : S.can("settings") || S.can("unregistered");
    if (!listOk) { AGC.shell.render({ kind: "item", navKey: bc.nav, title, breadcrumb: crumbs, item: { badgeHtml: badge, name: `${s.name}: interactions`, statusHtml: headerPill(s), sentence: "" }, html: notAvailable("The interactions with this AI asset are") }); return; }
    const pool = S.interactionsBySystem[s.id] || [], people = U.uniq(pool.map((x) => x.memberId)).length, dates = pool.map((x) => x.date).sort();
    const plat = S.platform(s.platformId || (pool[0] || {}).platformId) || {}, wsId = s.workspaceId || (pool[0] || {}).workspaceId, w = wsId ? S.byId.workspace[wsId] : null;
    const sentence = pool.length
      ? `${U.fmtNum(pool.length)} ${U.plural(pool.length, "interaction")} by ${U.fmtNum(people)} ${U.plural(people, "person", "people")} with ${U.esc(s.name)} (${U.esc(kindName(s))}${g ? `, ${U.esc(g.name)}` : ""}) in ${U.esc(plat.name || "")}${w ? `, ${U.esc(w.name)} workspace` : ""}, from ${U.fmtDate(dates[0])} to ${U.fmtDate(dates[dates.length - 1])}. Only this AI asset's interactions are listed here${g ? `; every interaction of ${U.esc(g.name)} is on its <a href="#/groups/${g.id}/interactions">Interactions page</a>` : ""}.`
      : `No interactions with ${U.esc(s.name)} have been archived yet.`;
    const scope = { assetId: s.id, asset: s, group: g };
    AGC.shell.render({ kind: "item", navKey: bc.nav, title, breadcrumb: crumbs,
      item: { badgeHtml: badge, name: `${s.name}: interactions`, statusHtml: headerPill(s), sentence },
      html: splitHtml(scope, enter(scope)), after: P.after });
  };
  /* A link to one interaction (Audit History, and the Findings review later) opens it where it lives: in its group's tree, or in the
     person's when it belongs to no group. The address is replaced, so the back button does not return to the redirect. */
  P.conversation = function (id) {
    const x = P.get(id);
    if (!x) { AGC.shell.render({ kind: "list", navKey: "groups", title: "Interaction", description: "", icon: "interactions", html: C.emptyState("Interaction not found", "The link may be out of date.") }); return; }
    const target = x.groupId ? `#/groups/${x.groupId}/interactions?open=${x.interactionId}` : `#/members/${x.memberId}/interactions?open=${x.interactionId}`;
    location.replace(location.pathname + location.search + target);
  };

  /* The conversation card on another page (the Findings review screen): binds its find bar, dates, details, earlier versions and file
     previews; getX returns the interaction the card shows. */
  P.resetConversation = function () { ui.find = ""; ui.from = ""; ui.to = ""; ui.details = false; ui.ctx = new Set(); };
  P.bindConversation = function (root, getX) {
    const drawTurns = () => { const x = getX(); const wrap = root.querySelector("#turnsWrap"); if (!x || !wrap) return; const conv = (D.conversations || {})[x.interactionId]; wrap.innerHTML = turnsHtml(x, S.member(x.memberId), assetOf(x), conv ? conv.turns || [] : []); const clr = root.querySelector("[data-action='conv-clear']"); if (clr) clr.disabled = !(ui.find || ui.from || ui.to); };
    root.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-att], [data-action='conv-details'], [data-action='conv-clear'], [data-action='turn-prev'], [data-action='ctx-reveal'], [data-action='ctx-hide'], [data-action='ctx-hide-all']");
      if (!t) return;
      if (t.dataset.att) { ev.preventDefault(); preview({ file: t.dataset.att, name: t.dataset.name, type: t.dataset.type, sizeKB: t.dataset.size }); return; }
      if (t.dataset.action === "conv-details") { ui.details = !ui.details; const dl = root.querySelector(".conv-details"); if (dl) dl.hidden = !ui.details; t.setAttribute("aria-expanded", ui.details ? "true" : "false"); t.textContent = ui.details ? "Hide details" : "Show details"; }
      else if (t.dataset.action === "conv-clear") { ui.find = ""; ui.from = ""; ui.to = ""; ui.ctx = new Set(); ["convFind", "convFrom", "convTo"].forEach((id) => { const el = root.querySelector("#" + id); if (el) el.value = ""; }); drawTurns(); }
      else if (t.dataset.action === "ctx-reveal") { ui.ctx.add(Number(t.dataset.turn)); drawTurns(); const li = root.querySelector("#turn-" + t.dataset.turn); if (li) li.scrollIntoView({ block: "nearest" }); }
      else if (t.dataset.action === "ctx-hide") { ui.ctx.delete(Number(t.dataset.turn)); drawTurns(); }
      else if (t.dataset.action === "ctx-hide-all") { ui.ctx = new Set(); drawTurns(); }
      else if (t.dataset.action === "turn-prev") { const prev = t.closest(".turn-main").querySelector(".turn-prev"); const show = prev.hidden; prev.hidden = !show; t.setAttribute("aria-expanded", show ? "true" : "false"); t.textContent = show ? "Hide the earlier version" : "Show the earlier version"; }
    });
    root.addEventListener("change", (ev) => { const el = ev.target; if (el.id === "convFrom" || el.id === "convTo") { ui[el.id === "convFrom" ? "from" : "to"] = el.value; ui.ctx = new Set(); drawTurns(); } });
    const typed = U.debounce((el) => { ui.find = el.value; ui.ctx = new Set(); drawTurns(); }, 200);
    root.addEventListener("input", (ev) => { if (ev.target.id === "convFind") typed(ev.target); });
  };

  /* ---------- Behaviour: the tree redraws in place, the conversation loads on the right, the popover stays open while it is used ---------- */
  P.after = function (root) {
    const scope = current.scope; if (!scope || !root.querySelector(".int-split")) return;
    const model = () => (scope.groupId ? groupModel(scope.group) : scope.assetId ? assetModel(scope.asset) : personModel(scope.member));
    const drawTree = () => {
      const mo = model(), tree = root.querySelector("#intTree"); if (tree) tree.innerHTML = treeHtml(scope, mo);
      const cnt = root.querySelector("#intTreeCount"); if (cnt) cnt.innerHTML = `<span class="count-badge">${U.fmtNum(shownCount(scope, mo))}</span><span class="small muted"> of ${U.fmtNum(mo.pool.length)}${scope.groupId ? " in this period" : ""}</span>`;
      const badge = root.querySelector("#qfBadge"); if (badge) { const n = activeFilters(); badge.innerHTML = n ? ` <span class="count-badge">${n}</span>` : ""; }
    };
    const drawConv = (focusTurn) => { const pane = root.querySelector("#intConv"); const x = ui.selected ? P.get(ui.selected) : null; if (pane) pane.innerHTML = x ? P.conversationHtml(x, focusTurn ? { focusTurn } : undefined) : ui.risk ? riskListHtml() : emptyConv(scope); };
    const drawTurns = () => { const x = ui.selected ? P.get(ui.selected) : null; const wrap = root.querySelector("#turnsWrap"); if (!x || !wrap) return; const conv = (D.conversations || {})[x.interactionId]; wrap.innerHTML = turnsHtml(x, S.member(x.memberId), assetOf(x), conv ? conv.turns || [] : []); const clr = root.querySelector("[data-action='conv-clear']"); if (clr) clr.disabled = !(ui.find || ui.from || ui.to); };
    const keepCaret = (id, fn) => { const el = root.querySelector("#" + id), pos = el ? el.selectionStart : null; fn(); const el2 = root.querySelector("#" + id); if (el2 && el2 !== el) { el2.focus(); try { el2.setSelectionRange(pos, pos); } catch (e) { /* date inputs have no caret */ } } };
    root.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-tree], [data-qf], [data-att], [data-action]");
      if (!t) return;
      if (t.dataset.tree === "section") { const k = t.dataset.key; if (ui.collapsed.has(k)) ui.collapsed.delete(k); else ui.collapsed.add(k); drawTree(); return; }
      if (t.dataset.tree === "node") { const k = t.dataset.key; if (ui.expanded.has(k)) ui.expanded.delete(k); else ui.expanded.add(k); drawTree(); return; }
      if (t.dataset.tree === "int") { dropQuery(); ui.selected = t.dataset.id; ui.find = ""; ui.from = ""; ui.to = ""; ui.details = false; ui.ctx = new Set(); root.querySelectorAll(".tree-leaf.selected").forEach((b) => { b.classList.remove("selected"); b.setAttribute("aria-pressed", "false"); }); t.classList.add("selected"); t.setAttribute("aria-pressed", "true"); drawConv(); return; }
      if (t.dataset.qf === "clear") { ui.members = "all"; ui.statuses = new Set(STATUSES.map(([k]) => k)); ui.findingStatuses = new Set(); ui.apps = new Set(); ui.actions = false; ui.memberName = ""; ui.chatName = ""; dropQuery(); const pop = root.querySelector("#menu-qf"); if (pop) pop.innerHTML = qfHtml(scope); drawTree(); return; }
      if (t.dataset.qf === "close") { AGC.shell.closeMenus(); return; }
      if (t.dataset.att) { ev.preventDefault(); preview({ file: t.dataset.att, name: t.dataset.name, type: t.dataset.type, sizeKB: t.dataset.size }); return; }
      switch (t.dataset.action) {
        case "int-export": AGC.shell.toast("Exports the list as CSV: every interaction shown, with its person, AI asset, date, chat status, turns and findings."); break;
        case "conv-details": { ui.details = !ui.details; const dl = root.querySelector(".conv-details"); if (dl) dl.hidden = !ui.details; t.setAttribute("aria-expanded", ui.details ? "true" : "false"); t.textContent = ui.details ? "Hide details" : "Show details"; break; }
        case "conv-clear": ui.find = ""; ui.from = ""; ui.to = ""; ui.ctx = new Set(); ["convFind", "convFrom", "convTo"].forEach((id) => { const el = root.querySelector("#" + id); if (el) el.value = ""; }); drawTurns(); break;
        case "ctx-reveal": { ui.ctx.add(Number(t.dataset.turn)); drawTurns(); const li = root.querySelector("#turn-" + t.dataset.turn); if (li) li.scrollIntoView({ block: "nearest" }); break; }
        case "ctx-hide": ui.ctx.delete(Number(t.dataset.turn)); drawTurns(); break;
        case "ctx-hide-all": ui.ctx = new Set(); drawTurns(); break;
        case "turn-prev": { const prev = t.closest(".turn-main").querySelector(".turn-prev"); const show = prev.hidden; prev.hidden = !show; t.setAttribute("aria-expanded", show ? "true" : "false"); t.textContent = show ? "Hide the earlier version" : "Show the earlier version"; break; }
        case "risk-open": { const x = P.get(t.dataset.id); if (!x) break; dropQuery(); ui.selected = x.interactionId; ui.find = ""; ui.from = ""; ui.to = ""; ui.details = false; ui.ctx = new Set(); expandFor(scope, model(), x); drawTree(); const turn = Number(t.dataset.turn) || null; drawConv(turn); const li = turn ? root.querySelector("#turn-" + turn) : null; if (li) li.scrollIntoView({ block: "center" }); break; }
        case "risk-show-all": { ui.risk = null; dropRisk(); const ln = root.querySelector("#intRisk"); if (ln) ln.remove(); drawTree(); drawConv(); break; }
        default: break;
      }
    });
    root.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.name === "qfMembers") { ui.members = el.value; dropQuery(); drawTree(); }
      else if (el.name === "qfStatus") { if (el.checked) ui.statuses.add(el.value); else ui.statuses.delete(el.value); dropQuery(); drawTree(); }
      else if (el.name === "qfFinding") { if (el.checked) ui.findingStatuses.add(el.value); else ui.findingStatuses.delete(el.value); dropQuery(); drawTree(); }
      else if (el.name === "qfApp") { if (el.checked) ui.apps.add(el.value); else ui.apps.delete(el.value); dropQuery(); drawTree(); }
      else if (el.name === "qfActions") { ui.actions = el.checked; dropQuery(); drawTree(); }
      else if (el.id === "convFrom" || el.id === "convTo") { ui[el.id === "convFrom" ? "from" : "to"] = el.value; ui.ctx = new Set(); drawTurns(); }
    });
    const typed = U.debounce((el) => {
      if (el.id === "qfMember") { ui.memberName = el.value; dropQuery(); drawTree(); }
      else if (el.id === "qfChat") { ui.chatName = el.value; dropQuery(); drawTree(); }
      else if (el.id === "convFind") { ui.find = el.value; ui.ctx = new Set(); keepCaret("convFind", drawTurns); }
    }, 200);
    root.addEventListener("input", (ev) => { if (["qfMember", "qfChat", "convFind"].includes(ev.target.id)) typed(ev.target); });
    const sel = root.querySelector(".tree-leaf.selected"); if (sel) sel.scrollIntoView({ block: "center" });
  };

  /* An in-app preview of a file shared in the conversation: the shared dialog in components.js. */
  function preview(a) {
    C.filePreview({ name: a.name, file: a.file, kind: a.type === "image" ? "image" : "pdf", sizeKB: a.sizeKB, note: "shared in this interaction." });
  }
})();
