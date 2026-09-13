# Fly.io worker image — runs the two persistent tickers (probe cron every 30s
# for user monitors, public-service cron every 30s for the 100-site catalog).
# The Vercel-hosted Next.js app owns the routes; this container just pokes them
# on a schedule so we can hit sub-1-minute cadence which Vercel Cron can't.

FROM node:20-alpine

WORKDIR /app

# Ship just the two ticker scripts and their (zero) runtime deps. We call
# fetch() against the deployed Next.js app; no other Node deps required.
COPY worker/entrypoint.sh /app/entrypoint.sh
COPY scripts/probe-tick.js /app/scripts/probe-tick.js
COPY scripts/public-service-tick.js /app/scripts/public-service-tick.js

RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV APP_URL=""
ENV CRON_SECRET=""
ENV PROBE_INTERVAL_SECONDS=30
ENV PUBLIC_SERVICE_INTERVAL_SECONDS=30

# Health check port — Fly needs *something* listening if you attach
# services/checks. The entrypoint spawns a tiny http listener on this port.
EXPOSE 8080

CMD ["/app/entrypoint.sh"]
