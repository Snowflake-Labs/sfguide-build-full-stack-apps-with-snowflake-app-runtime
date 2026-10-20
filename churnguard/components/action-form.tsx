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
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

export const ACTION_TYPES = ["Call", "Email", "Offer", "Escalate"] as const

const field = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"

export function ActionForm({ customerId, onClose }: { customerId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [assignedTo, setAssignedTo] = useState("")
  const [actionType, setActionType] = useState<string>("Call")
  const [notes, setNotes] = useState("")

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerKey: customerId, assignedTo, actionType, notes }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Failed to create action")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["actions"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onClick={onClose}>
      <form
        className="flex h-full w-full max-w-md flex-col gap-4 border-l border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); create.mutate() }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Flag for retention</h2>
            <p className="text-sm text-muted-foreground">Customer {customerId}</p>
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label="Close" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <label className="space-y-1.5 text-sm font-medium">
          Assignee
          <input className={field} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="e.g. jane.doe" required autoFocus />
        </label>

        <label className="space-y-1.5 text-sm font-medium">
          Action type
          <select className={field} value={actionType} onChange={(e) => setActionType(e.target.value)}>
            {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="space-y-1.5 text-sm font-medium">
          Notes
          <textarea
            className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
          />
        </label>

        {create.error && <p className="text-sm text-red-600">{create.error.message}</p>}

        <div className="mt-auto flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending || !assignedTo.trim()}>{create.isPending ? "Saving…" : "Create action"}</Button>
        </div>
      </form>
    </div>
  )
}
