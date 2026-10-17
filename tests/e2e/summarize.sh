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
# Summarize the E2E results of a run. Exits non-zero on any FAIL check or BLOCKER friction.
# Usage: tests/e2e/summarize.sh [--export friction-report|verify-evidence] [log]
#        (default log: $RUN_DIR/work/coco-run-log.md)
# Prints markdown (suitable for $GITHUB_STEP_SUMMARY): per-stage E2E checks, Friction,
# Blocked sections, the Consistency review and Top fixes, then counts and a guide-fix list.
#
# Interop exports (same exit code; nothing else is printed):
#   friction-report  markdown in the format of DevRel Launchpad's test-quickstart report
#   verify-evidence  an `attest --check execution` command for sfguide-verify (fill in <report>)
#
# Results come from the ```json e2e-checks / ```json friction blocks when a stage has
# them (the last block of a stage wins). Stages without them (older logs) fall back to
# the markdown tables, counting rows across all of that stage's sections as before.
set -uo pipefail

EXPORT=""
if [[ "${1:-}" == "--export" ]]; then
  EXPORT="${2:?usage: $0 --export friction-report|verify-evidence [log]}"
  case "$EXPORT" in friction-report|verify-evidence) ;; *) echo "unknown export: $EXPORT" >&2; exit 1 ;; esac
  shift 2
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tests/e2e/harness.env
[[ -f "$HERE/harness.env" ]] && source "$HERE/harness.env"
RUN_DIR="${RUN_DIR:-${TMPDIR:-/tmp}/${RUN_NAME:-learner-e2e}}"
LOG="${1:-$RUN_DIR/work/coco-run-log.md}"
[[ -s "$LOG" ]] || { echo "no log at $LOG"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "python3 is required"; exit 1; }

[[ -z "$EXPORT" ]] && awk '
  /^[[:space:]]*```json[[:space:]]+(e2e-checks|friction)/ { injson = 1; next }
  injson && /^[[:space:]]*```/ { injson = 0; next }
  injson                  { next }
  /^## STAGE:/            { print "\n" $0; section = ""; next }
  /^### /                 { section = tolower($0); if (section ~ /e2e checks|friction|blocked|consistency review|top fixes/) print $0; next }
  section ~ /e2e checks|friction|blocked|consistency review|top fixes/ { print }
' "$LOG"

python3 - "$LOG" "$EXPORT" <<'PY'
import datetime, json, os, re, shlex, sys

SEVERITIES = ["BLOCKER", "HIGH", "MEDIUM", "LOW", "UNSCORED"]
KINDS = ["step", "ambiguity", "order", "flow", "clarity", "consistency"]
RESULTS = ["PASS", "FAIL", "SKIPPED", "LIMITATION"]

lines = open(sys.argv[1], encoding="utf-8").read().splitlines()

# Split the log into stages; "## STAGE: iteration-1 (retry, ...)" belongs to iteration-1.
stages = {}   # name -> {"checks_json", "friction_json", "check_rows", "friction_rows", "verdict"}
order = []
cur, section, fence, buf = None, "", None, []

def stage(name):
    if name not in stages:
        stages[name] = {"checks_json": None, "friction_json": None,
                        "check_rows": [], "friction_rows": [], "verdict": None}
        order.append(name)
    return stages[name]

def cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]

def is_row(line):
    s = line.strip()
    return s.startswith("|") and not re.match(r"^\|[\s:|-]+\|?$", s)

