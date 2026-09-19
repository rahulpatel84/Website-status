// Defensive security probes — headers grader, SSL cert grader, content-hash.
// All three run in-process (no external browser, no external paid API).

import { createHash } from "node:crypto"
import * as tls from "node:tls"

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface SecurityProbeResult {
  ok: boolean
  score: number
  grade: "A+" | "A" | "B" | "C" | "D" | "F"
  issues: string[]
  details: Record<string, unknown>
  ms: number
}

export type Grade = SecurityProbeResult["grade"]

function toGrade(score: number): Grade {
  if (score >= 100) return "A+"
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  if (score >= 55) return "C"
  if (score >= 40) return "D"
  return "F"
}

// -----------------------------------------------------------
// Security headers (Mozilla Observatory-inspired rubric)
// -----------------------------------------------------------

interface HeaderCheck {
  key: string
  weight: number // signed; negative = penalty when missing
  ok: (v: string | null) => boolean
  issueIfMissing: string
  issueIfBad?: (v: string) => string | null
}

const HEADER_CHECKS: HeaderCheck[] = [
  {
    key: "strict-transport-security",
    weight: 20,
    ok: (v) => Boolean(v && /max-age\s*=\s*\d{7,}/i.test(v)),
    issueIfMissing: "Missing HSTS (Strict-Transport-Security) header",
    issueIfBad: (v) =>
      /max-age\s*=\s*(\d+)/i.test(v) && parseInt(v.match(/max-age\s*=\s*(\d+)/i)![1], 10) < 15768000
        ? "HSTS max-age is too short (< 6 months)"
        : null,
  },
  {
    key: "content-security-policy",
    weight: 25,
    ok: (v) => Boolean(v && !/unsafe-inline|unsafe-eval|\*/i.test(v)),
    issueIfMissing: "Missing Content-Security-Policy header",
    issueIfBad: (v) => (/unsafe-inline|unsafe-eval|\*/i.test(v) ? "CSP allows unsafe-inline/unsafe-eval or wildcards" : null),
  },
  {
    key: "x-content-type-options",
    weight: 5,
    ok: (v) => Boolean(v && /nosniff/i.test(v)),
    issueIfMissing: "Missing X-Content-Type-Options: nosniff",
  },
  {
    key: "x-frame-options",
    weight: 10,
    ok: (v) => Boolean(v && /(DENY|SAMEORIGIN)/i.test(v)),
    issueIfMissing: "Missing X-Frame-Options (clickjacking protection)",
  },
  {
    key: "referrer-policy",
    weight: 5,
    ok: (v) =>
      Boolean(
        v && /(no-referrer|strict-origin(-when-cross-origin)?|same-origin)/i.test(v),
      ),
    issueIfMissing: "Missing Referrer-Policy header",
  },
  {
    key: "permissions-policy",
    weight: 5,
    ok: (v) => Boolean(v && v.length > 0),
    issueIfMissing: "Missing Permissions-Policy header",
  },
  {
    key: "cross-origin-opener-policy",
    weight: 5,
    ok: (v) => Boolean(v && /same-origin/i.test(v)),
    issueIfMissing: "Missing Cross-Origin-Opener-Policy",
  },
  {
    key: "x-xss-protection",
    weight: 3,
    ok: (v) => v === null || v === "0",
    issueIfMissing: "",
    issueIfBad: (v) => (/1/.test(v) ? "X-XSS-Protection should be '0' (feature is deprecated and unsafe)" : null),
  },
]

export async function probeSecurityHeaders(url: string): Promise<SecurityProbeResult> {
  const started = performance.now()
  let res: Response
  try {
    res = await fetch(url, { method: "GET", redirect: "follow" })
  } catch (e: any) {
    return {
      ok: false,
      score: 0,
      grade: "F",
      issues: ["Could not reach URL: " + (e?.message || "unknown")],
      details: {},
      ms: Math.round(performance.now() - started),
    }
  }

  // Normalise header names to lowercase.
  const hdrs = new Map<string, string>()
  res.headers.forEach((v, k) => hdrs.set(k.toLowerCase(), v))

  let score = 100 // start at 100 like Observatory; deduct for missing/bad
  const issues: string[] = []
  const per: Record<string, { present: boolean; value: string | null; ok: boolean }> = {}

  for (const check of HEADER_CHECKS) {
    const v = hdrs.get(check.key) ?? null
    const ok = check.ok(v)
    per[check.key] = { present: v !== null, value: v, ok }
    if (v === null) {
      if (check.issueIfMissing) issues.push(check.issueIfMissing)
      score -= check.weight
    } else if (!ok) {
      const msg = check.issueIfBad?.(v)
      if (msg) issues.push(msg)
      score -= Math.round(check.weight * 0.5)
    }
  }

  // Extra credit — HTTPS-only redirect
  if (url.startsWith("http://")) {
    issues.push("URL is HTTP — should redirect to HTTPS")
    score -= 15
  }

  score = Math.max(0, Math.min(130, score))
  const grade = toGrade(score)
  return {
    ok: grade === "A+" || grade === "A" || grade === "B",
    score,
    grade,
    issues,
    details: { headers: per, http_status: res.status },
    ms: Math.round(performance.now() - started),
  }
}

