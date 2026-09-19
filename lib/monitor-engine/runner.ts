// Monitor engine — runs a single monitor, records probe result, opens/resolves
// incidents on state change.
import { randomUUID } from "node:crypto"
import { getDatabase } from "@/lib/database"
import {
  runHttpWaterfall,
  runTcpWaterfall,
  runSslWaterfall,
  type WaterfallResult,
} from "./waterfall"
import {
  probeSecurityHeaders,
  probeSslGrade,
  probeContentHash,
} from "./security"
import { probeForm, type FormProbeConfig } from "./browser-probe"

function safeParseConfig(s: string | null | undefined): any {
  if (!s) return {}
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

function httpStepOk(r: { layer_failed: string | null }): boolean {
  return r.layer_failed !== "http_head" && r.layer_failed !== "runtime"
}

interface MonitorRow {
  id: string
  workspace_id: string
  name: string
  type: string
  target: string
  method: string
  interval_s: number
  is_paused: number
  current_status: string
}

interface AssertionRow {
  id: string
  kind: string
  op: string
  value: string
}

function parseHostPort(target: string, defaultPort?: number): [string, number] {
  const [host, p] = target.split(":")
  return [host, p ? parseInt(p, 10) : (defaultPort ?? 80)]
}

export async function runMonitor(monitorId: string): Promise<{
  status: "up" | "down" | "degraded"
  response_ms: number | null
  http_status: number | null
  layer_failed: string | null
  error: string | null
}> {
  const db = getDatabase()
  const m = db.prepare("SELECT * FROM monitors WHERE id = ?").get(monitorId) as
    | MonitorRow
    | undefined
  if (!m) throw new Error("Monitor not found")

  const assertions = db
    .prepare("SELECT * FROM assertions WHERE monitor_id = ?")
    .all(monitorId) as AssertionRow[]

  let result: WaterfallResult

  try {
    switch (m.type) {
      case "url":
      case "api":
        result = await runHttpWaterfall(m.target, {
          method: m.method,
          assertions: assertions.map((a) => ({
            kind: a.kind as any,
            op: a.op as any,
            value: a.value,
          })),
        })
        break
      case "form": {
        const cfg = safeParseConfig((m as any).config)
        const formCfg: FormProbeConfig = {
          url: m.target,
          wait_for_selector: cfg.wait_for_selector,
          fill: cfg.fill,
          submit_selector: cfg.submit_selector,
          expect_selector_after: cfg.expect_selector_after,
          expect_url_regex_after: cfg.expect_url_regex_after,
          timeout_ms: cfg.timeout_ms ?? 25000,
        }
        const r = await probeForm(m.id, formCfg)
        result = {
          ok: r.ok,
          layerFailed: r.ok ? undefined : (r.layer_failed as any),
          layers: {
            http_head: { ok: httpStepOk(r), ms: r.ms, detail: `HTTP ${r.http_status ?? "?"}` },
            body_assertion: {
              ok: r.ok,
              ms: r.ms,
              detail: r.detail + (r.step_failed ? ` (step: ${r.step_failed})` : ""),
            },
          } as any,
          totalMs: r.ms,
          _browser: r,
        } as any
        break
      }
      case "port": {
        const [host, port] = parseHostPort(m.target)
        result = await runTcpWaterfall(host, port)
        break
      }
      case "ssl":
      case "dns":
        result = await runSslWaterfall(m.target.replace(/^https?:\/\//, "").split("/")[0])
        break
      case "heartbeat": {
        // For heartbeat monitors we don't probe. Presence of a recent heartbeat
        // check-in is what makes them "up".
        const last = db
          .prepare(
            "SELECT received_at FROM heartbeat_checkins WHERE monitor_id = ? ORDER BY received_at DESC LIMIT 1",
          )
          .get(monitorId) as { received_at: string } | undefined
        const stale = !last || Date.now() - new Date(last.received_at + "Z").getTime() > (m.interval_s + 60) * 1000
        result = {
          ok: !stale,
          layerFailed: stale ? ("runtime" as const) : undefined,
          layers: {} as any,
          totalMs: 0,
        }
        break
      }
      case "security-headers": {
        const r = await probeSecurityHeaders(m.target)
        result = {
          ok: r.ok,
          layerFailed: r.ok ? undefined : "http_head",
          layers: { http_head: { ok: r.ok, ms: r.ms, detail: `Grade ${r.grade} · score ${r.score}${r.issues.length ? " · " + r.issues[0] : ""}` } } as any,
          totalMs: r.ms,
          _security: r,
        } as any
        break
      }
      case "ssl-grade": {
        const host = m.target.replace(/^https?:\/\//, "").split("/")[0].split(":")[0]
        const port = m.target.includes(":") && !m.target.includes("://") ? parseInt(m.target.split(":")[1], 10) : 443
        const r = await probeSslGrade(host, port)
        result = {
          ok: r.ok,
          layerFailed: r.ok ? undefined : "tls",
          layers: { tls: { ok: r.ok, ms: r.ms, detail: `Grade ${r.grade} · score ${r.score}${r.issues.length ? " · " + r.issues[0] : ""}` } } as any,
          totalMs: r.ms,
          _security: r,
        } as any
        break
      }
      case "content-hash": {
        const last = db
          .prepare(
            "SELECT details FROM probes WHERE monitor_id = ? AND details IS NOT NULL ORDER BY ran_at DESC LIMIT 1",
          )
          .get(monitorId) as { details: string } | undefined
        let prevHash: string | null = null
        try {
          if (last) prevHash = JSON.parse(last.details)?.hash ?? null
        } catch {}
        const config = safeParseConfig((m as any).config)
        const r = await probeContentHash(m.target, prevHash, config.strip_patterns ?? [])
        result = {
          ok: r.ok && !r.changed,
          layerFailed: !r.ok
            ? "http_head"
            : r.changed
              ? "body_assertion"
              : undefined,
          layers: {
            http_head: {
              ok: r.ok,
              ms: r.ms,
              detail: r.changed ? "Content changed since last check" : "Unchanged",
            },
          } as any,
          totalMs: r.ms,
          _security: {
            score: r.changed ? 0 : 100,
            grade: r.changed ? "D" : "A",
            issues: r.changed ? ["Content hash changed"] : [],
            details: { hash: r.hash, previous_hash: r.previous_hash, http_status: r.http_status },
            ms: r.ms,
            ok: !r.changed,
          },
        } as any
        break
      }
      default:
        result = {
          ok: false,
          layerFailed: "runtime" as const,
          layers: {} as any,
          totalMs: 0,
        }
    }
  } catch (err) {
    result = {
      ok: false,
      layerFailed: "runtime" as const,
      layers: {} as any,
      totalMs: 0,
    }
  }

  const status: "up" | "down" | "degraded" = result.ok ? "up" : "down"
  const response_ms = result.totalMs || null
  const http_status =
    (result.layers as any)?.http?.status ?? (result.layers as any)?.http_head?.status ?? null
  const layer_failed = result.layerFailed ?? null
  const error =
    (result.layers as any)?.[result.layerFailed ?? ""]?.detail ??
    (!result.ok ? "check failed" : null)

  // Fold the security sidecar (if any) into the details JSON so the UI can render
  // grade / score / issues + hash for content-hash monitors.
  const detailsPayload: Record<string, unknown> = {
    layers: result.layers,
  }
  if ((result as any)._security) {
    detailsPayload.security = (result as any)._security
    if ((result as any)._security?.details?.hash) {
      detailsPayload.hash = (result as any)._security.details.hash
    }
  }
  if ((result as any)._browser) {
    const b = (result as any)._browser
    detailsPayload.browser = {
      screenshot_path: b.screenshot_path,
      console_errors: b.console_errors,
      final_url: b.final_url,
      step_failed: b.step_failed,
      detail: b.detail,
    }
  }

  db.prepare(
    `INSERT INTO probes (monitor_id, region, status, response_ms, http_status, layer_failed, error, details)
     VALUES (?, 'local', ?, ?, ?, ?, ?, ?)`,
  ).run(
    monitorId,
    status,
    response_ms,
    http_status,
    layer_failed,
    error,
    JSON.stringify(detailsPayload),
  )

  db.prepare(
    "UPDATE monitors SET current_status = ?, last_check_at = CURRENT_TIMESTAMP, last_response_ms = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(status, response_ms, monitorId)

  // State transitions → incidents
  if (status === "up" && m.current_status !== "up") {
    db.prepare(
      "UPDATE incidents SET resolved_at = CURRENT_TIMESTAMP WHERE monitor_id = ? AND resolved_at IS NULL",
    ).run(monitorId)
  }
  if (status === "down" && m.current_status !== "down") {
    db.prepare(
      `INSERT INTO incidents (id, monitor_id, workspace_id, severity, layer_isolated, cause)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      "inc_" + randomUUID().slice(0, 12),
      monitorId,
      m.workspace_id,
      m.type === "ssl" ? "minor" : "major",
      layer_failed,
      error,
    )
    try {
      const dispatch = await import("@/lib/notifications/dispatch")
      if (typeof (dispatch as any).dispatchIncidentByMonitor === "function") {
        await (dispatch as any).dispatchIncidentByMonitor(monitorId)
      }
    } catch {
      /* dispatch module not present — skip */
    }
  } else if (status === "down" && m.current_status === "down") {
    // Still down. Renotify if enough time has passed since the last alert —
    // covers the case where channels were added AFTER the incident opened,
    // or where the on-call rotation needs periodic re-pings.
    try {
      const dispatch = await import("@/lib/notifications/dispatch")
      if (typeof (dispatch as any).renotifyOngoingIfDue === "function") {
        await (dispatch as any).renotifyOngoingIfDue(monitorId)
      }
    } catch {
      /* dispatch module not present — skip */
    }
  }

  return { status, response_ms, http_status, layer_failed, error }
}
