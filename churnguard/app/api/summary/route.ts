/*
 * Copyright 2026 Snowflake Inc.
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { querySnowflake } from "@/lib/snowflake"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await querySnowflake(`
      SELECT COUNT(*) AS TOTAL_CUSTOMERS,
             COUNT_IF(CHURN_RISK = 'High') AS HIGH_RISK,
             SUM(IFF(CHURN_RISK = 'High', TOTAL_SPEND, 0)) AS REVENUE_AT_RISK,
             AVG(RETURN_RATE) AS AVG_RETURN_RATE
      FROM SFQUICKSTART_CHURNGUARD.PUBLIC.CHURN_METRICS`)
    const r = rows[0] as Record<string, unknown>
    const total = Number(r.TOTAL_CUSTOMERS)
    return Response.json({
      totalCustomers: total,
      highRisk: Number(r.HIGH_RISK),
      churnRate: total ? Number(r.HIGH_RISK) / total : 0,
      revenueAtRisk: Number(r.REVENUE_AT_RISK),
      avgReturnRate: Number(r.AVG_RETURN_RATE),
    })
  } catch (e) {
    console.error(new Date().toISOString(), "[summary]", e)
    return Response.json({ error: e instanceof Error ? e.message : "Failed to load summary" }, { status: 500 })
  }
}
