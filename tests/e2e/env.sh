#!/usr/bin/env bash

# Copyright 2026 Snowflake Inc.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# Sourced by run-stage.sh and run-all.sh. Loads tests/e2e/.env.test (git-ignored)
# for local runs. Variables already set in the environment win, so CI's
# workflow env and one-off overrides (GUIDE_URL=... run-all.sh) still apply.
# Copy .env.test.example to .env.test to start.

ENV_FILE="${E2E_ENV_FILE:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.env.test}"
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}" val="${BASH_REMATCH[2]}"
    val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
    [[ -z "${!key+x}" ]] && export "$key=$val"
  done < "$ENV_FILE"
fi
