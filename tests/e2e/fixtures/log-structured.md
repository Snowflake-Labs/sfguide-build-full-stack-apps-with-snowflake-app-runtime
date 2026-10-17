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
# Fixture: log with JSON blocks, a retried stage and a BLOCKER

## STAGE: setup
### E2E checks
| check | result | evidence |
|-------|--------|----------|
| CHURN_METRICS ~30,000 rows | PASS | 30012 |
| Role can use the warehouse | PASS | USE WAREHOUSE ok |

### Friction
| step | what happened | severity | workaround | suggested guide/prompt fix |
|------|---------------|----------|------------|----------------------------|
| guide.md:146 | CLARITY: "quickstart role" and "SFQUICKSTART_CHURNGUARD_ROLE" both used | LOW | none | use the role name |

Flow verdict: reads naturally — each script says what it creates

  ```json e2e-checks
  [{"check": "CHURN_METRICS ~30,000 rows", "stage": "setup", "result": "PASS", "evidence": "30012"},
   {"check": "Role can use the warehouse", "stage": "setup", "result": "PASS", "evidence": "USE WAREHOUSE ok"}]
  ```
  ```json friction
  [{"step": "guide.md:146", "severity": "LOW", "kind": "clarity",
    "description": "CLARITY: two names for the role", "workaround": "none",
    "fix": "use the role name", "source": "guide.md:146"}]
  ```

## STAGE: iteration-1
### E2E checks
| check | result | evidence |
|-------|--------|----------|
| App service has a URL | FAIL | deploy failed |

```json e2e-checks
[{"check": "App service has a URL", "stage": "iteration-1", "result": "FAIL", "evidence": "deploy failed"}]
```
```json friction
[{"step": "guide.md:182", "severity": "BLOCKER", "kind": "step", "description": "deploy needs the default role",
  "workaround": "none", "fix": "say the default role must be set", "source": "guide.md:182"}]
```

## STAGE: iteration-1 (retry, 2026-10-15)
### E2E checks
| check | result | evidence |
|-------|--------|----------|
| App service has a URL | PASS | SUSPENDED, auto_resume true |
| Ingress is protected | PASS | 302 to login |

```json e2e-checks
[{"check": "App service has a URL", "stage": "iteration-1", "result": "PASS", "evidence": "SUSPENDED, auto_resume true"},
 {"check": "Ingress is protected", "stage": "iteration-1", "result": "PASS", "evidence": "302 to login"}]
```
```json friction
[{"step": "guide.md:182", "severity": "MEDIUM", "kind": "step", "description": "default role had to be set by hand",
  "workaround": "set role in connections.toml", "fix": "say the default role must be set", "source": "guide.md:182"}]
```

## STAGE: iteration-3
### E2E checks
| check | result | evidence |
|-------|--------|----------|
| Semantic view and agent exist | PASS | SHOW AGENTS |
| Generic MCP client | LIMITATION | 302 to login |
| MCP via Cortex Code | SKIPPED | needs a browser sign-in |

### Friction
| step | what happened | severity | workaround | suggested guide/prompt fix |
|------|---------------|----------|------------|----------------------------|
| guide.md:485 | ORDER: iteration-3-setup.sql uses the Cortex grant before grants.sql is rerun | BLOCKER | reran grants.sql | rerun grants first and say why |

Flow verdict: partly — the jump from setup to the prompts has no bridge

### Consistency review
| aspect | setup | iteration-1 | iteration-2 | iteration-3 | consistent? |
|--------|-------|-------------|-------------|-------------|-------------|
| Verify position | n/a | before Key Concepts | after | after | no |

```json e2e-checks
[{"check": "Semantic view and agent exist", "stage": "iteration-3", "result": "PASS", "evidence": "SHOW AGENTS"},
 {"check": "Generic MCP client", "stage": "iteration-3", "result": "LIMITATION", "evidence": "302 to login"},
 {"check": "MCP via Cortex Code", "stage": "iteration-3", "result": "SKIPPED", "evidence": "needs a browser sign-in"}]
```
```json friction
[{"step": "guide.md:485", "severity": "BLOCKER", "kind": "order", "description": "ORDER: Cortex grant used before grants.sql is rerun",
  "workaround": "reran grants.sql", "fix": "rerun grants first and say why", "source": "guide.md:485"},
 {"step": "guide.md:500", "severity": "MEDIUM", "kind": "flow", "description": "FLOW: no bridge from setup to the prompts",
  "workaround": "none", "fix": "add one sentence on what the prompts build on", "source": "guide.md:500"},
 {"step": "guide.md:287", "severity": "LOW", "kind": "consistency", "description": "CONSISTENCY: Verify comes before Key Concepts only in iteration 1",
  "workaround": "none", "fix": "put Verify after Key Concepts in iteration 1", "source": "guide.md:287"}]
```
