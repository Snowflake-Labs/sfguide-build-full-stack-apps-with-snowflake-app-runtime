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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, CheckCheck, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useChat } from "@/components/agent/chat-provider"
import { getProposals, PROPOSALS_KEY, type Proposal } from "@/lib/proposals"

const TYPE_STYLE: Record<string, string> = {
  Escalate: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Offer: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  Call: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  Email: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
}

async function setProposalStatus(id: number, status: "approved" | "dismissed", reason?: string) {
  const res = await fetch(`/api/proposals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reason }),
  })
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update proposal")
}

/**
 * Approve = create the action in ACTIONS via POST /api/actions, then mark the proposal approved.
 * If the customer already has an open action (409), the proposal is dismissed as a duplicate.
 */
async function approve(p: Proposal): Promise<"approved" | "duplicate"> {
  const res = await fetch("/api/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerKey: p.customerKey,
      actionType: p.actionType,
      assignedTo: "Retention team",
      notes: `Agent suggested (rule ${p.ruleId ?? "?"}): ${p.reason}`,
    }),
  })
  if (res.status === 409) {
    const { error } = await res.json().catch(() => ({ error: "already flagged" }))
    await setProposalStatus(p.id, "dismissed", error)
    return "duplicate"
  }
  if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create action")
  await setProposalStatus(p.id, "approved")
  return "approved"
}

export function SuggestedList() {
  const qc = useQueryClient()
  const { prefill } = useChat()
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set())
  const [notice, setNotice] = useState<string | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: PROPOSALS_KEY, queryFn: getProposals, refetchInterval: 30_000 })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: PROPOSALS_KEY })
    qc.invalidateQueries({ queryKey: ["actions"] })
  }
  const track = (ids: number[], on: boolean) =>
    setBusyIds((s) => { const n = new Set(s); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n })

  const one = useMutation({
    mutationFn: async ({ p, op }: { p: Proposal; op: "approve" | "dismiss" }) => {
      setNotice(null)
      track([p.id], true)
      try {
        if (op === "dismiss") await setProposalStatus(p.id, "dismissed")
        else if ((await approve(p)) === "duplicate") setNotice(`Customer ${p.customerKey} already has an open action; proposal dismissed.`)
      } finally { track([p.id], false) }
    },
    onSettled: refresh,
  })

  const all = useMutation({
    mutationFn: async (ps: Proposal[]) => {
      setNotice(null)
      track(ps.map((p) => p.id), true)
      const failures: string[] = []
      let duplicates = 0
      try {
        for (const p of ps) {
          try {
            if ((await approve(p)) === "duplicate") duplicates++
          } catch (e) { failures.push(`${p.customerKey}: ${e instanceof Error ? e.message : "failed"}`) }
        }
      } finally { track(ps.map((p) => p.id), false) }
      if (duplicates) setNotice(`Skipped ${duplicates} of ${ps.length}: those customers already have an open action.`)
      if (failures.length) throw new Error(`${failures.length} of ${ps.length} failed — ${failures.slice(0, 3).join("; ")}`)
    },
    onSettled: refresh,
  })

  const proposals = data ?? []
  const err = error ?? one.error ?? all.error

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Agent suggested</CardTitle>
          <CardDescription>Playbook proposals staged by the ChurnGuard agent. Approving creates a retention action.</CardDescription>
        </div>
        <Button
          onClick={() => all.mutate(proposals)}
          disabled={!proposals.length || all.isPending || one.isPending}
          title="Approve all pending proposals"
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          {all.isPending ? "Approving…" : `Approve All${proposals.length ? ` (${proposals.length})` : ""}`}
        </Button>
      </CardHeader>
      <CardContent>
        {err ? <p className="mb-3 text-sm text-red-600">{err.message}</p> : null}
        {notice ? <p className="mb-3 text-sm text-muted-foreground">{notice}</p> : null}
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : proposals.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No pending proposals. Ask the agent to “Flag high-risk customers for retention”.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {proposals.map((p) => {
              const busy = busyIds.has(p.id)
              return (
                <div key={p.id} className={`flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm transition-opacity ${busy ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Customer</div>
                      <div className="font-semibold tabular-nums">{p.customerKey}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_STYLE[p.actionType] ?? TYPE_STYLE.Email}`}>{p.actionType}</span>
                  </div>
                  <p className="flex-1 text-sm text-muted-foreground">
                    {p.ruleId != null && <span className="mr-1 font-medium text-foreground">Rule {p.ruleId}:</span>}
                    {p.reason}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={busy || all.isPending} onClick={() => one.mutate({ p, op: "approve" })}>
                      <Check className="h-4 w-4" aria-hidden="true" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy || all.isPending} onClick={() => one.mutate({ p, op: "dismiss" })}>
                      <X className="h-4 w-4" aria-hidden="true" /> Dismiss
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="ml-auto h-8 w-8"
                      title="Suggest next step"
                      aria-label={`Suggest next step for customer ${p.customerKey}`}
                      onClick={() => prefill(`The playbook proposes "${p.actionType}" for customer ${p.customerKey} (rule ${p.ruleId}: ${p.reason}). What's the best next step for this customer?`)}
                    >
                      <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
