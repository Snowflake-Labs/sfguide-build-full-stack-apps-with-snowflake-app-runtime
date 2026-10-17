<!--
  Copyright 2026 Snowflake Inc.
  SPDX-License-Identifier: Apache-2.0
  
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
  
      http://www.apache.org/licenses/LICENSE-2.0
  
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->
# Fixture: clean log, plus a malformed JSON block that must fall back to the table

## STAGE: setup
### E2E checks
| check | result | evidence |
|-------|--------|----------|
| CHURN_METRICS ~30,000 rows | PASS | 30012 |

```json e2e-checks
[{"check": "CHURN_METRICS ~30,000 rows", "stage": "setup", "result": "PASS", "evidence": "30012"}]
```
```json friction
[]
```

## STAGE: iteration-1
### E2E checks
| check | result | evidence |
|-------|--------|----------|
| `npm run build` succeeds | PASS | exit 0 |
| Ingress is protected | PASS | 302 to login |

```json e2e-checks
[{"check": "npm run build succeeds", "result": "PASS", "evidence": "exit 0"},
```
```json friction
[{"step": "guide.md:300", "severity": "HIGH", "kind": "flow", "description": "FLOW: no success signal after deploy",
  "workaround": "checked SHOW APPLICATION SERVICES", "fix": "show the expected deploy output", "source": "guide.md:300"}]
```
