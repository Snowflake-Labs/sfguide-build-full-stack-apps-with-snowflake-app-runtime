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
# Tests for summarize.sh and the run-all.sh timing, using the logs in fixtures/.
# Usage: tests/e2e/test-summarize.sh   (no Snowflake access needed)
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
FIX="$HERE/fixtures"
failures=0

check() {  # check <description> <command...>
  local desc="$1"; shift
  if "$@"; then echo "ok   - $desc"; else echo "FAIL - $desc"; failures=$((failures + 1)); fi
}

run() {  # run <fixture>: sets OUT and RC
  OUT=$("$HERE/summarize.sh" "$FIX/$1" 2>&1); RC=$?
}
has() { grep -qF -- "$1" <<<"$OUT"; }
first_fix() { sed -n '/^### Guide fixes/,$p' <<<"$OUT" | grep -m1 '^- '; }

# Older logs (tables only) behave as before: every FAIL row counts, exit 1.
run log-legacy.md
check "legacy: exit 1 on a FAIL row" test "$RC" -eq 1
check "legacy: FAIL count matches the old regex" \
  test "$(grep -cE '^\|[^|]*\|[[:space:]]*\**FAIL' "$FIX/log-legacy.md")" -eq 1
check "legacy: FAIL checks: 1" has "**FAIL checks: 1, BLOCKER friction: 0**"
check "legacy: per-stage line from the table" \
  has "- iteration-1: 3 passed, 1 failed, 0 skipped, 0 limitation (from the table, all attempts)"
check "legacy: 4-column friction is UNSCORED" has "UNSCORED: 2"
check "legacy: tables are printed" has "| App service has a URL | **FAIL** |"

# JSON blocks: the last block of a stage wins; a BLOCKER fails the run.
run log-structured.md
check "structured: exit 1 on a BLOCKER" test "$RC" -eq 1
check "structured: retried stage supersedes the stale FAIL" \
  has "**FAIL checks: 0, BLOCKER friction: 1**"
check "structured: indented JSON block is read" \
  has "- setup: 2 passed, 0 failed, 0 skipped, 0 limitation"
check "structured: iteration-3 counts" \
  has "- iteration-3: 1 passed, 0 failed, 1 skipped, 1 limitation"
check "structured: severity counts" has "BLOCKER: 1, HIGH: 0, MEDIUM: 2, LOW: 2, UNSCORED: 0"
check "structured: kind counts" \
  has "step: 1, ambiguity: 0, order: 1, flow: 1, clarity: 1, consistency: 1"
check "structured: flow verdict printed" has "- iteration-3 flow verdict: partly"
check "structured: guide fixes start with the BLOCKER" \
  grep -qF '**BLOCKER** order `guide.md:485`' <<<"$(first_fix)"
check "structured: JSON blocks are not echoed" bash -c '! grep -q "json e2e-checks" <<<"$1"' _ "$OUT"
check "structured: consistency review is printed" has "### Consistency review"

# Malformed JSON falls back to the table with a warning; no FAIL or BLOCKER exits 0.
run log-clean.md
check "clean: exit 0" test "$RC" -eq 0
check "clean: malformed block warns" has "iteration-1: ignored a malformed"
check "clean: falls back to the table" \
  has "- iteration-1: 2 passed, 0 failed, 0 skipped, 0 limitation (from the table, all attempts)"
check "clean: friction JSON still read" has "BLOCKER: 0, HIGH: 1"

# Interop exports: test-quickstart report format and sfguide-verify evidence.
OUT=$(REPORT_DATE=2026-10-15 "$HERE/summarize.sh" --export friction-report "$FIX/log-structured.md" 2>&1); RC=$?
check "export report: same exit code" test "$RC" -eq 1
check "export report: test-quickstart title" has "# Quickstart Run-Through: Friction Points & Errors"
check "export report: stage summary row" has "| iteration-3 | PASS | 1 passed, 0 failed, 1 skipped, 1 limitation |"
check "export report: BLOCKER maps to Blocker" has '- **Blocker** (BLOCKER, order) `guide.md:485`'
check "export report: LOW maps to Cosmetic" has "- **Cosmetic** (LOW, clarity)"
check "export report: no run summary mixed in" bash -c '! grep -q "^\*\*FAIL checks:" <<<"$1"' _ "$OUT"
OUT=$("$HERE/summarize.sh" --export verify-evidence "$FIX/log-clean.md" 2>&1); RC=$?
check "export evidence: clean run exits 0" test "$RC" -eq 0
check "export evidence: attest command with PASS" has "--check execution --status PASS --evidence"
OUT=$("$HERE/summarize.sh" --export verify-evidence "$FIX/log-structured.md" 2>&1)
check "export evidence: BLOCKER gives FAIL" has "--status FAIL"
check "export evidence: skipped are not N/A" has "Skipped checks are untested paths"
OUT=$("$HERE/summarize.sh" --export nope "$FIX/log-clean.md" 2>&1); RC=$?
check "export: unknown export rejected" test "$RC" -ne 0

