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
  - SFQUICKSTART_CHURNGUARD_ROLE for everything else (data load, app build, deploy, Postgres, agent).
  - After setup the connection's default role is SFQUICKSTART_CHURNGUARD_ROLE, as the guide expects.
    Still pass --role AND --warehouse SFQUICKSTART_CHURNGUARD_WH explicitly on every snow command; for
    ACCOUNTADMIN scripts pass --role ACCOUNTADMIN. The guide's `--connection quickstart` is the
    connection named in this prompt.
- Expected script order (for the ORDER review): setup.sql -> grants.sql -> setup-data.sql; in
  iteration 2, grants -> the Postgres prompt -> iteration-2-setup.sql, which needs the mirror;
  in iteration 3, grants -> iteration-3-setup.sql -> the prompts.
- Parallel sections (for the consistency review): Environment Setup and each Iteration (Setup,
  Prompt(s), What Happens, Key Concepts, Verify). The repeated pattern is: merge the branch, rerun
  grants, run the iteration setup script, run the prompt(s), verify.
- Cleanup: scripts/cleanup.sql. Drop order, dependents first: app service, agent, semantic view,
  mirror, Postgres instance, EAI, network policy, database, role.

### Extra guardrails
- STOP and write the reason under "Blocked" if the Postgres instance CHURNGUARD_PG already exists when
  the guide says to create it, AND the log has no record of this run creating it (if the log shows
  this run created it, reuse it: never create a second instance, never recreate it).
- Create the Postgres instance only during STAGE: iteration-2, and at most one (CHURNGUARD_PG).
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

- Usage markers (iter 1): churnguard/app.yml has a top-level `environment_variables` entry
  APP_ORIGIN = devrel:churnguard:v1, and the app's Snowflake connection code sets QUERY_TAG to
  {"origin":"devrel","asset":"churnguard","v":"1","iter":"1"}. Missing or wrong markers are not a
  FAIL: record a HIGH `flow` friction item saying which marker CoCo dropped or changed. Best effort:
  after using the app, look for the tag in query history
  (`SELECT query_tag, COUNT(*) FROM TABLE(SFQUICKSTART_CHURNGUARD.INFORMATION_SCHEMA.QUERY_HISTORY_BY_WAREHOUSE(WAREHOUSE_NAME => 'SFQUICKSTART_CHURNGUARD_WH')) WHERE query_tag ILIKE '%churnguard%' GROUP BY 1`);
  if the role can't see the app's queries, mark that part SKIPPED with the error.

## STAGE: iteration-2
- Postgres instance CHURNGUARD_PG is READY; the mirror is REPLICATING.
- After the guide's lock-down step, `DESCRIBE NETWORK POLICY CHURNGUARD_PG_POLICY` allows only
  CHURNGUARD_PG_INGRESS_RULE (the temporary CHURNGUARD_PG_LOCAL_IP_RULE is no longer attached).
- App redeployed at the same URL as iteration-1.

- Usage markers (iter 2): churnguard/app.yml has a top-level `environment_variables` entry
  APP_ORIGIN = devrel:churnguard:v1, and the app's Snowflake connection code sets QUERY_TAG to
  {"origin":"devrel","asset":"churnguard","v":"1","iter":"2"}. Missing or wrong markers are not a
  FAIL: record a HIGH `flow` friction item saying which marker CoCo dropped or changed. Best effort:
  after using the app, look for the tag in query history
  (`SELECT query_tag, COUNT(*) FROM TABLE(SFQUICKSTART_CHURNGUARD.INFORMATION_SCHEMA.QUERY_HISTORY_BY_WAREHOUSE(WAREHOUSE_NAME => 'SFQUICKSTART_CHURNGUARD_WH')) WHERE query_tag ILIKE '%churnguard%' GROUP BY 1`);
  if the role can't see the app's queries, mark that part SKIPPED with the error.

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
  POST /api/actions) is rejected with an "already flagged" message, and Postgres still has exactly one
  open action for that customer. If no authenticated client is available, mark SKIPPED with the reason.
- Generic MCP client: `curl -s -i -X POST <app-url>/api/mcp -H 'Content-Type: application/json'
    -H 'Accept: application/json, text/event-stream'
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
  Record the HTTP status. A 302 to the Snowflake login is the documented limitation: mark LIMITATION.
  Any other non-200 result is a FAIL.
- Usage markers (iter 3): churnguard/app.yml has a top-level `environment_variables` entry
  APP_ORIGIN = devrel:churnguard:v1, and the app's Snowflake connection code sets QUERY_TAG to
  {"origin":"devrel","asset":"churnguard","v":"1","iter":"3"}. Missing or wrong markers are not a
  FAIL: record a HIGH `flow` friction item saying which marker CoCo dropped or changed. Best effort:
  after using the app, look for the tag in query history
  (`SELECT query_tag, COUNT(*) FROM TABLE(SFQUICKSTART_CHURNGUARD.INFORMATION_SCHEMA.QUERY_HISTORY_BY_WAREHOUSE(WAREHOUSE_NAME => 'SFQUICKSTART_CHURNGUARD_WH')) WHERE query_tag ILIKE '%churnguard%' GROUP BY 1`);
  if the role can't see the app's queries, mark that part SKIPPED with the error.
