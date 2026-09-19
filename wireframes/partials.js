// Injects shared navbar + footer into wireframe pages
const NAV = `
<header class="nav">
  <div class="container nav-inner">
    <a href="index.html" class="nav-brand">status<span class="dot">.</span>watch</a>
    <nav class="nav-links">
      <a href="services.html">Services</a>
      <a href="how-it-works.html">How it works</a>
      <a href="about.html">About</a>
      <a href="api.html">API</a>
      <a href="blog.html">Blog</a>
    </nav>
    <div class="nav-icons">
      <a href="https://x.com" title="X / Twitter" aria-label="X">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
      <a href="#" title="Theme toggle" aria-label="Theme">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 0 9 9c-2.5 1.5-6-.5-6-4.5C15 5 13.5 3 12 3z"/></svg>
      </a>
      <a class="nav-cta" href="company.html">Report an outage</a>
    </div>
  </div>
</header>
`;

const FOOTER = `
<footer class="footer">
  <div class="container">
    <div class="footer-cols">
      <div>
        <div class="nav-brand">status<span class="dot">.</span>watch</div>
        <p class="small muted" style="margin-top:8px;max-width:280px">
          Real-time outage reports and status monitoring for the internet's most-used services.
        </p>
        <div class="row" style="margin-top:12px">
          <a href="https://x.com" aria-label="X"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
          <a href="https://github.com" aria-label="GitHub"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.72-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.8 1.19 1.83 1.19 3.09 0 4.43-2.69 5.4-5.25 5.69.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.67.8.56A11.52 11.52 0 0 0 23.5 12.02C23.5 5.74 18.27.5 12 .5z"/></svg></a>
          <a href="rss.xml" aria-label="RSS"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36zM4 4.44v3.19c7.13 0 12.91 5.78 12.91 12.91h3.19c0-8.89-7.21-16.1-16.1-16.1zm0 6.35v3.18c3.6 0 6.53 2.92 6.53 6.52h3.19c0-5.36-4.35-9.7-9.72-9.7z"/></svg></a>
        </div>
      </div>
      <div>
        <h4>Product</h4>
        <ul>
          <li><a href="services.html">All services</a></li>
          <li><a href="company.html">Report an outage</a></li>
          <li><a href="api.html">Public API</a></li>
          <li><a href="#">Subscribe</a></li>
        </ul>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="about.html">About</a></li>
          <li><a href="how-it-works.html">How it works</a></li>
          <li><a href="blog.html">Blog</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Resources</h4>
        <ul>
          <li><a href="faq.html">FAQ</a></li>
          <li><a href="incident.html">Sample incident</a></li>
          <li><a href="#">Status widget</a></li>
          <li><a href="#">Changelog</a></li>
        </ul>
      </div>
      <div>
        <h4>Legal</h4>
        <ul>
          <li><a href="#">Privacy</a></li>
          <li><a href="#">Terms</a></li>
          <li><a href="#">Cookies</a></li>
          <li><a href="#">DMCA</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>© 2026 status.watch — Data crowd-sourced from users worldwide.</div>
      <div>Not affiliated with any of the services listed.</div>
    </div>
  </div>
</footer>
`;

document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector("[data-nav]");
  if (nav) nav.outerHTML = NAV;
  const foot = document.querySelector("[data-footer]");
  if (foot) foot.outerHTML = FOOTER;
});