# run-all.sh prints per-stage and total time, also when a stage fails.
# Uses its own stage names so it doesn't depend on this guide's harness.env.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp "$HERE/run-all.sh" "$HERE/env.sh" "$HERE/harness.env" "$tmp/"
mkdir -p "$tmp/run/work"
cat >"$tmp/run-stage.sh" <<'EOF'
#!/usr/bin/env bash
echo "log" >>"$RUN_DIR/work/coco-run-log.md"
[[ "$1" == "s3" ]] && exit 1
exit 0
EOF
chmod +x "$tmp/run-stage.sh"
OUT=$(E2E_ENV_FILE=/dev/null STAGES="s1 s2 s3 s4" RUN_DIR="$tmp/run" "$tmp/run-all.sh" 2>&1); RC=$?
check "run-all: stops on the failed stage" test "$RC" -eq 1
check "run-all: elapsed line on failure" grep -qE \
  'Elapsed: s1=[0-9]+s s2=[0-9]+s s3=[0-9]+s; total [0-9]+s' <<<"$OUT"

# run-stage.sh composes prompt-core.md + stages.md for a stage (no agent, no network).
STAGES_LIST=$(. "$HERE/harness.env"; echo "$STAGES")
LAST_STAGE="${STAGES_LIST##* }"
OUT=$(E2E_ENV_FILE=/dev/null GUIDE_URL=https://example.test/guide "$HERE/run-stage.sh" --print-prompt "$LAST_STAGE" 2>&1); RC=$?
check "prompt: composes for a known stage" test "$RC" -eq 0
check "prompt: guide title substituted" has "$(. "$HERE/harness.env"; echo "$GUIDE_TITLE")"
check "prompt: stage file included" has "## Stage file"
check "prompt: ends with the stage" test "$(tail -n 1 <<<"$OUT")" = "STAGE: $LAST_STAGE"
check "prompt: no harness variable left" bash -c '! grep -qE "\\$\\{(GUIDE_URL|GUIDE_TITLE|GUIDE_MD_PATH|RUN_DIR|REPO_URL|SNOWFLAKE_CONNECTION)\\}" <<<"$1"' _ "$OUT"
OUT=$(E2E_ENV_FILE=/dev/null "$HERE/run-stage.sh" --print-prompt no-such-stage 2>&1); RC=$?
check "prompt: unknown stage rejected" test "$RC" -ne 0
OUT=$(E2E_ENV_FILE=/dev/null REPO_URL=none "$HERE/run-stage.sh" --print-prompt "$LAST_STAGE" 2>&1)
check "prompt: no companion repo starts from an empty folder" has "this guide has no companion repo"
OUT=$(E2E_ENV_FILE=/dev/null REPO_URL=https://example.test/repo.git "$HERE/run-stage.sh" --print-prompt "$LAST_STAGE" 2>&1)
check "prompt: companion repo is cloned" has "a clone of https://example.test/repo.git"
# GUIDE_MD is checked before a run, and accepts padding and a file:// prefix.
OUT=$(E2E_ENV_FILE=/dev/null GUIDE_MD=" file://$FIX/log-clean.md " "$HERE/run-stage.sh" --print-prompt "$LAST_STAGE" 2>&1); RC=$?
check "guide md: file:// URL with spaces accepted" test "$RC" -eq 0
check "guide md: prompt cites work/guide.md" has "Markdown source of the same guide: work/guide.md"
OUT=$(E2E_ENV_FILE=/dev/null GUIDE_MD="no/such/guide.md" "$HERE/run-stage.sh" --print-prompt "$LAST_STAGE" 2>&1); RC=$?
check "guide md: unreadable path fails the dry run" test "$RC" -ne 0
check "guide md: names the bad value" has "GUIDE_MD is not readable: no/such/guide.md"
for s in $STAGES_LIST; do
  check "stages.md has a section for $s" grep -qE "^## STAGE: $s[[:space:]]*$" "$HERE/stages.md"
done
check "harness.env has no <...> placeholders left" bash -c '! grep -vE "^[[:space:]]*#" "$1" | grep -qE "<[A-Za-z][^>]*>"' _ "$HERE/harness.env"

echo
if (( failures )); then echo "$failures test(s) failed"; exit 1; fi
echo "all tests passed"
