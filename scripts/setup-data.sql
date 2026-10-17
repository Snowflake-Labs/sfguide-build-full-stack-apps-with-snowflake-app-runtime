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
-- ChurnGuard: Materialize demo churn data for fast dashboard queries.
-- Run once after grants.sql.
--
-- Uses a deterministic hash of the customer key to generate realistic
-- order, spend, and return metrics so the dashboard always shows a
-- good distribution across High / Medium / Low risk categories.

USE ROLE SFQUICKSTART_CHURNGUARD_ROLE;
USE DATABASE SFQUICKSTART_CHURNGUARD;
USE SCHEMA PUBLIC;
USE WAREHOUSE SFQUICKSTART_CHURNGUARD_WH;

----------------------------------------------------------------------
-- 1) Customer-level churn metrics (~30 K rows)
----------------------------------------------------------------------
CREATE OR REPLACE TABLE CHURN_METRICS AS
WITH sampled_customers AS (
  SELECT c.C_CUSTOMER_SK, cd.CD_CREDIT_RATING,
         cd.CD_MARITAL_STATUS, cd.CD_EDUCATION_STATUS, cd.CD_GENDER
  FROM SNOWFLAKE_SAMPLE_DATA.TPCDS_SF10TCL.CUSTOMER c
    TABLESAMPLE SYSTEM (5)
  JOIN SNOWFLAKE_SAMPLE_DATA.TPCDS_SF10TCL.CUSTOMER_DEMOGRAPHICS cd
    ON c.C_CURRENT_CDEMO_SK = cd.CD_DEMO_SK
  WHERE cd.CD_CREDIT_RATING IN ('Good', 'Low Risk', 'High Risk')
  LIMIT 30000
),
with_metrics AS (
  SELECT
    C_CUSTOMER_SK,
    CD_CREDIT_RATING,
    CD_MARITAL_STATUS,
    CD_EDUCATION_STATUS,
    CD_GENDER,
    -- deterministic pseudo-random metrics from customer key hash
    ABS(HASH(C_CUSTOMER_SK, 1)) % 50 + 1                       AS TOTAL_ORDERS,
    ROUND((ABS(HASH(C_CUSTOMER_SK, 2)) % 9000 + 1000) * 1.0, 2) AS TOTAL_SPEND,
    -- a customer cannot return more orders than they placed
    LEAST(ABS(HASH(C_CUSTOMER_SK, 3)) % 20,
          ABS(HASH(C_CUSTOMER_SK, 1)) % 50 + 1)                 AS TOTAL_RETURNS,
    ROUND((ABS(HASH(C_CUSTOMER_SK, 4)) % 5000) * 1.0, 2)       AS TOTAL_RETURN_AMT
  FROM sampled_customers
)
SELECT
  C_CUSTOMER_SK,
  CD_CREDIT_RATING,
  CD_MARITAL_STATUS,
  CD_EDUCATION_STATUS,
  CD_GENDER,
  TOTAL_ORDERS,
  TOTAL_SPEND,
  TOTAL_RETURNS,
  TOTAL_RETURN_AMT,
  ROUND(TOTAL_RETURNS::FLOAT / TOTAL_ORDERS * 100, 1) AS RETURN_RATE,
  CASE
    WHEN TOTAL_RETURNS::FLOAT / TOTAL_ORDERS > 0.3 THEN 'High'
    WHEN TOTAL_RETURNS::FLOAT / TOTAL_ORDERS > 0.15 THEN 'Medium'
    ELSE 'Low'
  END AS CHURN_RISK
FROM with_metrics;

----------------------------------------------------------------------
-- 2) Monthly trend data (12 months, deterministic)
----------------------------------------------------------------------
CREATE OR REPLACE TABLE CHURN_TRENDS AS
SELECT
  '2002-' || LPAD(m.MOY::STRING, 2, '0') AS MONTH,
  ROUND(18000 + ABS(HASH(m.MOY, 10)) % 4000)  AS ACTIVE_CUSTOMERS,
  ROUND( 3000 + ABS(HASH(m.MOY, 20)) % 2000)  AS CHURNING_CUSTOMERS
FROM (
  SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) AS MOY
  FROM TABLE(GENERATOR(ROWCOUNT => 12))
) m;

-- No extra grants needed: SFQUICKSTART_CHURNGUARD_ROLE creates and owns both tables.