// -----------------------------------------------------------
// SSL / TLS grade — native tls.connect, no external API
// -----------------------------------------------------------

interface CertSummary {
  subject: string
  issuer: string
  validTo: string
  validFrom: string
  daysUntilExpiry: number
  protocol: string | null
}

export function probeSslGrade(host: string, port = 443): Promise<SecurityProbeResult> {
  return new Promise((resolve) => {
    const started = performance.now()
    const sock = tls.connect(
      { host, port, servername: host, rejectUnauthorized: false, timeout: 8000 },
      () => {
        const authorized = sock.authorized
        const authErr = sock.authorizationError?.message
        const cert = sock.getPeerCertificate(false)
        const protocol = sock.getProtocol() // "TLSv1.3" | "TLSv1.2" | ...
        sock.end()

        if (!cert || Object.keys(cert).length === 0) {
          return resolve({
            ok: false,
            score: 0,
            grade: "F",
            issues: ["No certificate returned by peer"],
            details: {},
            ms: Math.round(performance.now() - started),
          })
        }

        const validTo = new Date(cert.valid_to)
        const validFrom = new Date(cert.valid_from)
        const daysUntilExpiry = Math.floor((validTo.getTime() - Date.now()) / 86400000)

        const issues: string[] = []
        let score = 100

        if (!authorized) {
          issues.push("Certificate chain not trusted: " + (authErr || "unknown"))
          score -= 40
        }
        if (protocol && !/TLSv1\.(2|3)/.test(protocol)) {
          issues.push(`Weak TLS protocol negotiated (${protocol})`)
          score -= 30
        }
        if (daysUntilExpiry < 0) {
          issues.push("Certificate is EXPIRED")
          score -= 60
        } else if (daysUntilExpiry < 14) {
          issues.push(`Certificate expires in ${daysUntilExpiry} days`)
          score -= 20
        } else if (daysUntilExpiry < 30) {
          issues.push(`Certificate expires in ${daysUntilExpiry} days`)
          score -= 5
        }

        if (protocol === "TLSv1.3" && authorized && daysUntilExpiry >= 30) {
          score = Math.min(130, score + 5) // A+ bump
        }

        const grade = toGrade(score)
        const summary: CertSummary = {
          subject: (cert.subject as any)?.CN ?? "",
          issuer: (cert.issuer as any)?.CN ?? "",
          validTo: cert.valid_to,
          validFrom: cert.valid_from,
          daysUntilExpiry,
          protocol,
        }
        resolve({
          ok: grade === "A+" || grade === "A" || grade === "B",
          score,
          grade,
          issues,
          details: { cert: summary },
          ms: Math.round(performance.now() - started),
        })
      },
    )
    sock.on("error", (err) => {
      resolve({
        ok: false,
        score: 0,
        grade: "F",
        issues: ["TLS connection failed: " + err.message],
        details: {},
        ms: Math.round(performance.now() - started),
      })
    })
    sock.on("timeout", () => {
      sock.destroy()
      resolve({
        ok: false,
        score: 0,
        grade: "F",
        issues: ["TLS connection timed out"],
        details: {},
        ms: Math.round(performance.now() - started),
      })
    })
  })
}

// -----------------------------------------------------------
// Content hash (defacement detection)
// -----------------------------------------------------------

export interface ContentHashResult {
  ok: boolean
  hash: string
  changed: boolean
  previous_hash: string | null
  ms: number
  http_status?: number
  error?: string
}

/** Strip volatile fragments so we don't false-alarm on timestamps / csrf tokens. */
function normaliseHtml(html: string, extraStripPatterns: RegExp[] = []): string {
  let s = html
  // Strip common volatile bits
  s = s.replace(/<meta\s+name=["']csrf-token["'][^>]*>/gi, "")
  s = s.replace(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>[\s\S]*?<\/script>/gi, "")
  s = s.replace(/data-cf-beacon=["'][^"']*["']/gi, "")
  s = s.replace(/\bnonce=["'][^"']+["']/gi, "")
  s = s.replace(
    /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g,
    "TIMESTAMP",
  )
  for (const rx of extraStripPatterns) s = s.replace(rx, "")
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim()
  return s
}

export async function probeContentHash(
  url: string,
  previousHash: string | null,
  extraStripPatterns: string[] = [],
): Promise<ContentHashResult> {
  const started = performance.now()
  try {
    const res = await fetch(url, { redirect: "follow" })
    const html = await res.text()
    const patterns = extraStripPatterns.map((p) => {
      try {
        return new RegExp(p, "gi")
      } catch {
        return null
      }
    }).filter(Boolean) as RegExp[]
    const normalised = normaliseHtml(html, patterns)
    const hash = createHash("sha256").update(normalised).digest("hex")
    return {
      ok: res.ok,
      hash,
      changed: previousHash != null && previousHash !== hash,
      previous_hash: previousHash,
      ms: Math.round(performance.now() - started),
      http_status: res.status,
    }
  } catch (e: any) {
    return {
      ok: false,
      hash: "",
      changed: false,
      previous_hash: previousHash,
      ms: Math.round(performance.now() - started),
      error: e?.message ?? "fetch failed",
    }
  }
}
