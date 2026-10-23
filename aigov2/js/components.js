/* Shared UI components: modal dialog, toggles, selects, people picker (members synchronized from the identity source). */
(function () {
  const U = AGC.util, S = AGC.store, I = AGC.icons;
  AGC.components = AGC.components || {};
  const C = AGC.components;

  /* A confirming button that waits: disabled, with the reason as plain text beside it, until the dialog's required input is there (Gabriel,
   2026-09-21). isReady returns the input; reason is a string or a function that names only what is still missing. */
C.guard = function (wrap, isReady, reason, selector) {
  const btn = wrap.querySelector(selector || "[data-action='go']"); if (!btn) return;
  const tip = document.createElement("span");
  tip.className = "go-reason";
  btn.insertAdjacentElement("beforebegin", tip);
  const update = () => { const ok = !!isReady(); btn.disabled = !ok; btn.classList.toggle("is-disabled", !ok); tip.hidden = ok; tip.textContent = typeof reason === "function" ? reason() : reason; };
  ["input", "change", "click", "keyup"].forEach((ev) => wrap.addEventListener(ev, () => setTimeout(update, 0)));
  update();
};
C.modal = function (opts) {
    C.closeModal();
    const wrap = document.createElement("div");
    wrap.className = "modal-overlay";
    wrap.id = "modalOverlay";
    wrap.innerHTML = `<div class="modal ${opts.size || ""}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-head"><h2 id="modalTitle">${opts.title}</h2><button class="modal-close" type="button" data-modal-close aria-label="Close">${I.x}</button></div>
      <div class="modal-body">${opts.body}</div>
      ${opts.footer != null ? `<div class="modal-foot">${opts.footer}</div>` : ""}
    </div>`;
    document.body.appendChild(wrap);
    C.placeModal(wrap);
    if (window.ResizeObserver) new ResizeObserver(() => C.placeModal(wrap)).observe(wrap.querySelector(".modal"));
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-modal-close]")) C.closeModal(); });
    const first = wrap.querySelector("input, select, textarea, button:not(.modal-close)");
    if (first) setTimeout(() => first.focus(), 30);
    if (opts.onOpen) opts.onOpen(wrap);
    return wrap;
  };
  /* One-scrollbar rule: the dialog opens just below the current scroll position and the overlay is stretched to the taller of the
     document and the dialog, so the browser scrollbar (never an inner one) reveals a long dialog. */
  C.placeModal = function (wrap) {
    const m = wrap.querySelector(".modal");
    if (!m || !document.body.contains(wrap)) return;
    if (!m.style.marginTop) m.style.marginTop = ((window.scrollY || document.documentElement.scrollTop || 0) + 48) + "px";
    const bottom = m.offsetTop + m.offsetHeight + 48;
    wrap.style.height = Math.max(document.documentElement.scrollHeight, bottom) + "px";
  };
  C.closeModal = function () { const m = document.getElementById("modalOverlay"); if (m) m.remove(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") C.closeModal(); });

  C.toggle = function (name, checked, label, opts) {
    const o = opts || {};
    return `<label class="toggle${o.disabled ? " is-disabled" : ""}" ${o.title ? `title="${U.esc(o.title)}"` : ""}><input type="checkbox" name="${name}" ${checked ? "checked" : ""} ${o.disabled ? "disabled" : ""}/><span class="toggle-track"><span class="toggle-thumb"></span></span><span class="toggle-label">${label}${o.locked ? ` <span class="lock-ic" title="Fixed by policy">${I.lock}</span>` : ""}</span></label>`;
  };
  /* Options may carry a `group` label; consecutive options with the same group render inside one <optgroup>. */
  C.select = function (name, options, value, attrs) {
    const opt = (o) => `<option value="${U.esc(o.value)}"${String(o.value) === String(value) ? " selected" : ""}${o.disabled ? " disabled" : ""}>${U.esc(o.label)}</option>`;
    let html = "", open = null;
    options.forEach((o) => { const g = o.group || ""; if (g !== open) { if (open) html += "</optgroup>"; if (g) html += `<optgroup label="${U.esc(g)}">`; open = g; } html += opt(o); });
    if (open) html += "</optgroup>";
    return `<select class="sel" name="${U.esc(name)}" ${attrs || ""}>${html}</select>`;
  };
  C.field = function (label, control, help) {
    return `<div class="field"><label class="field-label">${label}</label>${control}${help ? `<div class="field-help">${help}</div>` : ""}</div>`;
  };

  /* People picker. C.memberPicker(id) renders; C.bindMemberPicker(root, id, filterFn, onPick) wires it and returns {value()}. */
  C.memberPicker = function (id, opts) {
    const o = opts || {};
    return `<div class="mpick" id="${id}"><input type="text" class="inp" placeholder="${U.esc(o.placeholder || "Search people by name, title or email")}" autocomplete="off" data-mpick-input/><input type="hidden" data-mpick-value value="${U.esc(o.value || "")}"/><div class="mpick-list" data-mpick-list hidden></div><div class="mpick-selected" data-mpick-selected hidden></div></div>`;
  };
  C.bindMemberPicker = function (root, id, filterFn, onPick) {
    const box = root.querySelector("#" + id);
    const inp = box.querySelector("[data-mpick-input]"), list = box.querySelector("[data-mpick-list]"), hid = box.querySelector("[data-mpick-value]"), sel = box.querySelector("[data-mpick-selected]");
    const showSelected = (m) => { sel.innerHTML = `${U.avatar(m, "sm")}<span><span class="strong">${U.esc(m.displayName)}</span>${U.statusTag(m)}<span class="muted"> · ${U.esc(m.jobTitle || "")} · ${U.esc(S.groupName(m.primaryGroupId))}</span></span><button type="button" class="mpick-clear" aria-label="Clear">${I.x}</button>`; sel.hidden = false; inp.hidden = true; list.hidden = true; };
    const render = () => {
      const q = inp.value.trim().toLowerCase();
      let pool = AGC.data.members.filter((m) => m.memberStatus === "Active" && m.sourceSystem !== "Archive360 local account" && m.assignmentSource !== "excluded" && (!filterFn || filterFn(m)));
      if (q) pool = pool.filter((m) => m.displayName.toLowerCase().includes(q) || (m.jobTitle || "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.department || "").toLowerCase().includes(q));
      pool = S.sortMembers(pool).slice(0, 8);
      list.innerHTML = pool.map((m) => `<button type="button" class="mpick-item" data-mid="${m.memberId}">${U.avatar(m, "sm")}<span><span class="strong">${U.esc(m.displayName)}</span><span class="muted"> · ${U.esc(m.jobTitle || "")} · ${U.esc(S.groupName(m.primaryGroupId))}</span></span></button>`).join("") || '<div class="mpick-empty">No matching person</div>';
      list.hidden = false;
    };
    /* The list opens when the person clicks into the field, types, or presses the down arrow; never on focus alone,
       so a dialog that places the cursor in the owner field does not pop the list open by itself (Gabriel, 2026-09-11). */
    inp.addEventListener("click", render);
    inp.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { e.preventDefault(); render(); } });
    inp.addEventListener("input", render);
    list.addEventListener("click", (e) => { const b = e.target.closest("[data-mid]"); if (!b) return; const m = S.member(b.dataset.mid); hid.value = m.memberId; showSelected(m); if (onPick) onPick(m); });
    sel.addEventListener("click", (e) => { if (e.target.closest(".mpick-clear")) { hid.value = ""; sel.hidden = true; inp.hidden = false; inp.value = ""; inp.focus(); if (onPick) onPick(null); } });
    box.addEventListener("focusout", () => setTimeout(() => { if (!box.contains(document.activeElement)) list.hidden = true; }, 120));
    if (hid.value && S.member(hid.value)) showSelected(S.member(hid.value));
    return { value: () => hid.value };
  };

  /* The sentence under an owner field when the chosen person sits in another business group than the registration (Gabriel, 2026-09-24).
     Empty when the person is a member of the group, or when there is no group. */
  C.ownerNote = function (m, groupId, noun) {
    if (!m || !groupId || !m.primaryGroupId || m.primaryGroupId === groupId) return "";
    const g = S.group(groupId), gOwner = g ? S.member(g.ownerMemberId) : null;
    return `${U.esc(m.displayName)} is in ${U.esc(S.groupName(m.primaryGroupId))}, not ${U.esc(S.groupName(groupId))}; they will answer for this ${U.esc(noun || "AI asset")}, and ${U.esc(S.groupName(groupId))}'s owner${gOwner ? `, ${U.esc(gOwner.displayName)},` : ""} still receives the digest.`;
  };
  /* Binds the note to a picker: draws it for the current value and again on every pick or clear. */
  C.bindOwnerNote = function (wrap, pickerId, groupId, noun) {
    const box = wrap.querySelector("#" + pickerId); if (!box) return () => {};
    let note = box.parentElement.querySelector("[data-owner-note]");
    if (!note) { note = document.createElement("div"); note.className = "small warn-text owner-note"; note.setAttribute("data-owner-note", ""); box.insertAdjacentElement("afterend", note); }
    const draw = (m) => { const t = C.ownerNote(m, groupId, noun); note.innerHTML = t ? `${I.alert} ${t}` : ""; note.hidden = !t; };
    const hid = box.querySelector("[data-mpick-value]"); draw(hid && hid.value ? S.member(hid.value) : null);
    return draw;
  };

  /* A breadcrumb that leads back to where the reader came from, for a page reached from several places (an AI asset, a registration).
     Reads the router's previous route, including the group sub-page it was on; a direct link uses the fallback. Returns the crumbs and
     the tab to highlight, so the two never disagree (Gabriel, 2026-09-23 and 2026-09-24). */
  C.originCrumbs = function (last, fallback) {
    const prev = AGC.router.previous, path = (prev && prev.path) || "";
    const sub = (gid, key) => { const k = key === "systems" ? "registry" : key; const sp = ((AGC.pages.group && AGC.pages.group.SUBPAGES) || []).find((x) => x.key === k); return sp && k !== "overview" ? { label: sp.label, href: `#/groups/${gid}/${k}` } : null; };
    const groupTrail = (gid, key) => { const g = S.group(gid); return g ? [{ label: "Groups", href: "#/groups" }, { label: g.name, href: `#/groups/${g.id}` }, sub(g.id, key)].filter(Boolean) : null; };
    let m;
    if ((m = path.match(/^\/groups\/([^/]+)(?:\/([^/]+))?/))) { const t = groupTrail(m[1], m[2]); if (t) return { nav: "groups", crumbs: t.concat([last]) }; }
    /* Any other page that rendered a breadcrumb: continue its trail, so Groups > Contact Center > Members > Clara Achebe leads on to
       > Interactions and further (Gabriel, 2026-09-25). A return to a page already on the trail cuts the trail back to it. */
    /* The previous page's trail is the shell's current one while this page is first drawn (the shell records this page only when it
       renders), and the one before it when this page redraws itself. */
    const pt = [AGC.shell.trail, AGC.shell.previousTrail].find((t) => t && t.path === path && t.crumbs && t.crumbs.length);
    if (pt) {
      let crumbs = pt.crumbs.slice();
      const i = crumbs.findIndex((c) => c && c.href === last.href);
      if (i >= 0) crumbs = crumbs.slice(0, i);
      crumbs.push(last);
      return { nav: pt.nav || (fallback && fallback.nav) || "groups", crumbs };
    }
    if ((m = path.match(/^\/members\/([^/]+)(?:\/(interactions))?/))) { const p = S.member(m[1]); if (p) return { nav: "people", crumbs: [{ label: "People", href: "#/people" }, { label: p.displayName, href: `#/members/${p.memberId}` }, m[2] ? { label: "Interactions", href: `#/members/${p.memberId}/interactions` } : null, last].filter(Boolean) }; }
    if (/^\/people/.test(path)) return { nav: "people", crumbs: [{ label: "People", href: "#/people" }, last] };
    if ((m = path.match(/^\/systems\/([^/]+)/))) { const a = S.system(m[1]); const t = a && a.groupId ? groupTrail(a.groupId, "registry") : null; if (t) return { nav: "groups", crumbs: t.concat([{ label: a.name, href: `#/systems/${a.id}` }, last]) }; }
    if ((m = path.match(/^\/registry\/([^/]+)/)) && m[1] !== "assets") { const e = S.entry(m[1]); if (e) return { nav: "registry", crumbs: [{ label: "AI Registry", href: "#/registry" }, { label: `${e.name} registration`, href: `#/registry/${e.id}` }, last] }; }
    if (/^\/registry\/assets/.test(path)) return { nav: "registry", crumbs: [{ label: "AI Registry", href: "#/registry" }, { label: "All AI Assets", href: "#/registry/assets" }, last] };
    if (/^\/registry/.test(path)) return { nav: "registry", crumbs: [{ label: "AI Registry", href: "#/registry" }, last] };
    if ((m = path.match(/^\/unregistered\/([^/]+)/))) { const u = S.byId.unregistered[m[1]]; if (u) return { nav: "unregistered", crumbs: [{ label: "Unregistered AI", href: "#/unregistered" }, { label: u.name, href: `#/unregistered/${u.id}` }, last] }; }
    if (/^\/unregistered/.test(path)) return { nav: "unregistered", crumbs: [{ label: "Unregistered AI", href: "#/unregistered" }, last] };
    if (/^\/audit/.test(path)) return { nav: "audit", crumbs: [{ label: "Audit History", href: "#/audit" }, last] };
    if (/^\/(overview)?$/.test(path)) return { nav: "overview", crumbs: [{ label: "Overview", href: "#/overview" }, last] };
    return fallback;
  };

  /* What AI is used for: one row per use category with its count, share and a bar, plus an optional line beneath (Gabriel, 2026-09-25). */
  /* What AI is used for: one row per use category with its count in interactions, its share and a bar. A row that carries `groups` (the
     Overview's card: every business group with a count for the category, most first) opens them in place from a chevron, instead of naming
     the top three beneath the row, which read as a breakdown that did not add up (Gabriel, 2026-09-29). The group page's card has one group,
     so its rows carry no groups and no chevron. */
  C.useMixList = function (rows, total) {
    if (!rows.length) return '<p class="small muted">No interactions in this period.</p>';
    const max = Math.max(1, ...rows.map((r) => r.n)), toggles = rows.some((r) => r.groups && r.groups.length);
    const row = (r) => {
      const has = r.groups && r.groups.length, id = `use-groups-${r.cat.id}`;
      const chev = toggles ? (has ? `<button type="button" class="grp-toggle use-toggle" data-use-toggle="${r.cat.id}" aria-controls="${id}" aria-expanded="false" aria-label="Show the business groups using it">${I.chevronRight}</button>` : '<span class="grp-toggle-space"></span>') : "";
      const groups = has ? `<ul class="use-groups" id="${id}" hidden>${r.groups.map((g) => `<li><a href="#/groups/${g.id}">${U.esc(g.name)}</a><span class="use-gn">${U.fmtNum(g.n)}</span></li>`).join("")}</ul>` : "";
      return `<li>${chev}<span class="strong">${U.esc(r.cat.label)}</span><div class="ov-bar">${U.meter(r.n, max)}</div><span class="use-n">${U.fmtNum(r.n)} ${U.plural(r.n, "interaction", "interactions")}<span class="muted"> · ${Math.round((100 * r.n) / Math.max(1, total))}%</span></span>${groups}</li>`;
    };
    return `<ul class="use-list${toggles ? " has-toggles" : ""}">${rows.map(row).join("")}</ul>`;
  };
  /* The prototype's shared files stand in for the content of every previewed document (Gabriel, 2026-09-29: "OK to reuse common documents
     or pdfs to save space"): a PDF or a Word document previews as one of the five PDFs and a workbook as the spreadsheet image, chosen by the
     file's name so the same file always shows the same document. */
  const SHARED_PDFS = ["AI_Acceptable_Use_Policy_Section_4.pdf", "Business_Checking_Statement_June_2026.pdf", "Commercial_Loan_Term_Sheet_Draft.pdf", "Master_Services_Agreement_Draft_v3.pdf", "Operations_Meeting_Notes_2026-06-12.pdf"];
  const SHARED_IMAGES = ["loan_pipeline_week_24.png", "complaint_volume_q2_2026.png", "onboarding_process_whiteboard.png"];
  C.standInFile = function (name, type) {
    let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const ext = String(type || String(name).split(".").pop() || "").toLowerCase();
    if (ext === "xlsx" || ext === "csv") return { file: `assets/files/${SHARED_IMAGES[0]}`, kind: "image" };
    if (["png", "jpg", "jpeg", "gif", "image"].includes(ext)) return { file: `assets/files/${SHARED_IMAGES[h % SHARED_IMAGES.length]}`, kind: "image" };
    return { file: `assets/files/${SHARED_PDFS[h % SHARED_PDFS.length]}`, kind: "pdf" };
  };
  /* An in-app preview of a file: a PDF in the browser's viewer, an image at full size, and Close (the "Open in a new tab" button went on 2026-10-01, Gabriel). `a` carries name, file (the
     path shown), kind ("pdf" or "image"), sizeKB, an optional label for the kind of file, and `note`, the words under the title that say
     what the file is. */
  C.filePreview = function (a) {
    const isImg = a.kind === "image";
    C.modal({ title: `${isImg ? I.image : I.file} ${U.esc(a.name)}`, size: "modal-xl",
      body: `<p class="small muted">${U.esc(a.label || (isImg ? "Image" : "PDF file"))}${a.sizeKB ? ` · ${U.fmtNum(a.sizeKB)} KB` : ""}${a.note ? ` · ${a.note}` : ""}</p><div class="file-preview">${isImg ? `<img src="${U.esc(a.file)}" alt="${U.esc(a.name)}"/>` : `<iframe src="${U.esc(a.file)}" title="${U.esc(a.name)}"></iframe>`}</div>`,
      footer: `<button type="button" class="btn btn-sm btn-primary" data-modal-close>Close</button>` });
  };
  /* The chevron opens or closes the row's business groups in place; one listener serves every card that draws the list. */
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-use-toggle]"); if (!b) return;
    const list = document.getElementById(`use-groups-${b.dataset.useToggle}`); if (!list) return;
    const open = list.hidden; list.hidden = !open; b.setAttribute("aria-expanded", String(open)); b.innerHTML = open ? I.chevronDown : I.chevronRight;
  });

  C.emptyState = function (title, sub) { return `<div class="empty-state"><div class="empty-title">${title}</div>${sub ? `<div class="empty-sub">${sub}</div>` : ""}</div>`; };
  /* Shared building blocks that had lived at the top of overview.js since the first build and were lost when that page was rewritten on
     2026-09-22; restored here, where every page expects them. */
  C.card = function (title, body, opts) {
    const o = opts || {};
    return `<section class="card${o.cls ? " " + o.cls : ""}">${title ? `<div class="card-head"><h3 class="section-title">${title}</h3>${o.action || ""}</div>` : ""}<div class="card-body">${body}</div></section>`;
  };
  C.kpiTile = function (label, value, opts) {
    const o = opts || {};
    const inner = `<div class="kpi-value${o.danger ? " danger" : ""}${o.warn ? " warn" : ""}">${value}</div><div class="kpi-label">${U.esc(label)}</div>${o.sub ? `<div class="kpi-sub">${o.sub}</div>` : ""}`;
    return o.href ? `<a class="kpi-tile kpi-link" href="${o.href}">${inner}</a>` : `<div class="kpi-tile">${inner}</div>`;
  };
  /* The Needs attention strip on the Overview and on the group page (Gabriel, 2026-09-28: the icon and the text were not aligned). One box for
     both pages. Each line is html that starts with its icon; it becomes a row with a fixed icon cell and a text block, so a wrapped line hangs
     under its own text and the icon sits on the first line, and the two columns fill down the left one first, so the lines are read in the
     order they were given, the reader's own work first. */
  C.attentionBox = function (lines) {
    const row = (h) => {
      const m = String(h).match(/^\s*(<svg[\s\S]*?<\/svg>)\s*([\s\S]*)$/);
      return `<li><span class="attn-ic">${m ? m[1] : ""}</span><span class="attn-text">${m ? m[2] : h}</span></li>`;
    };
    return `<div class="notice notice-warn attention-strip"><div class="attention-head">${I.flag} Needs attention <span class="count-badge">${lines.length}</span></div><ul class="attention-list">${lines.map(row).join("")}</ul></div>`;
  };

  /* ---------- Dynamic risk scoring (Gabriel, 2026-10-21): the pill the lists show and the card the detail pages show ---------- */
  C.riskPill = function (r, o) {
    if (!r) return "";
    o = o || {};
    return `<span class="risk-badge risk-${r.cls}" title="${U.esc(r.band)} risk, ${r.score} of 100"><span class="risk-num">${r.score}</span>${o.noWord ? "" : `<span>${U.esc(r.band)}</span>`}</span>`;
  };
  C.riskTrendText = function (r) {
    const d = S.RISK_MODEL.trendDays;
    if (!r.delta) return `No change in the last ${d} days.`;
    return `${r.delta > 0 ? "Up" : "Down"} ${Math.abs(r.delta)} in the last ${d} days, from ${r.before}.`;
  };
  /* The card: the score and band, its movement, every factor with its points, its evidence link and what would lower it, and the model's name.
     For a business group, the items driving it come first. */
  C.riskCard = function (r, o) {
    o = o || {};
    if (!r) return "";
    const hero = `<div class="risk-hero">${C.riskPill(r, { noWord: true })}<div><div class="strong">${U.esc(r.band)} risk, ${r.score} of 100</div><div class="small ${r.delta > 0 ? "danger-text" : r.delta < 0 ? "ok-text" : "muted"}">${C.riskTrendText(r)}</div></div></div>`;
    const items = r.items ? (r.items.length ? `<div class="small muted">${r.items.length} ${U.plural(r.items.length, "AI asset or system scores", "AI assets and systems score")} in this group${r.high ? `, ${r.high} at High or above` : ""}. The riskiest:</div><ul class="risk-items">${r.items.slice(0, 3).map((i) => `<li><a class="strong" href="${i.href}">${U.esc(i.name)}</a> <span class="muted">· ${U.esc(i.type)}</span> ${C.riskPill(i.risk)}</li>`).join("")}</ul>` : '<div class="small muted">Nothing in this group has activity to score yet.</div>') : "";
    const factors = r.factors.length
      ? `<ul class="factor-list">${r.factors.map((f) => `<li><a href="${f.href || "#"}" class="factor-link${f.fix ? " has-fix" : ""}"><span class="factor-pts">+${f.points}</span><span class="factor-label">${U.esc(f.label)}</span><span class="factor-detail">${U.esc(f.detail || "")}</span>${f.fix ? `<span class="factor-fix">What would lower it: ${U.esc(f.fix)}</span>` : ""}</a></li>`).join("")}</ul>`
      : `<div class="small muted">${U.esc(o.none || "No factor adds points: nothing confirmed in the window, approved and owned, and reviewers have access.")}</div>`;
    const foot = `<div class="risk-foot small muted">As of today, recomputed on every view · Risk model ${U.esc(S.RISK_MODEL.version)} · <button type="button" class="link-btn" data-action="risk-model">How risk is scored</button></div>`;
    return C.card(o.title || "Risk", hero + items + factors + foot, o.cardOpts);
  };
  /* The published model: every factor with its ceiling and how it is counted, the bands, the windows, and what adds nothing. */
  C.riskModelDialog = function () {
    const M = S.RISK_MODEL;
    C.modal({ title: `How risk is scored · Risk model ${U.esc(M.version)}`, size: "modal-lg", body: `<p>One score per AI system and per AI asset with activity, 0 to 100, added up from the facts below as they stand today and recomputed on every view. Each factor has a ceiling, so no single fact carries the whole score. Confirmed violations count; dismissed findings and raw detections do not. Every factor on a Risk card links to its evidence. A business group's score is its riskiest AI asset or system plus the group's own gaps.</p>
      <table class="tbl"><thead><tr><th>Factor</th><th class="num">Up to</th><th>How it is counted</th></tr></thead><tbody>${M.factors.map((f) => `<tr><td class="strong">${U.esc(f.label)}</td><td class="num">${f.cap}</td><td class="small">${U.esc(f.how)}</td></tr>`).join("")}</tbody></table>
      <dl class="kv kv-wide" style="margin-top:12px">
        <dt>Bands</dt><dd>${M.bands.slice().reverse().map(([b, min], i, arr) => `${b} ${i + 1 < arr.length ? `${min} to ${arr[i + 1][1] - 1}` : `${min} and above`}`).join(" · ")}</dd>
        <dt>Windows</dt><dd>Confirmed violations and sensitive data over a rolling ${M.windowDays} days; recurring conduct over ${M.recurrenceDays} days; a finding counts as backlog after ${M.backlogDays} days; the movement shown is against ${M.trendDays} days ago. Approval, owner, coverage, drift, reach, remediation and origin are true today or not.</dd>
        <dt>Adds nothing</dt><dd>An AI system registered without archiving, by decision (Gabriel, 2026-10-21); a finding a reviewer dismissed; a detection nobody has reviewed yet, until it has waited ${M.backlogDays} days.</dd>
        <dt>Cadence</dt><dd>The reconfirmation cadence follows the band at approval or reconfirmation: High and Critical reconfirm every ${S.cadenceForBand("High")} months, others every ${S.cadenceForBand("Low")}, fixed until the next reconfirmation.</dd>
      </dl>`, footer: `<button type="button" class="btn btn-secondary" data-modal-close>Close</button>` });
  };
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-action='risk-model']"); if (b) { e.preventDefault(); C.riskModelDialog(); } });
  C.riskFactors = function (risk, limit) {
    const fs = limit ? risk.factors.slice(0, limit) : risk.factors;
    if (!fs.length) return '<div class="muted small">No contributing factors.</div>';
    return `<ul class="factor-list">${fs.map((f) => `<li><a href="${f.href || "#"}" class="factor-link"><span class="factor-pts">+${f.points}</span><span class="factor-label">${U.esc(f.label)}</span><span class="factor-detail">${U.esc(f.detail)}</span></a></li>`).join("")}</ul>`;
  };
  C.auditList = function (events, limit) {
    const ev = events.slice(0, limit || 8);
    if (!ev.length) return '<div class="muted small">No activity in this range.</div>';
    return `<ul class="audit-list">${ev.map((e) => {
      const actor = e.actorType === "member" ? (S.member(e.actorId) ? S.member(e.actorId).displayName : e.actorId) : e.actorType === "ai-system" ? (S.systemName(e.actorId) + " (AI system)") : "System";
      return `<li class="audit-item"><span class="audit-cat cat-${e.category.replace(/\s+/g, "-").toLowerCase()}">${U.esc(e.category)}</span><div class="audit-body"><div class="audit-summary">${U.esc(e.summary)}</div><div class="audit-meta">${U.esc(actor)} · ${U.esc(e.eventType)} · ${U.esc(U.fmtDateTime(e.timestamp))}${e.groupId ? " · " + U.esc(S.groupName(e.groupId)) : ""}</div></div></li>`;
    }).join("")}</ul>`;
  };
})();
