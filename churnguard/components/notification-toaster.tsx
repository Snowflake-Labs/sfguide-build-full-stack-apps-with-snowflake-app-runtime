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
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Sparkles, X } from "lucide-react"
import { useChat } from "@/components/agent/chat-provider"
import { getProposals, PROPOSALS_KEY } from "@/lib/proposals"

type Notification = { id: string; message: string; severity: string }

async function getNotifications(): Promise<Notification[]> {
  const res = await fetch("/api/notifications")
  if (!res.ok) throw new Error("Failed to load notifications")
  return res.json()
}

const PROPOSALS_DISMISSED = "churnguard.proposalsToastDismissed"

export function NotificationToaster() {
  const { prefill } = useChat()
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: getNotifications, refetchInterval: 30_000, retry: false })
  const proposals = useQuery({ queryKey: PROPOSALS_KEY, queryFn: getProposals, refetchInterval: 60_000, retry: false })
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  // Pending-proposals toast shows once per page load (per browser session once dismissed).
  const [proposalsHidden, setProposalsHidden] = useState(true)
  useEffect(() => setProposalsHidden(sessionStorage.getItem(PROPOSALS_DISMISSED) === "1"), [])

  const dismiss = (id: string) => {
    setDismissed((d) => new Set(d).add(id))
    fetch(`/api/notifications/${id}/ack`, { method: "POST" }).catch(() => {})
  }
  const hideProposals = () => {
    setProposalsHidden(true)
    sessionStorage.setItem(PROPOSALS_DISMISSED, "1")
  }

  const visible = (data ?? []).filter((n) => !dismissed.has(n.id))
  const pending = proposals.data?.length ?? 0
  const showProposals = pending > 0 && !proposalsHidden
  if (!visible.length && !showProposals) return null

  return (
    <div className="fixed bottom-4 right-4 z-[55] flex w-80 flex-col gap-2" role="status" aria-live="polite">
      {showProposals && (
        <div className="flex items-start gap-3 rounded-lg border border-violet-300 bg-background p-3 shadow-lg dark:border-violet-800">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden="true" />
          <div className="flex-1 text-sm">
            <p>{pending} agent-suggested action{pending === 1 ? "" : "s"} pending review.</p>
            <Link href="/actions?tab=suggested" onClick={hideProposals} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
              Review proposals
            </Link>
          </div>
          <button type="button" aria-label="Dismiss" className="text-muted-foreground hover:text-foreground" onClick={hideProposals}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {visible.map((n) => (
        <div
          key={n.id}
          className={`flex items-start gap-3 rounded-lg border bg-background p-3 shadow-lg ${n.severity === "critical" ? "border-red-300" : "border-amber-300"}`}
        >
          <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${n.severity === "critical" ? "text-red-600" : "text-amber-600"}`} />
          <div className="flex-1 text-sm">
            <p>{n.message}</p>
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => prefill(`Escalation alert: "${n.message}". Which customers are involved, and what should we do next?`)}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" /> Ask ChurnGuard
            </button>
          </div>
          <button type="button" aria-label="Dismiss" className="text-muted-foreground hover:text-foreground" onClick={() => dismiss(n.id)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