warnings = []
for line in lines:
    if fence:
        if re.match(r"^\s*```\s*$", line):
            try:
                data = json.loads("\n".join(buf))
                if not isinstance(data, list):
                    raise ValueError("not a JSON array")
                stage(cur)["checks_json" if fence == "e2e-checks" else "friction_json"] = data
            except ValueError as e:
                warnings.append(f"{cur}: ignored a malformed ```json {fence} block ({e})")
            fence, buf = None, []
        else:
            buf.append(line)
        continue
    m = re.match(r"^##\s+STAGE:\s*([^\s(]+)", line)
    if m:
        cur, section = m.group(1), ""
        stage(cur)
        continue
    if cur is None:
        continue
    m = re.match(r"^\s*```json\s+(e2e-checks|friction)\s*$", line)
    if m:
        fence = m.group(1)
        continue
    if line.startswith("### "):
        section = line.lower()
        continue
    v = re.search(r"Flow verdict:\s*(.+)", line)
    if v:
        stage(cur)["verdict"] = v.group(1).strip()
    if not is_row(line):
        continue
    c = cells(line)
    if "e2e checks" in section and len(c) >= 2 and c[0].lower() != "check":
        stage(cur)["check_rows"].append(c)
    elif "friction" in section and len(c) >= 2 and c[0].lower() != "step":
        stage(cur)["friction_rows"].append(c)

def norm_result(text):
    t = re.sub(r"[*_`]", "", text or "").strip().upper()
    for r in RESULTS:
        if t.startswith(r):
            return r
    return "OTHER"

def kind_of(text):
    m = re.match(r"\s*\**(AMBIGUITY|ORDER|FLOW|CLARITY|CONSISTENCY)\**\s*:", text or "", re.I)
    return m.group(1).lower() if m else "step"

checks, frictions, sources = [], [], {}
for name in order:
    s = stages[name]
    if s["checks_json"] is not None:
        sources.setdefault(name, []).append("json")
        for c in s["checks_json"]:
            checks.append((name, str(c.get("check", "")), norm_result(c.get("result")),
                           str(c.get("evidence", ""))))
    else:
        sources.setdefault(name, []).append("table")
        for c in s["check_rows"]:
            checks.append((name, c[0], norm_result(c[1]), c[2] if len(c) > 2 else ""))
    if s["friction_json"] is not None:
        for f in s["friction_json"]:
            sev = str(f.get("severity", "")).upper()
            kind = str(f.get("kind", "")).lower() or kind_of(f.get("description"))
            frictions.append({"stage": name, "severity": sev if sev in SEVERITIES else "UNSCORED",
                              "kind": kind if kind in KINDS else "step",
                              "source": str(f.get("source") or f.get("step") or ""),
                              "fix": str(f.get("fix", "")),
                              "description": str(f.get("description", ""))})
    else:
        for c in s["friction_rows"]:
            sev = re.sub(r"[*_`]", "", c[2]).strip().upper() if len(c) >= 5 else ""
            scored = sev in SEVERITIES[:4]
            frictions.append({"stage": name, "severity": sev if scored else "UNSCORED",
                              "kind": kind_of(c[1]), "source": c[0],
                              "fix": c[-1] if len(c) >= 4 else "", "description": c[1]})

export_mode = sys.argv[2] if len(sys.argv) > 2 else ""
stage_counts = {}
for name in order:
    counts = {r: 0 for r in RESULTS}
    for st, _, res, _ in checks:
        if st == name and res in counts:
            counts[res] += 1
    stage_counts[name] = counts
fails = [c for c in checks if c[2] == "FAIL"]
by_sev = {s: sum(1 for f in frictions if f["severity"] == s) for s in SEVERITIES}
by_kind = {k: sum(1 for f in frictions if f["kind"] == k) for k in KINDS}
blockers = by_sev["BLOCKER"]
stage_pos = {n: i for i, n in enumerate(order)}
ranked = sorted(frictions, key=lambda f: (SEVERITIES.index(f["severity"]), stage_pos[f["stage"]]))
exit_code = 1 if fails or blockers else 0

