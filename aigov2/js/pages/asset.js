/* The AI asset page: one GPT or Project as Archive360 archived it, for review only (Gabriel, 2026-09-23). Every link to a GPT or Project
   in the module lands here. It shows what the asset is, how it is configured and how that changed, who can use it, what it can reach and
   who used it; it offers no registration or approval action, because those stay on the AI Registry. Anyone who can see the asset's row on
   the Registry may open it, with names and counts only, never interaction content. The Configuration card has two views, Current and
   Change history; Shared with shows what is true as of the connector's last sync, each row with its since-date, and every addition or
   removal lives once, in the Change history. A GPT's apps and a Project's linked sources are rows of the Configuration card (2026-09-30). */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.asset = {});
  let current = null;  /* the AI asset on the page, for the handlers in P.after */
  const viewedFiles = new Set();  /* files previewed this session, so each is one Access event */
  const DAYS = 30;
  const since = () => { const d = new Date(U.today() + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - DAYS); return d.toISOString().slice(0, 10); };
  const REG = () => AGC.pages.registry, PEOPLE = () => AGC.pages.people;
  const canSee = (m) => !!(m && PEOPLE() && PEOPLE().canSee && PEOPLE().canSee(m));
  const personLink = (m) => (m ? `${canSee(m) ? `<a href="#/members/${m.memberId}">${U.esc(m.displayName)}</a>` : U.esc(m.displayName)}${U.statusTag(m)}` : '<span class="muted">Unknown</span>');
  const groupAt = (m, date) => (PEOPLE() && PEOPLE().groupAt ? PEOPLE().groupAt(m, date) : m.primaryGroupId);
  const CAPS = [["webBrowsing", "Web search"], ["codeInterpreter", "Code interpreter and data analysis"], ["imageGeneration", "Image generation"]];
  const TAGS = { created: ["Created", "tag-ok"], added: ["Added", "tag-ok"], updated: ["Updated", "tag-info"], removed: ["Removed", "tag-danger"], enabled: ["Enabled", "tag-ok"], disabled: ["Disabled", ""], granted: ["Granted", "tag-ok"], opened: ["Opened", "tag-ok"], connected: ["Connected", "tag-ok"], disconnected: ["Disconnected", "tag-pending"], reconnected: ["Reconnected", "tag-ok"], changed: ["Changed", "tag-info"] };
  const tag = (change) => { const t = TAGS[change] || [change, ""]; return `<span class="tag ${t[1]}">${U.esc(t[0])}</span>`; };
  const ws = (s) => (s.workspaceId && S.byId.workspace[s.workspaceId] ? S.byId.workspace[s.workspaceId] : null);
  const inst = (s) => (s.instanceId ? S.instance(s.instanceId) : null);
  const platformName = (s) => { const i = inst(s); return i ? i.name : (S.platform(s.platformId) || {}).name || "the platform"; };
  const syncDate = (s) => { const p = S.platform(s.platformId); return p && p.lastSync ? p.lastSync : null; };
  const notAvailable = () => AGC.shell.render({ kind: "list", navKey: "registry", title: "AI asset", description: "", icon: "coverage", html: `<div class="placeholder-card"><div class="ph-title">${I.lock} This AI asset is not available for your profile</div><div class="ph-body">Access to AI assets comes from your Profile and Entitlement Policies, managed by an Archive360 Administrator.</div></div>` });

  /* ---------- Approval: the same words and pill as the Registry's All AI Assets column, plus where it is decided ---------- */
  function approval(s) {
    const cov = S.systemCoverage(s);
    if (cov.key === "individual") return { pill: U.statusPill(cov.entry.status), text: `Registered individually · ${U.esc(cov.entry.status)}`, link: `<a href="#/registry/${cov.entry.id}">Open the registration</a>` };
    /* Managed and Waiting say exactly what the Registry's column says, and link nowhere: the AI system's registration is not this asset's
       record (Gabriel, 2026-09-23). An asset's own registration and its Unregistered AI item stay linked, because they are about it. */
    if (cov.key === "platform") return { pill: `<span class="pill pill-muted pill-managed">${I.stack}<span>Managed</span></span>`, text: `Managed · ${U.esc(cov.label)}`, link: "" };
    if (cov.key === "platformPending") return { pill: `<span class="pill pill-pending">${I.clock}<span>Waiting</span></span>`, text: `Waiting · ${U.esc(cov.label)}`, link: "" };
    const item = (D.unregisteredItems || []).find((u) => u.aiSystemId === s.id && !u.duplicateOf);
    const where = item ? `<a href="#/unregistered/${item.id}">Open in Unregistered AI</a>` : "";
    if (cov.key === "external" && cov.decided) return { pill: `<span class="pill pill-danger">${I.alert}<span>Prohibited</span></span>`, text: U.esc(cov.label) + (cov.reason ? ` · ${U.esc(cov.reason)}` : ""), link: where };
    if (cov.key === "external") return { pill: `<span class="pill pill-pending">${I.alert}<span>Undecided</span></span>`, text: "Undecided · nobody has allowed or prohibited it yet", link: where };
    return { pill: `<span class="pill pill-danger">${I.alert}<span>No approval</span></span>`, text: U.esc(cov.label), link: where };
  }

  /* ---------- The change history: configuration versions, sharing events and source events, newest first ---------- */
  function historyEntries(s) {
    const out = [];
    /* What was already in place on the day the asset was created belongs to the Created entry, not to a row of its own. */
    const atCreation = (h) => h.date === s.createdDate && h.event !== "removed";
    const initialShare = (s.sharingHistory || []).filter(atCreation), initialApps = (s.apps || []).filter((a) => a.addedDate === s.createdDate).map((a) => a.app);
    (s.configVersions || []).forEach((v) => {
      const who = v.changedByMemberId ? S.member(v.changedByMemberId) : null;
      let text = v.summary;
      if (v.kind === "created") {
        const np = initialShare.filter((h) => h.kind === "member").length, ng = initialShare.filter((h) => h.kind === "platformGroup").length;
        const parts = [np ? `${np} ${U.plural(np, "person", "people")}` : "", ng ? `${ng} ${U.esc(platformName(s))} ${U.plural(ng, "group")}` : ""].filter(Boolean);
        text = `Created${parts.length ? `, shared with ${parts.join(" and ")}` : ""}${initialApps.length ? `, with the ${initialApps.map(U.esc).join(" and ")} ${U.plural(initialApps.length, "app")}` : ""}`;
      }
      out.push({ date: v.date, change: v.change || (v.kind === "created" ? "created" : "updated"), text, meta: [v.version ? `Version ${v.version}` : "", who ? `by ${U.esc(who.displayName)}` : ""].filter(Boolean).join(" · "), diff: v.kind === "instructions" && v.before ? { before: v.before, after: v.after } : null });
    });
    (s.sharingHistory || []).filter((h) => !atCreation(h)).forEach((h) => {
      const m = h.memberId ? S.member(h.memberId) : null;
      const who = h.kind === "member" ? (m ? U.esc(m.displayName) : "a person no longer in the identity source") : h.kind === "platformGroup" ? `the ${U.esc(platformName(s))} group ${U.esc(h.name)}` : `everyone in the ${U.esc((ws(s) || {}).name || "workspace")} workspace`;
      const text = h.event === "granted" ? `Access granted to ${who}` : h.event === "removed" ? `Access removed for ${who}` : `Sharing opened to ${who}`;
      out.push({ date: h.date, change: h.event === "granted" ? "granted" : h.event === "removed" ? "removed" : "opened", text, meta: h.detected === "initial" ? `In place when Archive360 first synchronized this ${U.esc(s.type)} on ${U.fmtDate(h.detectedOn)}` : `Detected by the sync of ${U.fmtDate(h.detectedOn)}` });
    });
    return out.sort((a, b) => b.date.localeCompare(a.date) || (a.change === "created" ? 1 : 0) - (b.change === "created" ? 1 : 0));
  }
  function historyHtml(s) {
    const rows = historyEntries(s);
    if (!rows.length) return '<p class="small muted">No changes recorded.</p>';
    return `<ul class="change-list">${rows.map((r, i) => `<li>
        <span class="hist-date">${U.fmtDate(r.date)}</span>
        <span class="change-tag">${tag(r.change)}</span>
        <span class="change-body"><span class="strong">${r.text}</span>${r.meta ? `<div class="small muted">${r.meta}</div>` : ""}${r.diff ? `<div class="small"><button type="button" class="link-btn" data-action="asset-diff" data-i="${i}" aria-expanded="false">Show what changed</button></div><div class="instr-diff" data-diff="${i}" hidden><div class="instr-diff-col"><div class="small muted">Before</div><div class="instr-block small">${U.esc(r.diff.before)}</div></div><div class="instr-diff-col"><div class="small muted">After</div><div class="instr-block small">${U.esc(r.diff.after)}</div></div></div>` : ""}</span>
      </li>`).join("")}</ul>`;
  }

  /* ---------- An Action, as the Admin API exports its schema (2026-09-30) ---------- */
  /* Where it calls, how it authenticates, and every operation ChatGPT may choose, with the confirmation the schema asks for. A shared API
     key means every person who uses the GPT calls the domain as one identity; the confirmation for a consequential operation is in no log. */
  const AUTH_TEXT = { "API key": "API key", OAuth: "OAuth, per user", None: "None" };
  const EFFECT = { read: "Reads", create: "Creates", update: "Updates", delete: "Deletes", send: "Sends" };
  function actionBlock(a) {
    const authNote = a.auth === "API key" ? ` <span class="tag tag-pending" title="One key for everyone">Shared key</span><span class="muted"> · every person who uses this GPT calls ${U.esc(a.domain || "")} as the same identity, whatever their own access there</span>` : a.auth === "OAuth" ? `<span class="muted"> · each person signs in and calls ${U.esc(a.domain || "")} as themselves</span>` : "";
    const ops = (a.operations || []).map((o) => `<tr><td><span class="mono">${U.esc(o.operationId)}</span><div class="small muted">${U.esc(o.summary || "")}</div></td><td class="mono">${U.esc(o.method)} ${U.esc(o.path)}</td><td>${EFFECT[o.effect] || U.esc(o.effect || "")}</td><td>${o.consequential ? 'Asks the person first<div class="small muted">Not logged</div>' : '<span class="muted">None</span>'}</td></tr>`).join("");
    return `<div class="act-block">
      <div class="act-head"><span class="strong">${U.esc(a.name)}</span>${a.external ? ' <span class="tag tag-pending" title="This domain is outside Brookhaven Financial: what people type can be sent to a third party">Outside Brookhaven</span>' : ""}</div>
      <div class="endpoint">${U.esc(a.domain || a.endpoint || "")}</div>
      <div class="small muted">${U.esc(a.description || "")}</div>
      <div class="small">Authentication: ${U.esc(AUTH_TEXT[a.auth] || a.auth || "None")}${authNote}${a.privacyPolicyUrl ? `<span class="muted"> · privacy policy ${U.esc(a.privacyPolicyUrl.replace(/^https?:\/\//, ""))}</span>` : ""}</div>
      ${ops ? `<table class="ops"><thead><tr><th>Operation</th><th>Request</th><th>Effect</th><th>Confirmation</th></tr></thead><tbody>${ops}</tbody></table>` : ""}
    </div>`;
  }

  /* ---------- A plugin's configuration (Gabriel, 2026-09-30): what it contains, as the workspace's plugin administration reports it ---------- */
  /* Skills carry the instructions and reference files; apps are the workspace's; an MCP server's tools are shown like an Action's operations,
     with whether a tool asks the person first. Where a plugin came from (a migrated GPT, Plugin Creator, a marketplace) is in no API, so
     the page does not say it (Gabriel, 2026-10-01), and the card opens with the source of what it does say. */
  const MCP_AUTH = { "API key": "API key", OAuth: "OAuth, per user", None: "None" };
  const EFFECT_WORD = { read: "Reads", create: "Creates", update: "Updates", delete: "Deletes", send: "Sends" };
  function pluginHtml(s) {
    const fileRow = (fn) => { const i = (s.knowledgeFiles || []).findIndex((f) => f.name === fn), f = i >= 0 ? s.knowledgeFiles[i] : null; if (!f) return `<li>${I.file || ""}<span>${U.esc(fn)}</span></li>`; const by = f.addedByMemberId ? S.member(f.addedByMemberId) : null; return `<li>${I.file || ""}<span><a class="strong file-link" href="#" data-kf="${i}" title="Preview ${U.esc(f.name)}">${U.esc(f.name)}</a><div class="small muted">${U.esc((f.type || "").toUpperCase())}${f.sizeKB ? ` · ${U.fmtNum(f.sizeKB)} KB` : ""}</div></span></li>`; };
    const skills = (s.skills || []).map((k) => `<div class="act-block"><div class="act-head"><span class="strong">${U.esc(k.name)}</span>${k.description ? `<span class="small muted">· ${U.esc(k.description)}</span>` : ""}</div>
        ${k.instructions ? `<div class="instr-block">${U.esc(k.instructions)}</div>` : '<div class="small muted">No instructions recorded</div>'}
        <div class="small muted" style="margin-top:6px">Reference files</div>${(k.files || []).length ? `<ul class="file-list">${k.files.map(fileRow).join("")}</ul>` : '<div class="small muted">None</div>'}</div>`).join("");
    const mcps = (s.mcpServers || []).map((m) => `<div class="act-block">
        <div class="act-head"><span class="strong">${U.esc(m.name)}</span>${m.external ? ' <span class="tag tag-pending" title="This domain is outside Brookhaven Financial: what people type can be sent to a third party">Outside Brookhaven</span>' : ""}</div>
        <div class="endpoint">${U.esc(m.domain)}</div>
        <div class="small">Authentication: ${U.esc(MCP_AUTH[m.auth] || m.auth || "None")}${m.auth === "API key" ? ` <span class="tag tag-pending" title="One key for everyone">Shared key</span><span class="muted"> · every person who uses this plugin calls ${U.esc(m.domain)} as the same identity, whatever their own access there</span>` : m.auth === "OAuth" ? `<span class="muted"> · each person signs in and calls ${U.esc(m.domain)} as themselves</span>` : ""}</div>
        ${(m.tools || []).length ? `<table class="ops"><thead><tr><th>Tool</th><th>Effect</th><th>Confirmation</th></tr></thead><tbody>${m.tools.map((t) => `<tr><td><span class="mono">${U.esc(t.name)}</span><div class="small muted">${U.esc(t.summary || "")}</div></td><td>${EFFECT_WORD[t.effect] || U.esc(t.effect || "")}</td><td>${t.consequential ? 'Asks the person first<div class="small muted">Not logged</div>' : '<span class="muted">None</span>'}</td></tr>`).join("")}</tbody></table>` : ""}
      </div>`).join("");
    const sync = syncDate(s);
    return `<p class="small muted">Read from the workspace's plugin administration${sync ? ` on ${U.fmtDate(sync)}` : ""}; OpenAI publishes no API for a workspace-built plugin's configuration.</p><dl class="kv kv-wide kv-detail">
        <dt>Description</dt><dd>${s.description ? U.esc(s.description) : '<span class="muted">None recorded</span>'}</dd>
        <dt>Available to</dt><dd>${U.esc(s.availableTo || "Every member")}<div class="small muted">The workspace's installation policy; who can use it is on the Shared with card.</div></dd>
        <dt>Skills</dt><dd>${skills || '<span class="muted">None</span>'}</dd>
        <dt>Apps</dt><dd>${(s.apps || []).length ? `<ul class="app-list app-list-tight">${s.apps.map((a) => `<li><span class="strong">${U.esc(a.app)}</span></li>`).join("")}</ul><div class="small muted">Each person who uses this plugin reaches only what their own ${U.esc((function (n) { return n.length > 1 ? n.slice(0, -1).join(", ") + " and " + n[n.length - 1] : n[0]; })(s.apps.map((a) => a.app)))} ${U.plural(s.apps.length, "account")} can already open.</div>` : '<span class="muted">None</span>'}</dd>
        <dt>MCP servers</dt><dd>${mcps || '<span class="muted">None. This plugin calls no external system of its own.</span>'}</dd>
      </dl>`;
  }

  /* ---------- Configuration, current view ---------- */
  function currentHtml(s) {
    if (s.type === "Plugin") return pluginHtml(s);
    if (s.external) return `<div class="notice notice-info">${I.info}<span>This GPT was built outside your workspace. Archive360 archives your people's interactions with it, not its instructions, knowledge, capabilities or actions, so none of those is shown.</span></div><dl class="kv kv-wide kv-detail"><dt>Description</dt><dd>${s.description ? U.esc(s.description) : '<span class="muted">None recorded</span>'}</dd></dl>`;
    const isGpt = s.type === "GPT";
    /* Each file is a link that opens an in-app preview (Gabriel, 2026-09-29); the content shown is one of the prototype's shared files. */
    const files = (s.knowledgeFiles || []).map((f, i) => { const by = f.addedByMemberId ? S.member(f.addedByMemberId) : null; return `<li>${I.file || ""}<span><a class="strong file-link" href="#" data-kf="${i}" title="Preview ${U.esc(f.name)}">${U.esc(f.name)}</a><div class="small muted">${U.esc((f.type || "").toUpperCase())}${f.sizeKB ? ` · ${U.fmtNum(f.sizeKB)} KB` : ""}</div></span></li>`; }).join("");
    const caps = s.capabilities ? `<ul class="cap-list">${CAPS.map(([k, label]) => `<li class="${s.capabilities[k] ? "cap-on" : "cap-off"}">${s.capabilities[k] ? I.checkCircle : I.minus}<span>${label}</span></li>`).join("")}</ul>` : "";
    const acts = (s.actions || []).length ? `${s.actions.map(actionBlock).join("")}<div class="small muted">ChatGPT chooses the operation from what the person asks.</div>` : '<span class="muted">None. This GPT calls no external endpoint.</span>';
    /* A Project has no description in ChatGPT, so none is shown; it has a memory type and text sources, which a GPT does not. */
    const memory = s.memoryType === "Project-only" ? `Project-only <span class="muted">· chats in this project use only its own instructions, files and text sources, and nothing they learn is remembered outside it</span>` : s.memoryType ? `Default <span class="muted">· chats in this project can use and add to the person's ChatGPT memory</span>` : '<span class="muted">Not recorded</span>';
    const texts = (s.textSources || []).map((t) => { const by = t.addedByMemberId ? S.member(t.addedByMemberId) : null; return `<li><span class="text-src"><span class="strong">${U.esc(t.title)}</span><div class="instr-block small">${U.esc(t.text)}</div><div class="small muted">${U.fmtNum(t.chars || (t.text || "").length)} characters</div></span></li>`; }).join("");
    return `<dl class="kv kv-wide kv-detail">
        ${isGpt ? `<dt>Description</dt><dd>${s.description ? U.esc(s.description) : '<span class="muted">None recorded</span>'}</dd>` : ""}
        <dt>Instructions</dt><dd>${s.instructions ? `<div class="instr-block">${U.esc(s.instructions)}</div>` : '<span class="muted">None recorded</span>'}</dd>
        ${isGpt ? `<dt>Conversation starters</dt><dd>${(s.conversationStarters || []).length ? `<ul class="starter-list">${s.conversationStarters.map((x) => `<li>${I.chevronRight}<span>${U.esc(x)}</span></li>`).join("")}</ul>` : '<span class="muted">None</span>'}</dd>` : ""}
        ${isGpt ? `<dt>Recommended model</dt><dd>${s.recommendedModel ? `${U.esc(s.recommendedModel)}${s.recommendedModelDefault ? ' <span class="muted">(workspace default)</span>' : ""}` : '<span class="muted">Workspace default</span>'}</dd>` : ""}
        ${isGpt ? "" : `<dt>Memory type</dt><dd>${memory}</dd>`}
        <dt>${isGpt ? "Knowledge files" : "Files"}</dt><dd>${files ? `<ul class="file-list">${files}</ul>` : '<span class="muted">None</span>'}</dd>
        ${isGpt ? "" : `<dt>Text sources</dt><dd>${texts ? `<ul class="text-list">${texts}</ul>` : '<span class="muted">None</span>'}</dd>`}
        ${isGpt ? "" : `<dt>Linked sources</dt><dd>${(s.linkedSources || []).length ? `<ul class="app-list app-list-tight">${s.linkedSources.map((l) => { const by = l.addedByMemberId ? S.member(l.addedByMemberId) : null; return `<li><span class="strong">${U.esc(l.type)} ${U.esc(l.kind)} ${U.esc(l.name)}</span></li>`; }).join("")}</ul><div class="small muted">A Project can link Google Drive files and folders and Slack channels as sources; whoever chats in it reaches them under their own account.</div>` : '<span class="muted">None</span>'}</dd>`}
        ${isGpt ? `<dt>Capabilities</dt><dd>${caps || '<span class="muted">None recorded</span>'}</dd>` : ""}
        ${isGpt ? `<dt>Actions</dt><dd>${acts}</dd>` : ""}
        ${isGpt ? `<dt>Apps</dt><dd>${(s.apps || []).length ? `<ul class="app-list app-list-tight">${s.apps.map((a) => `<li><span class="strong">${U.esc(a.app)}</span></li>`).join("")}</ul><div class="small muted">Each person who uses this GPT reaches only what their own ${U.esc((function (n) { return n.length > 1 ? n.slice(0, -1).join(", ") + " and " + n[n.length - 1] : n[0]; })(s.apps.map((a) => a.app)))} ${U.plural(s.apps.length, "account")} can already open.</div>` : `<span class="muted">None${(s.actions || []).length ? ": this GPT uses Actions, and a GPT has apps or Actions, never both" : ""}</span>`}</dd>` : ""}
      </dl>`;
  }

  /* ---------- Shared with: who can use it, as the last sync found it ---------- */
  function sharingHtml(s) {
    if (s.external) return '<p class="small muted">Sharing of a GPT built outside your workspace is not visible to Archive360.</p>';
    const scope = (s.sharing || {}).scope || "specific", w = ws(s), creator = s.creatorMemberId ? S.member(s.creatorMemberId) : null;
    const events = (kind, key) => (s.sharingHistory || []).filter((h) => h.kind === kind && (kind === "member" ? h.memberId === key : kind === "platformGroup" ? h.name === key : true)).sort((a, b) => b.date.localeCompare(a.date));
    const sinceText = (list) => { const last = list.find((h) => h.event !== "removed"); return last ? (last.detected === "initial" ? `since the first sync on ${U.fmtDate(last.detectedOn)}` : `since ${U.fmtDate(last.date)}`) : ""; };
    const histList = (list) => `<ul class="share-hist small">${list.map((h) => `<li><span class="hist-date">${U.fmtDate(h.date)}</span><span>${h.event === "granted" ? "Access granted" : h.event === "removed" ? "Access removed" : "Sharing opened"}${h.detected === "initial" ? `; in place when Archive360 first synchronized on ${U.fmtDate(h.detectedOn)}` : `; detected by the sync of ${U.fmtDate(h.detectedOn)}`}</span></li>`).join("")}</ul>`;
    const row = (left, sub, list, tagLabel) => { const more = list.length > 1; return `<li class="share-row${more ? " has-more" : ""}"><div class="share-main">${more ? `<button type="button" class="grp-toggle" data-action="share-toggle" aria-expanded="false" aria-label="Show access history">${I.chevronRight}</button>` : '<span class="grp-toggle-space"></span>'}${left}<span class="share-side small muted">${I.checkCircle} Has access${list.length ? ` · ${sinceText(list)}` : ""}</span></div>${more ? `<div class="share-more" hidden>${histList(list)}</div>` : ""}</li>`; };
    const rows = [];
    if (creator) rows.push(row(`${U.avatar(creator, "sm")}<span class="share-who"><span class="strong">${personLink(creator)}</span> <span class="tag">Creator</span><div class="small muted">${U.esc(creator.jobTitle || "")}</div></span>`, "", [], "Creator"));
    if (scope === "workspace" && w) rows.push(row(`<span class="share-ic">${I.stack}</span><span class="share-who"><span class="strong">Everyone in the ${U.esc(w.name)} workspace</span> <span class="tag">Workspace</span><div class="small muted">${U.fmtNum(s.accessibleUserCount || 0)} people</div></span>`, "", events("workspace"), "Workspace"));
    (s.sharedWithPlatformGroups || []).forEach((name) => { const n = (s.sharedWithPlatformGroupCounts || {})[name]; rows.push(row(`<span class="share-ic">${I.members}</span><span class="share-who"><span class="strong">${U.esc(name)}</span> <span class="tag">Group</span><div class="small muted"><span class="chip chip-plat">${U.esc(platformName(s))} group</span>${n ? ` ${U.fmtNum(n)} people` : ""}</div></span>`, "", events("platformGroup", name), "Group")); });
    S.sortMembers((s.sharedWithMemberIds || []).map((id) => S.member(id)).filter(Boolean)).forEach((m) => rows.push(row(`${U.avatar(m, "sm")}<span class="share-who"><span class="strong">${personLink(m)}</span> <span class="tag">Member</span><div class="small muted">${U.esc(m.jobTitle || "")}${m.primaryGroupId && m.primaryGroupId !== s.groupId ? ` · ${U.esc(S.groupName(m.primaryGroupId))}` : ""}</div></span>`, "", events("member", m.memberId), "Member")));
    const named = (s.sharedWithMemberIds || []).length, groups = (s.sharedWithPlatformGroups || []).length;
    const reach = scope === "workspace" && w && s.type === "Plugin" ? `Published to the workspace directory${s.directoryPublishedDate ? ` on ${U.fmtDate(s.directoryPublishedDate)}` : ""}: everyone in the ${U.esc(w.name)} workspace can find and use it, ${U.fmtNum(s.accessibleUserCount || 0)} people.` : scope === "workspace" && w ? `Everyone in the ${U.esc(w.name)} workspace can use it, ${U.fmtNum(s.accessibleUserCount || 0)} people${named || groups ? `; ${[named ? `${named} ${U.plural(named, "person", "people")}` : "", groups ? `${groups} ${U.esc(platformName(s))} ${U.plural(groups, "group")}` : ""].filter(Boolean).join(" and ")} also ${named + groups === 1 ? "holds" : "hold"} a direct grant` : ""}.` : scope === "creator" || (!named && !groups) ? "Only the creator can use it." : `${U.fmtNum(s.accessibleUserCount || 0)} people can use it: the creator${named ? `, ${named} named ${U.plural(named, "person", "people")}` : ""}${groups ? ` and ${groups} ${U.esc(platformName(s))} ${U.plural(groups, "group")}` : ""}.`;
    return `<p class="small">${reach}</p><ul class="share-list">${rows.join("")}</ul>`;
  }

  /* ---------- Use: interactions and the people who used it ---------- */
  function useHtml(s) {
    const all = S.interactionsBySystem[s.id] || [], from = since(), recent = all.filter((x) => x.date >= from), last = all.reduce((a, x) => (x.date > a ? x.date : a), "");
    const byMember = {}, byGroup = {};
    all.forEach((x) => { const e = (byMember[x.memberId] = byMember[x.memberId] || { n: 0, last: "" }); e.n += 1; if (x.date > e.last) e.last = x.date; const m = S.member(x.memberId); const g = m ? groupAt(m, x.date) : null; const k = g || "none"; byGroup[k] = (byGroup[k] || 0) + 1; });
    const people = Object.entries(byMember).map(([id, e]) => ({ m: S.member(id), n: e.n, last: e.last })).filter((p) => p.m).sort((a, b) => (a.m.isDemoAnchor ? 0 : 1) - (b.m.isDemoAnchor ? 0 : 1) || b.n - a.n || a.m.displayName.localeCompare(b.m.displayName));
    const groups = Object.entries(byGroup).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k === "none" ? "no group" : U.esc(S.groupName(k))} ${U.fmtNum(n)}`);
    const otherGroups = Object.keys(byGroup).filter((k) => k !== s.groupId).length;
    /* Apps used in its interactions (2026-09-30): from the app-call log, counts only; an item is named on the interaction where the record carries it. */
    const byApp = {}; let named = 0; all.forEach((x) => (x.appCalls || []).forEach((c) => { byApp[c.app] = (byApp[c.app] || 0) + 1; if (c.item) named += 1; }));
    /* Actions called (2026-09-30): from the same log, per operation, with how often the request and the response were recorded. */
    const byAct = {}; let nCalls = 0, reqRec = 0, resRec = 0; all.forEach((x) => (x.actionCalls || []).forEach((c) => { const k = `${c.action} · ${c.operationId}`; byAct[k] = (byAct[k] || 0) + 1; nCalls++; if (c.inputRecorded) reqRec++; if (c.outputRecorded) resRec++; }));
    const actionsUsed = nCalls ? `${Object.entries(byAct).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${U.esc(k)} ${U.fmtNum(n)}`).join(" · ")}<div class="small muted">Action calls in its interactions, from the app-call log: the request was recorded on ${U.fmtNum(reqRec)} and the response on ${U.fmtNum(resRec)} of ${U.fmtNum(nCalls)}. A confirmation ChatGPT asked for is never logged.</div>` : '<span class="muted">None recorded</span>';
    const actionsRow = (s.actions || []).length || nCalls ? `<dt>Actions called</dt><dd>${actionsUsed}</dd>` : "";
    const appsUsed = Object.keys(byApp).length ? `${Object.entries(byApp).sort((a, b) => b[1] - a[1]).map(([a, n]) => `${U.esc(a)} ${U.fmtNum(n)}`).join(" · ")}<div class="small muted">App calls in its interactions, from the app-call log; the item is named on ${named ? `${U.fmtNum(named)} of them` : "none of them"}, where the record carries it.</div>` : '<span class="muted">None recorded</span>';
    return `<dl class="kv kv-wide kv-detail">
        <dt>Interactions</dt><dd>${U.fmtNum(all.length)} in total · ${U.fmtNum(recent.length)} in the last ${DAYS} days</dd>
        <dt>Last activity</dt><dd>${last ? `${U.fmtDate(last)} · ${U.relTime(last)}` : '<span class="muted">None recorded</span>'}</dd>
        <dt>By business group</dt><dd>${groups.length ? groups.join(" · ") : '<span class="muted">—</span>'}${otherGroups ? `<div class="small muted">The group is the one each person was in at the time of the interaction.</div>` : ""}</dd>
        ${s.providedBy ? "" : `<dt>Apps used</dt><dd>${appsUsed}</dd>`}
        ${actionsRow}
      </dl>
      <h4 class="sub-title">People who used it <span class="count-badge">${people.length}</span></h4>
      ${people.length ? `<ul class="people-list">${people.map((p, i) => `<li${i >= 8 ? " hidden data-more" : ""}>${U.avatar(p.m, "sm")}<span><span class="strong">${personLink(p.m)}</span><span class="muted"> · ${U.esc(p.m.jobTitle || "")}</span>${p.m.primaryGroupId && p.m.primaryGroupId !== s.groupId ? `<div class="small muted">${U.esc(S.groupName(p.m.primaryGroupId))}</div>` : ""}</span><span class="small muted people-side">${U.fmtNum(p.n)} ${U.plural(p.n, "interaction")}<div>${U.relTime(p.last)}</div></span></li>`).join("")}</ul>${people.length > 8 ? `<p class="small muted"><button type="button" class="link-btn" data-action="people-more" data-all="Show all ${people.length}" data-fewer="Show the first 8">Show all ${people.length}</button></p>` : ""}` : '<p class="small muted">Nobody has used it yet.</p>'}`;
  }

  /* The breadcrumb leads back to where the reader came from, sub-page included (shared rule in components.js); a direct link falls back
     to Groups > group > asset, the spine. */
  function crumbs(s, g) {
    const last = { label: s.name, href: `#/systems/${s.id}` };
    return C.originCrumbs(last, { nav: "groups", crumbs: [{ label: "Groups", href: "#/groups" }, g ? { label: g.name, href: `#/groups/${g.id}` } : null, g ? { label: "AI assets", href: `#/groups/${g.id}/registry` } : null, last].filter(Boolean) });
  }

  P.approval = approval;
  P.render = function (id) {
    const s = S.system(id);
    if (!s) { AGC.shell.render({ kind: "list", navKey: "registry", title: "AI asset", description: "", icon: "coverage", html: C.emptyState("AI asset not found", "The link may be out of date.") }); return; }
    current = s;
    if (!S.persona() || !AGC.shell.navMeta("registry")) { notAvailable(); return; }
    if (s.type === "Custom") { AGC.router.navigate(s.registerEntryId ? `#/registry/${s.registerEntryId}` : "#/registry"); return; }
    const g = s.groupId ? S.group(s.groupId) : null, creator = s.creatorMemberId ? S.member(s.creatorMemberId) : null, w = ws(s), ap = approval(s), sync = syncDate(s);
    /* The header names what the asset is, who made it, where and when; the AI system and the workspace are on the AI asset details card and
       are not repeated here (Gabriel, 2026-09-29). */
    const sentence = s.external
      ? `GPT built outside your workspace${g ? `, used by people in ${U.esc(g.name)}` : ""}.`
      : s.providedBy ? `${U.esc(s.type)} provided by ${U.esc(s.providedBy)} with ${U.esc(platformName(s))}${g ? `, in ${U.esc(g.name)}` : ""}.`
      : `${U.esc(s.type)} created by ${creator ? U.esc(creator.displayName) : "an unknown person"}${g ? ` in ${U.esc(g.name)}` : ""} on ${U.fmtDate(s.createdDate)}.`;
    const details = C.card("AI asset details", `<dl class="kv kv-wide kv-detail">
        <dt>Type</dt><dd>${U.esc(s.type)}${s.external ? " · built outside your workspace" : ""}</dd>
        <dt>AI system</dt><dd>${U.esc(platformName(s))}${w ? ` · ${U.esc(w.name)} workspace` : ""}</dd>
        <dt>Business group</dt><dd>${g ? `<a href="#/groups/${g.id}">${U.esc(g.name)}</a>` : '<span class="muted">None</span>'}</dd>
        ${s.providedBy ? `<dt>Provided by</dt><dd>${U.esc(s.providedBy)}<div class="small muted">Nobody in your organization created it.</div></dd>
        <dt>Available since</dt><dd>${U.fmtDate(s.createdDate)}<div class="small muted">The day ${U.esc(platformName(s))} was added as an AI system.</div></dd>` : `<dt>Creator</dt><dd>${s.external ? '<span class="muted">Outside your workspace</span>' : personLink(creator)}</dd>
        <dt>Created</dt><dd>${U.fmtDate(s.createdDate)}</dd>`}
        <dt>Status in ${U.esc(platformName(s))}</dt><dd>${s.status === "Active" ? "Active" : `${U.esc(s.status)}${s.archivedDate ? ` on ${U.fmtDate(s.archivedDate)}` : ""}`}</dd>
        <dt>Approval</dt><dd>${ap.text}${ap.link ? `<div class="small">${ap.link}</div>` : ""}</dd>
      </dl>`);
    const toggle = `<div class="groups-view-toggle asset-toggle" role="tablist" aria-label="Configuration view"><button type="button" class="groups-view-toggle-btn active" data-view="current" role="tab" aria-selected="true">Current</button><button type="button" class="groups-view-toggle-btn" data-view="history" role="tab" aria-selected="false">Change history</button></div>`;
    const config = s.providedBy
      ? C.card("What it does", `<p>${U.esc(s.description || "")}</p><div class="notice notice-info">${I.info}<span>${U.esc(s.providedBy)} provides and maintains this AI assistant. It has no instructions, knowledge files or settings written by your organization, so there is no configuration to show here.</span></div>`)
      : C.card("Configuration", `<div data-view-pane="current">${currentHtml(s)}</div><div data-view-pane="history" hidden>${historyHtml(s)}</div>`, { action: toggle });
    const shared = C.card(`Shared with${s.external ? "" : ` <span class="count-badge">${(s.sharedWithMemberIds || []).length + (s.sharedWithPlatformGroups || []).length + (((s.sharing || {}).scope === "workspace") ? 1 : 0)}</span>`}`, sharingHtml(s), { action: s.external ? "" : `<span class="small muted">People and groups granted access in ${U.esc(platformName(s))}${sync ? `, as the sync of ${U.fmtDateTime(sync)} found them` : ""}</span>` });
    const nInt = (S.interactionsBySystem[s.id] || []).length;
    const use = C.card("Activity", useHtml(s), { action: nInt ? `<a class="link" href="#/systems/${s.id}/interactions">Open the ${U.fmtNum(nInt)} ${U.plural(nInt, "interaction")} ${I.arrowRight}</a>` : "" });
    /* The highlighted tab follows the breadcrumb's first crumb (Gabriel, 2026-09-23), so the two never disagree. */
    const bc = crumbs(s, g);
    AGC.shell.render({ kind: "item", navKey: bc.nav || "registry", title: s.name, breadcrumb: bc.crumbs,
      item: { badgeHtml: REG() ? REG().badge(s.type) : "", name: s.name, statusHtml: ap.pill, sentence },
      html: `<div class="two-col"><div>${config}${s.providedBy ? "" : shared}</div><div>${C.riskCard(S.riskForAsset(s.id))}${details}${use}</div></div>`, after: P.after });
  };

  P.after = function (root) {
    root.querySelectorAll("[data-kf]").forEach((a) => a.addEventListener("click", (ev) => {
      ev.preventDefault();
      const s = current, f = s ? (s.knowledgeFiles || [])[+a.dataset.kf] : null; if (!f) return;
      const stand = C.standInFile(f.name, f.type), word = s.type === "Project" ? "file" : "knowledge file";
      const label = f.type === "docx" ? "Word document" : f.type === "xlsx" ? "Excel workbook" : f.type === "pdf" ? "PDF file" : String(f.type || "").toUpperCase();
      C.filePreview({ name: f.name, file: stand.file, kind: stand.kind, sizeKB: f.sizeKB, label, note: `a ${word} of ${U.esc(s.name)}.` });
      /* Opening a file is content access, like opening an interaction, so it is written to Audit History once per file per session. */
      const key = `${s.id}:${f.name}`;
      if (!viewedFiles.has(key)) { viewedFiles.add(key); S.logAudit({ category: "Access", eventType: "Knowledge file viewed", groupId: s.groupId || null, aiSystemId: s.id, refType: "aiSystem", refId: s.id, summary: `Viewed ${f.name}, a ${word} of ${s.name}`, details: { file: f.name } }); }
    }));
    root.querySelectorAll(".asset-toggle [data-view]").forEach((b) => b.addEventListener("click", () => {
      root.querySelectorAll(".asset-toggle [data-view]").forEach((x) => { const on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
      root.querySelectorAll("[data-view-pane]").forEach((p) => { p.hidden = p.dataset.viewPane !== b.dataset.view; });
    }));
    root.querySelectorAll("[data-action='share-toggle']").forEach((b) => b.addEventListener("click", () => { const li = b.closest("li"), more = li.querySelector(".share-more"); const open = more.hidden; more.hidden = !open; b.setAttribute("aria-expanded", open ? "true" : "false"); b.innerHTML = open ? I.chevronDown : I.chevronRight; }));
    root.querySelectorAll("[data-action='asset-diff']").forEach((b) => b.addEventListener("click", () => { const d = root.querySelector(`[data-diff="${b.dataset.i}"]`); const open = d.hidden; d.hidden = !open; b.setAttribute("aria-expanded", open ? "true" : "false"); b.textContent = open ? "Hide what changed" : "Show what changed"; }));
    const more = root.querySelector("[data-action='people-more']");
    if (more) more.addEventListener("click", () => { const open = more.dataset.open === "1"; root.querySelectorAll(".people-list li[data-more]").forEach((li) => { li.hidden = open; }); more.dataset.open = open ? "" : "1"; more.textContent = open ? more.dataset.all : more.dataset.fewer; });
  };
})();
