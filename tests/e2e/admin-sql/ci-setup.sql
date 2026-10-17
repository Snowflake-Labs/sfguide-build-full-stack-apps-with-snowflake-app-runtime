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
-- ci-setup.sql -- Maintainer-only: service user for the E2E GitHub workflow.
-- NOT part of the quickstart. Run once as ACCOUNTADMIN, ideally in a dedicated
-- test account. See tests/e2e/README.md.
--
-- Replace the SUBJECT with the value for your repo and environment:
--   <sub_claim_prefix>:environment:churnguard-e2e
-- where sub_claim_prefix comes from (README: "Find your OIDC subject"):
--   gh api repos/<owner>/<repo>/actions/oidc/customization/sub
-- This repo uses GitHub's immutable subject format (owner and repo IDs).
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- CI-owned warehouse: exists before the quickstart's setup.sql creates
-- SFQUICKSTART_CHURNGUARD_WH and survives its cleanup.sql. ci-hook.sh switches
-- the connection to the quickstart warehouse after the setup stage.
CREATE WAREHOUSE IF NOT EXISTS CHURNGUARD_E2E_CI_WH
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE
  COMMENT = 'Maintainer CI for the ChurnGuard quickstart E2E (tests/e2e). Not part of the quickstart.';

CREATE USER IF NOT EXISTS CHURNGUARD_E2E_CI
  TYPE = SERVICE
  DEFAULT_ROLE = ACCOUNTADMIN
  DEFAULT_WAREHOUSE = CHURNGUARD_E2E_CI_WH
  WORKLOAD_IDENTITY = (
    TYPE = OIDC
    ISSUER = 'https://token.actions.githubusercontent.com'
    SUBJECT = 'repo:Snowflake-Labs@58992620/sfguide-build-full-stack-apps-with-snowflake-app-runtime@1409807894:environment:churnguard-e2e'
  )
  COMMENT = 'Maintainer CI for the ChurnGuard quickstart E2E (tests/e2e). Not part of the quickstart.';

-- The quickstart scripts run as ACCOUNTADMIN (database and role creation,
-- BIND SERVICE ENDPOINT, external access integration), so the CI user needs it.
-- grants.sql grants the quickstart role to CURRENT_USER(), i.e. this user.
GRANT ROLE ACCOUNTADMIN TO USER CHURNGUARD_E2E_CI;

-- Verify
DESCRIBE USER CHURNGUARD_E2E_CI;
SHOW GRANTS TO USER CHURNGUARD_E2E_CI;
