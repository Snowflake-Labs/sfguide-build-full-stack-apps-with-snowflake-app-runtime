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

const LEVELS = ["High", "Medium", "Low"]

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams
    const risk = sp.get("risk") ?? "All"
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1)
    const pageSize = 10
    const dim = parseDimension(sp.get("dim"))
    const segment = sp.get("segment")
    const conds: string[] = []
    const binds: string[] = []
    if (LEVELS.includes(risk)) { conds.push("m.CHURN_RISK = ?"); binds.push(risk) }
    if (segment) { conds.push(`${DIMENSIONS[dim].expr} = ?`); binds.push(segment) }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : ""

    const [countRows, rows] = await Promise.all([
      querySnowflake(`SELECT COUNT(*) AS N FROM ${FROM_CLAUSE} ${where}`, { binds }),
      querySnowflake(
        `SELECT m.C_CUSTOMER_SK, m.CD_CREDIT_RATING, m.TOTAL_ORDERS, m.TOTAL_SPEND, m.TOTAL_RETURNS, m.TOTAL_RETURN_AMT, m.RETURN_RATE, m.CHURN_RISK
         FROM ${FROM_CLAUSE} ${where}
         ORDER BY m.RETURN_RATE DESC, m.TOTAL_SPEND DESC, m.C_CUSTOMER_SK
         LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        { binds },
      ),
    ])
    const total = Number((countRows[0] as Record<string, unknown>).N)
    return Response.json({
      total,
      page,
      pageSize,
      rows: (rows as Record<string, unknown>[]).map((r) => ({
        id: Number(r.C_CUSTOMER_SK),
        rating: String(r.CD_CREDIT_RATING),
        orders: Number(r.TOTAL_ORDERS),
        spend: Number(r.TOTAL_SPEND),
        returns: Number(r.TOTAL_RETURNS),
        returnAmt: Number(r.TOTAL_RETURN_AMT),
        returnRate: Number(r.RETURN_RATE),
        risk: String(r.CHURN_RISK),
      })),
    })
  } catch (e) {
    console.error(new Date().toISOString(), "[customers]", e)
    return Response.json({ error: e instanceof Error ? e.message : "Failed to load customers" }, { status: 500 })
  }
}
