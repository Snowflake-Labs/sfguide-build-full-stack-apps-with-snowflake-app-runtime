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

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, CheckCircle2, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SuggestedList } from "@/components/agent/suggested-list"
import { useChat } from "@/components/agent/chat-provider"
import { getProposals, PROPOSALS_KEY } from "@/lib/proposals"

type Action = {
  id: string; customerKey: number; assignedTo: string; actionType: string
  status: string; notes: string; createdAt: string; updatedAt: string
}
type ActionsResponse = {
  page: number
  pageSize: number
  summary: { total: number; new: number; inProgress: number; resolved: number; openEscalations: number }
  actions: Action[]
}

const NEXT: Record<string, string> = { New: "In Progress", "In Progress": "Resolved", Resolved: "New" }
const STATUS_STYLE: Record<string, string> = {
  New: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "In Progress": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
}
const TYPE_STYLE: Record<string, string> = {
  Escalate: "text-red-600 font-semibold",
}
const NEXT_ICON: Record<string, typeof ArrowRight> = { New: ArrowRight, "In Progress": CheckCircle2, Resolved: RotateCcw }
const NEXT_LABEL: Record<string, string> = { New: "Start progress", "In Progress": "Mark resolved", Resolved: "Reopen" }

async function getActions(page: number): Promise<ActionsResponse> {
  const res = await fetch(`/api/actions?page=${page}`)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Request failed")
  return body
}

function Metric({ label, value, loading, tone }: { label: string; value?: number; loading: boolean; tone?: string }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        {loading ? <Skeleton className="h-8 w-16" /> : <CardTitle className={`text-3xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</CardTitle>}
      </CardHeader>
    </Card>
  )
}

export function ActionBoard({ initialTab = "all" }: { initialTab?: "all" | "suggested" }) {
  const qc = useQueryClient()
  const { prefill } = useChat()
  const [tab, setTab] = useState(initialTab)
  const [page, setPage] = useState(1)
  useEffect(() => setTab(initialTab), [initialTab])
  const proposals = useQuery({ queryKey: PROPOSALS_KEY, queryFn: getProposals, refetchInterval: 30_000, retry: false })
  const pending = proposals.data?.length ?? 0
  const selectTab = (t: "all" | "suggested") => {
    setTab(t)
    window.history.replaceState(null, "", t === "suggested" ? "/actions?tab=suggested" : "/actions")
  }
  const { data, isLoading, error } = useQuery({
    queryKey: ["actions", page],
    queryFn: () => getActions(page),
    refetchInterval: 15_000,
    placeholderData: (prev) => prev,
  })

  const advance = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/actions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update status")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["actions"] }),
  })

  const s = data?.summary
  const pageSize = data?.pageSize ?? 25
  const totalPages = s ? Math.max(1, Math.ceil(s.total / pageSize)) : 1
  const safePage = Math.min(page, totalPages)
  if (safePage !== page) setPage(safePage)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Metric label="Total actions" value={s?.total} loading={isLoading} />
        <Metric label="New" value={s?.new} loading={isLoading} />
        <Metric label="In progress" value={s?.inProgress} loading={isLoading} />
        <Metric label="Resolved" value={s?.resolved} loading={isLoading} />
        <Metric label="Open escalations" value={s?.openEscalations} loading={isLoading} tone={s && s.openEscalations > 0 ? "text-red-600" : ""} />
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit" role="tablist">
        <Button role="tab" aria-selected={tab === "all"} size="sm" variant={tab === "all" ? "default" : "ghost"} onClick={() => selectTab("all")}>
          All actions
        </Button>
        <Button role="tab" aria-selected={tab === "suggested"} size="sm" variant={tab === "suggested" ? "default" : "ghost"} onClick={() => selectTab("suggested")}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Agent Suggested
          {pending > 0 && (
            <span className="rounded-full bg-violet-100 px-1.5 text-[10px] font-semibold tabular-nums text-violet-700 dark:bg-violet-950 dark:text-violet-300">{pending}</span>
          )}
        </Button>
      </div>

      {tab === "suggested" ? <SuggestedList /> : (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Retention actions</CardTitle>
          <CardDescription>Click a status badge to move the task to the next stage.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
          {advance.error ? <p className="mb-2 text-sm text-red-600">{advance.error.message}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell></TableRow>)
                : data?.actions.length === 0
                  ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No actions yet. Flag a high-risk customer from the dashboard.</TableCell></TableRow>
                  : data?.actions.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium tabular-nums">{a.customerKey}</TableCell>
                        <TableCell className={TYPE_STYLE[a.actionType]}>{a.actionType}</TableCell>
                        <TableCell>{a.assignedTo}</TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">{a.notes}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            title={`Move to ${NEXT[a.status]}`}
                            disabled={advance.isPending}
                            onClick={() => advance.mutate({ id: a.id, status: NEXT[a.status] })}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 ${STATUS_STYLE[a.status]}`}
                          >
                            {a.status}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const Icon = NEXT_ICON[a.status]
                            return (
                              <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="Suggest next step"
                                aria-label={`Suggest next step for customer ${a.customerKey}`}
                                onClick={() => prefill(`Customer ${a.customerKey} has a "${a.actionType}" retention action in status "${a.status}"${a.notes ? ` (notes: ${a.notes})` : ""}. Suggest the next step.`)}
                              >
                                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                title={NEXT_LABEL[a.status]}
                                aria-label={`${NEXT_LABEL[a.status]} for customer ${a.customerKey}`}
                                disabled={advance.isPending}
                                onClick={() => advance.mutate({ id: a.id, status: NEXT[a.status] })}
                              >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              </div>
                            )
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {s && s.total > 0 ? `${((page - 1) * pageSize + 1).toLocaleString()}–${Math.min(page * pageSize, s.total).toLocaleString()} of ${s.total.toLocaleString()}` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="tabular-nums">Page {page} of {totalPages.toLocaleString()}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
