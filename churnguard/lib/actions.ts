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
import { randomUUID } from "node:crypto"
import { querySnowflake } from "@/lib/snowflake"

export const ACTION_TYPES = ["Call", "Email", "Offer", "Escalate"]

export type NewAction = { customerKey: unknown; assignedTo: unknown; actionType: unknown; notes?: unknown }

/** Validates and inserts a retention action into ACTIONS. Throws ValidationError on bad input. */
export class ValidationError extends Error {}

/** The customer already has an open (not Resolved) action; at most one is allowed. */
export class DuplicateActionError extends ValidationError {
  constructor(readonly existingActionId: string) {
    super(`already flagged: ${existingActionId}`)
  }
}

/** Renders a TIMESTAMP_LTZ column as an ISO 8601 string the browser can parse. */
export function isoTimestamp(column: string): string {
  return `TO_VARCHAR(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')`
}

async function openActionId(customerKey: number): Promise<string | null> {
  const rows = await querySnowflake(
    `SELECT ACTION_ID FROM SFQUICKSTART_CHURNGUARD.PUBLIC.ACTIONS WHERE CUSTOMER_KEY = ? AND STATUS <> 'Resolved' ORDER BY CREATED_AT LIMIT 1`,
    { binds: [customerKey] },
  )
  return rows[0] ? String(rows[0].ACTION_ID) : null
}

export async function createAction(input: NewAction): Promise<string> {
  const customerKey = Number(input.customerKey)
  const assignedTo = String(input.assignedTo ?? "").trim().slice(0, 200)
  const actionType = String(input.actionType ?? "")
  const notes = String(input.notes ?? "").slice(0, 2000)
  if (!Number.isInteger(customerKey)) throw new ValidationError("customerKey must be an integer")
  if (!assignedTo) throw new ValidationError("Assignee is required")
  if (!ACTION_TYPES.includes(actionType)) throw new ValidationError("Invalid action type")

  // Standard tables don't enforce unique constraints, so one MERGE both checks for an
  // open action and inserts: when the customer already has one, it inserts nothing.
  const id = randomUUID()
  const rows = await querySnowflake(
    `MERGE INTO SFQUICKSTART_CHURNGUARD.PUBLIC.ACTIONS t
     USING (SELECT ? AS ACTION_ID, ? AS CUSTOMER_KEY, ? AS ASSIGNED_TO, ? AS ACTION_TYPE, ? AS NOTES) s
       ON t.CUSTOMER_KEY = s.CUSTOMER_KEY AND t.STATUS <> 'Resolved'
     WHEN NOT MATCHED THEN
       INSERT (ACTION_ID, CUSTOMER_KEY, ASSIGNED_TO, ACTION_TYPE, NOTES)
       VALUES (s.ACTION_ID, s.CUSTOMER_KEY, s.ASSIGNED_TO, s.ACTION_TYPE, s.NOTES)`,
    { binds: [id, customerKey, assignedTo, actionType, notes] },
  )
  if (Number(rows[0]?.["number of rows inserted"] ?? 0) > 0) return id
  const existing = await openActionId(customerKey)
  if (existing) throw new DuplicateActionError(existing)
  throw new Error("The action was not created")
}
