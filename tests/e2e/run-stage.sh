#!/usr/bin/env bash

# Copyright 2026 Snowflake Inc.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# Run one guide stage headlessly with `cortex exec`, as a learner would.
# Usage: tests/e2e/run-stage.sh [--print-prompt] <stage>
#   Stages, tools and roles come from harness.env; the agent's prompt is prompt-core.md
#   followed by stages.md. --print-prompt prints that prompt and exits (no network, no agent).
#
# Environment (set in the shell, or in tests/e2e/.env.test for local runs):
#   GUIDE_URL             guide the agent follows                (required)
#   GUIDE_MD              markdown source of the same guide, a path (absolute or
#                         relative to the repo root), a file:// URL, or an https:// raw URL;
#                         grounds the flow/order/consistency reviews (optional)
#   SNOWFLAKE_CONNECTION  Snowflake CLI connection name          (default: quickstart)
#   REPO_URL              repo to clone as the learner workspace (default: DEFAULT_REPO_URL;
#                         "none" when the guide has no companion repo: start from an empty folder)
#   RUN_DIR               learner workspace (clone)              (default: ${TMPDIR:-/tmp}/$RUN_NAME)
#   MAX_TURNS             cortex exec turn ceiling               (default: 80)
#   MAX_ATTEMPTS          attempts on model-stream drops         (default: 3)
set -euo pipefail

PRINT_PROMPT=false
if [[ "${1:-}" == "--print-prompt" ]]; then PRINT_PROMPT=true; shift; fi

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tests/e2e/env.sh
source "$HERE/env.sh"
# shellcheck source=tests/e2e/harness.env
source "$HERE/harness.env"
read -r -a STAGE_LIST <<<"$STAGES"

STAGE="${1:?usage: $0 [--print-prompt] <${STAGES// /|}>}"
[[ " $STAGES " == *" $STAGE "* ]] || { echo "unknown stage: $STAGE (stages: $STAGES)" >&2; exit 1; }
grep -qE "^## STAGE: ${STAGE}[[:space:]]*$" "$HERE/stages.md" \
  || { echo "stages.md has no '## STAGE: $STAGE' section" >&2; exit 1; }

export SNOWFLAKE_CONNECTION="${SNOWFLAKE_CONNECTION:-quickstart}"
export REPO_URL="${REPO_URL:-${DEFAULT_REPO_URL:-none}}"
export RUN_DIR="${RUN_DIR:-${TMPDIR:-/tmp}/$RUN_NAME}"
export GUIDE_TITLE
if [[ "$REPO_URL" == "none" ]]; then
  export WORKSPACE="an empty folder (${RUN_DIR}): this guide has no companion repo, so create files
   only where and how the guide says"
else
  export WORKSPACE="a clone of ${REPO_URL} (${RUN_DIR})"
