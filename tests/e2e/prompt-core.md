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
## Goal
Complete the guide "${GUIDE_TITLE}" end to end as a learner would, following ${GUIDE_URL},
and record every friction point. Also judge whether the guide reads naturally, runs its steps in a
sensible order, and keeps similar sections consistent.

Guide source: follow the steps from ${GUIDE_URL}, as a learner would.
Markdown source of the same guide: ${GUIDE_MD_PATH} (`none` = not provided). When provided, use it
for the reviews below and cite `guide.md:<line>` in findings; if it disagrees with the rendered
guide in a way that changes a step, log that as friction. When not provided, review the rendered
guide and cite section headings.

The "Stage file" at the end of this prompt is specific to this guide: its object prefixes, roles,
extra guardrails, and the E2E checks for each stage. Where it is more specific than this prompt,
it wins.

## Requirements
1. Work only in the current working directory: ${WORKSPACE}.
2. Follow the guide in order, through the stages listed in the stage file, using the guide's own
   git flow (if any) and any prompt files exactly as the guide says.
3. Use the roles and connection rules in the stage file. Connection: ${SNOWFLAKE_CONNECTION}. Wherever
   the guide names another connection, use ${SNOWFLAKE_CONNECTION} and log it as a deviation only if
   the names differ.
4. This run covers ONE stage, given at the end of this prompt as "STAGE: <name>".
   - First, append a "Plan" summary to the log: what the guide says this stage builds, the Snowflake
     objects it will create, and the files it will touch.
   - Then do the stage. After each Snowflake object is created (or each step fails), immediately append a
     one-line "Progress" entry to the log (time, object/step, OK/FAILED + error code). Runs can be cut off
     and resumed; the log is the only memory a resumed run has.
   - Then run the stage's E2E checks and append a "Result" summary: what was built, objects created
     (verified with SHOW ... LIKE), app URL if deployed, and any deviations from the guide.
   - Then STOP. Do not start the next stage.
5. Before starting, read the existing log (if any) to understand what earlier stages did. If the log shows
   the stage is already complete, only re-verify state with SHOW and stop.

## Constraints
- The account may be shared. Only touch objects matching the prefixes in the stage file. Never modify
  or drop anything else.
- Don't fix the guide or the repo while running. Do what a learner would do; if you have to improvise,
  log it.
- Don't skip verification steps the guide includes.

## Ambiguity detection
While following the guide, flag any instruction that is ambiguous, incomplete, or assumes knowledge
the guide hasn't provided. Specifically watch for:
- Commands where you have to guess a value (database name, role, warehouse) that the guide didn't
  explicitly state
- Steps that say "run this" but don't say which role or connection to use
- Steps where the order matters but the guide doesn't make that clear
- References to UI actions that can't be done via CLI (and vice versa)
- Missing prerequisites (e.g. "install X" without saying how)
- Files, scripts or code the guide uses but doesn't give in full or link to (e.g. "run setup.sql"
  with no file or link, or a long program shown only in fragments). Note how much the learner had
  to copy or retype; it tells the maintainer whether the guide needs a companion repo.

Log each as a row in the Friction table with what happened = "AMBIGUITY: <what was unclear>" and
your best-guess interpretation.

## Flow and clarity review (every stage)
A step can work and still read badly. While following the guide and any prompt files, log these as
Friction rows, prefixed by kind:
- ORDER: before running a guide script or prompt, confirm the objects, roles and grants it uses
  were created by an earlier step (the stage file may list the expected order). Flag a step that
  depends on something done later or never stated, and an order that matters without the guide
  saying so and why.
- FLOW: a section that doesn't connect to what was just built, an abrupt jump, a step that says
  what to do but not why or what the learner has afterwards, or a step with no success signal
  (expected output) to tell it worked.
- CLARITY: the same thing under different names (product, object or role names), jargon or acronyms
  used before they are explained, prompt-file wording that doesn't match the guide, forced or
  marketing terms where plain words would do, or a wall of text that hides the action.
Severity is usually MEDIUM or LOW; use HIGH or BLOCKER only if it made you improvise or caused a
failure. End each stage's Friction section with one line:
`Flow verdict: reads naturally | partly | no — <reason>`.

