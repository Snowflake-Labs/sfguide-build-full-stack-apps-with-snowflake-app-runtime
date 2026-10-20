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
-- iteration-3-setup.sql -- Retention playbook, proposals, and agentic automation
-- Run as SFQUICKSTART_CHURNGUARD_ROLE (after iteration-2-setup.sql)
--
-- Objects created:
--   RETENTION_PLAYBOOK       – ordered rules mapping risk signals to actions
--   CUSTOMER_RECOMMENDATIONS – view: one recommended action per customer
--   PROPOSED_ACTIONS         – staged proposals from the agent/scheduled task
--   STAGE_RETENTION_PROPOSALS – SP: bulk-stage proposals from the playbook
--   AGENT_SUGGESTION_TASK    – serverless task: runs the SP daily
--
-- The semantic view (CHURNGUARD_SV) and agent (CHURNGUARD_AGENT) are created
-- in a Cortex Code conversation -- see prompts/03-agent-setup.md.
-- =============================================================================

USE ROLE SFQUICKSTART_CHURNGUARD_ROLE;
USE DATABASE SFQUICKSTART_CHURNGUARD;
USE SCHEMA PUBLIC;
USE WAREHOUSE SFQUICKSTART_CHURNGUARD_WH;

-- ---------------------------------------------------------------------------
-- 1. Retention playbook (lookup table)
--    NULL in a condition column means "any value".
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE RETENTION_PLAYBOOK (
    RULE_ID          NUMBER       NOT NULL,
    PRIORITY         NUMBER       NOT NULL,
    CHURN_RISK       STRING,
    CREDIT_RATING    STRING,
    MIN_SPEND        NUMBER(10,2),
    MIN_RETURN_RATE  FLOAT,
    ACTION_TYPE      STRING       NOT NULL,
    REASON           STRING       NOT NULL
)
COMMENT = 'Ordered retention rules: first matching rule by PRIORITY decides the action';

INSERT INTO RETENTION_PLAYBOOK
    (RULE_ID, PRIORITY, CHURN_RISK, CREDIT_RATING, MIN_SPEND, MIN_RETURN_RATE, ACTION_TYPE, REASON)
VALUES
    (1, 1, 'High',   'High Risk', NULL, NULL, 'Escalate', 'High churn risk on a high credit-risk account needs an account manager'),
    (2, 2, 'High',   NULL,        7000, NULL, 'Offer',    'Valuable customer at risk: worth a retention discount'),
    (3, 3, 'High',   NULL,        NULL, 40,   'Call',     'Very high return rate signals a product or fit problem: talk to them'),
    (4, 4, 'High',   NULL,        NULL, NULL, 'Email',    'At-risk customer: low-cost personal check-in'),
    (5, 5, 'Medium', NULL,        NULL, 25,   'Email',    'Early warning: returns trending up, nudge before it becomes high risk');

-- ---------------------------------------------------------------------------
-- 2. Recommendations view: applies the playbook to every customer
--    Open actions come from the ACTIONS table the app writes to.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW CUSTOMER_RECOMMENDATIONS
COMMENT = 'One recommended retention action per customer, from the first matching RETENTION_PLAYBOOK rule'
AS
WITH open_actions AS (
    SELECT
        CUSTOMER_KEY,
        COUNT(*)                                   AS OPEN_ACTION_COUNT,
        MAX_BY(ACTION_TYPE, CREATED_AT)            AS OPEN_ACTION_TYPE
    FROM SFQUICKSTART_CHURNGUARD.PUBLIC.ACTIONS
    WHERE STATUS <> 'Resolved'
    GROUP BY CUSTOMER_KEY
)
SELECT
    m.C_CUSTOMER_SK                                AS CUSTOMER_KEY,
    m.CD_CREDIT_RATING                             AS CREDIT_RATING,
    m.CHURN_RISK,
    m.TOTAL_ORDERS,
    m.TOTAL_SPEND,
    m.TOTAL_RETURNS,
    m.RETURN_RATE,
    p.ACTION_TYPE                                  AS RECOMMENDED_ACTION,
    p.RULE_ID,
    p.REASON,
    COALESCE(o.OPEN_ACTION_COUNT, 0) > 0           AS HAS_OPEN_ACTION,
    o.OPEN_ACTION_TYPE
