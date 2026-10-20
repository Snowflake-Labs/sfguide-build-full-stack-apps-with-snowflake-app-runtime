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
import { ActionBoard } from "@/components/action-board"

export const dynamic = "force-dynamic"

export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Action board</h1>
        <p className="text-sm text-muted-foreground">Track retention tasks from flagged to resolved.</p>
      </div>
      <ActionBoard initialTab={tab === "suggested" ? "suggested" : "all"} />
    </main>
  )
}
