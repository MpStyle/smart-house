---
name: mp-smart-home-workflow
description: "Only when the user explicitly invokes /mp-smart-home-workflow: turn unchecked TODO.md entries into English GitHub issues, interview with grill-me, implement sequentially, test, commit, push, open PRs and merge after successful checks. Never invoke automatically."
user-invocable: true
disable-model-invocation: true
---

# Smart home TODO workflow

## Invocation and authorization

Run only when the user explicitly invokes `/mp-smart-home-workflow`. A request
to inspect, explain, edit or create this skill is not an invocation. Never start
because TODO.md changed, another skill suggested it, or a task seems relevant.
If loaded without an explicit invocation, stop without side effects.

An explicit invocation authorizes issue and branch creation, implementation,
commits, pushes to origin, PR creation and conditional automatic merge for the
selected TODO entries. It also authorizes invoking `grill-me` for each entry.
It does not authorize bypassing repository protections, changing permissions,
force-pushing, destructive Git operations or modifying unrelated work.
Respect tool permission prompts and higher-priority instructions; this skill
does not grant permissions that the host or repository withholds.

If the host has already injected this skill through the slash command, use
these instructions directly; do not perform a redundant skill lookup.
Keep explicit-only metadata enabled even on hosts with compatibility problems.
Report an invocation failure rather than enabling implicit invocation.

## Preflight

1. Read applicable repository instructions and root `TODO.md`. Select only
   unchecked Markdown task entries (`[ ]`), in file order; never process
   checked entries (`[x]` or `[X]`), checkbox examples in code blocks or headings.
   Keep each entry's heading, description and supporting context. Nested
   checkboxes are separate entries; clarify overlapping scope with the user
   rather than silently combining or omitting them.
2. If there are no unchecked entries, report that there is no work and stop.
   Do not create issues, branches, commits or PRs.
3. Require a clean checkout, including staged and untracked files. If dirty,
   stop and report the paths. Never stash, reset, clean, discard changes or
   include unrelated work to make the checkout usable.
4. Resolve origin's actual GitHub repository and default branch; do not assume
   the checkout's branch, hard-code this repository or silently use another
   remote. Verify authentication and permissions for issues, push and PRs.
   Read issue/PR templates, CI configuration and documented test commands.
5. Verify that `grill-me` and its dependency `grilling` are available. They
   may be personal skills; they are not bundled here. If missing, stop and
   request their installation. Do not replace the interview with guesses.
6. Fetch origin and switch to its default branch without discarding changes.
   Create a local tracking branch if absent; otherwise require that the local
   default branch is equal to or behind origin and update with fast-forward
   only. Stop on local-only commits, divergence, errors or conflicting work.

## Process one entry at a time

Finish and verify the merge of the current entry before starting the next.
Re-read TODO.md on the updated default branch between entries. Do not expand
the invocation to new entries added after preflight; if an original entry was
removed, changed ambiguously or already completed, report it and reconcile
before taking action. On any blocker, stop the sequence and preserve progress.

### 1. Find or create the issue

- Reuse an explicit issue link already attached to the entry after verifying
  its repository and scope. A closed issue with an unchecked entry, multiple
  possible matches or a conflicting association requires a user decision.
- For an entry without an issue link, compute a stable SHA-256 identifier from
  its heading path, a newline and the original task text (excluding the checkbox
  and workflow-added links). Store the identifier in the issue and PR bodies:
  `<!-- mp-smart-home-workflow:todo:<sha256> -->`.
  Search existing open and closed issues/PRs and verify the exact marker before
  creating anything. This recovers issues created before a local commit.
  Duplicate identical entries require clarification, not duplicate creation.
- Never assume a failed or timed-out create request created nothing. Check
  remote state for the marker before retrying.
- Create an English title and body that faithfully describe the entry, not
  an invented larger feature. Preserve every applicable issue-template section
  (render issue-form fields as headings), and include the source heading,
  original TODO text and marker. Include testable acceptance scenarios:

  ```markdown
  ## Acceptance criteria

  ### Scenario: <observable behavior>
  GIVEN <initial state and relevant preconditions>
  WHEN <action or event>
  THEN <observable expected result>
  AND <additional expected result, if needed>
  ```

  Use multiple scenarios for distinct outcomes and important error cases.
  Keep explanatory prose and scenarios in English even if TODO.md is not.
- Use the host's dedicated issue-creation tool when required. Otherwise use
  available GitHub tooling. Follow repository/host rules for external writes.
  Record the returned issue number and URL before continuing.

