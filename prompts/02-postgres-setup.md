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
# Iteration 2: Postgres Setup (No Longer Needed)

**Skip this step.** ChurnGuard no longer uses Snowflake Postgres. Retention
actions now live in a standard Snowflake table, **ACTIONS**, which
`scripts/iteration-2-setup.sql` creates. You don't need a Postgres instance,
secrets, a network policy, an External Access Integration, a data mirror, or
psql, so iteration 2 works on trial accounts too.

Iteration 2 setup is now:

1. Rerun `scripts/grants.sql` as ACCOUNTADMIN.
2. Run `scripts/iteration-2-setup.sql` as SFQUICKSTART_CHURNGUARD_ROLE. It
   creates ACTIONS, the ACTION_SUMMARY dynamic table, the NOTIFICATIONS table,
   and ESCALATION_ALERT.
3. Paste [`02-add-workflow.md`](02-add-workflow.md) into Cortex Code.

If you already created Postgres objects with an earlier version of this
quickstart, `scripts/cleanup.sql` still removes them.
