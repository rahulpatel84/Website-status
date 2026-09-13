# status.watch — Enterprise Readiness Roadmap

> Target: convert status.watch from a credible mid-market uptime + status-page tool into an enterprise-buyable observability + incident platform.
> Sources cited inline: Datadog docs, PagerDuty docs, incident.io engineering blog, Grafana Cloud docs, Atlassian Statuspage docs, Dynatrace product pages, BetterStack pricing, AICPA Trust Services Criteria (SOC 2), Gartner MQ Observability 2025 summary.

---

## A. Category-by-category comparison

### 1. Incident management (declare / roles / comms / retro)
| Vendor | Depth |
|---|---|
| **PagerDuty** | Incident Objects, roles (Commander, Scribe, Liaison), Slack/Teams war rooms, Status Updates, Post-mortems (auto-timeline from events + Slack). |
| **incident.io** | Slack-first declare (`/inc`), auto-generated channel, roles, custom fields, follow-ups, retros in-app, workflows engine. |
| **FireHydrant** | Runbooks (steps + automations), retro templates, Jira/ServiceNow ticket sync, severity matrix. |
| **Rootly / Squadcast** | Similar Slack-first flow; Rootly leans on Terraform-managed runbooks. |
| **Datadog Incident Mgmt** | Declare from alert, timeline auto-populated from APM/log events, notebooks for retros. |
| **BetterStack** | Basic declare + status page sync; no chatops runbook engine. |
| **Grafana IRM (OnCall + Incident)** | Recently merged; Slack-first, workflows, retro doc export. |

**Minimum bar for enterprise credibility:** declare from alert or Slack, incident channel auto-provisioned, roles (IC/comms/scribe), auto-timeline, status-page sync, retro doc with follow-up action items tracked to closure.

### 2. On-call scheduling & escalation
- **PagerDuty**: layered rotations, overrides, holiday calendars, escalation policies with time-outs, push/SMS/voice with retries, "high-urgency" vs "low-urgency" routing.
- **Splunk On-Call (VictorOps)**: rotations + escalation, weaker mobile UX vs PD.
- **incident.io On-call**: rotations, overrides, escalation, native mobile app (2024 GA).
- **Grafana OnCall**: OSS, rotations + escalation, Terraform-first.
- **Squadcast**: rotations + escalation + Slack routing, aggressive pricing.
- **BetterStack**: rotations + SMS/voice, thinner overrides model.

**Minimum bar:** layered rotations, overrides, holiday coverage, escalation policies with per-step time-out, push + SMS + voice with retries, mobile app with reliable wake.

### 3. SLOs / SLIs / error budgets
- **Datadog SLOs**: metric-based + monitor-based, rolling & calendar windows, burn-rate alerts, weekly reports.
- **Dynatrace**: SLO with Davis-driven burn analysis.
- **New Relic**: SLI/SLO w/ error budget, drill-down to entities.
- **Grafana SLO** (Sloth-style): declarative YAML, budget-burn multi-window alerts.
- **BetterStack / incident.io / PagerDuty**: light or none.

**Minimum bar:** availability + latency SLO, rolling 7/28/90-day windows, multi-window burn-rate alerts (per Google SRE book), weekly digest.

### 4. RBAC / SSO / SCIM / audit log
- **Datadog, Dynatrace, New Relic, Grafana Cloud, PagerDuty**: SAML SSO (Okta, Azure AD, Google, Ping, OneLogin, JumpCloud), SCIM 2.0, granular RBAC (custom roles, resource-scoped), immutable audit log with export.
- **incident.io / FireHydrant / Rootly**: SSO + SCIM at Enterprise tier, role packs.
- **BetterStack**: SSO, basic RBAC; SCIM only on top tier.

**Minimum bar:** SAML 2.0 with Okta + Azure AD + Google, SCIM 2.0 provisioning, at least 4 built-in roles + resource-scoped custom roles, immutable audit log with 1-year retention and API export.

### 5. Private / VPC probes
- **Datadog Private Locations**: Docker/K8s worker inside customer VPC.
- **Dynatrace ActiveGate**: on-prem gateway.
- **New Relic Private Minion (Containerized/Kubernetes)**: same pattern.
- **Grafana Synthetic Monitoring Private Probes**: agent + tunneling.
- **BetterStack**: no first-class private probes yet.
- **StatusCake / Uptime.com / Checkly**: private locations via agent.