fi
MAX_TURNS="${MAX_TURNS:-80}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-3}"
export GUIDE_MD_PATH="none"
# GUIDE_MD: a path (absolute or repo-relative), a file:// URL, or an https:// URL.
GUIDE_MD="$(sed -E 's/^[[:space:]]+|[[:space:]]+$//g' <<<"${GUIDE_MD:-}")"
GUIDE_MD="${GUIDE_MD#file://}"
guide_md_src=""
if [[ -n "$GUIDE_MD" && "$GUIDE_MD" != https://* ]]; then
  guide_md_src="$GUIDE_MD"
  [[ "$guide_md_src" == /* ]] || guide_md_src="$HERE/../../$guide_md_src"
  [[ -r "$guide_md_src" ]] || { echo "GUIDE_MD is not readable: $GUIDE_MD" >&2; exit 1; }
fi

compose_prompt() {
  # Only substitute the harness variables; the prompt contains other `$` text.
  local vars='${SNOWFLAKE_CONNECTION} ${REPO_URL} ${RUN_DIR} ${GUIDE_URL} ${GUIDE_MD_PATH} ${GUIDE_TITLE} ${WORKSPACE}'
  envsubst "$vars" < "$HERE/prompt-core.md"
  echo
  envsubst "$vars" < "$HERE/stages.md"
  echo; echo "STAGE: $STAGE"
}

if $PRINT_PROMPT; then
  [[ -n "$GUIDE_MD" ]] && GUIDE_MD_PATH="work/guide.md"
  export GUIDE_URL="${GUIDE_URL:-<GUIDE_URL>}"
  compose_prompt
  exit 0
fi

if [[ -z "${GUIDE_URL:-}" ]]; then
  echo "GUIDE_URL is required: the guide (or preview) URL the agent follows." >&2
  echo "Set it in tests/e2e/.env.test (see .env.test.example) or the shell; in CI, the guide_url input." >&2
  exit 1
fi
export GUIDE_URL

# --- preflight ---------------------------------------------------------------
missing=()
for tool in $REQUIRED_TOOLS; do
  command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
if (( ${#missing[@]} )); then
  echo "missing tools: ${missing[*]}" >&2; exit 1
fi

# The guide must be reachable. snowflake.com answers a missing guide with a
# redirect to an error page (HTTP 200), so check the final URL too.
guide_check=$(curl -sL -o /dev/null -w '%{http_code} %{url_effective}' "$GUIDE_URL" || true)
if [[ "${guide_check%% *}" != "200" || "$guide_check" == *"/error-pages/"* ]]; then
  echo "GUIDE_URL is not reachable: $GUIDE_URL ($guide_check)." >&2
  echo "Set GUIDE_URL to a published or preview URL of the guide." >&2
  exit 1
fi

if [[ -n "$QS_ROLE" && "$STAGE" != "${STAGE_LIST[0]}" ]]; then
  # Tools such as snow app deploy use the connection's default role, so after the
  # first stage it must be the guide's role.
  role=$(snow sql -c "$SNOWFLAKE_CONNECTION" -q "SELECT CURRENT_ROLE()" --format json 2>/dev/null \
    | grep -oE '"CURRENT_ROLE\(\)": *"[^"]*"' | sed -E 's/.*: *"([^"]*)"/\1/' || true)
  if [[ "$role" != "$QS_ROLE" ]]; then
    echo "connection '$SNOWFLAKE_CONNECTION' default role is '${role:-unknown}', expected $QS_ROLE." >&2
    echo "Set role = \"$QS_ROLE\" for this connection in connections.toml (see tests/e2e/README.md)." >&2
    exit 1
  fi
fi

if [[ "$REPO_URL" == "none" ]]; then
  mkdir -p "$RUN_DIR"
elif [[ ! -d "$RUN_DIR/.git" ]]; then
  git clone "$REPO_URL" "$RUN_DIR"
fi
mkdir -p "$RUN_DIR/work"
LOG="$RUN_DIR/work/coco-run-log.md"

# Optional markdown source of the guide, copied into the (git-ignored) work/
# folder so the agent can cite guide.md:<line> without leaving its workspace.
if [[ -n "$GUIDE_MD" ]]; then
  guide_md_dest="$RUN_DIR/work/guide.md"
  if [[ "$GUIDE_MD" == https://* ]]; then
    curl -sSfL -o "$guide_md_dest" "$GUIDE_MD" \
      || { echo "GUIDE_MD is not reachable: $GUIDE_MD" >&2; exit 1; }
  else
    cp "$guide_md_src" "$guide_md_dest"
  fi
  [[ -s "$guide_md_dest" ]] || { echo "GUIDE_MD is empty: $GUIDE_MD" >&2; exit 1; }
  GUIDE_MD_PATH="work/guide.md"
fi
trap 'echo "interrupted" >&2; exit 130' INT

# cortex exec prints nothing until the stage ends; stream the log meanwhile
tail -n 0 -F "$LOG" 2>/dev/null &
TAIL_PID=$!
trap 'kill $TAIL_PID 2>/dev/null' EXIT
echo "[$STAGE] running cortex exec in $RUN_DIR (log streams below as it is written)..."

run_exec() {
  compose_prompt | cortex exec \
    -c "$SNOWFLAKE_CONNECTION" \
    -w "$RUN_DIR" \
    --bypass \
    --no-mcp \
    --blocked "Bash(git push*),Bash(git commit*),Bash(git reset --hard*),Bash(rm -rf *),Bash(sudo *),web_search" \
    --max-turns "$MAX_TURNS" \
    --no-history \
    -o "$RUN_DIR/work/last-$STAGE.md"
}

# Retry only on transient model-stream drops; the prompt makes the agent resume from the log.
ERR_LOG="$RUN_DIR/work/exec-$STAGE.err"
STAGE_START=$(date +%s)
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if run_exec 2>&1 | tee "$ERR_LOG"; then
    break
  fi
  if grep -q "Network connection was interrupted" "$ERR_LOG" && (( attempt < MAX_ATTEMPTS )); then
    echo "[$STAGE] stream dropped (attempt $attempt/$MAX_ATTEMPTS), retrying in 30s..." >&2
    sleep 30
    continue
  fi
  echo "[$STAGE] failed after $(( $(date +%s) - STAGE_START ))s" >&2
  exit 1
done

STAGE_END=$(date +%s)
ELAPSED=$(( STAGE_END - STAGE_START ))
echo "Stage '$STAGE' done in ${ELAPSED}s. Review: $LOG"
