<!--
  Copyright 2026 Snowflake Inc.
  SPDX-License-Identifier: Apache-2.0
  
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
  
      http://www.apache.org/licenses/LICENSE-2.0
  
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->
### Guide
- Objects you may touch: SFQUICKSTART_CHURNGUARD*, CHURNGUARD*.
- Git flow: start from the guide's working directory setup, then fetch/merge each iteration branch, and
  use the prompts in prompts/*.md exactly as the guide says.
- Roles:
  - ACCOUNTADMIN only for scripts the guide marks "Run as ACCOUNTADMIN" (setup.sql, grants.sql,
    iteration setup scripts, cleanup.sql).
  - SFQUICKSTART_CHURNGUARD_ROLE for everything else (data load, app build, deploy, agent).
  - After setup the connection's default role is SFQUICKSTART_CHURNGUARD_ROLE, as the guide expects.
    Still pass --role AND --warehouse SFQUICKSTART_CHURNGUARD_WH explicitly on every snow command; for
    ACCOUNTADMIN scripts pass --role ACCOUNTADMIN. The guide's `--connection quickstart` is the
    connection named in this prompt.
- Expected script order (for the ORDER review): setup.sql -> grants.sql -> setup-data.sql; in
  iteration 2, grants -> iteration-2-setup.sql -> the prompt; in iteration 3, grants -> iteration-3-setup.sql -> the prompts.
- Parallel sections (for the consistency review): Environment Setup and each Iteration (Setup,
  Prompt(s), What Happens, Key Concepts, Verify). The repeated pattern is: merge the branch, rerun
  grants, run the iteration setup script, run the prompt(s), verify.
- Cleanup: scripts/cleanup.sql. Drop order, dependents first: app service, agent, semantic view,
  database, warehouse, role. It also drops Postgres objects that earlier versions of the guide created.

### Extra guardrails
- Never create a Postgres instance, External Access Integration, network policy, or hybrid table. The
  guide runs on trial accounts, which reject External Access Integrations and hybrid tables. If a prompt
  or skill steers toward one, record a HIGH `flow` friction item instead.
- Never use, create, or suggest a Snowflake-managed MCP server (CREATE MCP SERVER) or any MCP approach
  other than the one in prompts/03-add-agent.md. Test only what the guide builds.

### Documented limitations
- Generic MCP clients get a 302 to the Snowflake login; only the Cortex Code CLI path works.

## STAGE: setup
- CHURN_METRICS has ~30,000 rows; CHURN_TRENDS has 12 rows (SELECT COUNT(*) as SFQUICKSTART_CHURNGUARD_ROLE).
- SFQUICKSTART_CHURNGUARD_ROLE can USE WAREHOUSE SFQUICKSTART_CHURNGUARD_WH and read SNOWFLAKE_SAMPLE_DATA.

## STAGE: iteration-1
- `npm run build` in churnguard/ succeeds.
- Application Service SFQUICKSTART_CHURNGUARD.PUBLIC.CHURNGUARD exists with a URL; record its status
  (SUSPENDED right after deploy is normal: auto-resume is on).
- `curl -s -o /dev/null -w '%{http_code}' <app-url>` (unauthenticated) -> a 302 to Snowflake login is a
  PASS for "ingress is protected".

- Usage marker (iter 1): churnguard/app.yml has a top-level `environment_variables` entry
  APP_ORIGIN = devrel:churnguard:v1. A missing or wrong marker is not a FAIL: record a HIGH `flow`
  friction item. The marker lives only in app.yml: if CoCo edited churnguard/lib/snowflake.ts for
  it (for example to add a QUERY_TAG), record a HIGH `flow` friction item.

## STAGE: iteration-2
- ACTIONS exists in SFQUICKSTART_CHURNGUARD.PUBLIC, ACTION_SUMMARY is an ACTIVE dynamic table, and
  ESCALATION_ALERT is started (SHOW TABLES, SHOW DYNAMIC TABLES, SHOW ALERTS).
- churnguard/app.yml has no `secrets` or `external_access_integrations` block.
- Flag one customer with Escalate through the app's POST /api/actions: on the deployed app if an
  authenticated client is available, otherwise with `npm run dev` against the same connection. ACTIONS
  gains one row. Flagging the same customer again is rejected with "already flagged", and ACTIONS still
  has exactly one open action for that customer. If neither path works, mark SKIPPED with the reason.
- With that Escalate action open, NOTIFICATIONS gets a critical row within about 2 minutes (the dynamic
  table refreshes, then the alert runs). SKIPPED if the flag check was skipped.
- App redeployed at the same URL as iteration-1.

- Usage marker (iter 2): churnguard/app.yml has a top-level `environment_variables` entry
  APP_ORIGIN = devrel:churnguard:v1. A missing or wrong marker is not a FAIL: record a HIGH `flow`
  friction item. The marker lives only in app.yml: if CoCo edited churnguard/lib/snowflake.ts for
  it (for example to add a QUERY_TAG), record a HIGH `flow` friction item.

## STAGE: iteration-3
- Semantic view and agent exist (SHOW SEMANTIC VIEWS / SHOW AGENTS in SFQUICKSTART_CHURNGUARD.PUBLIC).
- Agent answers one question (e.g. "Which customers are high churn risk?") via SQL/REST using
  SFQUICKSTART_CHURNGUARD_ROLE; record whether it returns a grounded answer.
- Agent test "Flag high-risk customers for retention" calls stage_retention_actions without asking for
  confirmation (PROPOSED_ACTIONS pending count increases).
- MCP via the guide's path: `cortex mcp add churnguard <app-url>/api/mcp --type http
  --snowflake-connection ${SNOWFLAKE_CONNECTION}` then `cortex mcp reconnect churnguard` reports 4 tools.
  If the MCP client can't run in this environment (e.g. the command errors, needs a browser/OAuth
  sign-in, or the connection type isn't supported, as in CI with workload identity), mark it SKIPPED
  with the exact reason and error excerpt. It is not a FAIL, and it never blocks the run. Any
  MCP-dependent check that follows (e.g. the duplicate flag via flag_customer) is SKIPPED for the
  same reason unless another authenticated client is available.
- Duplicate flag guard: flagging a customer that already has an open action (MCP flag_customer or
  POST /api/actions) is rejected with an "already flagged" message, and ACTIONS still has exactly one
  open action for that customer. If no authenticated client is available, mark SKIPPED with the reason.
- Generic MCP client: `curl -s -i -X POST <app-url>/api/mcp -H 'Content-Type: application/json'
    -H 'Accept: application/json, text/event-stream'
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
  Record the HTTP status. A 302 to the Snowflake login is the documented limitation: mark LIMITATION.
  Any other non-200 result is a FAIL.
- Usage marker (iter 3): churnguard/app.yml has a top-level `environment_variables` entry
  APP_ORIGIN = devrel:churnguard:v1. A missing or wrong marker is not a FAIL: record a HIGH `flow`
  friction item. The marker lives only in app.yml: if CoCo edited churnguard/lib/snowflake.ts for
  it (for example to add a QUERY_TAG), record a HIGH `flow` friction item.
