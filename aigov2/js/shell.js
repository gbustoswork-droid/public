/* Shell: the v216 header stack (global header, section tabs, title band, breadcrumb band, and under the breadcrumb either the
   detail header band or the item header band) plus menus, toasts and the persona-aware pieces. */
(function () {
  const U = AGC.util, S = AGC.store, I = AGC.icons;
  const SH = (AGC.shell = {});

  SH.NAV = [
    { key: "overview", label: "Overview", href: "#/overview", icon: "overview", title: "Overview",
      description: "The state of AI governance at a glance: what needs attention, and how each business group is using AI." },
    { key: "groups", label: "Groups", href: "#/groups", icon: "groups", title: "Groups",
      description: "Which business groups are ready for governance, who is accountable for each, and how much AI each uses. Open a group for the detail." },
    { key: "people", label: "People", href: "#/people", icon: "members", title: "People",
      description: "Every person, by business group, with their department, employment status, and last AI activity. Open a person's group history and AI activity." },
    { key: "findings", label: "Findings", href: "#/findings", icon: "findings", badge: "findings", title: "Findings",
      description: "What the AI Policy Rules flagged, by business group, for a reviewer to confirm or dismiss with the interaction in front of them. A finding is a violation only once a reviewer confirms it." },
    { key: "approvals", label: "Approvals", href: "#/approvals", icon: "approvals", badge: "approvals", feature: "approve", title: "Approvals",
      description: "Escalated violations waiting for an approver to decide the response, and AI systems waiting to be approved for use. Reviewers judge validity on Findings; approvers decide what changes here." },
    { key: "unregistered", label: "Unregistered AI", href: "#/unregistered", icon: "unregistered", badge: "unregistered", feature: "unregistered", title: "Unregistered AI",
      description: "AI activity and API access that Archive360 found but that your setup does not cover, so nobody is accountable for it yet. Decide what each item is and where it belongs." },
    { key: "registry", label: "AI Registry", href: "#/registry", icon: "coverage", features: ["register", "reconfirm", "retire", "approve", "settings"], title: "AI Registry",
      description: "What is approved to run AI here, who answers for it, and when that was last confirmed. AI systems come from Settings; AI assets are registered here when they need their own owner and cadence." },
    { key: "rules", label: "AI Policy Rules", href: "#/rules", icon: "rules", features: ["rules", "review", "approve", "register", "reconfirm", "retire", "remediate", "settings"], title: "AI Policy Rules",
      description: "The rules that decide when sensitive data in an AI interaction is a violation: what each rule detects, where that data is allowed, how serious a violation is and which regulation or policy it rests on, how the rule performs, and how it has changed. A finding keeps the version of the rule it was judged under." },
    { key: "audit", label: "Audit History", href: "#/audit", icon: "audit", title: "Audit History",
      description: "Who did what, and when: registrations and approvals, setup changes, people synchronized, notifications sent, review decisions and content viewed. Read-only, and exportable for an auditor." },
    { key: "settings", label: "Settings", href: "#/settings", icon: "settings", feature: "settings", title: "Settings",
      description: "AI systems, business groups, Business Group Mapping, notifications, and the readiness check before governance runs." },
  ];
  SH.visibleNav = function () {
    return SH.NAV.filter((n) => {
      if (n.feature) return S.can(n.feature);
      if (n.features) return n.features.some((f) => S.can(f));
      return true;
    });
  };
  SH.navMeta = (key) => SH.NAV.find((n) => n.key === key);

  const APPS = ["Dashboard", "Ingestion", "Index", "eDiscovery", "Self Service Access", "Disposition", "Logs", "Administration", "Records Management", "AI Governance Center"];

  function headerHtml(minimal) {
    const p = S.persona();
    const notes = p ? S.notificationsFor() : [];
    const unread = notes.filter((n) => !n.read).length;
    const greeting = p ? `Hello, ${U.esc(p.member.firstName)}` : "Choose a profile";
    return `
  <header class="global-header">
    <div class="global-header-left">
      <div class="global-module-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
          <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>
        </svg>
      </div>
      <span class="global-module-name">AI Governance Center</span>
    </div>
    <div class="global-header-center">
      <span class="global-brand-name">ARCHIVE360</span>
      <span class="global-brand-suffix">Platform</span>
    </div>
    <div class="global-header-right">
      <button class="global-icon-btn" id="globalThemeToggle" aria-label="Toggle dark mode" title="Toggle theme" data-action="toggle-theme">
        <svg id="globalIconMoon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${AGC.state.theme === "dark" ? 'style="display:none"' : ""}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        <svg id="globalIconSun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${AGC.state.theme === "dark" ? "" : 'style="display:none"'}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      </button>
      ${minimal ? "" : `
      <a class="global-icon-btn" href="${AGC.pages.guide ? AGC.pages.guide.href() : "#/guide"}" target="_blank" rel="noopener" aria-label="User guide" title="User guide (opens in a new tab)">${I.help}</a>
      <div class="hdr-menu-wrap">
        <button class="global-icon-btn" aria-label="App switcher" data-menu="apps" aria-haspopup="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>
        </button>
        <div class="hdr-menu" id="menu-apps" hidden>
          <div class="hdr-menu-title">Applications</div>
          ${APPS.map((a) => `<button class="hdr-menu-item${a === "AI Governance Center" ? " active" : ""}" data-action="app-switch" data-app="${U.esc(a)}">${U.esc(a)}</button>`).join("")}
        </div>
      </div>
      <div class="hdr-menu-wrap">
        <button class="global-icon-btn${unread ? " has-badge" : ""}" aria-label="Notifications" data-menu="notes" aria-haspopup="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          ${unread ? '<span class="global-badge-dot"></span>' : ""}
        </button>
        <div class="hdr-menu hdr-menu-wide" id="menu-notes" hidden>
          <div class="hdr-menu-title">Notifications ${unread ? `<span class="count-badge">${unread} new</span>` : ""}</div>
          ${notes.length ? notes.slice(0, 8).map((n) => `<a class="hdr-note${n.read ? "" : " unread"}" href="${noteHref(n)}"><span class="hdr-note-subject">${U.esc(n.subject)}</span><span class="hdr-note-meta">${U.esc(n.type)} · ${U.relTime(n.sentAt)}${n.deliveryNote ? " · " + U.esc(n.deliveryNote) : ""}</span></a>`).join("") : '<div class="hdr-menu-empty">No notifications for this profile.</div>'}
        </div>
      </div>
      <div class="hdr-menu-wrap">
        <button class="global-user-greeting" data-menu="persona" aria-haspopup="true">
          <span>${greeting}</span>
          <div class="global-avatar">${U.esc(p ? U.initials(p.member.displayName) : "?")}</div>
        </button>
        <div class="hdr-menu" id="menu-persona" hidden>
          ${p ? `<div class="persona-card-mini">${U.avatar(p.member, "lg")}<div><div class="pc-name">${U.esc(p.member.displayName)}</div><div class="pc-role">${U.esc(p.roleTitle)}${p.groupId ? " · " + U.esc(S.groupName(p.groupId)) : ""}</div><div class="pc-profile">Profile: ${U.esc(p.profile.name)}</div><div class="pc-profile">Entitlement: ${p.eps.length ? p.eps.map((e) => U.esc(e.name)).join(", ") : "none (metadata only)"}</div></div></div>` : ""}
          <button class="hdr-menu-item" data-action="personal-settings">Personal Settings</button>
          <button class="hdr-menu-item" data-action="change-profile">Change Profile</button>
          <button class="hdr-menu-item" data-action="about">About</button>
          <button class="hdr-menu-item" data-action="sign-out">Sign Out</button>
        </div>
      </div>`}
    </div>
  </header>`;
  }
  function noteHref(n) {
    if (n.refType === "escalation") return `#/approvals/${n.refId}`;
    if (n.refType === "register") return `#/register/${n.refId}`;
    if (n.refType === "group") return `#/groups/${n.refId}`;
    if (n.refType === "approvals") return "#/approvals";
    if (n.refType === "evidence") return `#/evidence/${n.refId}`;
    return "#/overview";
  }

  function navHtml(activeKey) {
    const counts = S.queueCounts();
    return `<nav class="global-nav" role="tablist" aria-label="AI Governance Center sections">
      ${SH.visibleNav().map((n) => {
        const c = n.badge ? counts[n.badge] : 0;
        return `<button class="global-nav-item${n.key === activeKey ? " active" : ""}" role="tab" data-nav="${n.href}">${U.esc(n.label)}${c ? `<span class="nav-badge">${c}</span>` : ""}</button>`;
      }).join("")}
    </nav>`;
  }

  /* The page's own door into the user guide (Gabriel, 2026-10-22): a small Guide link at the right of the title band, or of the breadcrumb
     band on a detail page, opening the guide in a new tab on the section about this page. The header's help icon opens the whole guide. */
  function guideLinkHtml() {
    const g = AGC.pages.guide; if (!g) return "";
    const section = g.sectionFor(AGC.router.current); if (!section) return "";
    return `<a class="band-guide-link" href="${g.href(section)}" target="_blank" rel="noopener" title="Open the user guide on this page's section (new tab)">${I.help}<span>Guide</span></a>`;
  }
  function titleBandHtml(page) {
    return `<section class="global-page-title-band">
      <div class="global-page-title-row">
        <div class="global-page-title-icon" id="globalPageIcon" aria-hidden="true">${U.icon(page.icon || "overview")}</div>
        <h1 class="global-page-title" id="globalPageTitle">${U.esc(page.title)}</h1>
        ${page.titleExtra || ""}
        ${page.kind === "guide" ? "" : guideLinkHtml()}
      </div>
      <p class="global-page-description" id="globalPageDescription">${U.esc(page.description || "")}</p>
    </section>`;
  }

  function breadcrumbHtml(page) {
    const crumbs = page.breadcrumb || [];
    return `<section class="gd-breadcrumb-band" aria-label="Breadcrumb">
      <div class="gd-breadcrumb" role="navigation">
        <button class="gd-breadcrumb-home" data-nav="#/overview" aria-label="Return to Overview" title="Return to Overview">${I.home}</button>
        ${crumbs.map((c, i) => `<span class="gd-breadcrumb-sep" aria-hidden="true">&#8250;</span>${c.href && i < crumbs.length - 1 ? `<a href="${c.href}" class="gd-breadcrumb-link">${U.esc(c.label)}</a>` : (i === crumbs.length - 1 && !page.viewOptions ? `<span class="gd-breadcrumb-group-name">${U.esc(c.label)}</span>` : `<span class="gd-breadcrumb-text">${U.esc(c.label)}</span>`)}`).join("")}
        ${page.viewOptions ? `<span class="gd-breadcrumb-sep" aria-hidden="true">&#8250;</span>
        <div class="gd-breadcrumb-view-wrap">
          <label for="gdViewSelect" class="sr-only">Detail view</label>
          <select class="gd-view-select" id="gdViewSelect" data-action="view-select" aria-label="Select detail view">
            ${page.viewOptions.map((o) => `<option value="${U.esc(o.href)}"${o.active ? " selected" : ""}>${U.esc(o.label)}</option>`).join("")}
          </select>
        </div>` : ""}
        ${guideLinkHtml()}
      </div>
    </section>`;
  }

  /* The v216 detail header band, with the sub-page name and the date range. It belongs only on a page that has sub-pages and numbers
     that depend on a period, which today is the group page. Every other detail page uses the item header below (Gabriel, 2026-09-21). */
  function detailHeaderHtml(page) {
    const dr = AGC.state.dateRange;
    const d = page.detail || {};
    const label = dr.mode === "custom" ? `${U.fmtDate(dr.from)} &ndash; ${U.fmtDate(dr.to)}` : `${U.fmtDate(d.firstDate || "2025-03-01")} &ndash; ${U.fmtDate(U.today())}`;
    /* The group page's header (Gabriel, 2026-09-25): the item header every detail page has, name once, readiness in words as a pill, one
       sentence, and the date range at the right only on the sub-pages whose numbers depend on a period. It replaced the v216 band, which
       repeated the crumb and the view selector and showed readiness as a hover-only icon. */
    return `<section class="item-header-band" aria-label="Group header">
      <div class="item-header">
        <span class="item-header-icon gd-detail-header-icon" aria-hidden="true">${d.iconHtml || U.icon("groups")}</span>
        <h1 class="item-header-name">${U.esc(d.name || page.title)}</h1>
        ${d.statusHtml || ""}
        ${d.noDateRange ? "" : `<div class="item-header-range"><span class="gd-detail-header-label">Date range</span>
        <div class="gd-date-range-wrap">
          <button class="gd-date-range-trigger" data-menu="daterange" aria-haspopup="true" aria-expanded="false">
            <span class="gd-date-range-cal-icon" aria-hidden="true">${I.calendar}</span>
            <span class="gd-date-range-label">${label}</span>
            <span class="gd-date-range-caret" aria-hidden="true">&#9662;</span>
          </button>
          <div class="gd-date-range-popover" id="menu-daterange" hidden role="dialog" aria-label="Choose date range">
            <ul class="gd-date-range-options">
              <li><label class="gd-date-range-option"><input type="radio" name="gdDateRangeMode" value="all"${dr.mode === "all" ? " checked" : ""} data-action="daterange-mode"/><span class="gd-date-range-option-text">All data</span></label></li>
              <li><label class="gd-date-range-option"><input type="radio" name="gdDateRangeMode" value="custom"${dr.mode === "custom" ? " checked" : ""} data-action="daterange-mode"/><span class="gd-date-range-option-text">Custom range</span></label></li>
            </ul>
            <div class="gd-date-range-custom" id="gdDateRangeCustom"${dr.mode === "custom" ? "" : ' style="display:none"'}>
              <div class="gd-date-range-field"><label class="gd-date-range-field-label" for="gdDateRangeFrom">FROM</label><input type="date" id="gdDateRangeFrom" class="gd-date-range-field-input" value="${dr.from || "2026-06-01"}"/></div>
              <div class="gd-date-range-field"><label class="gd-date-range-field-label" for="gdDateRangeTo">TO</label><input type="date" id="gdDateRangeTo" class="gd-date-range-field-input" value="${dr.to || U.today()}"/></div>
            </div>
            <div class="gd-date-range-popover-footer">
              <button class="gd-date-range-cancel-btn" data-action="daterange-cancel">Cancel</button>
              <button class="gd-date-range-apply-btn" data-action="daterange-apply">Apply</button>
            </div>
          </div>
        </div>
        <button class="gd-info-icon" type="button" aria-label="Date range information" title="${U.esc(d.infoText || "The default range starts when this group was first synchronized into Archive360.")}">${I.info}</button></div>`}
      </div>
      ${d.sentence ? `<p class="item-header-sentence">${d.sentence}</p>` : ""}
    </section>`;
  }

  /* The item header band: a detail page with no sub-pages and nothing that depends on a period (a queue item, a registration).
     The kind badge as the lists show it, the name, the status in words as a pill, and one or two plain sentences saying what the thing is.
     No date range, because a control that changes nothing on the page has no place on it. page.item: {badgeHtml, name, statusHtml, sentence};
     sentence is HTML the page has already escaped. */
  function itemHeaderHtml(page) {
    const d = page.item || {};
    return `<section class="item-header-band" aria-label="Item header">
      <div class="item-header">
        ${d.badgeHtml || ""}
        <h1 class="item-header-name">${U.esc(d.name || page.title)}</h1>
        ${d.statusHtml || ""}
      </div>
      ${d.sentence ? `<p class="item-header-sentence${d.badgeHtml ? "" : " item-header-sentence--flush"}">${d.sentence}</p>` : ""}
    </section>`;
  }

  /* Render a page into #app. page: {kind:'list'|'detail'|'item'|'start', navKey, title, description, icon, breadcrumb, viewOptions, detail, item, html, after} */
  SH.render = function (page) {
    /* The trail: the breadcrumb of the last page whose address differed, kept so that a page reached from it can lead back the same way
       (Groups > Contact Center > Members > Clara Achebe > Interactions). A page that re-renders itself does not push a new trail. */
    const path = AGC.router.current ? AGC.router.current.path : null;
    SH.trail = SH.trail || { path: null, crumbs: null, nav: null };
    if (SH.trail.path !== path) SH.previousTrail = SH.trail;
    SH.trail = { path, crumbs: page.breadcrumb ? page.breadcrumb.slice() : null, nav: page.navKey || null };
    const app = document.getElementById("app");
    const minimal = page.kind === "start" || page.kind === "guide";  // the guide opens in its own tab, with or without a profile (2026-10-22)
    let html = headerHtml(minimal);
    if (!minimal) {
      html += navHtml(page.navKey);
      if (page.kind === "detail") html += breadcrumbHtml(page) + detailHeaderHtml(page);
      else if (page.kind === "item") html += breadcrumbHtml(page) + itemHeaderHtml(page);
      else html += titleBandHtml(page);
    } else if (page.kind === "guide") html += titleBandHtml(page);
    html += `<main class="page-body${page.kind === "start" ? " page-body-start" : ""}" id="pageBody">${page.html}</main>`;
    html += `<div class="toast-container" id="toastContainer" aria-live="polite"></div>`;
    app.innerHTML = html;
    document.body.setAttribute("data-theme", AGC.state.theme);
    if (page.after) page.after(document.getElementById("pageBody"));
  };

  SH.toast = function (msg, kind) {
    const c = document.getElementById("toastContainer");
    if (!c) return;
    const el = document.createElement("div");
    el.className = "toast toast-" + (kind || "info");
    el.innerHTML = `<span class="toast-ic">${kind === "success" ? I.checkCircle : kind === "warn" ? I.alert : I.info}</span><span>${msg}</span>`;
    c.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 3600);
  };
  SH.closeMenus = function () {
    document.querySelectorAll(".hdr-menu, .gd-date-range-popover, .group-card-actions-menu, .menu-pop").forEach((m) => { m.hidden = true; m.classList.remove("open"); });
  };
  SH.toggleMenu = function (id) {
    const m = document.getElementById("menu-" + id);
    if (!m) return;
    const open = !m.hidden;
    SH.closeMenus();
    m.hidden = open;
    m.classList.toggle("open", !open);  // the v216 date range popover shows only with this class; closeMenus removes it (fixed 2026-09-25)
  };

  /* A button that is disabled with a reason when the persona lacks the permission. */
  SH.permButton = function (action, ctx, label, attrs, cls) {
    const perm = S.permission(action, ctx);
    const base = `btn ${cls || "btn-secondary"}`;
    if (perm.allowed) return `<button class="${base}" ${attrs || ""}>${label}</button>`;
    return `<span class="btn-disabled-wrap" tabindex="0" data-reason="${U.esc(perm.reason)}"><button class="${base} is-disabled" disabled aria-disabled="true" title="${U.esc(perm.reason)}">${label}</button><span class="btn-reason">${U.esc(perm.reason)}</span></span>`;
  };
})();
