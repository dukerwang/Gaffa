#!/bin/bash
# Dev server for the Browser pane's "gaffa-preview" config (.claude/launch.json).
#
# The desktop app always launches preview configs from the main checkout, but
# sessions work in worktrees under .claude/worktrees/. This script serves the
# worktree named in .claude/preview-target (one absolute path), or the main
# checkout when that file is missing, so a session can preview its own branch
# without editing launch.json.
#
# It also stops the server it started when the app stops it. `next dev` runs
# `next-server` as a child, and when only the parent was killed the child kept
# running on its own, holding several GB of memory. The trap below takes the
# whole tree down, and reap-dev-servers.sh clears any that slipped through.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE=/opt/homebrew/bin/node
PORT="${PORT:-3020}"

TARGET="$ROOT"
if [ -f "$ROOT/.claude/preview-target" ]; then
  WANT="$(head -n 1 "$ROOT/.claude/preview-target")"
  if [ -d "$WANT" ] && [ -f "$WANT/package.json" ]; then
    TARGET="$WANT"
  else
    echo "preview: ignoring .claude/preview-target ($WANT is not a checkout)" >&2
  fi
fi

# A worktree starts with neither; see "Branches and worktrees" in CLAUDE.md.
if [ ! -d "$TARGET/node_modules" ]; then
  echo "preview: cloning node_modules into $TARGET"
  cp -cR "$ROOT/node_modules" "$TARGET/node_modules"
fi
if [ ! -e "$TARGET/.env.local" ] && [ -f "$ROOT/.env.local" ]; then
  ln -s "$ROOT/.env.local" "$TARGET/.env.local"
fi

"$ROOT/scripts/reap-dev-servers.sh" >&2

# Next.js allows one dev server per folder and exits if another is running, so
# stop an earlier preview of the same folder (a restart, or a 3011-style server
# started by hand).
for pid in $(pgrep -f "next/dist/bin/next dev $TARGET( |$)"); do
  echo "preview: stopping the earlier server for $TARGET ($pid)" >&2
  pkill -TERM -P "$pid" 2>/dev/null
  kill -TERM "$pid" 2>/dev/null
done
sleep 1

echo "$TARGET" > "$ROOT/.claude/preview-serving"
echo "preview: serving $TARGET on port $PORT"

"$NODE" "$TARGET/node_modules/next/dist/bin/next" dev "$TARGET" -p "$PORT" &
CHILD=$!

stop() {
  pkill -TERM -P "$CHILD" 2>/dev/null
  kill -TERM "$CHILD" 2>/dev/null
  rm -f "$ROOT/.claude/preview-serving"
  exit 0
}
trap stop TERM INT HUP EXIT
wait "$CHILD"
