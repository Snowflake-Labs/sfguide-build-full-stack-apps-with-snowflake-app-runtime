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
# CI-only STAGE_HOOK (GitHub Actions). Never used by learners.
#
# Before every stage: re-mint the GitHub OIDC token, so a long run does not
# depend on the first token's lifetime.
# After the first stage: point the connection at the guide's role and warehouse
# (QS_ROLE / QS_WAREHOUSE in harness.env), as a learner's connection would be.
# Tools such as `snow app deploy` use the connection's default role (not --role).
# connections.toml outranks the generic SNOWFLAKE_ROLE / SNOWFLAKE_WAREHOUSE job
# env, so these edits take effect.
#
# Usage (called by run-all.sh): eval "$(ci-hook.sh <stage-just-finished>)"
# Prints `export ...` lines on stdout for the caller to eval; messages go to stderr.
set -euo pipefail

STAGE="${1:-}"
CONN="${SNOWFLAKE_CONNECTION:-quickstart}"
CONN_FILE="${HOME}/.snowflake/connections.toml"
HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=tests/e2e/harness.env
source "$HERE/harness.env"
read -r -a STAGE_LIST <<<"$STAGES"

refresh_token() {
  [[ -n "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" && -n "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" ]] || return 0
  local token
  token=$(curl -sSf -H "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
    "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=snowflakecomputing.com" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["value"])')
  echo "::add-mask::${token}" >&2
  # The connector reads SNOWFLAKE_TOKEN (temporary connection) or the named-connection form.
  local conn_var
  conn_var="SNOWFLAKE_CONNECTIONS_$(echo "$CONN" | tr '[:lower:]-' '[:upper:]_')_TOKEN"
  printf 'export SNOWFLAKE_TOKEN=%q\nexport %s=%q\n' "$token" "$conn_var" "$token"
}

set_quickstart_defaults() {
  python3 - "$CONN_FILE" "$CONN" "$QS_ROLE" "$QS_WAREHOUSE" <<'PY'
import re, sys
path, conn, role, warehouse = sys.argv[1:5]
text = open(path).read()
pattern = re.compile(r"(^\[" + re.escape(conn) + r"\]\n)(.*?)(?=^\[|\Z)", re.S | re.M)
m = pattern.search(text)
if not m:
    sys.exit(f"connection [{conn}] not found in {path}")
body = re.sub(r"^(role|warehouse)\s*=.*\n?", "", m.group(2), flags=re.M)
body = body.rstrip("\n") + f'\nrole                       = "{role}"\nwarehouse                  = "{warehouse}"\n\n'
open(path, "w").write(text[:m.start(2)] + body + text[m.end(2):])
PY
  echo "connection [$CONN] defaults set to role $QS_ROLE, warehouse $QS_WAREHOUSE" >&2
}

if [[ "$STAGE" == "${STAGE_LIST[0]}" && -n "$QS_ROLE" ]]; then
  set_quickstart_defaults
fi
refresh_token
