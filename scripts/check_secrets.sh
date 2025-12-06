#!/usr/bin/env bash
set -euo pipefail

# Lightweight secret scan to prevent accidental leakage of server-only keys into client assets or docs.
# Usage: bash scripts/check_secrets.sh

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) is required for secret scanning." >&2
  exit 1
fi

raw_targets=(
  dist
  public
  src
  components
  contexts
  services
  docs
  index.html
)

targets=()
for t in "${raw_targets[@]}"; do
  if [ -e "$t" ]; then
    targets+=("$t")
  fi
done

if [ ${#targets[@]} -eq 0 ]; then
  echo "No scan targets found (skipped)."
  exit 0
fi

patterns=(
  "SUPABASE_KEY"
  "service_role"
  "API_TOKEN"
)

rg --hidden --no-ignore --glob '!**/.git/**' --glob '!**/.env' \
  --pcre2 -n "(${patterns[*]// /|})" "${targets[@]}" || true

echo "Secret scan completed. If matches are shown above, remove them before committing or deploying."
