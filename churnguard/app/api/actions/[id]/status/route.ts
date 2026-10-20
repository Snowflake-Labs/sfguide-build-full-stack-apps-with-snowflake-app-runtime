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

const STATUSES = ["New", "In Progress", "Resolved"]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { status } = await req.json()
    if (!UUID.test(id)) return Response.json({ error: "Invalid action id" }, { status: 400 })
    if (!STATUSES.includes(status)) return Response.json({ error: "Invalid status" }, { status: 400 })
    const rows = await querySnowflake(
      `UPDATE SFQUICKSTART_CHURNGUARD.PUBLIC.ACTIONS SET STATUS = ?, UPDATED_AT = CURRENT_TIMESTAMP() WHERE ACTION_ID = ?`,
      { binds: [status, id] },
    )
    const updated = Number((rows[0] as Record<string, unknown> | undefined)?.["number of rows updated"] ?? 0)
    if (!updated) return Response.json({ error: "Action not found" }, { status: 404 })
    return Response.json({ ok: true })
  } catch (e) {
    console.error(new Date().toISOString(), "[actions:status]", e)
    return Response.json({ error: e instanceof Error ? e.message : "Failed to update status" }, { status: 500 })
  }
}