FROM CHURN_METRICS m
JOIN RETENTION_PLAYBOOK p
  ON (p.CHURN_RISK      IS NULL OR p.CHURN_RISK    = m.CHURN_RISK)
 AND (p.CREDIT_RATING   IS NULL OR p.CREDIT_RATING = m.CD_CREDIT_RATING)
 AND (p.MIN_SPEND       IS NULL OR m.TOTAL_SPEND  >= p.MIN_SPEND)
 AND (p.MIN_RETURN_RATE IS NULL OR m.RETURN_RATE  >= p.MIN_RETURN_RATE)
LEFT JOIN open_actions o
  ON o.CUSTOMER_KEY = m.C_CUSTOMER_SK
QUALIFY ROW_NUMBER() OVER (PARTITION BY m.C_CUSTOMER_SK ORDER BY p.PRIORITY) = 1;

-- ---------------------------------------------------------------------------
-- 3. Proposed actions (staging table for agent/task proposals)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE PROPOSED_ACTIONS (
    PROPOSAL_ID    NUMBER AUTOINCREMENT,
    CUSTOMER_KEY   NUMBER       NOT NULL,
    ACTION_TYPE    VARCHAR      NOT NULL,
    RULE_ID        NUMBER,
    REASON         VARCHAR,
    SOURCE         VARCHAR      DEFAULT 'agent-scheduled',
    PROPOSED_AT    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    STATUS         VARCHAR      DEFAULT 'pending',
    CONSTRAINT pk_proposal PRIMARY KEY (PROPOSAL_ID)
)
COMMENT = 'Staged retention proposals: pending human approval before writing to ACTIONS';

-- ---------------------------------------------------------------------------
-- 4. SP: stage up to 20 proposals from the playbook
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE STAGE_RETENTION_PROPOSALS(MAX_PROPOSALS NUMBER DEFAULT 20)
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
BEGIN
    LET staged NUMBER := 0;

    INSERT INTO SFQUICKSTART_CHURNGUARD.PUBLIC.PROPOSED_ACTIONS (CUSTOMER_KEY, ACTION_TYPE, RULE_ID, REASON, SOURCE)
        SELECT
            CUSTOMER_KEY,
            RECOMMENDED_ACTION,
            RULE_ID,
            REASON,
            'agent-scheduled'
        FROM SFQUICKSTART_CHURNGUARD.PUBLIC.CUSTOMER_RECOMMENDATIONS r
        WHERE HAS_OPEN_ACTION = FALSE
          AND NOT EXISTS (
              SELECT 1 FROM SFQUICKSTART_CHURNGUARD.PUBLIC.PROPOSED_ACTIONS p
              WHERE p.CUSTOMER_KEY = r.CUSTOMER_KEY
                AND p.STATUS = 'pending'
          )
        ORDER BY CASE CHURN_RISK WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
                 TOTAL_SPEND DESC NULLS LAST
        LIMIT :MAX_PROPOSALS;

    staged := SQLROWCOUNT;
    RETURN staged || ' proposals staged';
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Serverless task: run the SP daily at 08:00 UTC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TASK AGENT_SUGGESTION_TASK
    SCHEDULE = 'USING CRON 0 8 * * * UTC'
    USER_TASK_MANAGED_INITIAL_WAREHOUSE_SIZE = 'XSMALL'
    AS CALL STAGE_RETENTION_PROPOSALS();

ALTER TASK AGENT_SUGGESTION_TASK RESUME;

-- Run once immediately so proposals appear during the quickstart
EXECUTE TASK AGENT_SUGGESTION_TASK;
