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
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Flag, Sparkles } from "lucide-react"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartTooltip, formatTick, getYAxisWidth } from "@/components/chart-utils"
import { ActionForm } from "@/components/action-form"
import { useChat } from "@/components/agent/chat-provider"

const RISK_COLORS: Record<string, string> = { High: "#E5484D", Medium: "#F5A524", Low: "#2FA66A" }
const RISK_BADGE: Record<string, string> = {
  High: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Request failed")
  return body as T
}

type Summary = { totalCustomers: number; highRisk: number; churnRate: number; revenueAtRisk: number; avgReturnRate: number }
type Segment = { segment: string; High: number; Medium: number; Low: number }
type Trend = { month: string; active: number; churning: number }
type Customer = { id: number; rating: string; orders: number; spend: number; returns: number; returnAmt: number; returnRate: number; risk: string }
type CustomerPage = { total: number; page: number; pageSize: number; rows: Customer[] }

const DIMS = [
  { key: "credit", label: "Credit rating" },
  { key: "marital", label: "Marital status" },
  { key: "education", label: "Education level" },
  { key: "gender", label: "Gender" },
]

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

function ErrorNote({ error }: { error: unknown }) {
  return <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Failed to load"}</p>
}

function Kpi({ label, value, hint, loading, error, action }: { label: string; value?: string; hint?: string; loading: boolean; error: unknown; action?: React.ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          {action}
        </div>
        {loading ? <Skeleton className="h-8 w-32" /> : error ? <ErrorNote error={error} /> : (
          <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
        )}
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  )
}

