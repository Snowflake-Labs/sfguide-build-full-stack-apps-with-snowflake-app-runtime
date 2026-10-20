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
import type { TableData } from "@/components/agent/chat-provider"

function fmt(v: unknown): string {
  if (v == null) return "—"
  const n = typeof v === "number" ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null
  if (n == null) return String(v)
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function AgentTable({ title, data }: { title?: string; data: TableData }) {
  if (!data.columns.length) return null
  return (
    <div className="overflow-hidden rounded-md border">
      {title && <div className="border-b bg-muted/50 px-3 py-1.5 text-xs font-medium">{title}</div>}
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>{data.columns.map((c) => <th key={c} className="px-3 py-1.5 text-left font-medium text-muted-foreground">{c}</th>)}</tr>
          </thead>
          <tbody>
            {data.rows.slice(0, 100).map((r, i) => (
              <tr key={i} className="border-t">
                {r.map((v, j) => <td key={j} className="px-3 py-1.5 tabular-nums">{fmt(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.rows.length > 100 && <div className="border-t px-3 py-1 text-xs text-muted-foreground">Showing 100 of {data.rows.length} rows</div>}
    </div>
  )
}