**Minimum bar:** signed container image the customer runs in their VPC/K8s, mTLS back to control plane, no inbound firewall rules required (agent dials out).

### 6. APM / distributed tracing
- **Datadog / Dynatrace / New Relic**: full APM, code-level tracing, OTel ingest.
- **Grafana Cloud**: Tempo (traces) + Pyroscope (profiling), OTel-native.
- **PagerDuty / incident.io / BetterStack**: none.

**Reality for uptime buyers:** they typically already have APM (Datadog/NR/Dynatrace) or want OSS OTel. They don't want a second APM bill. **OTel receiver + trace-to-incident correlation** is enough; full APM is not required.

### 7. Log aggregation
Same shape as APM. Enterprise uptime buyers rarely want us to become their log store. **OTel logs ingest + log-line linking on incident timeline** is the credible middle path; do not try to compete with Datadog Logs / Grafana Loki / Splunk head-on.

### 8. Alert routing & noise reduction
- **PagerDuty Event Intelligence**: dedup, grouping (ML), auto-pause flapping, business-impact scoring.
- **Datadog**: composite monitors, alert grouping, downtimes, notification rules by tag.
- **incident.io / FireHydrant**: alert routes, dedup keys, "alert sources" fan-in.
- **BetterStack**: dedup + grouping, weaker ML.

**Minimum bar:** tag-based routing, dedup by fingerprint, grouping window, maintenance windows / silences, weekly noise report.

### 9. Third-party integrations
- **PagerDuty**: 700+ documented integrations.
- **Datadog**: 850+ integrations.
- **incident.io**: ~60 catalog integrations + Zapier + webhook.
- **BetterStack**: ~40.

**Table-stakes for us:** Slack, MS Teams, PagerDuty (as forwarder), Opsgenie, Jira, ServiceNow, GitHub/GitLab, Zendesk, HubSpot, Datadog, Grafana, Prometheus Alertmanager, Sentry, Cloudflare, AWS SNS, GCP Pub/Sub, Twilio, generic webhook, email, Discord. Realistic bar: **~30 first-party + webhook + Zapier/Make**.