## Consistency review (once, at the end of the last stage)
Once the whole guide has been read, compare its parallel sections (the stage file names them; if it
doesn't, use the guide's repeated `##` sections, such as iterations, modules or labs). Use the
markdown source's `##`/`###` outline and code blocks when it is available. Compare:
- headings: which exist, their order, their names
- step style: numbered "Step N" labels or not, code-block comments, connection and role flags
- the repeated pattern each parallel section follows, and whether any difference is explained
- Verify sections: do they check the same kind of thing at a similar depth
Write a `### Consistency review` table | aspect | <one column per parallel section> | consistent? |,
and log each mismatch as a Friction row prefixed CONSISTENCY:, with the form to standardize on as the
suggested fix.

## Guardrails (non-interactive run: you cannot ask anyone)
- STOP the run and write the reason under "Blocked" in the log if:
  - a step fails twice in a row (no retry loops)
  - a step needs a privilege, object, or name the guide doesn't mention
  - you're about to run any SQL with ACCOUNTADMIN that isn't in a guide-listed script
- Never run DROP (the harness runs the guide's cleanup after the run).
- Never: git push, git commit, edit ~/.snowflake/connections.toml or config.toml, or CREATE/ALTER
  account-level objects the guide doesn't list (users, account network policies, resource monitors,
  warehouses).
- Run long commands (builds, installs, deploys) in the FOREGROUND. Never background them with
  `&`/nohup (the harness kills background children when a tool call returns), and never wait on a file
  marker or poll in a loop without a hard timeout (max 15 minutes). If a command times out, check the
  real state with SHOW before retrying.
- Never write secrets (passwords, tokens, private key paths, IP addresses) into the log or any file;
  write <redacted>.
- Do not create users, PATs, secrets, or OAuth integrations to make a check pass.

## E2E checks (run after the stage's work, before the Result summary)
Treat the stage file's checks as automated acceptance tests. Each check's result is exactly one of
PASS, FAIL, SKIPPED or LIMITATION, with evidence (the command run and a short, secret-free excerpt of
its output). A FAIL is a finding, not a reason to stop or "fix" the app: record it and move on to the
next check. SKIPPED needs a reason (e.g. "needs SSO browser session"). LIMITATION is only for the
documented limitations the stage file lists.

## Output
Append to work/coco-run-log.md (create it if missing), one section per stage, headed `## STAGE: <name>`:
- Plan
- Progress
- Result
- E2E checks: a table | check | result | evidence |
- Friction: a table | step | what happened | severity | workaround | suggested guide/prompt fix |
  where severity is one of:
  - BLOCKER: learner cannot proceed without external help or undocumented knowledge
  - HIGH: learner has to improvise significantly or search outside the guide
  - MEDIUM: confusing but recoverable with re-reading or minor experimentation
  - LOW: cosmetic or minor annoyance
  In "step", cite where the friction is: `guide.md:<line>` when the markdown source is available,
  `<prompt file>:<line>`, or else the guide section heading.
- Blocked (only if the run stopped early)
After each stage's tables, ALSO append two machine-readable blocks with the same rows, so the
harness doesn't depend on table formatting. Use exactly these fences and keys (JSON arrays, `[]`
when empty; no secrets):
  ```json e2e-checks
  [{"check": "...", "stage": "...", "result": "PASS|FAIL|SKIPPED|LIMITATION", "evidence": "..."}]
  ```
  ```json friction
  [{"step": "...", "severity": "BLOCKER|HIGH|MEDIUM|LOW",
    "kind": "step|ambiguity|order|flow|clarity|consistency", "description": "...",
    "workaround": "...", "fix": "...", "source": "guide.md:<line> | <prompt file>:<line> | <heading>"}]
  ```
If a stage is resumed or retried, write a fresh, complete pair of blocks for it (the last pair of
a stage wins).
At the end of the last stage (or whenever you stop), also add:
- "Top fixes": sorted by severity (BLOCKER first), then by how early in the guide the friction
  occurs.
- "Objects created": every object with its current state (running / suspended).

Also maintain work/cleanup.md (create it if missing; update it at the end of every stage). Write the
statements only, NEVER execute them:
- A table: | object | type | created in stage | owner role | still exists (verified via SHOW) |
  Include objects created implicitly (e.g. mirror target databases, integrations, secrets, network
  rules, artifact repositories).
- A single ```sql block, in safe drop order (dependents first; the stage file may give the order),
  using IF EXISTS and the correct USE ROLE before each group.
- A "Not covered by the guide's cleanup" list: objects in the table that the guide's cleanup script
  would not drop.

## Stage file
