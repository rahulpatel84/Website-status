#!/bin/sh
# Fly worker entrypoint. Starts:
#   - a trivial http health server on $PORT (Fly needs one process listening)
#   - the two ticker scripts, each forever-looping at their configured cadence
#
# APP_URL and CRON_SECRET are set as Fly secrets (see fly.toml + DEPLOYMENT.md).

set -eu

: "${APP_URL:?APP_URL must be set (e.g. https://status.watch)}"
: "${PROBE_INTERVAL_SECONDS:=30}"
: "${PUBLIC_SERVICE_INTERVAL_SECONDS:=30}"
: "${PORT:=8080}"

echo "Starting worker → APP_URL=$APP_URL probe=$PROBE_INTERVAL_SECONDS s public=$PUBLIC_SERVICE_INTERVAL_SECONDS s"

# Minimal health server so Fly's TCP checks pass.
node -e "
const http = require('http');
http.createServer((_, res) => { res.writeHead(200); res.end('ok'); })
  .listen(process.env.PORT || 8080, () => console.log('health :' + (process.env.PORT || 8080)));
" &

# Probe ticker (user monitors)
node /app/scripts/probe-tick.js --url "$APP_URL" --interval "$PROBE_INTERVAL_SECONDS" &

# Public-services ticker (the 100-site catalog)
node /app/scripts/public-service-tick.js --url "$APP_URL" --interval "$PUBLIC_SERVICE_INTERVAL_SECONDS" &

# Wait for any child to exit; if any dies, tear the container down so Fly restarts it.
wait -n
exit $?
