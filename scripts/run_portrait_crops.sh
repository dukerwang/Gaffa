#!/bin/bash
# Wrapper for launchd (scripts/launchd/com.gaffa.portrait-crops-daily.plist,
# installed into ~/Library/LaunchAgents). Re-measures the portrait crop of any
# player whose PL photo changed since the last run (see
# scripts/backfill_portrait_crops.ts). loadEnvLocal() inside the script reads
# .env.local from the repo root, so cd'ing into place is enough.
set -euo pipefail
cd "/Users/dukewang/Fantasy Futbol"
exec /opt/homebrew/bin/node --experimental-strip-types --no-warnings \
  scripts/backfill_portrait_crops.ts "$@"
