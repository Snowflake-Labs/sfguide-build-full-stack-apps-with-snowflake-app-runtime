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
      `SELECT NOTIFICATION_ID, MESSAGE, SEVERITY, CREATED_AT
       FROM SFQUICKSTART_CHURNGUARD.PUBLIC.NOTIFICATIONS
       WHERE ACKNOWLEDGED = ? AND CREATED_AT > DATEADD('hour', ?, CURRENT_TIMESTAMP())
       ORDER BY CREATED_AT DESC LIMIT 5`,
      { binds: [false, -24] },
    )
    return Response.json(
      (rows as Record<string, unknown>[]).map((r) => ({
        id: String(r.NOTIFICATION_ID), message: String(r.MESSAGE), severity: String(r.SEVERITY),
      })),
    )
  } catch (e) {
    console.error(new Date().toISOString(), "[notifications]", e)
    return Response.json({ error: e instanceof Error ? e.message : "Failed to load notifications" }, { status: 500 })
  }
}
