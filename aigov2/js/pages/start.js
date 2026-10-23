/* Start page: choose a profile. Nothing is persisted; a refresh returns here by design. */
(function () {
  const U = AGC.util, S = AGC.store, D = AGC.data;
  AGC.pages = AGC.pages || {};
  const P = (AGC.pages.start = {});

  const FEATURE_LABELS = { register: "Register AI systems", review: "Review findings", escalate: "Escalate", approve: "Approve decisions", reconfirm: "Reconfirm", remediate: "Complete remediations", retire: "Retire systems", evidence: "Evidence packages", rules: "AI Policy Rules", mapping: "Group mapping", digests: "Notifications", unregistered: "Unregistered AI", settings: "Settings", audit: "Audit" };

  function card(p) {
    const m = S.member(p.memberId);
    const prof = S.byId.profile[p.profileId];
    const eps = p.entitlementPolicyIds.map((id) => S.byId.ep[id].name);
    const stats = m.isDemoAnchor ? `${(S.interactionsByMember[m.memberId] || []).length} interactions · ${(S.findingsByMember[m.memberId] || []).length} findings on own activity` : "";
    return `<button class="start-card${p.id === "admin" ? " start-card-admin" : ""}" data-action="choose-persona" data-persona="${p.id}">
      <div class="start-card-top">${U.avatar(m, "lg")}<div><div class="start-name">${U.esc(m.displayName)}</div><div class="start-role">${U.esc(p.roleTitle)}${p.groupId ? " · " + U.esc(S.groupName(p.groupId)) : ""}</div></div></div>
      <div class="start-blurb">${U.esc(p.blurb)}</div>
      <div class="start-meta"><span class="start-label">Profile</span><span>${U.esc(prof.name)}</span></div>
      <div class="start-meta"><span class="start-label">Content access</span><span>${eps.length ? U.esc(eps.join(", ")) : "None. Metadata only."}</span></div>
      <div class="chips">${prof.features.slice(0, 6).map((f) => `<span class="chip">${U.esc(FEATURE_LABELS[f] || f)}</span>`).join("")}${prof.features.length > 6 ? `<span class="chip chip-muted">+${prof.features.length - 6} more</span>` : ""}</div>
      ${stats ? `<div class="start-stats">${stats}</div>` : ""}
      <div class="start-cta">Continue as ${U.esc(m.firstName)} ${U.icon("arrowRight")}</div>
    </button>`;
  }

  P.show = function () {
    const personas = D.personas.slice().sort((a, b) => a.order - b.order);
    const co = D.meta.company;
    AGC.shell.render({
      kind: "start", title: "Choose a profile",
      html: `<div class="start-wrap">
        <div class="start-head">
          <div class="start-eyebrow">${U.esc(co.name)} · ${U.esc(co.headquarters)}</div>
          <h1>Choose a profile to continue</h1>
          <p>The AI Governance Center shows each person what their Profile and Entitlement Policies allow. Pick who you are presenting as. You can switch at any time from the avatar menu, and a page refresh returns here.</p>
          <p class="start-guide"><a href="${AGC.pages.guide ? AGC.pages.guide.href() : "#/guide"}" target="_blank" rel="noopener">${U.icon("help")} Read the user guide</a> <span class="muted">(opens in a new tab)</span></p>
        </div>
        <div class="start-grid">${personas.map(card).join("")}</div>
        <div class="start-foot">Prototype data as of ${U.esc(U.fmtDateLong(U.today()))}. Synthetic data for a fictional insurer; nothing is persisted.</div>
      </div>`,
      after(root) {
        root.querySelectorAll("[data-action='choose-persona']").forEach((b) => b.addEventListener("click", () => {
          S.setPersona(b.dataset.persona);
          const p = S.persona();
          AGC.router.navigate(p.landing);
          setTimeout(() => AGC.shell.toast(`Signed in as ${U.esc(p.member.displayName)} (${U.esc(p.profile.name)})`, "success"), 50);
        }));
      },
    });
  };
})();
