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
    const rows = await querySnowflake(
      `SELECT PROPOSAL_ID, CUSTOMER_KEY, ACTION_TYPE, RULE_ID, REASON, SOURCE, PROPOSED_AT
       FROM SFQUICKSTART_CHURNGUARD.PUBLIC.PROPOSED_ACTIONS
       WHERE STATUS = ? ORDER BY PROPOSED_AT DESC, PROPOSAL_ID LIMIT 200`,
      { binds: ["pending"] },
    )
    return Response.json(rows.map((r) => ({
      id: Number(r.PROPOSAL_ID), customerKey: Number(r.CUSTOMER_KEY), actionType: r.ACTION_TYPE,
      ruleId: r.RULE_ID == null ? null : Number(r.RULE_ID), reason: r.REASON, source: r.SOURCE, proposedAt: r.PROPOSED_AT,
    })))
  } catch (e) {
    console.error(new Date().toISOString(), "[proposals:get]", e)
    return Response.json({ error: e instanceof Error ? e.message : "Failed to load proposals" }, { status: 500 })
  }
}
