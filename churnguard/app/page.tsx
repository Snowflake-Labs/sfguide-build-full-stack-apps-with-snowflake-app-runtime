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
import { Dashboard } from "@/components/dashboard"

export const dynamic = "force-dynamic"

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Customer churn risk</h1>
        <p className="text-sm text-muted-foreground">
          Identify and prioritize at-risk customers across credit-rating segments.
        </p>
      </div>
      <Dashboard />
    </main>
  )
}
