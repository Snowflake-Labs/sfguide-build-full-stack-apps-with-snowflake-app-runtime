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
import { ACTION_TYPES, createAction, isoTimestamp, ValidationError } from "@/lib/actions"
export const dynamic = "force-dynamic"

/**
 * Minimal MCP server (Streamable HTTP, stateless JSON responses).
 * Auth is enforced by Snowflake ingress, the same as every other /api route.
 */

const PROTOCOL_VERSION = "2025-06-18"
const STATUSES = ["New", "In Progress", "Resolved"]

const TOOLS = [
  {
    name: "flag_customer",
    description: "Flag a customer for retention by creating a retention action (written to the ACTIONS table).",
    inputSchema: {
      type: "object",
      properties: {
        customer_key: { type: "integer", description: "Customer key (C_CUSTOMER_SK)" },
        action_type: { type: "string", enum: ACTION_TYPES },
        assigned_to: { type: "string", description: "Assignee; defaults to 'MCP'" },
        notes: { type: "string" },
      },
      required: ["customer_key", "action_type"],
    },
  },
  {
    name: "list_actions",
    description: "List retention actions, newest first, optionally filtered by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: STATUSES },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
    },
  },
  {
    name: "get_customer_risk",
    description: "Get churn metrics and the playbook-recommended action for one customer.",
    inputSchema: {
      type: "object",
      properties: { customer_key: { type: "integer" } },
      required: ["customer_key"],
    },
  },
  {
    name: "get_churn_summary",
    description: "Get overall churn KPIs: total customers, high-risk count, churn rate, revenue at risk, average return rate.",
    inputSchema: { type: "object", properties: {} },
  },
]

type Args = Record<string, unknown>

async function callTool(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case "flag_customer": {
      const id = await createAction({
        customerKey: args.customer_key,
        actionType: args.action_type,
        assignedTo: args.assigned_to ?? "MCP",
        notes: args.notes ?? "",
      })
      return { action_id: id, status: "New" }
    }
    case "list_actions": {
      // limit is clamped to an integer from 1 to 100, so it's safe to inline.
      const limit = Math.min(100, Math.max(1, Math.trunc(Number(args.limit ?? 25)) || 25))
      const status = args.status == null ? null : String(args.status)
      if (status && !STATUSES.includes(status)) throw new ValidationError("Invalid status")
      return querySnowflake(
        `SELECT ACTION_ID, CUSTOMER_KEY, ASSIGNED_TO, ACTION_TYPE, STATUS, NOTES, ${isoTimestamp("CREATED_AT")} AS CREATED_AT_ISO
         FROM SFQUICKSTART_CHURNGUARD.PUBLIC.ACTIONS WHERE STATUS = COALESCE(?, STATUS) ORDER BY CREATED_AT DESC LIMIT ${limit}`,
        { binds: [status] },
      )
    }
    case "get_customer_risk": {
      const key = Number(args.customer_key)
      if (!Number.isInteger(key)) throw new ValidationError("customer_key must be an integer")
      const rows = await querySnowflake(
        `SELECT m.C_CUSTOMER_SK AS CUSTOMER_KEY, m.CD_CREDIT_RATING AS CREDIT_RATING, m.CHURN_RISK,
                m.TOTAL_ORDERS, m.TOTAL_SPEND, m.TOTAL_RETURNS, m.RETURN_RATE,
                r.RECOMMENDED_ACTION, r.REASON, r.HAS_OPEN_ACTION
         FROM SFQUICKSTART_CHURNGUARD.PUBLIC.CHURN_METRICS m
         LEFT JOIN SFQUICKSTART_CHURNGUARD.PUBLIC.CUSTOMER_RECOMMENDATIONS r ON r.CUSTOMER_KEY = m.C_CUSTOMER_SK
         WHERE m.C_CUSTOMER_SK = ?`,
        { binds: [key] },
      )
      if (!rows.length) throw new ValidationError(`Customer ${key} not found`)
      return rows[0]
    }
    case "get_churn_summary": {
      const rows = await querySnowflake(
        `SELECT COUNT(*) AS TOTAL_CUSTOMERS, COUNT_IF(CHURN_RISK = 'High') AS HIGH_RISK,
                COUNT_IF(CHURN_RISK = 'High') / NULLIF(COUNT(*), 0) AS CHURN_RATE,
                SUM(IFF(CHURN_RISK = 'High', TOTAL_SPEND, 0)) AS REVENUE_AT_RISK,
                AVG(RETURN_RATE) AS AVG_RETURN_RATE
         FROM SFQUICKSTART_CHURNGUARD.PUBLIC.CHURN_METRICS`,
      )
      return rows[0]
    }
    default:
      throw new UnknownTool(name)
  }
}

class UnknownTool extends Error {}

type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

function result(id: RpcRequest["id"], value: unknown) {
  return { jsonrpc: "2.0", id, result: value }
}
function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } }
}

async function handle(msg: RpcRequest) {
  const { id, method, params } = msg
  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "churnguard", version: "1.0.0" },
      })
    case "ping":
      return result(id, {})
    case "tools/list":
      return result(id, { tools: TOOLS })
    case "tools/call": {
      const name = String(params?.name ?? "")
      try {
        const out = await callTool(name, (params?.arguments as Args) ?? {})
        return result(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] })
      } catch (e) {
        if (e instanceof UnknownTool) return rpcError(id, -32602, `Unknown tool: ${name}`)
        if (!(e instanceof ValidationError)) console.error(new Date().toISOString(), "[mcp:tool]", name, e)
        return result(id, { isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : "Tool failed" }] })
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}

export async function POST(req: Request) {
  let body: RpcRequest | RpcRequest[]
  try {
    body = await req.json()
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), { status: 400 })
  }
  const batch = Array.isArray(body) ? body : [body]
  // Notifications (no id) get no response body.
  const requests = batch.filter((m) => m.id !== undefined && m.id !== null)
  const responses = await Promise.all(requests.map(handle))
  if (!responses.length) return new Response(null, { status: 202 })
  return Response.json(Array.isArray(body) ? responses : responses[0])
}

export async function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } })
}