if export_mode == "friction-report":
    # The report format of DevRel Launchpad's test-quickstart skill, so either
    # tool's output can be read the same way. Its severities are Blocker / Friction / Cosmetic.
    legacy = {"BLOCKER": "Blocker", "HIGH": "Friction", "MEDIUM": "Friction", "LOW": "Cosmetic",
              "UNSCORED": "Friction"}
    env = os.environ.get
    print("# Quickstart Run-Through: Friction Points & Errors\n")
    print(f"**Date:** {env('REPORT_DATE') or datetime.date.today().isoformat()}")
    print(f"**Guide:** {env('GUIDE_URL') or 'n/a'}")
    print(f"**Repo:** {env('REPO_URL') or 'n/a'}")
    print(f"**Connection:** {env('SNOWFLAKE_CONNECTION') or 'n/a'}")
    print("**Run by:** run-as-learner (headless, one stage at a time)\n\n---\n")
    print("## Summary\n\n| Section | Status | Notes |\n|---------|--------|-------|")
    for name in order:
        c = stage_counts[name]
        status = "FAIL" if c["FAIL"] else "PASS"
        print(f"| {name} | {status} | {c['PASS']} passed, {c['FAIL']} failed, "
              f"{c['SKIPPED']} skipped, {c['LIMITATION']} limitation |")
    print("\n---\n\n## Reconciliation\n\nNot checked by run-as-learner.\n\n---\n\n## Errors Encountered\n")
    if not fails:
        print("None.\n")
    for st, check, _, ev in fails:
        print(f"### {st} — {check}\n\n**Error:** {ev or 'n/a'}\n**Severity:** Blocker\n")
    print("---\n\n## Friction\n")
    for f in ranked:
        print(f"- **{legacy[f['severity']]}** ({f['severity']}, {f['kind']}) `{f['source']}` "
              f"({f['stage']}): {f['description']}")
    print("\n---\n\n## Recommendations\n")
    for f in ranked:
        print(f"- {f['fix'] or f['description']} (`{f['source']}`)")
    sys.exit(exit_code)

if export_mode == "verify-evidence":
    # Evidence for sfguide-verify's manual `execution` check. It records what this run
    # found; it doesn't run anything. Fill in the report paths.
    total = {r: sum(stage_counts[n][r] for n in order) for r in RESULTS}
    status = "FAIL" if exit_code else "PASS"
    evidence = (f"run-as-learner headless run of stages {', '.join(order)}: "
                f"{total['PASS']} checks passed, {total['FAIL']} failed, {total['SKIPPED']} skipped, "
                f"{total['LIMITATION']} documented limitations; friction BLOCKER {by_sev['BLOCKER']}, "
                f"HIGH {by_sev['HIGH']}, MEDIUM {by_sev['MEDIUM']}, LOW {by_sev['LOW']}. "
                f"Log: {os.path.basename(sys.argv[1])}; see its cleanup.md for created objects.")
    if total["SKIPPED"]:
        evidence += " Skipped checks are untested paths, not N/A."
    print('python "<verify-skill>/scripts/guide_tools.py" attest "<report-in>" '
          f'--output "<report-out>" --check execution --status {status} --evidence {shlex.quote(evidence)}')
    sys.exit(exit_code)

print("\n## Summary\n")
for w in warnings:
    print(f"- warning: {w}")
for name in order:
    counts = stage_counts[name]
    src = "" if sources[name] == ["json"] else " (from the table, all attempts)"
    print(f"- {name}: {counts['PASS']} passed, {counts['FAIL']} failed, "
          f"{counts['SKIPPED']} skipped, {counts['LIMITATION']} limitation{src}")

if fails:
    print("\n### FAIL checks\n")
    for st, check, _, ev in fails:
        print(f"- {st}: {check}" + (f" — {ev}" if ev else ""))

print("\n### Friction\n")
print("- by severity: " + ", ".join(f"{s}: {n}" for s, n in by_sev.items()))
print("- by kind: " + ", ".join(f"{k}: {n}" for k, n in by_kind.items()))
for name in order:
    if stages[name]["verdict"]:
        print(f"- {name} flow verdict: {stages[name]['verdict']}")

if frictions:
    print("\n### Guide fixes (by severity, then guide order)\n")
    for f in ranked:
        fix = f["fix"] or f["description"]
        print(f"- **{f['severity']}** {f['kind']} `{f['source']}` ({f['stage']}): {fix}")

print(f"\n**FAIL checks: {len(fails)}, BLOCKER friction: {blockers}**")
sys.exit(exit_code)
PY
