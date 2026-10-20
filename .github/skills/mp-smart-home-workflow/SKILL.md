---
name: mp-smart-home-workflow
description: "Explicit-only local TODO workflow: clarify each entry with grill-me or grilling, record English GIVEN / WHEN / THEN scenarios, implement, test, commit and fast-forward merge locally without GitHub or remote operations."
user-invocable: true
disable-model-invocation: true
---

# Smart home TODO workflow

## Invocation and authorization

Run only when the user explicitly invokes `/mp-smart-home-workflow`. A request
to inspect, explain, edit or create this skill is not an invocation. Never start
because TODO.md changed, another skill suggested it, or a task seems relevant.
If loaded without an explicit invocation, stop without side effects.

An explicit invocation authorizes local branch creation, implementation,
commits and conditional local fast-forward merges for the selected TODO entries.
It also authorizes invoking `grill-me` or `grilling` for each entry. Respect host permissions
and higher-priority instructions.

Operate entirely locally: use the checkout, local Git history and local tools.
Do not access GitHub, authenticate, create or consult issues/PRs, query remote
checks, or run fetch, pull, push or any other remote operation. Existing GitHub
links are inert text to preserve, not sources to open. Apply this boundary to
delegated work, nested skills, hooks and verification commands too; stop if a
required step needs remote access. Never alter permissions, discard unrelated
work, force-update branches or perform destructive Git operations.

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
   Do not create branches or commits.
3. Require a clean checkout, including staged and untracked files. If dirty,
   stop and report the paths. Never stash, reset, clean, discard changes or
   include unrelated work to make the checkout usable.
4. Record the current local branch and its commit SHA as the integration base.
   Require a named branch; on detached HEAD, stop for the user to select one.
   Keep this base fixed throughout the invocation; do not resolve a remote
   default branch or synchronize with origin. Read local test configuration
   and documented verification commands.
5. Verify that `grill-me` or `grilling` are available. They
   may be personal skills; they are not bundled here. If missing, stop and
   request their installation. Do not replace the interview with guesses.
6. Record the initial unchecked entries by heading, original task title and
   supporting context. These define the invocation's scope. Use these readable
   associations rather than generated IDs or TODO numbers.

## Process one entry at a time

Finish and verify the local merge of the current entry before starting the next.
Re-read TODO.md on the integration base between entries. Do not expand
the invocation to new entries added after preflight; if an original entry was
removed, changed ambiguously or already completed, report it and reconcile
before taking action. On any blocker, stop the sequence and preserve progress.

### 1. Associate the entry and prepare its branch

- Match existing local work by the entry's title, heading, scenarios, branch
  changes and commit messages. Clarify duplicate titles, ambiguous matches or
  inconsistent completion states instead of creating replacement work.
- Use a short descriptive English branch name, such as `add-room-renaming` or
  `fix-temperature-refresh`. Include no issue number, TODO number, generated ID
  or numeric disambiguation suffix. If a name collides with unrelated work,
  choose a clearer descriptive name.
- Create the branch from the recorded integration base. Reuse an existing
  matching branch only after verifying its scope and that it descends from the
  unchanged base. Never overwrite branches or fork into an unrelated session.
  Stop on conflicting branch state; do not rebase or reset to make it fit.

### 2. Interview and record acceptance criteria

- Invoke `grill-me` or `grilling` or  explicitly on behalf of this authorized workflow, passing
  the TODO context and relevant local repository facts. Keep it local-only.
- Interview for this entry even if an earlier entry was already clarified.
  Wait for the user's explicit confirmation of the agreed requirements before
  implementing. If resuming, reuse an explicitly confirmed agreement only when
  it is available in context and still matches the entry and code.
- After confirmation, record the agreed English GIVEN / WHEN / THEN scenarios
  directly under the entry in TODO.md, indented as continuation content rather
  than new task checkboxes. Preserve its original title and existing links.
  Update existing scenarios rather than duplicating them. For example:

  ```markdown
  - [ ] Allow room renaming

    **Scenario: Rename an existing room**
    GIVEN an existing room
    WHEN the user saves a valid new name
    THEN the room displays the new name
  ```

  Use multiple scenarios for distinct outcomes and relevant error cases, even
  if the original task is not in English. Clarify dependencies or scope changes
  rather than silently adding work or proceeding in an impossible order.

### 3. Implement, test and commit locally

- Make the smallest complete implementation of the confirmed scenarios,
  following repository patterns and updating directly related documentation.
  Add or update unit tests for changed behavior and relevant error cases.
- On this same branch, change only the matching TODO checkbox to `[x]` and
  keep the scenarios with it. Include this update in the same commit as the
  completed implementation, preserving surrounding entries and existing links.
  The integration base must remain unchecked until the local merge.
- Before **every commit**, run the relevant existing unit-test suites, including
  the new tests, against the final changes being committed. Require a successful
  run with actual tests executed: missing, skipped, failing or unexecuted tests
  are not green. Also run applicable build, type, lint and other project checks.
- If unit tests are absent, add the necessary tests using existing tooling.
  If infrastructure is missing, stop to agree on it with the user. If the
  change has no executable behavior (for example, documentation only), require
  an explicit user exemption for that case; never infer an exemption.
- On failures, stop and report the cause; do not commit or start the next entry.
  Resume only after fixing the current entry and rerunning checks.
- Inspect and stage only the intended changes. Write English commit messages
  with a readable `TODO: <original task title>` reference in every commit body
  and any repository-required trailers. If the task title is not English, use
  a faithful English translation consistently in commit references; keep the
  original title in TODO.md. Example:

  ```text
  Add room renaming

  TODO: Allow room renaming
  ```

  If hooks modify code after validation, rerun the checks before committing.
  Verify the resulting commit and clean checkout; record the tested commit SHA.

### 4. Integrate with a local fast-forward merge

- Require all applicable local verification to have passed for the exact
  committed implementation and a clean checkout. If the committed tree differs
  from what was tested, rerun verification before merging.
- Verify that the integration base still points to its recorded SHA and is an
  ancestor of the tested feature commit. If the base changed, stop even if a
  fast-forward would be possible. Never merge unverified concurrent work.
- Switch to the base without discarding changes and merge the verified feature
  SHA using `git merge --ff-only <tested-commit-sha>`. This creates no merge
  commit and needs no remote checks. Stop on any failure; do not fall back to
  a merge commit, rebase, reset or force-update.
- Verify that the base now points to the tested SHA and contains the completed
  implementation, checked entry and English scenarios. Require a clean checkout.
  Record this SHA as the new base for the next entry.
- Continue only after these checks pass. Keep feature branches; do not delete
  them automatically.

## Reporting and recovery

Report completed entries with descriptive branch names, local commit SHAs and
the integration base. On interruption, report the current entry, branch, base
SHA, failing gate and next required action. Distinguish implemented, tested,
committed and locally integrated states; never imply anything was published.

Resume by inspecting local history, TODO scenarios and branch changes, reusing
the same association and test gates. If interrupted work left a dirty checkout,
report it and wait for the user to resolve it; do not bypass the clean-checkout
gate. If the invocation context or base cannot be recovered unambiguously,
ask the user before resuming rather than guessing or creating duplicates.
