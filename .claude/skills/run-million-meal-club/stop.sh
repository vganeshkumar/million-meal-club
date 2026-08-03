#!/usr/bin/env bash
# Stops the Million Meal Club dev servers by killing whatever is listening
# on their ports. Leaves the Terminal.app windows themselves open.
set -uo pipefail

for port in 8001 3000; do
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    # uvicorn --reload runs a reloader parent + worker subprocess, both
    # bound to the port — lsof -t can return more than one PID per port,
    # one per line, so kill each individually rather than passing the
    # whole (possibly multi-line) string as a single argument.
    echo "Stopping process(es) on :$port (pid(s): $(echo "$pids" | tr '\n' ' '))"
    echo "$pids" | while IFS= read -r pid; do
      [ -n "$pid" ] && kill "$pid" 2>/dev/null
    done
  else
    echo "Nothing listening on :$port"
  fi
done
