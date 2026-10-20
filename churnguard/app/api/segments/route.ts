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
import { DIMENSIONS, FROM_CLAUSE, parseDimension } from "@/lib/dimensions"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const dim = parseDimension(new URL(req.url).searchParams.get("dim"))
    const expr = DIMENSIONS[dim].expr
    const rows = await querySnowflake(`
      SELECT ${expr} AS SEGMENT,
             COUNT_IF(m.CHURN_RISK = 'High') AS HIGH,
             COUNT_IF(m.CHURN_RISK = 'Medium') AS MEDIUM,
             COUNT_IF(m.CHURN_RISK = 'Low') AS LOW
      FROM ${FROM_CLAUSE}
      GROUP BY 1 ORDER BY 1`)
    return Response.json(
      (rows as Record<string, unknown>[]).map((r) => ({
        segment: String(r.SEGMENT),
        High: Number(r.HIGH),
        Medium: Number(r.MEDIUM),
        Low: Number(r.LOW),
      })),
    )
  } catch (e) {
    console.error(new Date().toISOString(), "[segments]", e)
    return Response.json({ error: e instanceof Error ? e.message : "Failed to load segments" }, { status: 500 })
  }
}
