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
-- setup.sql -- Infrastructure setup for the ChurnGuard quickstart
-- Run FIRST, as ACCOUNTADMIN
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 1. Quickstart database and schema
-- ---------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS SFQUICKSTART_CHURNGUARD
    COMMENT = 'Database for the Build Full-Stack Apps with Snowflake App Runtime quickstart';

-- ---------------------------------------------------------------------------
-- 2. TPC-DS sample data
--    This is a shared database from the Snowflake Marketplace.
--    If it already exists in your account, this step is a no-op.
--    If it does not exist, get it from Snowflake Marketplace:
--      1. Go to Snowsight > Marketplace
--      2. Search for "TPC-DS"
--      3. Select "TPC-DS 10 TB" and click "Get"
--      4. Use the default database name SNOWFLAKE_SAMPLE_DATA
--
--    Alternatively, create it from the share (if available):
-- ---------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS SNOWFLAKE_SAMPLE_DATA
    FROM SHARE SFC_SAMPLES.SAMPLE_DATA;

-- Access for the quickstart role is granted in grants.sql (not to PUBLIC)

-- ---------------------------------------------------------------------------
-- 3. Dedicated warehouse for the quickstart
--    XSMALL with a 60-second auto-suspend, so it only costs while queries run.
--    Dropped by cleanup.sql.
-- ---------------------------------------------------------------------------
CREATE WAREHOUSE IF NOT EXISTS SFQUICKSTART_CHURNGUARD_WH
    WAREHOUSE_SIZE = 'XSMALL'
    AUTO_SUSPEND = 60
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'Warehouse for the Build Full-Stack Apps with Snowflake App Runtime quickstart';

-- Verify sample data is accessible (should return ~65 million)
USE WAREHOUSE SFQUICKSTART_CHURNGUARD_WH;
SELECT COUNT(*) AS CUSTOMER_COUNT
  FROM SNOWFLAKE_SAMPLE_DATA.TPCDS_SF10TCL.CUSTOMER;
