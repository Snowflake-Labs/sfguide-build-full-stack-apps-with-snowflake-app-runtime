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
# Iteration 2: Add Workflow Capabilities

Before running this prompt, ensure you have:
1. Completed iteration 1 (ChurnGuard Explorer is deployed)
2. Rerun `grants.sql` as ACCOUNTADMIN (adds EXECUTE ALERT)
3. Run `iteration-2-setup.sql` (creates the ACTIONS table, the ACTION_SUMMARY
   dynamic table, the NOTIFICATIONS table, and ESCALATION_ALERT)

Paste the following prompt into Cortex Code Desktop chat:

```text
/snowflake-apps

Goal: Add retention workflow capabilities to ChurnGuard so teams
can act on churn insights -- flag customers, assign tasks, and
track resolution -- writing to a Snowflake table, with a dynamic
table and an alert turning those writes into notifications.

Requirements:
- "Flag for Retention" action button on high-risk customer rows
- Retention action form: assignee, action type
  (Call / Email / Offer / Escalate), notes field
- Write flagged actions to SFQUICKSTART_CHURNGUARD.PUBLIC.ACTIONS
  (created by iteration-2-setup.sql; columns ACTION_ID, CUSTOMER_KEY,
  ASSIGNED_TO, ACTION_TYPE, STATUS, NOTES, CREATED_AT, UPDATED_AT,
  CREATED_BY) with querySnowflake and ? bind variables
- One open action per customer: POST /api/actions creates the action
  with a single MERGE ... WHEN NOT MATCHED THEN INSERT that matches the
  customer's actions that aren't Resolved, using an ACTION_ID generated
  in the app (crypto.randomUUID()). If the MERGE inserts no row, look up
  the open action and return HTTP 409 with "already flagged: <action_id>".
  The form shows that message as a toast instead of creating a duplicate
- Read the action list from the ACTIONS table
- Action Board page: all tasks with status badges
  (New / In Progress / Resolved)
- Status update controls to move tasks through the workflow
  (UPDATE ACTIONS, setting UPDATED_AT)
- Summary KPI cards on the Action Board computed from the
  ACTIONS table (same source as the action list -- no sync delay)
- Global toast notifications from the NOTIFICATIONS table
  (populated by ESCALATION_ALERT -- the alert reads the
  ACTION_SUMMARY dynamic table; the DT exists solely to power
  the Snowflake alert pipeline)

Architecture:
- App reads and writes the ACTIONS table (action list, KPI summaries,
  status transitions -- all through querySnowflake)
- Alert pipeline (Snowflake-only): ACTION_SUMMARY DT reads ACTIONS
  (1 minute target lag) -> ESCALATION_ALERT fires on open escalations ->
  writes to NOTIFICATIONS table
- App reads NOTIFICATIONS and displays them as global toasts

UI:
- Action Board as a clean list/table with status pill badges
  and 25-per-page pagination
- Summary metric cards above the action table
- Global toast notifications for escalation alerts (visible on any page)
- Slide-over or modal form for creating actions -- not a separate page
- Inline status transitions (click badge to advance)
- Table action columns use icon buttons with the label as tooltip/alt text
- Visual distinction between action statuses using color coding
- Consistent design language with the existing explorer dashboard

Constraints:
- Use ? bind variables for every query that takes a value
- Use owner's rights for all Snowflake queries (the default)
- Snowflake doesn't enforce primary keys or CHECK constraints on
  standard tables: validate action types and statuses in the API
- Return timestamps to the browser as ISO 8601 strings
- app.yml doesn't change in this iteration: no secrets or
  external access integrations are needed
- Do not modify the existing read-only dashboard views
- Keep the APP_ORIGIN usage marker from AGENTS.md

Output:
- Updated app with a new Action Board page
- Snowflake writes for action CRUD operations
- Action summaries computed from the ACTIONS table (no sync delay)
- Global toast notifications from Snowflake alerts
- Redeploy to the same Application Service URL
```
