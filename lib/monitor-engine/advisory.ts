// Health advisory: extra passive checks that we run *server-side* on the
// monitor detail page and surface as a warning banner. Not run per-probe —
// just when someone opens the monitor page (cached ~60s).

import { performance } from "node:perf_hooks"

export interface Advisory {
  severity: "info" | "warn" | "critical"
  title: string
  detail: string
}

const cache = new Map<string, { at: number; advisories: Advisory[] }>()
const TTL_MS = 60_000

export async function computeAdvisories(target: string, type: string): Promise<Advisory[]> {
  const cacheKey = `${type}::${target}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < TTL_MS) return cached.advisories

  const out: Advisory[] = []
  if (type === "url" || type === "api" || type === "form") {
    let url: URL
    try {
      url = new URL(target)
    } catch {
      return []
    }

    // 1) If it's HTTP, check whether HTTPS is reachable at all.
    if (url.protocol === "http:") {
      const httpsUrl = new URL(target)
      httpsUrl.protocol = "https:"
      httpsUrl.port = "" // reset
      const ok = await quickReachable(httpsUrl.toString())
      if (!ok) {
        out.push({
          severity: "warn",
          title: "Target is HTTP-only — modern browsers block plain HTTP",
          detail:
            `Your monitor is watching ${target}. HTTP responds fine, but ${httpsUrl.toString()} ` +
            "is unreachable (no TLS listener or bad certificate). Chrome/Firefox HTTPS-first policies " +
            "will show your visitors 'This site doesn't support a secure connection' even though the site " +
            "is technically UP. Consider adding TLS (Let's Encrypt) or switching the monitor target to https:// so " +
            "any HTTPS breakage triggers an alert.",
        })
      } else {
        out.push({
          severity: "info",
          title: "Consider monitoring HTTPS instead",
          detail:
            "HTTPS is reachable on this domain. Point the monitor at the https:// URL so cert-expiry or TLS " +
            "issues also trigger alerts.",
        })
      }
    }

    // 2) If HTTPS, check bare-domain redirect etiquette (optional; skip for now).
  }

  if (type === "url" || type === "api") {
    // 3) Suggest adding an ssl-grade monitor when the target is HTTPS.
    try {
      const u = new URL(target)
      if (u.protocol === "https:") {
        out.push({
          severity: "info",
          title: "Add an SSL grade monitor",
          detail:
            `Create an ssl-grade monitor for ${u.hostname} to get a live A→F score, days-until-expiry, ` +
            "protocol version, and cipher-suite warnings.",
        })
      }
    } catch {}
  }

  cache.set(cacheKey, { at: Date.now(), advisories: out })
  return out
}

/** Small parallel-friendly probe. Returns true when the URL responded within 5s. */
async function quickReachable(url: string): Promise<boolean> {
  const t0 = performance.now()
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 5000)
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: ac.signal,
    })
    clearTimeout(timer)
    // Any HTTP response (including 3xx) means the transport worked.
    return res.status > 0
  } catch {
    return false
  } finally {
    void performance.now() - t0
  }
}
