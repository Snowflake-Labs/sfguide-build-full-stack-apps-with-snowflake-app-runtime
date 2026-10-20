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
-- cleanup.sql -- Remove all quickstart resources
-- Run as ACCOUNTADMIN
--
-- Safe to run from any branch: every statement skips objects that don't
-- exist. It also removes the Postgres resources that earlier versions of this
-- quickstart created in iteration 2, which keep using credits until dropped.
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- Drop the Application Service (if deployed)
DROP APPLICATION SERVICE IF EXISTS SFQUICKSTART_CHURNGUARD.PUBLIC.CHURNGUARD;

-- ---------------------------------------------------------------------------
-- Cortex Agent cleanup (iteration 3)
-- Explicit drops for clarity; DROP DATABASE below would also remove them.
-- ---------------------------------------------------------------------------
DROP AGENT IF EXISTS SFQUICKSTART_CHURNGUARD.PUBLIC.CHURNGUARD_AGENT;
DROP SEMANTIC VIEW IF EXISTS SFQUICKSTART_CHURNGUARD.PUBLIC.CHURNGUARD_SV;
DROP VIEW IF EXISTS SFQUICKSTART_CHURNGUARD.PUBLIC.CUSTOMER_RECOMMENDATIONS;
DROP TABLE IF EXISTS SFQUICKSTART_CHURNGUARD.PUBLIC.RETENTION_PLAYBOOK;

-- ---------------------------------------------------------------------------
-- Postgres + mirroring cleanup (earlier versions of iteration 2)
-- Order matters: mirror first, then instance
-- ---------------------------------------------------------------------------

-- The instance and mirror are owned by the quickstart role (created by earlier versions of iteration 2)
USE ROLE SFQUICKSTART_CHURNGUARD_ROLE;

-- Drop the data mirror. By default this also drops the CHURNGUARD_MIRROR
-- target database and the CHURNGUARD_MIRROR_CATALOG_INTEGRATION.
-- Wrapped so the script continues when the mirror was never created; the
-- returned message shows the real error if the drop fails for another reason.
EXECUTE IMMEDIATE $$
BEGIN
  CALL SNOWFLAKE.POSTGRES.DROP_MIRROR('churnguard_mirror');
  RETURN 'Mirror dropped';
EXCEPTION
  WHEN OTHER THEN
    RETURN 'Mirror not dropped (none, or see error): ' || SQLERRM;
END;
$$;

USE ROLE ACCOUNTADMIN;

-- Fallbacks in case DROP_MIRROR did not run to completion. The catalog
-- integration references the instance, so it must go before the instance.
DROP INTEGRATION IF EXISTS CHURNGUARD_MIRROR_CATALOG_INTEGRATION;

-- The mirror target database is owned by the SNOWFLAKE application, so take
-- ownership before dropping it.
EXECUTE IMMEDIATE $$
BEGIN
  GRANT OWNERSHIP ON DATABASE CHURNGUARD_MIRROR TO ROLE ACCOUNTADMIN;
  DROP DATABASE CHURNGUARD_MIRROR;
  RETURN 'CHURNGUARD_MIRROR dropped';
EXCEPTION
  WHEN OTHER THEN
    RETURN 'CHURNGUARD_MIRROR not dropped (none, or see error): ' || SQLERRM;
END;
$$;

USE ROLE SFQUICKSTART_CHURNGUARD_ROLE;

-- Drop the Postgres instance
DROP POSTGRES INSTANCE IF EXISTS CHURNGUARD_PG;

USE ROLE ACCOUNTADMIN;

-- Drop the External Access Integration
DROP INTEGRATION IF EXISTS CHURNGUARD_EAI;

-- Drop the network policy (must detach from instance first, which DROP INSTANCE handles)
DROP NETWORK POLICY IF EXISTS CHURNGUARD_PG_POLICY;

-- Network rules live in the quickstart schema, so DROP DATABASE below removes
-- them too. Explicit drops for clarity, including the temporary local-IP rule
-- that earlier versions of iteration 2 detached after their psql steps. A rule still attached to a
-- network policy with another name can't be dropped: the message names it,
-- and the script carries on.
EXECUTE IMMEDIATE $$
DECLARE
  msg STRING DEFAULT '';
BEGIN
  BEGIN
    DROP NETWORK RULE IF EXISTS SFQUICKSTART_CHURNGUARD.PUBLIC.CHURNGUARD_PG_LOCAL_IP_RULE;
  EXCEPTION
    WHEN OTHER THEN msg := msg || 'CHURNGUARD_PG_LOCAL_IP_RULE: ' || SQLERRM || ' ';
  END;
  BEGIN
    DROP NETWORK RULE IF EXISTS SFQUICKSTART_CHURNGUARD.PUBLIC.CHURNGUARD_PG_INGRESS_RULE;
  EXCEPTION
    WHEN OTHER THEN msg := msg || 'CHURNGUARD_PG_INGRESS_RULE: ' || SQLERRM || ' ';
  END;
  BEGIN
    DROP NETWORK RULE IF EXISTS SFQUICKSTART_CHURNGUARD.PUBLIC.CHURNGUARD_EGRESS_RULE;
  EXCEPTION
    WHEN OTHER THEN msg := msg || 'CHURNGUARD_EGRESS_RULE: ' || SQLERRM || ' ';
  END;
  RETURN IFF(msg = '', 'Network rules dropped',
             'Not dropped: ' || msg || '-- A network policy other than CHURNGUARD_PG_POLICY uses this rule '
             || '(SHOW NETWORK POLICIES). Drop that policy, then rerun this script; DROP DATABASE fails until then.');
END;
$$;

-- ---------------------------------------------------------------------------
-- Drop the database (removes all tables, secrets, network rules, DTs, alerts,
-- tasks, and the app's artifact repository)
-- ---------------------------------------------------------------------------
DROP DATABASE IF EXISTS SFQUICKSTART_CHURNGUARD;

-- Drop the dedicated warehouse and role
DROP WAREHOUSE IF EXISTS SFQUICKSTART_CHURNGUARD_WH;
DROP ROLE IF EXISTS SFQUICKSTART_CHURNGUARD_ROLE;

-- ---------------------------------------------------------------------------
-- Verify: every SHOW below should return no rows
-- ---------------------------------------------------------------------------
SHOW DATABASES LIKE '%CHURNGUARD%';
SHOW ROLES LIKE 'SFQUICKSTART_CHURNGUARD%';
SHOW WAREHOUSES LIKE 'SFQUICKSTART_CHURNGUARD%';
SHOW POSTGRES INSTANCES LIKE 'CHURNGUARD%';
SHOW INTEGRATIONS LIKE 'CHURNGUARD%';
SHOW NETWORK POLICIES LIKE 'CHURNGUARD%';

-- Local leftovers (not in Snowflake), remove them yourself if you like:
--   cortex mcp remove churnguard
--   CHURNGUARD_PG entries in ~/.pgpass and ~/.pg_service.conf, if you used
--   psql with an earlier version of this quickstart
