/* User guide (Gabriel, 2026-10-22): one continuous page, built from prototype/guide/user-guide.md by tools/build_guide.py into
   guide-content.js, and opened in a new browser tab from the header's help icon or from a page's own Guide link, which lands on the
   section about that page. It renders without a profile and describes every feature for every reader; nothing in it is hidden by
   permission. A contents list with anchors sits at the top, every section ends with a way back to it, and a floating Contents button
   appears once the list has scrolled away. One scrollbar, as everywhere. */
(function () {
  const U = AGC.util, I = AGC.icons;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.guide = {});
  const content = () => AGC.guideContent || { title: "User guide", description: "", intro: "", sections: [] };

  /* The address of the guide, or of one of its sections, from any page of the prototype (same folder, same query string). */
  P.href = (section) => location.pathname + location.search + "#/guide" + (section ? "/" + section : "");

  /* The section that describes the page the reader is on, from the router's match: the page's Guide link lands there. */
  P.sectionFor = function (match) {
    if (!match || !match.route) return null;
    const p = match.params || {};
    switch (match.route.pattern) {
      case "/overview": return "overview";
      case "/groups": return "groups";
      case "/groups/:id/:facet?": return { registry: "group-ai-assets", members: "group-members", interactions: "group-interactions", findings: "group-findings", audit: "group-audit-history" }[p.facet] || "group-page";
      case "/people": return "people";
      case "/members/:id": return "person-page";
      case "/members/:id/interactions": return "person-interactions";
      case "/findings/:view?/:id?": return p.id ? "reviewing-a-finding" : "findings";
      case "/approvals/:view?/:id?": return "approvals";
      case "/unregistered": return "unregistered-ai";
      case "/unregistered/:id": return "unregistered-item";
      case "/registry": return "registered";
      case "/registry/assets": return "all-ai-assets";
      case "/registry/:id": return "registration-page";
      case "/systems/:id": return "ai-asset-page";
      case "/systems/:id/interactions": return "ai-asset-interactions";
      case "/rules": return "rules-list";
      case "/rules/matrix": return "permitted-data";
      case "/rules/:id": return "rule-page";
      case "/audit": return "audit-history";
      case "/settings/:page?": return { instances: "ai-systems", groups: "business-groups", mapping: "business-group-mapping", notifications: "notifications", access: "readiness-check" }[p.page] || "settings";
      case "/evidence/:id?": return "evidence-packages";
      default: return null;
    }
  };

  function tocHtml(g) {
    return `<nav class="guide-toc" id="guideToc" aria-label="Contents"><div class="guide-toc-title">Contents</div><ol class="guide-toc-list">${g.sections.map((s) => `<li><a href="${P.href(s.id)}" data-guide-jump="${s.id}">${s.title}</a>${s.subs.length ? `<ul>${s.subs.map((x) => `<li><a href="${P.href(x.id)}" data-guide-jump="${x.id}">${x.title}</a></li>`).join("")}</ul>` : ""}</li>`).join("")}</ol></nav>`;
  }
  const back = `<a class="guide-top" href="${P.href()}" data-guide-top>${I.arrowUp} Back to contents</a>`;

  P.render = function (section) {
    const g = content();
    const html = `<div class="guide-wrap">
      ${g.intro ? `<div class="guide-intro">${g.intro}</div>` : ""}
      ${tocHtml(g)}
      ${g.sections.map((s) => `<section class="guide-section" id="${s.id}"><h2>${s.title}</h2>${s.html}${back}</section>`).join("")}
    </div>
    <button type="button" class="guide-float" id="guideFloat" hidden data-guide-top>${I.arrowUp} Contents</button>`;
    AGC.shell.render({ kind: "guide", title: g.title, description: g.description, icon: "help", html, after: (root) => bind(root, section) });
  };

  /* Jumps are in-page: the address is updated without re-rendering, so a link to a section can be copied, and the back button still
     leaves the guide rather than stepping through every jump. */
  function jump(id) {
    const el = id ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ block: "start" }); else window.scrollTo(0, 0);
    history.replaceState(null, "", P.href(id));
    if (onScroll) onScroll();  // the Contents button follows the new position at once
  }
  let onScroll = null;
  function bind(root, section) {
    root.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-guide-jump], [data-guide-top]");
      if (!t) return;
      ev.preventDefault();
      jump(t.dataset.guideTop !== undefined ? null : t.dataset.guideJump);
    });
    if (onScroll) window.removeEventListener("scroll", onScroll);
    onScroll = () => {
      const float = document.getElementById("guideFloat"), toc = document.getElementById("guideToc");
      if (!float || !toc) { window.removeEventListener("scroll", onScroll); onScroll = null; return; }
      float.hidden = window.scrollY < toc.offsetTop + toc.offsetHeight;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    if (section) { setTimeout(() => jump(section), 0); setTimeout(() => jump(section), 350); }  // after the router's own scroll to the top, and again once fonts and layout have settled
  }
})();
