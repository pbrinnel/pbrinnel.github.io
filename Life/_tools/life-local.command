#!/bin/bash
# Opens your working copy of life.html in the browser, for testing before committing.
# Double-click it in Finder (it opens in Terminal), or run it from a terminal.
# The page has to be served (it fetches its CSV tables), so this starts the tuning lab's
# server, which serves the whole repo with caching off, so a reload always shows your
# latest edits. Close the Terminal window (or press Ctrl+C) to stop it.

PORT=8920
URL="http://localhost:$PORT/life.html"
# Finder starts .command files with a bare PATH; add Homebrew's so node is found.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/../.." || exit 1

if curl -s -o /dev/null "http://localhost:$PORT/life.html"; then
  echo "Already running; opening $URL"
  open "$URL"
  exit 0
fi

if ! command -v node >/dev/null; then
  echo "node isn't installed (https://nodejs.org); it's needed to serve the page."
  read -r -p "Press Return to close."
  exit 1
fi

echo "Serving $(pwd) at http://localhost:$PORT"
echo "Life:  $URL"
echo "Lab:   http://localhost:$PORT/Life/_lab/"
echo "Close this window or press Ctrl+C to stop."
( sleep 1; open "$URL" ) &
exec node Life/_lab/serve.js
