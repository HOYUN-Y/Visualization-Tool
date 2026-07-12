#!/usr/bin/env bash
# Cache-bust automation (FOLLOWUP P12). Rewrites EVERY `?v=NNN` in index.html to a single new
# version — both bumping and re-unifying any drift (the manual per-line bump was the accident source).
#
# Usage:
#   scripts/bump-assets.sh          # → (current max + 1)
#   scripts/bump-assets.sh 300      # → set all to 300
#   npm run bump                    # same as no-arg
#
# Idempotent for a given version. No build step; this is the whole "build".
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="index.html"

CUR=$(grep -oE '\?v=[0-9]+' "$FILE" | grep -oE '[0-9]+' | sort -n | tail -1 || true)
CUR=${CUR:-0}
NEW="${1:-$((CUR + 1))}"

if ! [[ "$NEW" =~ ^[0-9]+$ ]]; then echo "error: version must be an integer, got '$NEW'" >&2; exit 1; fi

perl -i -pe 's/(\?v=)\d+/${1}'"$NEW"'/g' "$FILE"

COUNT=$(grep -oE '\?v=[0-9]+' "$FILE" | wc -l | tr -d ' ')
UNIQ=$(grep -oE '\?v=[0-9]+' "$FILE" | sort -u | tr '\n' ' ')
echo "bumped $COUNT asset refs in $FILE → ?v=$NEW (prev max $CUR); unique now: ${UNIQ:-none}"