### 2. Branch and interview

- Use `issue-<number>-<short-english-slug>`, based on the updated origin default
  branch. Reuse an existing matching branch and PR only after verifying their
  issue, base and changes. Do not overwrite an existing branch or fork work
  into an unrelated session. Stop for stale or conflicting branch state.
- Invoke `grill-me` explicitly on behalf of this authorized workflow, passing
  the TODO context, issue and relevant repository facts.
- Interview for this issue even if an earlier issue was already clarified.
  Wait for the user's explicit confirmation of the agreed requirements before
  implementing. If resuming, reuse an explicitly confirmed agreement only when
  it is available in context and still matches the issue and code.
- Update the English issue scenarios to reflect the confirmed agreement before
  implementation. Clarify dependencies and scope changes instead of silently
  adding work or proceeding in an impossible order.

### 3. Implement and test before publishing

- Make the smallest complete implementation of the confirmed scenarios,
  following repository patterns and updating directly related documentation.
  Add or update unit tests for changed behavior and relevant error cases.
- On this same branch, change only the matching TODO checkbox to `[x]` and
  append its GitHub issue link, preserving the task text and surrounding entries.
  Example: `- [x] Allow room renaming ([#123](https://github.com/owner/repo/issues/123))`.
  The default branch must remain unchecked until the PR merges.
- Before **every commit**, run the relevant existing unit-test suites, including
  the new tests, against the final changes being committed. Require a successful
  run with actual tests executed: missing, skipped, failing or unexecuted tests
  are not green. Also run applicable build, type, lint and other project checks.
- If unit tests are absent, add the necessary tests using existing tooling.
  If infrastructure is missing, stop to agree on it with the user. If the
  change has no executable behavior (for example, documentation only), require
  an explicit user exemption for that case; never infer an exemption.
- On failures, stop and report the cause; do not commit, push or start the next
  entry. Resume only after fixing the current issue and rerunning checks.
- Inspect and stage only the intended changes. Write English commit messages
  with `Refs #<number>` in every commit and any repository-required trailers.
  If hooks modify code after validation, rerun the checks before committing.
- Before **every push**, rerun the unit tests on the exact committed code to be
  pushed. Push only the issue branch to origin with upstream tracking; never
  push the default branch or force-push. Any later fix repeats both test gates.

### 4. Open the PR and merge only when safe

- Reuse the matching open PR if present; otherwise open a PR targeting origin's
  default branch using the host's required PR-creation tool when available.
  Follow applicable repository rules for draft/ready state and PR templates.
- Write an English title/body with the marker, `Closes #<number>`, agreed
  scenarios, implementation summary and actual verification results.
- Read the live PR state and head SHA. Wait for checks on that exact SHA.
  Require at least one GitHub check and require **all** applicable check runs
  and commit statuses, including required checks, to finish successfully.
  Missing, pending, failed, cancelled, skipped, neutral, timed-out or
  action-required checks do not satisfy this gate. A no-checks PR must remain
  open even if local tests pass.
- Require a non-draft PR, no conflicts, satisfied review/branch protections and
  no unresolved blocking feedback. Respect required human reviews; never
  self-approve, use administrator bypass, weaken rules or treat an unknown
  mergeability result as approval.
- Merge automatically only after these conditions hold. Use a repository-
  permitted merge method, preserve the issue reference in the resulting commit,
  and bind the merge to the verified head SHA (for example, `gh pr merge
  --match-head-commit <sha>`). If the head changes, re-evaluate the gates.
  Do not schedule an unconditional future merge or report a queued merge as done.
- If checks or reviews remain pending and the host cannot keep waiting, report
  the blocker and stop with the PR open. Do not begin the next entry.

### 5. Verify completion and continue

- Confirm remotely that the PR is merged into the intended default branch and
  that GitHub closed the linked issue. A merge request returning successfully
  is not itself proof. If automatic issue closure did not occur, report the
  inconsistency and stop rather than silently declaring completion.
- Return to a clean default branch, fetch and update fast-forward only.
  Verify that the implementation, checked TODO entry and issue link are present.
  If new local changes or divergence appear, stop without discarding them.
- Continue with the next original unchecked entry only after those checks pass.
  Do not delete branches automatically.

## Reporting and recovery

Report completed entries with issue and PR links. On interruption, report the
current entry, branch, issue/PR URLs, failing or pending gate and next required
action. Distinguish implemented, tested, committed, pushed, PR-open and merged
states; never claim a later state without verification. Resume through the
same association and gates, not by creating replacements or skipping tests.
