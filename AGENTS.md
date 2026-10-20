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
# AGENTS.md

## Snowflake Environment

- **Connection**: quickstart (change this, and `--connection quickstart` below, if your connection has another name)
- **Role**: SFQUICKSTART_CHURNGUARD_ROLE. The connection's default `role` must be this role: `snow app deploy` uses the connection's default role, not `--role`
- **Database**: SFQUICKSTART_CHURNGUARD
- **Schema**: PUBLIC
- **Query Warehouse**: SFQUICKSTART_CHURNGUARD_WH (created by scripts/setup.sql)

## Conventions

- All app code lives in the `churnguard/` directory
- All Snowflake objects go in SFQUICKSTART_CHURNGUARD.PUBLIC
- Use database namespace for object identification (no prefix on table names)
- Run `snow app setup` with `--database SFQUICKSTART_CHURNGUARD --schema PUBLIC`, so the app deploys to the quickstart schema, not your personal database
- Deploy apps with `snow app deploy --connection quickstart`
- Use SAMPLE clauses on TPCDS fact tables (10TB+ dataset) for demo performance

## Usage Marker

ChurnGuard carries one anonymous label that tells Snowflake DevRel the app started from this quickstart. It contains no customer data. Add it, and keep it in every later iteration:

- **App origin.** A top-level `environment_variables` block in `churnguard/app.yml` (a sibling of `install:` and `run:`, not nested under `run:`):
  ```yaml
  environment_variables:
    - name: APP_ORIGIN
      value: "devrel:churnguard:v1"
  ```

The marker lives only in `app.yml`. Don't edit `churnguard/lib/snowflake.ts` or other template files for it. To opt out, delete it. The app works the same without it.
