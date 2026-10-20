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

import { useQuery } from "@tanstack/react-query"
import { getProposals, PROPOSALS_KEY } from "@/lib/proposals"

/** Pending agent-suggested proposal count, shown next to the Action Board link. */
export function SuggestedBadge() {
  const { data } = useQuery({ queryKey: PROPOSALS_KEY, queryFn: getProposals, refetchInterval: 60_000, retry: false })
  const n = data?.length ?? 0
  if (!n) return null
  return (
    <span className="rounded-full bg-violet-100 px-1.5 text-[10px] font-semibold tabular-nums text-violet-700 dark:bg-violet-950 dark:text-violet-300" title={`${n} agent-suggested proposals pending`}>
      {n}
    </span>
  )
}
