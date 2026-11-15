#!/bin/bash
# Stops orphaned Next.js dev servers: `next-server` or `next dev` processes
# whose parent has exited (macOS reparents them to launchd, pid 1). A server
# someone is still running from a terminal or the Browser pane keeps its parent,
# so it is left alone.
#
#   scripts/reap-dev-servers.sh          stop orphans
#   scripts/reap-dev-servers.sh --list   show every dev server and its memory

LIST=0
[ "${1:-}" = "--list" ] && LIST=1

ps -axo pid=,ppid=,rss=,command= | while read -r pid ppid rss cmd; do
  case "$cmd" in
    next-server*|*next/dist/bin/next\ dev*) ;;
    *) continue ;;
  esac
  mb=$((rss / 1024))
  if [ "$LIST" = 1 ]; then
    state=running; [ "$ppid" = 1 ] && state=orphaned
    echo "$pid  ${mb}MB  $state  $(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')  $cmd"
  elif [ "$ppid" = 1 ]; then
    echo "reap: stopping orphaned dev server $pid (${mb}MB)"
    kill -TERM "$pid" 2>/dev/null
  fi
done
