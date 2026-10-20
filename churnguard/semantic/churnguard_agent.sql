-- Copyright 2026 Snowflake Inc.
-- SPDX-License-Identifier: Apache-2.0
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
USE ROLE SFQUICKSTART_CHURNGUARD_ROLE;
USE WAREHOUSE SFQUICKSTART_CHURNGUARD_WH;
CREATE OR REPLACE AGENT SFQUICKSTART_CHURNGUARD.PUBLIC.CHURNGUARD_AGENT
  COMMENT = 'ChurnGuard retention agent'
  PROFILE = '{"display_name": "ChurnGuard"}'
  FROM SPECIFICATION
$$
models:
  orchestration: auto
orchestration:
  budget:
    seconds: 120
instructions:
  response: >-
    Be concise. Prefer a markdown table for lists of customers (customer key, spend,
    churn risk, recommended action, reason). When proposals are staged, summarize how
    many were staged and remind the user they are pending human approval.
  orchestration: >-
    Use churn_analyst for any question about customers, churn risk, spend, returns,
    churn trends, recommendations, actions or notifications.
    Recommend retention actions ONLY from CUSTOMER_RECOMMENDATIONS (RECOMMENDED_ACTION)
    and always cite the playbook rule REASON. Never invent an action type; valid types are
    those in the playbook (Escalate, Offer, Call, Email).
    Skip customers where HAS_OPEN_ACTION is true.
    Propose at most 5 customers per turn.
    When the user asks to flag, stage, or propose retention actions, call
    stage_retention_actions with max_proposals=5 right away. Do not list candidates or ask
    for confirmation first: proposals only take effect after a person approves them in the app.
    Then report the returned count of staged proposals.
    Use data_to_chart when the user asks for a chart, trend, or comparison.
  sample_questions:
    - question: Who are the top 5 high-risk customers by spend and what should we do?
    - question: Show the monthly churn trend as a chart
    - question: Flag high-risk customers for retention
tools:
  - tool_spec:
      type: cortex_analyst_text_to_sql
      name: churn_analyst
      description: >-
        Queries ChurnGuard data: customer churn metrics (orders, spend, returns, churn risk,
        credit rating), monthly churn trends, playbook retention recommendations with
        HAS_OPEN_ACTION flag, action summary counts, and notifications/escalations.
  - tool_spec:
      type: data_to_chart
      name: data_to_chart
      description: Generates charts for trends and comparisons from query results.
  - tool_spec:
      type: generic
      name: stage_retention_actions
      description: >-
        Stages retention proposals from the playbook into PROPOSED_ACTIONS for customers
        with no open action and no pending proposal, highest risk and spend first.
        Returns the count of staged proposals as text, e.g. '5 proposals staged'.
      input_schema:
        type: object
        properties:
          max_proposals:
            type: integer
            description: Maximum proposals to stage. Always pass 5 (the per-turn limit).
        required: [max_proposals]
tool_resources:
  churn_analyst:
    semantic_view: SFQUICKSTART_CHURNGUARD.PUBLIC.CHURNGUARD_SV
    execution_environment:
      type: warehouse
      warehouse: SFQUICKSTART_CHURNGUARD_WH
  stage_retention_actions:
    type: procedure
    identifier: SFQUICKSTART_CHURNGUARD.PUBLIC.STAGE_RETENTION_PROPOSALS
    execution_environment:
      type: warehouse
      warehouse: SFQUICKSTART_CHURNGUARD_WH
$$;
