/* Utilities shared by every screen. Classic script: everything hangs off window.AGC. */
(function () {
  window.AGC = window.AGC || {};
  const U = (AGC.util = {});

  U.esc = function (s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  };

  U.today = function () { return AGC.data.meta.today; };
  U.nowMs = function () { return Date.parse(AGC.data.meta.now); };

  U.parseDate = function (s) {
    if (!s) return null;
    const d = new Date(s.length === 10 ? s + "T12:00:00Z" : s);
    return isNaN(d) ? null : d;
  };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  U.fmtDate = function (s) {
    const d = U.parseDate(s);
    if (!d) return "";
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
  };
  U.fmtDateLong = function (s) {
    const d = U.parseDate(s);
    if (!d) return "";
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  };
  U.fmtDateTime = function (s) {
    const d = U.parseDate(s);
    if (!d) return "";
    return `${U.fmtDate(s)} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  };
  U.fmtMonth = function (key) {
    const [y, m] = key.split("-");
    return `${MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`;
  };
  U.daysBetween = function (a, b) {
    const da = U.parseDate(a), db = U.parseDate(b);
    if (!da || !db) return null;
    return Math.round((db - da) / 86400000);
  };
  U.daysAgo = function (s) { return U.daysBetween(s, U.today()); };
  U.daysUntil = function (s) { return U.daysBetween(U.today(), s); };
  U.relTime = function (s) {
    const d = U.parseDate(s);
    if (!d) return "";
    /* A date with no time is placed at noon, which on today's date falls after "now" and used to read "in 3 hr". Dates count in whole days. */
    if (s.length === 10) {
      const days = Math.round((U.parseDate(U.today()).getTime() - d.getTime()) / 86400000);
      if (days === 0) return "today";
      if (days === 1) return "yesterday";
      if (days > 1) return U.relSpan(days * 86400) + " ago";
    }
    const diff = (U.nowMs() - d.getTime()) / 1000;
    if (diff < 0) return "in " + U.relSpan(-diff);
    return U.relSpan(diff) + " ago";
  };
  U.relSpan = function (sec) {
    const m = sec / 60, h = m / 60, dd = h / 24;
    if (m < 1) return "moments";
    if (h < 1) return Math.round(m) + " min";
    if (dd < 1) return Math.round(h) + " hr";
    if (dd < 30) return Math.round(dd) + (Math.round(dd) === 1 ? " day" : " days");
    const mo = dd / 30;
    if (mo < 24) return Math.round(mo) + " mo";  /* "13 mo", never "1.0 yr" (2026-09-30) */
    return Math.round(dd / 365) + " yr";
  };
  U.addDays = function (s, n) {
    const d = U.parseDate(s);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  U.monthKey = function (s) { return (s || "").slice(0, 7); };
  U.lastMonths = function (n) {
    const out = [];
    const t = U.parseDate(U.today());
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - i, 1));
      out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  };

  U.fmtNum = function (n) {
    if (n === null || n === undefined) return "";
    return Number(n).toLocaleString("en-US");
  };
  U.fmtCompact = function (n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 10000) return Math.round(n / 1000) + "k";
    return U.fmtNum(n);
  };
  U.pct = function (a, b) { return b ? Math.round((a / b) * 100) : 0; };
  U.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  U.initials = function (name) {
    if (!name) return "?";
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
  };
  U.groupBy = function (arr, fn) {
    const out = {};
    for (const x of arr) { const k = typeof fn === "function" ? fn(x) : x[fn]; (out[k] = out[k] || []).push(x); }
    return out;
  };
  U.countBy = function (arr, fn) {
    const out = {};
    for (const x of arr) { const k = typeof fn === "function" ? fn(x) : x[fn]; out[k] = (out[k] || 0) + 1; }
    return out;
  };
  U.sum = function (arr, fn) { return arr.reduce((a, x) => a + (fn ? fn(x) : x), 0); };
  U.uniq = function (arr) { return Array.from(new Set(arr)); };
  U.sortBy = function (arr, fn, desc) {
    const s = arr.slice().sort((a, b) => { const va = fn(a), vb = fn(b); return va < vb ? -1 : va > vb ? 1 : 0; });
    return desc ? s.reverse() : s;
  };
  U.debounce = function (fn, ms) { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(null, a), ms); }; };
  U.plural = function (n, one, many) { return n === 1 ? one : (many || one + "s"); };

  U.severityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  U.statusMeta = {
    Approved: { cls: "ok", label: "Approved" },
    Pending: { cls: "pending", label: "Pending" },
    Suspended: { cls: "danger", label: "Suspended" },
    Expired: { cls: "expired", label: "Expired" },
    Rejected: { cls: "muted", label: "Rejected" },
    Retired: { cls: "muted", label: "Retired" },
    Unregistered: { cls: "unreg", label: "Unregistered" },
  };

  /* --- Icons (inline SVG, currentColor) --- */
  const I = (AGC.icons = {});
  const svg = (inner, vb) => `<svg viewBox="${vb || "0 0 24 24"}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  I.groups = svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>');
  I.members = svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>');
  I.overview = svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>');
  I.findings = svg('<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>');
  I.approvals = svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>');
  I.unregistered = svg('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>');
  I.rules = svg('<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/>');
  I.audit = svg('<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>');
  I.settings = svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
  I.systems = svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/><path d="M9 10h6"/><path d="M9 7h2"/>');
  I.interactions = svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');
  I.sources = svg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>');
  I.evidence = svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/>');
  I.policies = I.rules;
  I.home = svg('<path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>');
  I.calendar = svg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>');
  I.info = svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>');
  I.check = svg('<path d="M20 6L9 17l-5-5"/>');
  I.checkCircle = svg('<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>');
  I.help = svg('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5"/><path d="M12 18h.01"/>');
  I.arrowUp = svg('<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>');
  I.alert = svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>');
  I.pause = svg('<circle cx="12" cy="12" r="10"/><path d="M10 9v6"/><path d="M14 9v6"/>');
  I.clock = svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
  I.minus = svg('<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>');
  I.x = svg('<path d="M18 6L6 18"/><path d="M6 6l12 12"/>');
  I.filter = svg('<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>');
  I.file = svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/>');
  I.image = svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>');
  I.archive = svg('<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>');
  I.trash = svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>');
  I.temp = svg('<circle cx="12" cy="12" r="10" stroke-dasharray="3 3"/><path d="M12 7v5l3 2"/>');
  I.chevronRight = svg('<path d="M9 18l6-6-6-6"/>');
  I.chevronDown = svg('<path d="M6 9l6 6 6-6"/>');
  I.arrowRight = svg('<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>');
  I.lock = svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>');
  I.user = I.members;
  I.mail = svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>');
  I.bell = svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>');
  I.grid = svg('<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>');
  I.list = svg('<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>');
  I.cards = svg('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>');
  I.search = svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>');
  I.shield = I.rules;
  I.risk = svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>');
  I.coverage = svg('<circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/>');
  I.owner = svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M16 4l2 2 3-3"/>');
  I.flag = svg('<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>');
  I.retire = svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>');
  I.platform = svg('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>');
  I.stack = svg('<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/>');
  I.external = svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/>');
  I.mapping = svg('<path d="M4 6h6"/><path d="M4 12h6"/><path d="M4 18h6"/><path d="M14 6h6"/><path d="M14 12h6"/><path d="M14 18h6"/><path d="M10 6l4 6"/><path d="M10 12l4 6"/>');
  I.trend = svg('<path d="M3 17l6-6 4 4 8-8"/>');
  I.dot = '<span class="dot"></span>';

  U.icon = function (name) { return I[name] || ""; };

  U.statusIcon = function (status) {
    const map = { Approved: "checkCircle", Pending: "clock", Suspended: "pause", Expired: "alert", Rejected: "x", Retired: "minus", Unregistered: "unregistered" };
    const m = U.statusMeta[status] || { cls: "muted" };
    return `<span class="status-ic ${m.cls}" title="${U.esc(status)}">${U.icon(map[status] || "minus")}</span>`;
  };
  U.statusPill = function (status, extra) {
    const m = U.statusMeta[status] || { cls: "muted", label: status };
    return `<span class="pill pill-${m.cls}">${U.statusIcon(status)}<span>${U.esc(m.label)}${extra ? " " + U.esc(extra) : ""}</span></span>`;
  };
  U.sevChip = function (sev) { return `<span class="sev sev-${(sev || "").toLowerCase()}">${U.esc(sev)}</span>`; };
  U.riskBand = function (score) {
    if (score >= 75) return { band: "Critical", cls: "critical" };
    if (score >= 50) return { band: "High", cls: "high" };
    if (score >= 25) return { band: "Moderate", cls: "moderate" };
    return { band: "Low", cls: "low" };
  };
  U.riskBadge = function (score) {
    const b = U.riskBand(score);
    return `<span class="risk-badge risk-${b.cls}" title="Risk score ${score} (${b.band})"><span class="risk-num">${score}</span><span class="risk-band">${b.band}</span></span>`;
  };
  U.avatar = function (member, size) {
    const cls = size === "lg" ? "avatar avatar-lg" : size === "sm" ? "avatar avatar-sm" : "avatar";
    return `<span class="${cls}" title="${U.esc(member ? member.displayName : "")}">${U.esc(U.initials(member ? member.displayName : "?"))}</span>`;
  };
  /* Employment status as the identity source reports it (Gabriel, 2026-09-23): Active, On Leave, Inactive or Terminated. One word per
     state, shown the same way everywhere: a tag beside the name in lists, a pill on the person page, the word in a sentence. A terminated
     person carries removedDate; one on leave or inactive carries statusSince. "Departed" is no longer said anywhere. */
  U.STATUS = {
    "Active": { label: "Active", word: "active", tag: "", pill: "pill-ok", icon: "checkCircle" },
    "On Leave": { label: "On leave", word: "on leave", tag: "tag-pending", pill: "pill-pending", icon: "clock" },
    "Inactive": { label: "Inactive", word: "inactive", tag: "", pill: "pill-muted", icon: "lock" },
    "Terminated": { label: "Terminated", word: "terminated", tag: "tag-danger", pill: "pill-danger", icon: "minus" },
  };
  U.statusOf = (m) => U.STATUS[m && m.memberStatus] || U.STATUS.Active;
  U.isActive = (m) => !!m && m.memberStatus === "Active";
  U.statusWord = (m) => U.statusOf(m).word;
  /* The status with its date, for a detail row or a hover: "Active since 04/15/2019", "On leave since 07/22/2026",
     "Inactive since 08/03/2026 · account disabled", "Terminated 06/30/2026". */
  U.statusDetail = function (m) {
    if (m.memberStatus === "Terminated") return `Terminated${m.removedDate ? ` ${U.fmtDate(m.removedDate)}` : ""}`;
    if (m.memberStatus === "On Leave") return `On leave${m.statusSince ? ` since ${U.fmtDate(m.statusSince)}` : ""}`;
    if (m.memberStatus === "Inactive") return `Inactive${m.statusSince ? ` since ${U.fmtDate(m.statusSince)}` : ""} · account disabled`;
    return `Active${m.hireDate ? ` since ${U.fmtDate(m.hireDate)}` : ""}`;
  };
  /* A plain-text sentence for a strip or a notice; callers escape it. */
  U.statusSentence = function (m) {
    if (m.memberStatus === "Terminated") return `${m.displayName}'s employment ended${m.removedDate ? ` on ${U.fmtDate(m.removedDate)}` : ""}`;
    if (m.memberStatus === "On Leave") return `${m.displayName} has been on leave${m.statusSince ? ` since ${U.fmtDate(m.statusSince)}` : ""}`;
    if (m.memberStatus === "Inactive") return `${m.displayName} has been inactive${m.statusSince ? ` since ${U.fmtDate(m.statusSince)}` : ""}; the account is disabled`;
    return `${m.displayName} is active`;
  };
  U.statusTag = (m) => (U.isActive(m) ? "" : ` <span class="tag ${U.statusOf(m).tag}" title="${U.esc(U.statusDetail(m))}">${U.statusOf(m).label}</span>`);
  U.employmentPill = function (m) { const s = U.statusOf(m); return `<span class="pill ${s.pill}">${I[s.icon] || ""}<span>${s.label}</span></span>`; };
  /* "12 active · 1 on leave · 1 terminated" for a list of people, leaving out what is zero; skipActive drops the first part. */
  U.statusBreakdown = function (list, opts) {
    const o = opts || {};
    return Object.keys(U.STATUS).filter((k) => !(o.skipActive && k === "Active")).map((k) => { const n = list.filter((m) => m.memberStatus === k).length; return n ? `${U.fmtNum(n)} ${U.STATUS[k].word}` : ""; }).filter(Boolean).join(" · ");
  };
  U.memberLink = function (member, opts) {
    if (!member) return '<span class="muted">Unassigned</span>';
    const o = opts || {};
    const gone = o.noStatus ? "" : U.statusTag(member);  /* noStatus: the table has its own Status column */
    return `<a class="entity-link" href="#/members/${member.memberId}">${o.noAvatar ? "" : U.avatar(member, "sm")}<span>${U.esc(member.displayName)}</span></a>${gone}`;
  };

  /* Tiny SVG charts */
  U.barChart = function (series, opts) {
    // series: [{label, values:[{key,color}] }] simplified: rows of {label, segments:[{value,color,title}]}
    const o = Object.assign({ height: 140, gap: 6, showLabels: true }, opts || {});
    const n = series.length;
    if (!n) return '<div class="chart-empty">No data</div>';
    const max = Math.max(1, ...series.map((r) => U.sum(r.segments, (s) => s.value)));
    const w = 100 / n;
    let bars = "";
    series.forEach((r, i) => {
      let y = o.height;
      r.segments.forEach((s) => {
        const h = (s.value / max) * (o.height - 8);
        y -= h;
        if (s.value > 0) bars += `<rect x="${(i * w + o.gap / 4).toFixed(2)}%" y="${y.toFixed(1)}" width="${(w - o.gap / 2).toFixed(2)}%" height="${h.toFixed(1)}" fill="${s.color}" rx="1.5"><title>${U.esc(r.label)}: ${U.esc(s.title || s.value)}</title></rect>`;
      });
    });
    let labels = "";
    if (o.showLabels) {
      series.forEach((r, i) => { labels += `<span style="width:${w}%">${U.esc(r.label)}</span>`; });
    }
    return `<div class="chart"><svg viewBox="0 0 100 ${o.height}" preserveAspectRatio="none" style="width:100%;height:${o.height}px">${bars}</svg><div class="chart-labels">${labels}</div></div>`;
  };
  U.sparkline = function (values, color) {
    if (!values.length) return "";
    const max = Math.max(1, ...values), w = 100, h = 28;
    const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(" ");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color || "var(--accent)"}" stroke-width="2"/></svg>`;
  };
  U.meter = function (value, max, cls) {
    const p = U.clamp(U.pct(value, max), 0, 100);
    return `<span class="meter"><span class="meter-fill ${cls || ""}" style="width:${p}%"></span></span>`;
  };
})();
