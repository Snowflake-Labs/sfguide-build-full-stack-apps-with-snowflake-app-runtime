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
-- grants.sql -- RBAC setup for the ChurnGuard quickstart
-- Run SECOND (after setup.sql), as ACCOUNTADMIN
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 1. Create dedicated role
-- ---------------------------------------------------------------------------
CREATE ROLE IF NOT EXISTS SFQUICKSTART_CHURNGUARD_ROLE
    COMMENT = 'Role for the Build Full-Stack Apps with Snowflake App Runtime quickstart';

-- Grant the role to the user running this script
SET current_user = (SELECT CURRENT_USER());
GRANT ROLE SFQUICKSTART_CHURNGUARD_ROLE TO USER IDENTIFIER($current_user);

-- ---------------------------------------------------------------------------
-- 2. Grants on quickstart database (created by setup.sql)
-- ---------------------------------------------------------------------------
GRANT OWNERSHIP ON DATABASE SFQUICKSTART_CHURNGUARD
    TO ROLE SFQUICKSTART_CHURNGUARD_ROLE COPY CURRENT GRANTS;
GRANT OWNERSHIP ON SCHEMA SFQUICKSTART_CHURNGUARD.PUBLIC
    TO ROLE SFQUICKSTART_CHURNGUARD_ROLE COPY CURRENT GRANTS;

-- ---------------------------------------------------------------------------
-- 3. Account-level privileges
-- ---------------------------------------------------------------------------

-- Deploy Application Services
GRANT CREATE APPLICATION SERVICE ON SCHEMA SFQUICKSTART_CHURNGUARD.PUBLIC
    TO ROLE SFQUICKSTART_CHURNGUARD_ROLE;
GRANT BIND SERVICE ENDPOINT ON ACCOUNT TO ROLE SFQUICKSTART_CHURNGUARD_ROLE;

-- Dedicated quickstart warehouse (created in setup.sql) for queries, the
-- app, the alert, and the agent
GRANT USAGE, OPERATE ON WAREHOUSE SFQUICKSTART_CHURNGUARD_WH TO ROLE SFQUICKSTART_CHURNGUARD_ROLE;

-- ---------------------------------------------------------------------------
-- 4. Data access
-- ---------------------------------------------------------------------------

-- TPC-DS sample data (shared database created by setup.sql)
GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE_SAMPLE_DATA
    TO ROLE SFQUICKSTART_CHURNGUARD_ROLE;

-- ---------------------------------------------------------------------------
-- 5. Escalation alert (iteration 2)
--    The ACTIONS table lives in the quickstart schema, which the role owns,
--    so the workflow itself needs no extra grants.
-- ---------------------------------------------------------------------------
GRANT EXECUTE ALERT ON ACCOUNT
    TO ROLE SFQUICKSTART_CHURNGUARD_ROLE;

-- ---------------------------------------------------------------------------
-- 6. Serverless tasks (iteration 3 -- agentic automation)
-- ---------------------------------------------------------------------------
GRANT EXECUTE MANAGED TASK ON ACCOUNT
    TO ROLE SFQUICKSTART_CHURNGUARD_ROLE;
GRANT EXECUTE TASK ON ACCOUNT
    TO ROLE SFQUICKSTART_CHURNGUARD_ROLE;

-- ---------------------------------------------------------------------------
-- 7. Cortex AI (iteration 3)
--    CORTEX_USER covers Cortex Agents, Cortex Analyst and Data to Chart.
-- ---------------------------------------------------------------------------
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE SFQUICKSTART_CHURNGUARD_ROLE;

-- No object grants are needed for iteration 3 setup objects. The role owns
-- the schema and creates the playbook, view, procedure, and task itself, so
-- it already owns them. Run this script before iteration-3-setup.sql.
