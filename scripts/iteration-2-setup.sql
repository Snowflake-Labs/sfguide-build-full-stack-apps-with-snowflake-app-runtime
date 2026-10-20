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
-- iteration-2-setup.sql -- Workflow objects for iteration 2
-- Run as SFQUICKSTART_CHURNGUARD_ROLE (after rerunning grants.sql)
-- =============================================================================

USE ROLE SFQUICKSTART_CHURNGUARD_ROLE;
USE DATABASE SFQUICKSTART_CHURNGUARD;
USE SCHEMA PUBLIC;

-- ---------------------------------------------------------------------------
-- 1. Actions table — the app reads and writes retention actions here
--    A standard Snowflake table: it works on trial accounts, needs no
--    network access or secrets, and the app reaches it through the same
--    owner's rights connection it already uses. Snowflake doesn't enforce
--    PRIMARY KEY or CHECK constraints on standard tables, so the app validates
--    action types and statuses, and allows one open action per customer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ACTIONS (
    ACTION_ID    STRING        NOT NULL DEFAULT UUID_STRING(),
    CUSTOMER_KEY NUMBER        NOT NULL,
    ASSIGNED_TO  STRING        NOT NULL,
    ACTION_TYPE  STRING        NOT NULL,  -- Call, Email, Offer, Escalate
    STATUS       STRING        NOT NULL DEFAULT 'New',  -- New, In Progress, Resolved
    NOTES        STRING        DEFAULT '',
    CREATED_AT   TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT   TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
    CREATED_BY   STRING        DEFAULT CURRENT_USER(),
    CONSTRAINT PK_ACTIONS PRIMARY KEY (ACTION_ID)
)
COMMENT = 'Retention actions written by the ChurnGuard app';

-- ---------------------------------------------------------------------------
-- 2. Dynamic table — pre-computed action summaries (refreshes every minute)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE DYNAMIC TABLE ACTION_SUMMARY
    TARGET_LAG = '1 minute'
    WAREHOUSE = SFQUICKSTART_CHURNGUARD_WH
AS
SELECT
    COUNT(*)                                                    AS TOTAL_ACTIONS,
    COUNT_IF(STATUS = 'New')                                    AS NEW_COUNT,
    COUNT_IF(STATUS = 'In Progress')                            AS IN_PROGRESS_COUNT,
    COUNT_IF(STATUS = 'Resolved')                               AS RESOLVED_COUNT,
    COUNT_IF(ACTION_TYPE = 'Escalate' AND STATUS != 'Resolved') AS OPEN_ESCALATIONS,
    COUNT_IF(STATUS = 'New'
        AND CREATED_AT < DATEADD('hour', -24, CURRENT_TIMESTAMP())) AS STALE_COUNT
FROM ACTIONS;

-- ---------------------------------------------------------------------------
-- 3. Notifications table — alert writes here; app reads and displays
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS NOTIFICATIONS (
    NOTIFICATION_ID STRING DEFAULT UUID_STRING(),
    MESSAGE STRING,
    SEVERITY STRING DEFAULT 'warning',
    ACKNOWLEDGED BOOLEAN DEFAULT FALSE,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ---------------------------------------------------------------------------
-- 4. Alert — fires every minute; inserts a notification on escalation
--    Deduplicates: at most one unacknowledged critical per hour
-- ---------------------------------------------------------------------------
CREATE OR REPLACE ALERT SFQUICKSTART_CHURNGUARD.PUBLIC.ESCALATION_ALERT
    WAREHOUSE = SFQUICKSTART_CHURNGUARD_WH
    SCHEDULE = '1 MINUTE'
    IF (EXISTS (
        SELECT 1 FROM SFQUICKSTART_CHURNGUARD.PUBLIC.ACTION_SUMMARY
        WHERE OPEN_ESCALATIONS > 0
    ))
    THEN
        INSERT INTO SFQUICKSTART_CHURNGUARD.PUBLIC.NOTIFICATIONS (MESSAGE, SEVERITY)
        SELECT
            OPEN_ESCALATIONS || ' open escalation(s) require attention',
            'critical'
        FROM SFQUICKSTART_CHURNGUARD.PUBLIC.ACTION_SUMMARY
        WHERE OPEN_ESCALATIONS > 0
          AND NOT EXISTS (
              SELECT 1 FROM SFQUICKSTART_CHURNGUARD.PUBLIC.NOTIFICATIONS
              WHERE ACKNOWLEDGED = FALSE
                AND SEVERITY = 'critical'
                AND CREATED_AT > DATEADD('hour', -1, CURRENT_TIMESTAMP())
          );

ALTER ALERT ESCALATION_ALERT RESUME;
