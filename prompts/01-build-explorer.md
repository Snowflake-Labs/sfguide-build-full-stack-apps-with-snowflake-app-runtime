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
# Iteration 1: Build ChurnGuard Explorer

Paste the following prompt into Cortex Code Desktop chat:

```text
/snowflake-apps

Goal: Build a customer churn risk dashboard called ChurnGuard
that helps retention teams identify and prioritize at-risk customers.

Requirements:
- KPI cards: total customers, churn rate, revenue at risk, avg return rate
- Segment chart: churn risk distribution by credit rating (High/Medium/Low)
- Trend chart: active customers vs churn indicator over time
- Customer details table showing individual high-risk customers
  with 10-per-page pagination and risk level filter tabs
- Drill down: clicking a segment in the churn-risk chart filters the
  customer table to that segment; a "Clear filter" button resets it
- Pivot: a dimension selector above the segment chart lets users switch
  the grouping column (credit rating, marital status, education level,
  or gender) and the chart re-aggregates on selection
- Query the pre-computed tables in SFQUICKSTART_CHURNGUARD.PUBLIC:
  CHURN_METRICS (customer-level data) and CHURN_TRENDS (monthly aggregates)

UI:
- Modern card-based layout with generous spacing and subtle shadows
- Professional color palette (blues and grays with accent colors for risk levels)
- Responsive grid that works well on wide screens
- Smooth loading states and transitions
- Data-dense but not cluttered -- prioritize readability

Constraints:
- Query only the local CHURN_METRICS and CHURN_TRENDS tables
  (do NOT query SNOWFLAKE_SAMPLE_DATA directly -- the fact tables are too large)
- Add the usage marker from AGENTS.md (APP_ORIGIN in app.yml)

Output:
- Deployed interactive dashboard at the Application Service URL
- Clean Next.js project structure ready for iteration
```
