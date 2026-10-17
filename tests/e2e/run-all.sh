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
# Run all quickstart stages end to end, stopping on failure or a new "Blocked" entry.
# Usage: tests/e2e/run-all.sh [start-stage]   (default: the first stage in harness.env; use to resume after a block)
#
# STAGE_HOOK (optional): a command run after each stage succeeds, with the stage
# name as its argument. CI uses it to switch the connection role after setup.
# Other environment variables are documented in run-stage.sh.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tests/e2e/env.sh
source "$HERE/env.sh"
# shellcheck source=tests/e2e/harness.env
source "$HERE/harness.env"
RUN_DIR="${RUN_DIR:-${TMPDIR:-/tmp}/$RUN_NAME}"
export RUN_DIR
LOG="$RUN_DIR/work/coco-run-log.md"
read -r -a STAGE_LIST <<<"$STAGES"
START="${1:-${STAGE_LIST[0]}}"

blocked_count() {
  local n
  n=$(grep -ciE '^#+[[:space:]]*blocked' "$LOG" 2>/dev/null || true)
  echo "${n:-0}"
}

# Wall-clock time per stage, printed on every exit so slow steps stay visible.
TIMES=()
TOTAL=0
print_times() {
  (( ${#TIMES[@]} )) || return 0
  echo "Elapsed: ${TIMES[*]}; total ${TOTAL}s ($(( TOTAL / 60 ))m $(( TOTAL % 60 ))s)"
}
trap print_times EXIT
trap 'echo "interrupted, stopping" >&2; exit 130' INT

started=false
for s in "${STAGE_LIST[@]}"; do
  [[ "$s" == "$START" ]] && started=true
  $started || continue

  before=$(blocked_count)
  echo "==> Stage: $s"
  stage_start=$(date +%s)
  "$HERE/run-stage.sh" "$s"
  rc=$?
  stage_elapsed=$(( $(date +%s) - stage_start ))
  TIMES+=("$s=${stage_elapsed}s")
  TOTAL=$(( TOTAL + stage_elapsed ))
  if (( rc != 0 )); then
    echo "Stage $s failed"; exit 1
  fi
  if [[ ! -s "$LOG" ]]; then
    echo "Stage $s wrote no log (file writes denied?), stopping"; exit 3
  fi
  after=$(blocked_count)
  if (( after > before )); then
    echo "Stage $s blocked, see $LOG"; exit 2
  fi
  if [[ -n "${STAGE_HOOK:-}" ]]; then
    hook_out=$($STAGE_HOOK "$s") || { echo "STAGE_HOOK failed after $s"; exit 4; }
    eval "$hook_out"
  fi
done

$started || { echo "unknown start stage: $START" >&2; exit 1; }
echo "All stages done. Review $LOG and $RUN_DIR/work/cleanup.md"
