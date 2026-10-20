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
-- =============================================================================
-- REFERENCE ONLY — This file records the semantic view and Cortex Agent that
-- the prompts/03-agent-setup.md prompt creates via the /agent-studio skill.
-- You do not need to run this manually.
--
-- What it does:
--   1. CHURNGUARD_SV  — semantic view over churn metrics, trends, playbook
--      recommendations, and action/escalation state
--   2. CHURNGUARD_AGENT — read-only Cortex Agent (Cortex Analyst + Data to
--      Chart) that explores churn and proposes playbook-grounded actions
--
-- If running manually:
--   snow sql -f scripts/reference/agent-setup.sql --connection quickstart
-- =============================================================================

USE ROLE SFQUICKSTART_CHURNGUARD_ROLE;
USE DATABASE SFQUICKSTART_CHURNGUARD;
USE SCHEMA PUBLIC;
USE WAREHOUSE SFQUICKSTART_CHURNGUARD_WH;

-- ---------------------------------------------------------------------------
-- 1. Semantic view
-- ---------------------------------------------------------------------------
CREATE OR REPLACE SEMANTIC VIEW CHURNGUARD_SV
  TABLES (
    customers AS CHURN_METRICS
      PRIMARY KEY (C_CUSTOMER_SK)
      WITH SYNONYMS ('churn metrics', 'customer risk', 'churners', 'at-risk customers')
      COMMENT = 'One row per customer: orders, spend, returns, return rate, churn risk, credit rating',
    recommendations AS CUSTOMER_RECOMMENDATIONS
      PRIMARY KEY (CUSTOMER_KEY)
      WITH SYNONYMS ('retention recommendations', 'playbook', 'next best action', 'retention action')
      COMMENT = 'Recommended retention action per at-risk customer from the first matching RETENTION_PLAYBOOK rule. Low-risk customers with no matching rule have no row.',
    trends AS CHURN_TRENDS
      PRIMARY KEY (MONTH)
      WITH SYNONYMS ('churn trend', 'monthly churn')
      COMMENT = 'Monthly active vs churning customers',
    action_summary AS ACTION_SUMMARY
      WITH SYNONYMS ('action board summary', 'retention action counts')
      COMMENT = 'Single-row summary of retention actions by status, open escalations, and stale actions',
    notifications AS NOTIFICATIONS
      PRIMARY KEY (NOTIFICATION_ID)
      WITH SYNONYMS ('alerts', 'escalation notifications')
      COMMENT = 'Escalation notifications raised by the ChurnGuard alert'
  )
  RELATIONSHIPS (
    recommendation_customer AS recommendations (CUSTOMER_KEY) REFERENCES customers
  )
  FACTS (
    customers.TOTAL_ORDERS     AS TOTAL_ORDERS     COMMENT = 'Orders placed by the customer',
    customers.TOTAL_SPEND      AS TOTAL_SPEND      WITH SYNONYMS ('spend', 'revenue', 'customer value') COMMENT = 'Total spend in USD',
    customers.TOTAL_RETURNS    AS TOTAL_RETURNS    COMMENT = 'Items returned by the customer',
    customers.TOTAL_RETURN_AMT AS TOTAL_RETURN_AMT COMMENT = 'Value of returned items in USD',
    customers.RETURN_RATE      AS RETURN_RATE      WITH SYNONYMS ('return %', 'return percentage') COMMENT = 'Returns as a percentage of orders (0-100)',
    trends.ACTIVE_CUSTOMERS    AS ACTIVE_CUSTOMERS   COMMENT = 'Active customers in the month',
    trends.CHURNING_CUSTOMERS  AS CHURNING_CUSTOMERS COMMENT = 'Customers who churned in the month'
  )
  DIMENSIONS (
    customers.C_CUSTOMER_SK    AS C_CUSTOMER_SK    WITH SYNONYMS ('customer key', 'customer id', 'customer') COMMENT = 'Customer identifier',
    customers.CD_CREDIT_RATING AS CD_CREDIT_RATING WITH SYNONYMS ('credit rating', 'credit segment', 'segment') COMMENT = 'Credit rating: Good, Low Risk, or High Risk',
    customers.CHURN_RISK       AS CHURN_RISK       WITH SYNONYMS ('risk', 'risk level', 'risk category') COMMENT = 'Churn risk: High (return rate > 30%), Medium (> 15%), or Low',
    recommendations.RECOMMENDED_ACTION AS RECOMMENDED_ACTION WITH SYNONYMS ('action', 'next step', 'action type') COMMENT = 'Playbook action: Call, Email, Offer, or Escalate',
    recommendations.RULE_ID    AS RULE_ID          COMMENT = 'RETENTION_PLAYBOOK rule that produced the recommendation',
    recommendations.REASON     AS REASON           COMMENT = 'Why the playbook recommends this action',
    recommendations.HAS_OPEN_ACTION AS HAS_OPEN_ACTION WITH SYNONYMS ('already actioned', 'has action') COMMENT = 'TRUE if the customer already has a retention action that is not Resolved',
    recommendations.OPEN_ACTION_TYPE AS OPEN_ACTION_TYPE COMMENT = 'Type of the most recent open action, if any',
    trends.MONTH               AS MONTH            COMMENT = 'Month in YYYY-MM format',
    notifications.NOTIFICATION_ID AS NOTIFICATION_ID COMMENT = 'Notification identifier',
    notifications.MESSAGE      AS MESSAGE          COMMENT = 'Notification text',
    notifications.SEVERITY     AS SEVERITY         COMMENT = 'Notification severity',
    notifications.ACKNOWLEDGED AS ACKNOWLEDGED     COMMENT = 'TRUE once a user dismissed the notification',
    notifications.CREATED_AT   AS CREATED_AT       COMMENT = 'When the notification was raised',
    action_summary.TOTAL_ACTIONS     AS TOTAL_ACTIONS     COMMENT = 'Total retention actions',
    action_summary.NEW_COUNT         AS NEW_COUNT         COMMENT = 'Actions in New status',
    action_summary.IN_PROGRESS_COUNT AS IN_PROGRESS_COUNT COMMENT = 'Actions in In Progress status',
    action_summary.RESOLVED_COUNT    AS RESOLVED_COUNT    COMMENT = 'Actions in Resolved status',
    action_summary.OPEN_ESCALATIONS  AS OPEN_ESCALATIONS  COMMENT = 'Escalate actions not yet resolved',
    action_summary.STALE_COUNT       AS STALE_COUNT       COMMENT = 'Open actions not updated recently'
  )
  METRICS (
    customers.CUSTOMER_COUNT   AS COUNT(customers.C_CUSTOMER_SK) WITH SYNONYMS ('number of customers', 'how many customers') COMMENT = 'Number of customers',
    customers.HIGH_RISK_COUNT  AS COUNT_IF(customers.CHURN_RISK = 'High') WITH SYNONYMS ('at-risk customers', 'high-risk count') COMMENT = 'Number of high churn risk customers',
    customers.HIGH_RISK_SHARE  AS DIV0(COUNT_IF(customers.CHURN_RISK = 'High'), COUNT(customers.C_CUSTOMER_SK)) * 100 COMMENT = 'Percentage of customers at high churn risk',
    customers.AVG_RETURN_RATE  AS AVG(customers.RETURN_RATE) COMMENT = 'Average return rate (0-100)',
    customers.TOTAL_SPEND_SUM  AS SUM(customers.TOTAL_SPEND) WITH SYNONYMS ('total revenue') COMMENT = 'Sum of customer spend in USD',
    recommendations.RECOMMENDATION_COUNT AS COUNT(recommendations.CUSTOMER_KEY) COMMENT = 'Number of customers with a recommended action',
    trends.CHURN_RATE          AS DIV0(SUM(trends.CHURNING_CUSTOMERS), SUM(trends.ACTIVE_CUSTOMERS)) * 100 COMMENT = 'Churning as a percentage of active customers'
  )
  COMMENT = 'ChurnGuard: customer churn risk, retention playbook recommendations, and action/escalation state'
  AI_SQL_GENERATION 'Retention recommendations must come from the recommendations table (RECOMMENDED_ACTION, RULE_ID, REASON); never derive an action type yourself. When asked which customers need action, exclude rows where HAS_OPEN_ACTION is TRUE unless the user asks otherwise. RETURN_RATE is a percentage from 0 to 100. Limit customer lists to 5 rows unless the user asks for more.'
  AI_VERIFIED_QUERIES (
    top_high_risk_by_spend AS (
      QUESTION 'Who are the top 5 high-risk customers by spend and what should we do?'
      ONBOARDING_QUESTION TRUE
      SQL 'SELECT customers.C_CUSTOMER_SK, customers.TOTAL_SPEND, customers.RETURN_RATE, customers.CD_CREDIT_RATING, recommendations.RECOMMENDED_ACTION, recommendations.RULE_ID, recommendations.REASON FROM customers JOIN recommendations ON recommendations.CUSTOMER_KEY = customers.C_CUSTOMER_SK WHERE customers.CHURN_RISK = ''High'' AND recommendations.HAS_OPEN_ACTION = FALSE ORDER BY customers.TOTAL_SPEND DESC LIMIT 5'
    ),
    risk_by_credit_rating AS (
      QUESTION 'Which credit rating has the highest share of high-risk customers?'
      ONBOARDING_QUESTION TRUE
      SQL 'SELECT customers.CD_CREDIT_RATING, COUNT(*) AS customer_count, COUNT_IF(customers.CHURN_RISK = ''High'') AS high_risk_count, ROUND(DIV0(COUNT_IF(customers.CHURN_RISK = ''High''), COUNT(*)) * 100, 1) AS high_risk_share FROM customers GROUP BY customers.CD_CREDIT_RATING ORDER BY high_risk_share DESC'
    ),
    monthly_churn_trend AS (
      QUESTION 'Show the monthly churn trend'
      ONBOARDING_QUESTION TRUE
      SQL 'SELECT trends.MONTH, trends.ACTIVE_CUSTOMERS, trends.CHURNING_CUSTOMERS, ROUND(DIV0(trends.CHURNING_CUSTOMERS, trends.ACTIVE_CUSTOMERS) * 100, 1) AS churn_rate FROM trends ORDER BY trends.MONTH'
    ),
    high_risk_no_open_action AS (
      QUESTION 'How many high-risk customers have no open retention action, by recommended action?'
      SQL 'SELECT recommendations.RECOMMENDED_ACTION, COUNT(*) AS customer_count FROM customers JOIN recommendations ON recommendations.CUSTOMER_KEY = customers.C_CUSTOMER_SK WHERE customers.CHURN_RISK = ''High'' AND recommendations.HAS_OPEN_ACTION = FALSE GROUP BY recommendations.RECOMMENDED_ACTION ORDER BY customer_count DESC'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Cortex Agent (read-only: no custom tools, no writes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE AGENT CHURNGUARD_AGENT
  COMMENT = 'ChurnGuard retention assistant: explores churn data and proposes playbook-grounded retention actions'
  PROFILE = '{"display_name": "ChurnGuard", "color": "blue"}'
  FROM SPECIFICATION
  $$
  models:
    orchestration: auto

  orchestration:
    budget:
      seconds: 60
      tokens: 16000

  instructions:
    orchestration: |
      Use churn_analyst for every data question about customers, churn risk,
      credit ratings, trends, retention recommendations, actions, or escalations.
      Use data_to_chart when the user asks for a chart or a trend over time.
      Retention recommendations must come only from the recommendations table
      (RECOMMENDED_ACTION, RULE_ID, REASON). Never invent or change an action type.
      When proposing actions, skip customers where HAS_OPEN_ACTION is TRUE.
      Propose at most 5 actions per turn.
      Messages may start with a [context: ...] line describing what the user is
      looking at in the app; use it to scope the question.
    response: |
      Be concise. Show lists of customers as a table with customer key, spend,
      return rate, recommended action, and reason.
      You cannot create or change actions yourself; the user approves proposals
      in the app. Whenever you recommend actions for specific customers, end
      the answer with a fenced code block tagged churnguard-actions containing
      a JSON array, one object per proposal:
      ```churnguard-actions
      [{"customerKey": 123, "actionType": "Offer", "notes": "short note for the assignee", "ruleId": 2, "reason": "playbook reason"}]
      ```
      actionType must be exactly one of Call, Email, Offer, Escalate.
      Omit the block when you are not proposing actions.
    sample_questions:
      - question: "Who are the top 5 high-risk customers by spend and what should we do?"
      - question: "Show the monthly churn trend as a chart"
      - question: "Which credit rating has the highest share of high-risk customers?"
      - question: "How many high-risk customers have no open retention action?"

  tools:
    - tool_spec:
        type: cortex_analyst_text_to_sql
        name: churn_analyst
        description: "Answers questions about ChurnGuard customers, churn risk, credit ratings, monthly churn trends, playbook retention recommendations, retention actions, and escalation notifications."
    - tool_spec:
        type: data_to_chart
        name: data_to_chart
        description: "Generates charts from data returned by churn_analyst"

  tool_resources:
    churn_analyst:
      semantic_view: SFQUICKSTART_CHURNGUARD.PUBLIC.CHURNGUARD_SV
      execution_environment:
        type: warehouse
        warehouse: SFQUICKSTART_CHURNGUARD_WH
        query_timeout: 60
  $$;
