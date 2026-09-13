// Authenticated-app shell: top bar + sidebar. Used across all logged-in wireframes.

const APP_TOPBAR = `
<header class="nav">
  <div style="max-width:none; padding:0 20px" class="nav-inner">
    <a href="dashboard.html" class="nav-brand">status<span class="dot">.</span>watch</a>
    <div class="row" style="gap:10px">
      <span class="kbar">⌘K  Search monitors</span>
    </div>
    <div class="nav-icons">
      <a href="notifications.html" title="Notifications" aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      </a>
      <a href="settings.html" title="Settings" aria-label="Settings">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.15.36.24.75.24 1.15V10a2 2 0 0 1 0 4h-.09c-.4 0-.79.09-1.15.24z"/></svg>
      </a>
      <div class="avatar" style="width:28px;height:28px;font-size:11px">RP</div>
    </div>
  </div>
</header>
`;

function makeSidebar(active) {
  const items = [
    ["dashboard.html", "Dashboard", "▦", "dashboard"],
    ["monitor-new.html", "Monitors", "◉", "monitors"],
    ["incidents.html", "Incidents", "▲", "incidents"],
    ["status-page-config.html", "Status pages", "◐", "status"],
    ["notifications.html", "Notifications", "◔", "notifications"],
    ["agent-install.html", "SDK / Agent", "▤", "agent"],
    ["settings.html", "Settings", "◇", "settings"],
  ];
  const links = items.map(([href, label, icon, key]) => `
    <a class="side-link ${active === key ? "active" : ""}" href="${href}">
      <span aria-hidden="true" style="width:14px;text-align:center">${icon}</span> ${label}
    </a>`).join("");
  return `
    <aside class="sidebar">
      <div style="padding:0 6px 10px">
        <div class="tiny muted">WORKSPACE</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <div class="svc-logo" style="width:24px;height:24px;font-size:10px;background:var(--accent-50);color:var(--accent-700);border-color:var(--accent-100)">RP</div>
          <div style="font-weight:600;font-size:13px">Rahul's projects</div>
        </div>
      </div>
      ${links}
      <h5>PLAN</h5>
      <div style="padding:6px 10px 4px" class="tiny muted">
        Free · 3 / 5 monitors used
      </div>
      <a class="side-link" style="color:var(--accent-700);font-weight:600" href="pricing.html">↗ Upgrade to Pro</a>
    </aside>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const top = document.querySelector("[data-app-top]");
  if (top) top.outerHTML = APP_TOPBAR;
  const side = document.querySelector("[data-app-sidebar]");
  if (side) side.outerHTML = makeSidebar(side.getAttribute("data-active"));
});
