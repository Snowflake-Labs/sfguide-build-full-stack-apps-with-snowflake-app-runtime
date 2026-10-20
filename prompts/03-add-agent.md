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
# Iteration 3: Embed the ChurnGuard Agent

Before running this prompt, ensure you have:
1. Completed iterations 1 and 2 (ChurnGuard with workflow is deployed)
2. Run `scripts/iteration-3-setup.sql`
3. Completed `prompts/03-agent-setup.md` (CHURNGUARD_SV and
   CHURNGUARD_AGENT exist and answer the test questions)

Paste the following prompt into Cortex Code Desktop chat:

```text
/snowflake-apps

Goal: Make ChurnGuard agent-assisted with proactive recommendations,
an MCP server for external automation, and consistent UI polish.

Requirements:
- API route streaming the agent:run REST API (SSE) for CHURNGUARD_AGENT,
  one thread per conversation
- Chat drawer opened from the header and Cmd+K; thread survives page
  navigation, with a "New conversation" action
- Contextual entry points that pre-fill context: details row "Ask about
  this customer", segment bar "Explain this segment", High-risk KPI
  "Why?", Action Board card "Suggest next step", escalation toast
- Page-aware suggested prompts in an empty drawer
- Render agent tables and charts inline; when the agent calls
  stage_retention_actions, show the staged count and link to the
  Agent Suggested tab
- "Agent Suggested" tab on Action Board reading PROPOSED_ACTIONS
  (pending) via querySnowflake: each card shows customer key, action
  type, and rule reason. "Approve All" button above the list;
  per-card Approve / Dismiss. Approve writes to ACTIONS via
  POST /api/actions and sets PROPOSED_ACTIONS.STATUS = 'approved'.
  If POST /api/actions answers 409 "already flagged", mark the
  proposal 'dismissed' with that reason instead of failing. Approve All
  approves the rest and reports how many were skipped as duplicates.
  Tab badge showing pending count.
- Toast notification when pending proposals exist on page load
- MCP server at /api/mcp exposing tools: flag_customer, list_actions,
  get_customer_risk, get_churn_summary. Auth via Snowflake ingress.
  flag_customer uses the same one-open-action-per-customer rule as
  POST /api/actions and returns "already flagged: <action_id>" as a
  tool error instead of creating a duplicate.

UI:
- Multi-phase loading: thinking indicator, live status steps from the
  stream, shimmer, then the streamed answer
- All agent entry points (header button, contextual row/card actions,
  Agent Suggested tab) use the same sparkle/wand icon for consistency
- Table/list action columns: icon buttons with label as tooltip
- Approval buttons (Approve, Dismiss, Approve All): icon + label
- Action cards show customer, action, and rule reason
- Consistent with the existing ChurnGuard design language

Constraints:
- The agent never writes directly; Approve calls POST /api/actions
- Keep Dashboard and Action Board working; Action Board refreshes
  after approve
- MCP server shares the same auth as the app's API routes
- Keep the APP_ORIGIN usage marker from AGENTS.md

Output:
- Agent-assisted ChurnGuard with Agent Suggested tab, MCP server,
  redeployed to the same Application Service URL
```
