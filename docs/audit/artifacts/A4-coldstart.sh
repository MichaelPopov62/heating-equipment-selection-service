#!/bin/sh
# A4: замер cold start Render free.
# Запуск: sh docs/audit/artifacts/A4-coldstart.sh <label>
URL="https://heatcalc-api-mp62.onrender.com/health"
LABEL="${1:-run}"
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "$LABEL #$i http=%{http_code} dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\n" \
    --max-time 180 "$URL"
done
