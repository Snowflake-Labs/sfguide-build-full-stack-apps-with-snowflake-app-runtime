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
import { createAction, DuplicateActionError, isoTimestamp, ValidationError } from "@/lib/actions"
export const dynamic = "force-dynamic"

const PAGE_SIZE = 25


export async function GET(req: Request) {
  try {
    const page = Math.max(1, parseInt(new URL(req.url).searchParams.get("page") ?? "1", 10) || 1)
    // page is a validated integer, so the LIMIT and OFFSET values are safe to inline.
    const [rows, kpi] = await Promise.all([
      querySnowflake(
        `SELECT ACTION_ID, CUSTOMER_KEY, ASSIGNED_TO, ACTION_TYPE, STATUS, NOTES, CREATED_BY,
                ${isoTimestamp("CREATED_AT")} AS CREATED_AT_ISO, ${isoTimestamp("UPDATED_AT")} AS UPDATED_AT_ISO
         FROM SFQUICKSTART_CHURNGUARD.PUBLIC.ACTIONS ORDER BY CREATED_AT DESC, ACTION_ID LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      ),
      querySnowflake(
        `SELECT COUNT(*) AS TOTAL,
                COUNT_IF(STATUS = 'New') AS NEW_COUNT,
                COUNT_IF(STATUS = 'In Progress') AS IN_PROGRESS,
                COUNT_IF(STATUS = 'Resolved') AS RESOLVED,
                COUNT_IF(ACTION_TYPE = 'Escalate' AND STATUS <> 'Resolved') AS OPEN_ESCALATIONS
         FROM SFQUICKSTART_CHURNGUARD.PUBLIC.ACTIONS`,
      ),
    ])
    const k = kpi[0]
    return Response.json({
      page,
      pageSize: PAGE_SIZE,
      summary: {
        total: Number(k.TOTAL), new: Number(k.NEW_COUNT), inProgress: Number(k.IN_PROGRESS),
        resolved: Number(k.RESOLVED), openEscalations: Number(k.OPEN_ESCALATIONS),
      },
      actions: rows.map((r) => ({
        id: String(r.ACTION_ID), customerKey: Number(r.CUSTOMER_KEY), assignedTo: r.ASSIGNED_TO,
        actionType: r.ACTION_TYPE, status: r.STATUS, notes: r.NOTES ?? "",
        createdAt: r.CREATED_AT_ISO, updatedAt: r.UPDATED_AT_ISO, createdBy: r.CREATED_BY,
      })),
    })
  } catch (e) {
    console.error(new Date().toISOString(), "[actions:get]", e)
    return Response.json({ error: e instanceof Error ? e.message : "Failed to load actions" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const id = await createAction(await req.json())
    return Response.json({ id }, { status: 201 })
  } catch (e) {
    if (e instanceof DuplicateActionError) {
      return Response.json({ error: e.message, existingActionId: e.existingActionId }, { status: 409 })
    }
    if (e instanceof ValidationError) return Response.json({ error: e.message }, { status: 400 })
    console.error(new Date().toISOString(), "[actions:post]", e)
    return Response.json({ error: e instanceof Error ? e.message : "Failed to create action" }, { status: 500 })
  }
}