### 10. Compliance
| Cert | When enterprise asks |
|---|---|
| SOC 2 Type II | Any deal > $25k ACV, US mid-market and up (AICPA TSC 2017). |
| ISO 27001 | Global enterprise, especially EU/APAC. |
| HIPAA BAA | Healthcare buyers (rare for uptime, common for status pages of health apps). |
| GDPR DPA + SCCs | Any EU customer. Table stakes. |
| FedRAMP Moderate | US public sector; multi-year effort, defer. |
| PCI DSS | Only if you store cardholder data (you don't). |

**Minimum bar for enterprise:** SOC 2 Type II + GDPR DPA + ISO 27001 on roadmap. HIPAA on request. FedRAMP is Tier 3.

### 11. Data residency & retention
- **Datadog**: US, EU, US3, US5, AP1, Gov regions.
- **Dynatrace / NR**: US + EU.
- **Grafana Cloud**: US, EU, AU.
- **BetterStack**: EU + US.
- **incident.io**: EU + US.

**Minimum bar:** at least one EU region (Frankfurt) and one US region, region pinned at workspace creation, configurable retention (30/90/365 days) per data class, data-export API, documented right-to-deletion flow.

### 12. Public / private status pages
- **Statuspage.io**: category leader — custom domains, private (auth) pages, i18n, per-component subscribe, embedded widgets, metrics on page, SSO for private pages.
- **BetterStack**: strong — custom domains, private pages, TLS auto-renew, subscribe by service.
- **Instatus**: fast, cheap, i18n.
- **status.watch (today)**: per-service branded pages — need to close gap on private/auth pages, custom domains + TLS, i18n, subscribe-by-service, embed widget.

**Minimum bar:** custom domain + auto-TLS, private (SSO or password) status pages, subscribe per component (email/SMS/Slack/webhook/RSS), i18n (5+ langs), multi-page per org, embeddable widget.

### 13. API + Terraform provider
- **PagerDuty, Datadog, Grafana, incident.io, FireHydrant, Rootly**: first-class Terraform providers.
- **BetterStack**: Terraform provider covers monitors + status pages + on-call.

**Minimum bar:** documented REST API with OpenAPI spec, official Terraform provider covering monitors, status pages, escalation policies, SLOs, integrations. Nice-to-have: Pulumi + CDK.

### 14. Cost model
- **Datadog**: per-host + per-custom-metric + per-log-GB — infamous surprise bills; Gartner MQ 2025 flags this repeatedly.
- **New Relic**: per-user + per-GB ingested (2020 pivot); cleaner but per-user bites large orgs.
- **Dynatrace**: DDU (Davis Data Units) — opaque.
- **PagerDuty**: per-user per-month; simple but expensive at scale.
- **BetterStack**: per-monitor + per-seat.
- **incident.io**: per-responder-seat.

**Winning models for us:** per-monitor + per-responder-seat (predictable) with an events/synthetics overage meter. Avoid per-host. Publish a calculator.

### 15. Vendor procurement
Enterprise procurement gates: MSA (or accept customer paper), DPA with SCCs, subprocessor list published, SOC 2 + ISO reports under NDA, annual pen-test summary, SBOM (CycloneDX or SPDX), vulnerability disclosure policy, uptime SLA (99.9% minimum, 99.99% for Enterprise tier), incident-disclosure policy (< 72h), security questionnaire pre-answered (SIG Lite / CAIQ). Trust Center page (e.g. Vanta, Drata, SafeBase) is now expected.

**Minimum bar:** SOC 2 Type II report available under NDA, DPA template, subprocessor list on trust page, 99.9% SLA with credits, published pen-test cadence, security@ contact + PGP key.

---

## B. Priority tiers

### Tier 1 — required to close ANY enterprise deal
1. SAML SSO (Okta, Azure AD, Google) + SCIM 2.0.
2. RBAC with 4 built-in roles + resource-scoped custom roles.
3. Immutable audit log (1yr retention, API export).
4. SOC 2 Type II in progress (Vanta/Drata), DPA template, subprocessor list, Trust Center page.
5. Private probes (Docker + K8s agent, mTLS dial-out).
6. Custom retention tiers per data class; EU + US region split.
7. Uptime SLA 99.9% with credits; incident-disclosure policy.
8. On-call basics: rotations, overrides, escalation policy, SMS + voice + push.
9. Incident-management basics: declare, Slack channel provisioning, roles, timeline, retro doc.
10. Status-page custom domain + auto-TLS + private (auth) pages.

### Tier 2 — required above ~200 employees
1. SLOs with multi-window burn-rate alerts + weekly digest.
2. Terraform provider covering monitors, status pages, on-call, SLOs.
3. 30+ first-party integrations incl. ServiceNow, Jira, Datadog, PagerDuty, Opsgenie, Sentry, Grafana, MS Teams.
4. Alert grouping + dedup + noise-reduction weekly report.
5. i18n status pages, subscribe-per-component, embeddable widget, multi-page per org.
6. HIPAA BAA (on request), ISO 27001 in progress.
7. Mobile app for on-call responders (push wake reliability).

### Tier 3 — differentiators / TAM expansion
1. OTel receiver (traces + logs) with trace-to-incident linking — "APM lite".
2. LLM observability (prompt/completion capture, cost/latency SLOs).
3. Chatops runbook engine (Slack step-by-step interactive runbooks).
4. Error-budget policies triggering deploy freezes (via GitHub/GitLab check).
5. Forecast / anomaly alerts on burn rate (Prophet / Chronos).
6. Public API marketplace for community integrations.

---

## C. Incident-management deep-dive

### Feature map of leaders
| Capability | incident.io | FireHydrant | PagerDuty | Datadog IM |
|---|---|---|---|---|
| Slack declare `/inc` | yes | yes | yes | yes |
| Auto-provisioned channel | yes | yes | yes | yes |
| Roles (IC/comms/scribe/liaison) | yes | yes | yes | yes |
| Custom fields + severity | yes | yes | yes | yes |
| Runbooks / workflows | yes | yes (Runbooks) | yes (Automation Actions) | notebooks |
| Status-page sync | yes | yes | yes (via Statuspage) | yes |
| Auto-timeline from events | yes | yes | yes | yes (rich w/ APM) |
| Retro doc + follow-ups | yes | yes | yes | notebooks |
| Ticket sync (Jira/ServiceNow) | yes | yes | yes | yes |

### Proposed `status.watch` incident module

**Schema (Postgres/Supabase):**
```
incidents(id, org_id, title, summary, severity, status, started_at, resolved_at,
          declared_by, ic_user_id, comms_user_id, scribe_user_id,
          slack_channel_id, status_page_incident_id, source_alert_id,
          custom_fields jsonb, tags text[])
incident_events(id, incident_id, ts, kind, actor, payload jsonb)  -- append-only timeline
incident_roles(id, incident_id, role, user_id, assigned_at)
incident_updates(id, incident_id, ts, author, body_md, published_to jsonb)
incident_followups(id, incident_id, title, owner, due_at, jira_key, status)
runbooks(id, org_id, name, trigger, steps jsonb)
runbook_runs(id, runbook_id, incident_id, current_step, state jsonb)
```

**UI screens:**
1. Incidents list (filter by severity/status/service/tag).
2. Incident detail: header (sev, status, roles), tabbed timeline / updates / follow-ups / runbooks / linked alerts / linked status-page.
3. Declare modal (from alert, from Slack, from status page, from API).
4. Retro editor (auto-populated timeline, editable markdown, action-item list synced to Jira/Linear).
5. Runbook builder (drag-drop steps: message, HTTP call, wait, approval, branch).

**API surface (REST + webhook):**
```
POST   /v1/incidents              # declare
PATCH  /v1/incidents/{id}         # update status/severity/roles
POST   /v1/incidents/{id}/updates # public/internal update
POST   /v1/incidents/{id}/events  # append timeline event
POST   /v1/incidents/{id}/roles   # assign role
GET    /v1/incidents/{id}/timeline
POST   /v1/runbooks/{id}/run      # execute against incident
```
Webhooks: `incident.declared`, `incident.updated`, `incident.role_assigned`, `incident.resolved`, `runbook.step_completed`.

**Integrations to ship day one:** Slack (channel provisioning, `/sw incident` slash command, interactive updates), MS Teams, PagerDuty (import), Jira (follow-up sync), Zoom/Meet (auto-bridge), GitHub (link commits/PRs to timeline), Statuspage/status.watch pages (auto-sync visible incident).

---

## D. Concrete 4-week build plan (ROI-ranked)

We already have monitors, incidents, status pages, notifications, SDK — ~65% of Tier 1. Ship these in order:

**Week 1 — IAM foundation (blocks every RFP)**
- SAML SSO via WorkOS or native (Okta/Azure AD/Google).
- SCIM 2.0 provisioning endpoint.
- RBAC: 4 roles (Owner/Admin/Responder/Viewer) + resource scoping.
- Audit log table + append-only writer + `/v1/audit` API.

**Week 2 — Private probes + retention/regions**
- Agent (Go binary + Docker + Helm chart), mTLS dial-out to control plane, job pull loop, result push.
- Retention policy per data class (monitor results 30/90/365, incidents 3y, audit 1y).
- EU region flag on workspace (data pinned at write).

**Week 3 — Incident module hardening + on-call**
- Slack `/sw` declare + auto channel, role assignment, timeline writer.
- Retro doc generator; follow-up sync to Jira + Linear.
- On-call rotations + overrides + escalation policy engine; Twilio SMS + voice with retry; push via APNs/FCM.

**Week 4 — Procurement + status pages**
- Trust Center page (SOC 2 in progress, DPA, subprocessors, SLA).
- Custom domains + auto-TLS (Caddy or ACME lib) on status pages; private/auth-gated pages via Clerk.
- Terraform provider v0.1 (monitors + status pages + escalation policies).

Deferred to month 2: SLOs, OTel receiver, 30+ integrations catalog, mobile app, ISO 27001 kickoff.

---

## E. Positioning statement

> **status.watch is the uptime and incident platform for teams who already pay too much for observability.** We give you enterprise-grade synthetic monitoring, on-call, SLOs, and branded status pages — with SSO, SCIM, private probes, EU data residency, and a Terraform provider — at a predictable per-monitor + per-responder price, without becoming your APM or log vendor.
