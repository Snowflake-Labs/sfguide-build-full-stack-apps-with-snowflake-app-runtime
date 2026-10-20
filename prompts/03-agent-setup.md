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
# Iteration 3 Prerequisite: Semantic View + Cortex Agent

Before running this prompt, ensure you have:
1. Completed iterations 1 and 2 (ChurnGuard with the Action Board workflow is deployed)
2. Run `scripts/iteration-3-setup.sql` (creates RETENTION_PLAYBOOK,
   CUSTOMER_RECOMMENDATIONS, PROPOSED_ACTIONS, and the staging SP/task)

Paste the following prompt into Cortex Code Desktop chat:

````text
/agent-studio

Goal: Give ChurnGuard a Cortex Agent that explores churn data, recommends
retention actions from the RETENTION_PLAYBOOK, and stages proposals via a
custom tool.

Requirements:

1. Create semantic view CHURNGUARD_SV over:
   - CHURN_METRICS (customer-level orders, spend, returns, churn risk)
   - CHURN_TRENDS (monthly active vs churning customers)
   - CUSTOMER_RECOMMENDATIONS (recommended action, rule, reason,
     open-action flag per customer)
   - ACTION_SUMMARY and NOTIFICATIONS (action counts, escalations)
   Add synonyms (at-risk, churner, retention action, playbook) and
   verified queries for: top high-risk customers by spend, churn risk
   by credit rating, monthly churn trend, high-risk customers with no
   open action.

2. Create agent CHURNGUARD_AGENT (model auto, display name "ChurnGuard")
   with tools:
   - Cortex Analyst on CHURNGUARD_SV, warehouse SFQUICKSTART_CHURNGUARD_WH
   - Data to Chart for trends and comparisons

3. Register a custom tool `stage_retention_actions` backed by stored
   procedure STAGE_RETENTION_PROPOSALS. The tool writes proposals to
   PROPOSED_ACTIONS and returns the count of staged proposals.

4. Instructions:
   - Recommend actions only from CUSTOMER_RECOMMENDATIONS; cite the
     rule REASON. Never invent an action type.
   - Skip customers where HAS_OPEN_ACTION is true
   - At most 5 proposals per turn
   - When the user asks to flag or stage actions, call
     stage_retention_actions right away with max_proposals = 5. Don't
     list candidates or ask for confirmation first: proposals are only
     suggestions, and people approve them on the app's Agent Suggested
     tab, which the next prompt (03-add-agent.md) adds. Until then they
     wait in PROPOSED_ACTIONS. Summarize what was staged.
   - Be concise; prefer a table for lists of customers

5. Test the agent with these questions, in the Snowsight agent playground
   or through the agent's REST API:
   - "Who are the top 5 high-risk customers by spend and what should we do?"
   - "Show the monthly churn trend as a chart"
   - "Flag high-risk customers for retention" (should call the tool)

Constraints:
- Use role SFQUICKSTART_CHURNGUARD_ROLE; create objects in
  SFQUICKSTART_CHURNGUARD.PUBLIC

Output:
- CHURNGUARD_SV semantic view with verified queries
- CHURNGUARD_AGENT answering the test questions, with the custom tool
  staging proposals into PROPOSED_ACTIONS
````
