/* Evidence collection (Gabriel, 2026-10-20). A dated export of one registration's governance record for one period: what was approved and by
   whom, the configuration and AI Policy Rule versions in force, what was found and decided and under which reviewer authority, who could
   review, how the activity was collected, every interaction of the period as a listing, and a documented sample. Module-owned facts go inside;
   platform-owned facts (the eDiscovery production criteria, the Logs audit filter, the record class's retention policy) are referenced, never
   copied, and no per-record audit is copied because every record carries its own Audit.txt. The export runs as a background job; in Archive360
   it is downloaded and deleted on the Exports page, so the module lists packages and their status and names that page. The prototype simulates
   the job over a few seconds and offers a stand-in download built from the data, so the contents can be seen.
   Home: the registration page (an Evidence packages card with Generate evidence package…), the Registry's row menu, and the package's own page
   at #/evidence/:id, which Audit History's "Evidence package requested" and "completed" rows already link to. No tab, no group sub-page. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data, I = AGC.icons, C = AGC.components;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.evidence = {});

  const STATUS = { Completed: { cls: "ok", icon: () => I.checkCircle }, "In progress": { cls: "pending", icon: () => I.clock }, Queued: { cls: "muted", icon: () => I.clock } };
  function pill(p) { const m = STATUS[p.status] || STATUS.Queued; return `<span class="pill pill-${m.cls}">${m.icon()}<span>${U.esc(p.status)}</span></span>`; }
  const who = (id) => { const m = S.member(id); return m ? U.esc(m.displayName) : "Archive360"; };
  const periodText = (p) => `${U.fmtDate(p.periodStart)} to ${U.fmtDate(p.periodEnd)}`;
  /* A quarter, half or year gets its name beside the dates; any other period is the dates alone. */
  const periodTag = (from, to) => { const l = S.evidencePeriodLabel(from, to); return l.indexOf("/") >= 0 ? "" : ` (${U.esc(l)})`; };
  const comps = (p) => (p.components || []).map((c) => (typeof c === "string" ? { name: c, how: "" } : c));
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  /* ---------- The card on the registration page ---------- */
  function statusCell(p) {
    if (p.status === "Completed") return `${pill(p)}<div class="small muted">${U.fmtDateTime(p.completedAt)}${p.sizeMB ? ` · ${p.sizeMB} MB` : ""}</div>`;
    return `${pill(p)}<div class="ev-bar" aria-hidden="true"><span style="width:${p.progress || 0}%"></span></div><div class="small muted">${p.status === "Queued" ? "Waiting for the export job to start." : `${p.progress || 0}% · export job running`}</div>`;
  }
  P.card = function (e) {
    const list = S.evidencePackagesFor(e.id), perm = S.permission("evidence", { entry: e });
    const btn = perm.allowed
      ? `<button type="button" class="btn btn-primary" data-reg-action="evidence" data-id="${e.id}">${I.evidence} Generate evidence package…</button>`
      : `<span class="btn-disabled-wrap"><button type="button" class="btn btn-primary is-disabled" disabled>${I.evidence} Generate evidence package…</button><span class="btn-reason">${U.esc(perm.reason)}</span></span>`;
    const rows = list.map((p) => `<tr>
      <td><a class="strong" href="#/evidence/${p.id}">${U.esc(p.name)}</a><div class="small muted">${periodText(p)} · ${U.fmtNum(p.populationCount || 0)} ${U.plural(p.populationCount || 0, "interaction")} · sample of ${U.fmtNum(p.sampleSize || 0)}${p.sampleWithheld ? ", content withheld" : ""}</div></td>
      <td class="small">${who(p.requestedByMemberId)}<div class="muted">${U.fmtDateTime(p.requestedAt)}</div></td>
      <td>${statusCell(p)}</td>
      <td class="ev-actions">${p.status === "Completed" ? `<button type="button" class="btn btn-secondary btn-sm" data-ev-download="${p.id}">${I.file} Download</button><div class="small muted">Prototype stand-in for the Exports page</div>` : ""}</td></tr>`).join("");
    const body = `<p class="small muted">A dated export of this registration's governance record for one period: approvals, configuration and rule versions, findings and decisions, reviewer access, collection, every interaction of the period as a listing, and a documented sample. It runs as a background job and is downloaded and deleted on the Exports page in Archive360.</p>
      ${list.length ? `<table class="tbl ev-table"><thead><tr><th>Package</th><th>Requested</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : C.emptyState("No evidence package yet", "Generate one for the period an auditor asks about.")}
      <div class="btn-row">${btn}</div>`;
    return C.card(`Evidence packages${list.length ? ` <span class="count-badge">${list.length}</span>` : ""}`, body);
  };

  /* ---------- Generate evidence package…: a two-step wizard, Period then Summary and Commit ---------- */
  const quarterBounds = (today) => {
    const d = new Date(today + "T00:00:00Z");
    let y = d.getUTCFullYear(), q = Math.floor(d.getUTCMonth() / 3) - 1;
    if (q < 0) { q = 3; y -= 1; }
    const from = `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`, end = new Date(Date.UTC(y, q * 3 + 3, 0));
    return { from, to: end.toISOString().slice(0, 10), label: `Q${q + 1} ${y}` };
  };
  const yearBack = (today) => { const d = new Date(today + "T00:00:00Z"); d.setUTCFullYear(d.getUTCFullYear() - 1); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
  function scopeNotice(e, scope) {
    if (scope.notArchived) return `<div class="notice notice-info">${I.info}<span>${U.esc(e.name)}'s interactions are not archived, by decision. The package will hold the registration record and the reason nothing is archived, and will say so.</span></div>`;
    if (!scope.population) return `<div class="notice notice-info">${I.info}<span>Nothing is archived for ${U.esc(e.name)} in this period. The package will hold the registration record alone and will say so.</span></div>`;
    return `<div class="notice notice-ok">${I.checkCircle}<span>${U.fmtNum(scope.population)} ${U.plural(scope.population, "interaction")} in the period, ${U.fmtNum(scope.findings.length)} with ${U.plural(scope.findings.length, "a finding", "findings")}; the documented sample will hold ${U.fmtNum(scope.sampleSize)}${scope.sampleWithheld ? ", its content withheld because your Entitlement Policies do not cover this group" : ""}.</span></div>`;
  }
  P.wizard = function (e) {
    const perm = S.permission("evidence", { entry: e });
    if (!perm.allowed) { AGC.shell.toast(perm.reason, "warn"); return; }
    const today = U.today(), q = quarterBounds(today), since = e.approvedDate || e.registeredDate;
    const st = { step: 1, from: q.from, to: q.to };
    const steps = ["Period", "Summary and Commit"];
    const stepsHtml = () => `<ol class="wizard-steps">${steps.map((s, i) => `<li class="wstep${st.step === i + 1 ? " active" : st.step > i + 1 ? " done" : ""}"><span class="wstep-num">${st.step > i + 1 ? I.check : i + 1}</span><span>Step ${i + 1}. ${s}</span></li>`).join("")}</ol>`;
    const valid = () => { if (!st.from || !st.to) return "Choose the period first."; if (st.from > st.to) return "From must be on or before To."; if (st.to > today) return "The period cannot end after today."; return null; };
    const body = () => {
      if (st.step === 1) {
        const scope = valid() ? null : S.evidenceScope(e, st.from, st.to);
        return `${stepsHtml()}
          <p>Choose the period the auditor asks about. The package captures the governance record of ${U.esc(e.name)} as it stands today, for that period.</p>
          <div class="ev-presets"><span class="small muted">Presets</span>
            <button type="button" class="btn btn-secondary btn-sm" data-preset="${q.from}|${q.to}">Last quarter, ${q.label}</button>
            <button type="button" class="btn btn-secondary btn-sm" data-preset="${yearBack(today)}|${today}">Last 12 months</button>
            ${since ? `<button type="button" class="btn btn-secondary btn-sm" data-preset="${since}|${today}">Since ${e.approvedDate ? "approval" : "registration"}, ${U.fmtDate(since)}</button>` : ""}</div>
          <div class="ev-dates">${C.field("From", `<input type="date" class="inp" name="from" value="${st.from}" max="${today}"/>`)}${C.field("To", `<input type="date" class="inp" name="to" value="${st.to}" max="${today}"/>`)}</div>
          <div id="evScopeNotice">${scope ? scopeNotice(e, scope) : ""}</div>
          <h4 class="sub-title">What the package holds</h4>
          <ol class="ev-comps">${S.EVIDENCE_COMPONENTS.map((c) => `<li>${U.esc(c.name)}</li>`).join("")}</ol>
          <p class="small muted">Module-owned facts go inside. The eDiscovery criteria, the Logs audit filter and the record class's retention policy are referenced, not copied, and every sampled record carries its own Audit.txt. The sample follows your Entitlement Policies, as any export does.</p>`;
      }
      const scope = S.evidenceScope(e, st.from, st.to), p = S.persona(), grp = e.groupId ? S.group(e.groupId) : null;
      return `${stepsHtml()}<dl class="kv kv-wide">
          <dt>Registration</dt><dd>${U.esc(e.name)} · ${U.esc(e.level === "Platform" ? "AI platform" : e.level === "Custom AI system" ? "Custom AI application" : e.level)}${grp ? ` · ${U.esc(grp.name)}` : " · all business groups"}</dd>
          <dt>Period</dt><dd>${U.fmtDate(st.from)} to ${U.fmtDate(st.to)}${periodTag(st.from, st.to)}</dd>
          <dt>Interactions in the period</dt><dd>${U.fmtNum(scope.population)}${scope.population ? ` · ${U.fmtNum(scope.people)} ${U.plural(scope.people, "person", "people")}` : ""}</dd>
          <dt>Findings</dt><dd>${scope.findings.length ? `${U.fmtNum(scope.findings.length)} · ${scope.counts.confirmed} confirmed ${U.plural(scope.counts.confirmed, "violation")} · ${scope.counts.dismissed} dismissed · ${scope.counts.awaiting} awaiting review` : "None in the period"}</dd>
          <dt>Documented sample</dt><dd>${scope.sampleSize ? `${U.fmtNum(scope.sampleSize)} ${U.plural(scope.sampleSize, "interaction")} as records with their Audit.txt${scope.sampleWithheld ? ", content withheld: your Entitlement Policies do not cover this group, and the manifest will say so" : ""}` : "None: nothing is archived in the period"}<div class="small muted">${U.esc(S.EVIDENCE_SAMPLE_METHOD)}.</div></dd>
          <dt>Contents</dt><dd>${S.EVIDENCE_COMPONENTS.length} components, with a manifest that states the scope, the period and how each component was produced</dd>
          <dt>Requested by</dt><dd>${p ? U.esc(p.member.displayName) : ""}</dd>
        </dl>
        ${scopeNotice(e, scope)}
        <div class="notice notice-info">${I.info}<span>Generating starts an export job. The package appears on the registration page with its progress, you are notified when it is ready, and the request and the completion are recorded in Audit History. In Archive360 the package is downloaded and deleted on the Exports page.</span></div>`;
    };
    const footer = () => `<button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>${st.step > 1 ? `<button type="button" class="btn btn-secondary" data-wz="back">Back</button>` : ""}${st.step < 2 ? `<button type="button" class="btn btn-primary" data-wz="next">Next</button>` : `<button type="button" class="btn btn-primary" data-wz="save">${I.evidence} Generate</button>`}`;
    const capture = (wrap) => { const f = wrap.querySelector("input[name='from']"), t = wrap.querySelector("input[name='to']"); if (f) st.from = f.value; if (t) st.to = t.value; };
    const paint = (wrap) => {
      wrap.querySelector(".modal-body").innerHTML = body();
      wrap.querySelector(".modal-foot").innerHTML = footer();
      if (st.step === 1) {
        const redraw = () => { capture(wrap); const n = wrap.querySelector("#evScopeNotice"); if (n) n.innerHTML = valid() ? "" : scopeNotice(e, S.evidenceScope(e, st.from, st.to)); };
        wrap.querySelectorAll("input[type='date']").forEach((inp) => inp.addEventListener("change", redraw));
        wrap.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { const [f, t] = b.dataset.preset.split("|"); wrap.querySelector("input[name='from']").value = f; wrap.querySelector("input[name='to']").value = t; redraw(); }));
        C.guard(wrap, () => { capture(wrap); return !valid(); }, () => valid() || "", "[data-wz='next']");
      }
      wrap.querySelectorAll("[data-wz]").forEach((b) => b.addEventListener("click", () => {
        capture(wrap);
        const act = b.dataset.wz;
        if (act === "back") { st.step = 1; paint(wrap); return; }
        const err = valid(); if (err) { AGC.shell.toast(err, "warn"); return; }
        if (act === "next") { st.step = 2; paint(wrap); return; }
        const pkg = S.generateEvidence(e.id, { from: st.from, to: st.to });
        C.closeModal(); AGC.router.refresh();
        setTimeout(() => AGC.shell.toast(`Export started: ${U.esc(pkg.name)}. You will be notified when it is ready.`, "success"), 30);
      }));
    };
    C.modal({ title: `Generate evidence package: ${U.esc(e.name)}`, size: "modal-lg", body: "", footer: "", onOpen: paint });
  };

  /* ---------- The package's own page ---------- */
  P.page = function (id) {
    const p = S.byId.evidence[id];
    if (!p) { AGC.router.navigate("#/registry"); return; }
    const e = S.entry(p.registerEntryId), grp = e && e.groupId ? S.group(e.groupId) : null;
    if (!e) { AGC.router.navigate("#/registry"); return; }
    const scope = S.evidenceScope(e, p.periodStart, p.periodEnd, p), m = p.manifest || {}, rc = scope.recordClass;
    const sentence = `Evidence package for ${U.esc(e.name)}${grp ? `, ${U.esc(grp.name)}` : ", registered for all business groups"}, covering ${periodText(p)}. Requested by ${who(p.requestedByMemberId)} on ${U.fmtDate(p.requestedAt)}. ${p.status === "Completed" ? `Completed ${U.fmtDateTime(p.completedAt)}${p.sizeMB ? `, ${p.sizeMB} MB` : ""}.` : p.status === "In progress" ? `The export job is running, ${p.progress || 0}% done.` : "The export job is queued."}`;
    const manifest = C.card("Manifest", `<dl class="kv kv-wide kv-detail">
        <dt>Scope</dt><dd>${U.esc(m.scope || "One AI system, one period")}: the governance record as it stood when the package was produced.</dd>
        <dt>Registration</dt><dd><a href="#/registry/${e.id}">${U.esc(e.name)}</a> · ${U.esc(e.level === "Platform" ? "AI platform" : e.level === "Custom AI system" ? "Custom AI application" : e.level)}${grp ? ` · <a href="#/groups/${grp.id}">${U.esc(grp.name)}</a>` : ""} · ${U.statusPill(e.status)}</dd>
        <dt>Period</dt><dd>${periodText(p)}${periodTag(p.periodStart, p.periodEnd)}</dd>
        <dt>Population</dt><dd>${U.fmtNum(p.populationCount || 0)} ${U.plural(p.populationCount || 0, "interaction")}${scope.people ? ` by ${U.fmtNum(scope.people)} ${U.plural(scope.people, "person", "people")}` : ""} · ${U.fmtNum(scope.findings.length)} ${U.plural(scope.findings.length, "finding")}${scope.findings.length ? ` (${scope.counts.confirmed} confirmed, ${scope.counts.dismissed} dismissed, ${scope.counts.awaiting} awaiting review)` : ""}</dd>
        <dt>Documented sample</dt><dd>${p.sampleSize ? `${U.fmtNum(p.sampleSize)} ${U.plural(p.sampleSize, "interaction")} as records with their Audit.txt` : "None: nothing is archived in the period"}${p.sampleWithheld ? `<div class="small warn-text">${I.alert} Content withheld: the requester's Entitlement Policies did not cover ${grp ? U.esc(grp.name) : "the group"}. The listing and the governance record are complete.</div>` : ""}<div class="small muted">${U.esc(p.sampleMethod || S.EVIDENCE_SAMPLE_METHOD)}${p.sampleSeed ? ` · seed ${U.esc(p.sampleSeed)}` : ""}.</div></dd>
        <dt>Collection</dt><dd>${U.esc(scope.collection.method)}${rc ? ` · record class ${U.esc(rc.name)}` : ""}<div class="small muted">${U.esc(scope.collection.gaps)}</div></dd>
        <dt>Criteria for full production</dt><dd>${scope.notArchived || !p.populationCount ? `Nothing is archived for ${U.esc(e.name)} in this period, so there is nothing for eDiscovery to produce.` : `${rc ? `Record class ${U.esc(rc.name)}, ` : ""}${scope.identifier ? `AI system <code>${U.esc(scope.identifier)}</code>, ` : `${U.esc(e.name)}, `}${periodText(p)}: eDiscovery produces the full set, or the auditor's picks from the listing.`}</dd>
        <dt>References</dt><dd><div>Logs › Audit Search filtered to the AI Governance Center action group, ${U.esc(e.name)}, ${periodText(p)}.</div><div>${rc ? `Retention: ${U.esc(rc.name)} keeps records for ${rc.retentionYears} years.` : "Retention: no record class; nothing is archived for this AI system."}</div></dd>
        <dt>Requested</dt><dd>${who(p.requestedByMemberId)}, ${U.fmtDateTime(p.requestedAt)}</dd>
        <dt>Produced by</dt><dd>${U.esc(m.producedBy || "Archive360 export job")}${m.exportName ? ` · <code>${U.esc(m.exportName)}</code>` : ""}</dd>
      </dl>`);
    const contents = C.card(`Contents <span class="count-badge">${comps(p).length || S.EVIDENCE_COMPONENTS.length}</span>`, `<ol class="ev-comps">${(comps(p).length ? comps(p) : S.EVIDENCE_COMPONENTS).map((c) => `<li><span class="strong">${U.esc(c.name)}</span>${c.how ? `<span class="small muted">${U.esc(c.how)}</span>` : ""}</li>`).join("")}</ol>`);
    const exportCard = C.card("Export", `<dl class="kv kv-wide kv-detail">
        <dt>Status</dt><dd>${pill(p)}${p.status !== "Completed" ? `<div class="ev-bar" aria-hidden="true"><span style="width:${p.progress || 0}%"></span></div><div class="small muted">${p.status === "Queued" ? "Waiting for the export job to start." : `${p.progress || 0}% done.`}</div>` : ""}</dd>
        <dt>Requested</dt><dd>${U.fmtDateTime(p.requestedAt)}</dd>
        ${p.completedAt ? `<dt>Completed</dt><dd>${U.fmtDateTime(p.completedAt)}</dd>` : ""}
        ${p.sizeMB ? `<dt>Size</dt><dd>${p.sizeMB} MB</dd>` : ""}
      </dl>
      <div class="notice notice-info">${I.info}<span>In Archive360 the package is downloaded and deleted on the Exports page, like any export. The prototype offers the download here so the contents can be seen.</span></div>
      ${p.status === "Completed" ? `<div class="btn-row"><button type="button" class="btn btn-primary" data-ev-download="${p.id}">${I.file} Download (prototype)</button></div>` : ""}`);
    const events = D.auditEvents.filter((a) => a.refType === "evidence" && a.refId === p.id);
    const history = C.card("History", events.length ? C.auditList(events, 10) : '<div class="muted small">No audit event yet.</div>');
    const html = `<div class="two-col"><div>${manifest}${contents}</div><div>${exportCard}${history}</div></div>`;
    const bc = C.originCrumbs({ label: p.name, href: `#/evidence/${p.id}` }, { nav: "registry", crumbs: [{ label: "AI Registry", href: "#/registry" }, { label: e.name, href: `#/registry/${e.id}` }, { label: p.name, href: `#/evidence/${p.id}` }] });
    AGC.shell.render({ kind: "item", navKey: bc.nav || "registry", title: p.name, breadcrumb: bc.crumbs,
      item: { badgeHtml: `<span class="type-ic" aria-hidden="true">${I.evidence}</span>`, name: p.name, statusHtml: pill(p), sentence }, html });
  };

  /* ---------- The prototype's download: the package built from the data, as a ZIP ---------- */
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  /* A stored (uncompressed) ZIP: local headers, the entries, the central directory and the end record, with UTF-8 names. */
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = [], now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF, dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    let offset = 0;
    files.forEach((f) => {
      const name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((n, x) => n + x.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: "application/zip" });
  }
  const csv = (rows) => rows.map((r) => r.map((v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n") + "\n";
  const json = (o) => JSON.stringify(o, null, 2);
  const name = (id) => { const m = S.member(id); return m ? m.displayName : (id === "system" ? "Archive360" : id || ""); };
  /* A record's audit history, as the platform would supply it beside the record: assembled here from the module's audit events about the
     interaction and its findings, after the collection line. A stand-in for the prototype, and labelled so. */
  function auditTxt(x, scope) {
    const lines = [`Audit history of record ${x.interactionId} (prototype stand-in: assembled from the module's audit events; in Archive360 each record carries its own Audit.txt)`, ""];
    const ingested = x.timestamp || `${x.date}T00:00:00Z`;
    lines.push(`${ingested}  Collected  ${scope.collection.method}${scope.recordClass ? ` into ${scope.recordClass.name}` : ""}, daily sync of ${U.addDays(x.date, 1)}`);
    const fids = new Set(x.findingIds || []);
    D.auditEvents.filter((a) => (a.refType === "interaction" && a.refId === x.interactionId) || (a.refType === "finding" && fids.has(a.refId)))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .forEach((a) => lines.push(`${a.timestamp}  ${a.eventType}  ${name(a.actorId)}: ${a.summary || ""}`));
    return lines.join("\n") + "\n";
  }
  P.buildFiles = function (p) {
    const e = S.entry(p.registerEntryId), scope = S.evidenceScope(e, p.periodStart, p.periodEnd, p), grp = e.groupId ? S.group(e.groupId) : null, rc = scope.recordClass, m = p.manifest || {};
    const files = [];
    files.push({ name: "README.txt", data: [`${p.name}`, "", `Evidence package for ${e.name}${grp ? ` (${grp.name})` : " (all business groups)"}, ${U.fmtDate(p.periodStart)} to ${U.fmtDate(p.periodEnd)}.`,
      `Requested by ${name(p.requestedByMemberId)} on ${U.fmtDateTime(p.requestedAt)}${p.completedAt ? `; completed ${U.fmtDateTime(p.completedAt)}` : ""}.`, "",
      "What this is: the governance record of one AI system for one period, as the AI Governance Center held it when the package was produced. Module-owned facts are inside (files 01 to 09). Platform-owned facts are referenced, not copied (files 10 and 11): eDiscovery produces the interactions themselves from the criteria, Logs holds the audit history, and the record class carries retention.",
      "The documented sample holds records with their Audit.txt. Every record in Archive360 carries its own audit history; the package does not restate it for the whole population.",
      "", "Prototype note: this ZIP is built in the browser from the prototype's synthetic data. In Archive360 the package is built by the export job and downloaded from the Exports page."].join("\n") + "\n" });
    files.push({ name: "manifest.json", data: json({ package: p.name, id: p.id, scope: m.scope || "One AI system, one period", registration: { id: e.id, name: e.name, level: e.level, businessGroup: grp ? grp.name : null }, period: { start: p.periodStart, end: p.periodEnd, label: S.evidencePeriodLabel(p.periodStart, p.periodEnd) },
      requestedBy: name(p.requestedByMemberId), requestedAt: p.requestedAt, status: p.status, completedAt: p.completedAt || null, sizeMB: p.sizeMB || null, producedBy: m.producedBy || null, exportName: m.exportName || null,
      population: { interactions: p.populationCount || 0, people: scope.people, findings: scope.findings.length, confirmedViolations: scope.counts.confirmed, dismissed: scope.counts.dismissed, awaitingReview: scope.counts.awaiting },
      sample: { method: p.sampleMethod || S.EVIDENCE_SAMPLE_METHOD, seed: p.sampleSeed || null, size: p.sampleSize || 0, interactionIds: p.sampleInteractionIds || [], contentWithheld: !!p.sampleWithheld, withheldReason: p.sampleWithheld ? "The requester's Entitlement Policies did not cover the business group." : null },
      collection: scope.collection, recordClass: rc ? { id: rc.id, name: rc.name, retentionYears: rc.retentionYears } : null,
      components: (comps(p).length ? comps(p) : S.EVIDENCE_COMPONENTS).map((c, i) => ({ n: i + 1, name: c.name, how: c.how })) }) });
    files.push({ name: "01-registration-and-approval-history.json", data: json({ id: e.id, name: e.name, level: e.level, status: e.status, businessGroup: grp ? grp.name : null, accountableOwner: name(e.ownerMemberId), approvedPurpose: e.approvedPurpose, permittedSensitiveDataTags: (e.permittedDataClasses || []).map(S.dcName),
      registered: e.registeredDate, registeredBy: name(e.registeredByMemberId), approved: e.approvedDate || null, approvedBy: e.approvedByMemberId ? name(e.approvedByMemberId) : null, lastReconfirmed: e.lastReconfirmedDate || null, reconfirmationDue: e.reconfirmationDueDate || null, cadenceMonths: e.reconfirmationIntervalMonths || null, blockers: e.blockers || [],
      decisionHistory: (e.decisionHistory || []).map((h) => ({ date: h.date, action: h.action, by: name(h.actorMemberId), detail: h.detail || "" })) }) });
    files.push({ name: "02-configuration-versions.json", data: json(scope.configVersions) });
    files.push({ name: "03-ai-policy-rule-versions.json", data: json(scope.ruleVersions) });
    files.push({ name: "04-findings-and-decisions.json", data: json(scope.findings.map((f) => { const r = S.rule(f.ruleId), s = f.aiSystemId ? S.system(f.aiSystemId) : null; return { findingId: f.findingId, interactionId: f.interactionId, detectedAt: f.detectedAt, rule: r ? r.name : f.ruleId, ruleVersion: f.ruleVersion, sensitiveData: S.dcName(f.dataClassId), severity: f.severity, severityDefault: f.severityDefault || null, detectedIn: f.location, person: name(f.memberId), businessGroup: S.groupName(f.groupId), aiAsset: s ? s.name : "Direct chat", status: f.status === "Confirmed" ? "Confirmed violation" : f.status === "Dismissed" ? "Dismissed" : "Awaiting review", registrationStateAtDetection: f.registrationStateAtDetection || null,
      review: f.review ? { decision: f.review.decision, reviewer: name(f.review.reviewerMemberId), decidedAt: f.review.decidedAt, reason: f.review.reason, note: f.review.note || "", reviewerAuthority: f.review.entitlementPolicyId ? `Archive360 Entitlement Policy ${f.review.entitlementPolicyId}` : null } : null, escalationId: f.escalationId || null }; })) });
    files.push({ name: "05-review-coverage.json", data: json({ asOf: U.today(), note: "Who can review the business group's activity today, with the Archive360 Entitlement Policy that grants it.", reviewers: scope.reviewers }) });
    files.push({ name: "06-collection-method-and-gaps.json", data: json(scope.collection) });
    files.push({ name: "07-monthly-activity-volumes.csv", data: csv([["month", "interactions", "people", "findings", "confirmed_violations", "dismissed", "awaiting_review"]].concat(scope.months.map((r) => [r.month, r.interactions, r.people, r.findings, r.confirmed, r.dismissed, r.awaiting]))) });
    files.push({ name: "08-population-listing.csv", data: csv([["interaction_id", "last_turn_date", "thread_started", "person", "business_group", "ai_asset", "turns", "chat_status", "findings", "finding_status"]].concat(scope.interactions.map((x) => { const s = x.aiSystemId ? S.system(x.aiSystemId) : null, fs = (x.findingIds || []).map((id) => S.finding(id)).filter(Boolean); return [x.interactionId, x.date, x.threadCreatedDate || x.date, name(x.memberId), S.groupName(x.groupId), s ? s.name : "Direct chat", x.turnCount || 0, x.chatStatus || "", fs.length, fs.map((f) => (f.status === "Confirmed" ? "Confirmed violation" : f.status === "Dismissed" ? "Dismissed" : "Awaiting review")).join("; ")]; }))) });
    if (p.sampleWithheld) files.push({ name: "09-sample/WITHHELD.txt", data: `The documented sample (${p.sampleSize} interactions: ${(p.sampleInteractionIds || []).join(", ")}) was withheld because the requester's Entitlement Policies did not cover ${grp ? grp.name : "the business group"} when the package was produced. The population listing names them; eDiscovery produces them for an entitled person.\n` });
    else (p.sampleInteractionIds || []).forEach((id) => {
      const x = S.interaction(id); if (!x) return;
      const s = x.aiSystemId ? S.system(x.aiSystemId) : null, conv = (D.conversations || {})[id] || null;
      files.push({ name: `09-sample/${id}.json`, data: json({ interactionId: id, chatName: x.chatName || "", person: name(x.memberId), businessGroup: S.groupName(x.groupId), aiAsset: s ? s.name : "Direct chat", aiSystem: x.instanceId && S.instance(x.instanceId) ? S.instance(x.instanceId).name : null, threadStarted: x.threadCreatedDate || x.date, lastTurn: x.date, turns: x.turnCount, tokens: x.tokenCount, models: x.models || [], chatStatus: x.chatStatus, contentRetained: !!x.contentRetained, useCategory: x.useCategory || null, findingIds: x.findingIds || [], attachedFiles: x.attachedFiles || [], appCalls: x.appCalls || [], actionCalls: x.actionCalls || [], content: conv ? conv : (x.contentRetained ? "Content not in the prototype's conversation files." : "Content not retained.") }) });
      files.push({ name: `09-sample/${id}.Audit.txt`, data: auditTxt(x, scope) });
    });
    files.push({ name: "10-production-criteria.json", data: json({ note: "Criteria for producing the full set, or the auditor's picks from the listing, in Archive360 eDiscovery. Nothing is copied here.", recordClass: rc ? rc.name : null, aiSystem: e.name, aiSystemIdentifier: scope.identifier || null, aiAssetId: e.level === "Platform" ? null : e.refId, period: { start: p.periodStart, end: p.periodEnd }, expectedInteractions: p.populationCount || 0 }) });
    files.push({ name: "11-references.json", data: json({ auditHistory: { where: "Archive360 Logs, Audit Search", filter: { actionGroup: "AI Governance Center", aiSystem: e.name, from: p.periodStart, to: p.periodEnd }, eventsAtProduction: scope.auditCount }, retention: rc ? { recordClass: rc.name, retentionYears: rc.retentionYears } : { recordClass: null, note: "Nothing is archived for this AI system." }, recordAudit: "Each record carries its own Audit.txt; the sample's records include theirs." }) });
    return files;
  };
  P._zip = zip; // exposed for the browser check of the archive's structure
  P.download = function (p) {
    const files = P.buildFiles(p), blob = zip(files), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = (p.manifest && p.manifest.exportName) || `${slug(p.name)}.zip`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    AGC.shell.toast(`Prototype download of ${U.esc(p.name)}: ${files.length} files. In Archive360 the package is downloaded from the Exports page.`, "info");
  };
  document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-ev-download]"); if (!b) return; const p = S.byId.evidence[b.dataset.evDownload]; if (p) P.download(p); });

  /* The simulated export job reports progress; the page that shows the package or its registration redraws, and completion is announced. */
  S.onEvidenceProgress = function (p) {
    const h = location.hash || "";
    if (h.indexOf(`/evidence/${p.id}`) >= 0 || h.indexOf(`/registry/${p.registerEntryId}`) >= 0) AGC.router.refresh();
    if (p.status === "Completed") setTimeout(() => AGC.shell.toast(`${U.esc(p.name)} is ready. The notification is in the bell; in Archive360 the package is on the Exports page.`, "success"), 30);
  };
})();