export function Dashboard() {
  const { prefill } = useChat()
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => getJson<Summary>("/api/summary") })
  const [dim, setDim] = useState("credit")
  const [segment, setSegment] = useState<string | null>(null)
  const dimLabel = DIMS.find((d) => d.key === dim)!.label
  const segments = useQuery({
    queryKey: ["segments", dim],
    queryFn: () => getJson<Segment[]>(`/api/segments?dim=${dim}`),
    placeholderData: (prev) => prev,
  })
  const trends = useQuery({ queryKey: ["trends"], queryFn: () => getJson<Trend[]>("/api/trends") })

  const [risk, setRisk] = useState("All")
  const [page, setPage] = useState(1)
  const [flagging, setFlagging] = useState<number | null>(null)
  const customers = useQuery({
    queryKey: ["customers", risk, page, dim, segment],
    queryFn: () =>
      getJson<CustomerPage>(
        `/api/customers?risk=${risk}&page=${page}&dim=${dim}${segment ? `&segment=${encodeURIComponent(segment)}` : ""}`,
      ),
    placeholderData: (prev) => prev,
  })

  const drill = (seg: string, level: string) => { setSegment(seg); setRisk(level); setPage(1) }
  const clearFilter = () => { setSegment(null); setRisk("All"); setPage(1) }
  const changeDim = (k: string) => { setDim(k); setSegment(null); setRisk("All"); setPage(1) }

  const s = summary.data
  const totalPages = customers.data ? Math.max(1, Math.ceil(customers.data.total / customers.data.pageSize)) : 1

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total customers" value={s?.totalCustomers.toLocaleString()} hint="All profiled customers" loading={summary.isLoading} error={summary.error} />
        <Kpi label="Churn rate" value={s ? `${(s.churnRate * 100).toFixed(1)}%` : undefined} hint={s ? `${s.highRisk.toLocaleString()} high-risk customers` : ""} loading={summary.isLoading} error={summary.error}
          action={s && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" title="Ask the agent why customers are high risk"
              onClick={() => prefill(`${s.highRisk.toLocaleString()} of ${s.totalCustomers.toLocaleString()} customers (${(s.churnRate * 100).toFixed(1)}%) are high churn risk. Why? What drives high risk, and what does the playbook recommend?`)}>
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Why?
            </Button>
          )} />
        <Kpi label="Revenue at risk" value={s ? money(s.revenueAtRisk) : undefined} hint="Lifetime spend of high-risk customers" loading={summary.isLoading} error={summary.error} />
        <Kpi label="Avg return rate" value={s ? `${s.avgReturnRate.toFixed(1)}%` : undefined} hint="Mean across all customers" loading={summary.isLoading} error={summary.error} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Churn risk by {dimLabel.toLowerCase()}</CardTitle>
              <CardDescription>Customer count per risk level. Click a bar to filter the table.</CardDescription>
            </div>
            <select
              aria-label="Group by"
              value={dim}
              onChange={(e) => changeDim(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              {DIMS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </CardHeader>
          <CardContent className="h-80">
            {segments.isLoading ? <Skeleton className="h-full w-full" /> : segments.error ? <ErrorNote error={segments.error} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={segments.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="segment" tick={{ fontSize: 12 }} />
                  <YAxis width={getYAxisWidth(segments.data ?? [], "High")} tickFormatter={formatTick} tick={{ fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
                  <Legend />
                  {["High", "Medium", "Low"].map((k) => (
                    <Bar
                      key={k}
                      dataKey={k}
                      fill={RISK_COLORS[k]}
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(d: { payload?: Segment }) => d.payload && drill(d.payload.segment, k)}
                    >
                      {(segments.data ?? []).map((d) => (
                        <Cell key={d.segment} fill={RISK_COLORS[k]} fillOpacity={segment && (segment !== d.segment || risk !== k) ? 0.3 : 1} />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Active vs churning customers</CardTitle>
            <CardDescription>Monthly trend</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {trends.isLoading ? <Skeleton className="h-full w-full" /> : trends.error ? <ErrorNote error={trends.error} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis width={getYAxisWidth(trends.data ?? [], "active")} tickFormatter={formatTick} tick={{ fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="active" name="Active" stroke="#1E7BC4" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="churning" name="Churning" stroke="#E5484D" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Customer details</CardTitle>
            <CardDescription>Sorted by return rate, highest first</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          {segment && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">{dimLabel}: {segment}</Badge>
              <Button size="sm" variant="outline" title="Explain this segment"
                onClick={() => {
                  const row = segments.data?.find((d) => d.segment === segment)
                  const counts = row ? ` (High ${row.High.toLocaleString()}, Medium ${row.Medium.toLocaleString()}, Low ${row.Low.toLocaleString()})` : ""
                  prefill(`Explain the ${dimLabel.toLowerCase()} = "${segment}" segment${counts}. Focus on ${risk === "All" ? "all risk levels" : `${risk.toLowerCase()} risk customers`}: what's driving churn and what should we do?`)
                }}>
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Explain this segment
              </Button>
              <Button size="sm" variant="outline" onClick={clearFilter}>Clear filter</Button>
            </div>
          )}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {["All", "High", "Medium", "Low"].map((r) => (
              <Button key={r} size="sm" variant={risk === r ? "default" : "ghost"} onClick={() => { setRisk(r); setPage(1) }}>
                {r}
              </Button>
            ))}
          </div>
          </div>
        </CardHeader>
        <CardContent>
          {customers.error ? <ErrorNote error={customers.error} /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Credit rating</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total spend</TableHead>
                  <TableHead className="text-right">Returns</TableHead>
                  <TableHead className="text-right">Return amount</TableHead>
                  <TableHead className="text-right">Return rate</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.isLoading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                    ))
                  : customers.data?.rows.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium tabular-nums">{c.id}</TableCell>
                        <TableCell>{c.rating}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.orders.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(c.spend)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.returns.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(c.returnAmt)}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.returnRate.toFixed(1)}%</TableCell>
                        <TableCell><Badge variant="secondary" className={RISK_BADGE[c.risk]}>{c.risk}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Ask about this customer"
                            aria-label={`Ask about customer ${c.id}`}
                            onClick={() => prefill(`Tell me about customer ${c.id} (${c.rating} credit, ${c.risk} churn risk, ${money(c.spend)} spend, ${c.returnRate.toFixed(1)}% return rate). What does the playbook recommend, and do they already have an open action?`)}
                          >
                            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                          </Button>
                          {c.risk === "High" && (
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              title="Flag for Retention"
                              aria-label={`Flag customer ${c.id} for retention`}
                              onClick={() => setFlagging(c.id)}
                            >
                              <Flag className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {customers.data ? `${((page - 1) * 10 + 1).toLocaleString()}–${Math.min(page * 10, customers.data.total).toLocaleString()} of ${customers.data.total.toLocaleString()}` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="tabular-nums">Page {page} of {totalPages.toLocaleString()}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {flagging !== null && <ActionForm customerId={flagging} onClose={() => setFlagging(null)} />}
    </div>
  )
}
