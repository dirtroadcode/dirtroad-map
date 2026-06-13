---
name: clanker-swarm
description: Spawn a worker pool of parallel subagents to process queue tasks in worktrees
argument-hint: <workers> [instructions]
user-invocable: true
---

# Swarm: Parallel Worker Pool

Run a pool of concurrent subagent workers that process tasks from the queue. Workers pick up the next matching task when they finish, until no matching tasks remain.

## Arguments

- **Required:** Number of concurrent workers (e.g., `2`)
- **Optional:** Task filter instructions (e.g., `complete all bugfix tasks`, `work on the TUI items`)

The worker count is the **concurrency limit**, not the total number of tasks. If there are 6 matching tasks and 2 workers, each worker processes tasks sequentially until all 6 are done.

If no filter instructions are given, work through the queue in priority order. If instructions are given, only process tasks matching the criteria (by type, keyword, theme, etc.).

$ARGUMENTS

## Setup

1. **Load context**
   - Read SPEC.md for project understanding
   - Run `clanker view` to read the tracker

2. **Parse arguments**
   - Extract worker count (required number)
   - Extract task filter instructions if present
   - If no count provided, ask the user how many workers to run

3. **Identify matching tasks**
   - Scan the Queue section from the tracker output
   - **No filter:** All queue items match, in priority order
   - **With filter:** Select items matching the criteria (e.g., `all bugfix tasks` → type `bugfix`; `TUI items` → TUI-related)
   - Report: "Found N matching tasks. Running M concurrent workers."

4. **Claim initial tasks** (one at a time, sequentially)
   For each worker (up to count, or number of matching tasks if fewer):
   - `clanker claim <task-file>.md` then commit: `git add .clanker/ && git commit -m "track: Claim task for swarm worker"`
   - Claim tasks one at a time to avoid clobbering — wait for each commit before claiming the next
   - Record the task title, slug, and filename

5. **Create worktrees**
   For each claimed task:
   ```bash
   git worktree add .worktrees/<task-slug> -b agent/<task-slug>
   ```

---

## Worker Loop

The swarm orchestrator manages the worker pool:

### 1. Launch Workers

For each claimed task, spawn a subagent (Task tool, run in background) with:
- Working directory set to the worktree path
- Full clanker work instructions inlined (since subagents can't use skills)
- The specific task to implement
- Instructions to commit work, but NOT to merge

### 2. Monitor

Poll workers with `TaskOutput` (block=false). When a worker completes:

### 3. On Worker Completion

1. **Pre-check**: Verify main is clean (`git status --porcelain`). If dirty, commit first.
2. **Merge**: `git merge agent/<task-slug> --no-ff -m "feature: Task title"`
3. **If conflict**: `git merge --abort`. Report conflicted files to user. Leave worktree and branch intact. Skip this task — do NOT move to Completed. Continue with remaining tasks.
4. **Verify**: Confirm `MERGE_HEAD` does not exist before cleanup.
5. **Cleanup** (only after verified merge — run from project root, NOT from inside the worktree):
   - `cd <project-root>` (CRITICAL: persistent shell breaks if CWD is inside removed worktree)
   - `git worktree remove .worktrees/<task-slug>`
   - `git branch -d agent/<task-slug>`
6. **Complete task:**
   - `clanker complete <task-file>.md` then commit: `git add .clanker/ && git commit -m "feature: Complete task title"`
7. If matching tasks remain, claim next (one at a time) and launch worker.

### 4. Repeat

Continue until all workers are idle and no matching tasks remain.

---

## Subagent Prompt Template

```
You are working in a git worktree at <path>. Your task: <task title and description>.
Follow these instructions: <inlined work skill instructions minus the branch workflow since you're already on a branch>.
Make incremental commits as you complete subtasks.
When done, commit your final state. Do NOT merge to main — the orchestrator will handle merging.
```

---

## Progress Reporting

After each worker completes a task, report:
```
Worker N completed: "Task title" ✓
  → Merged agent/<task-slug> to main
  → Starting next task: "Next task title"
  Remaining: X tasks | Workers: Y active
```

When all tasks are done:
```
Swarm complete!
  Completed: N tasks
  Workers used: M
  [list of completed tasks]
```

---

## Cleanup

After all workers complete:

```bash
# Remove remaining worktrees
git worktree list | grep .worktrees | awk '{print $1}' | xargs -I{} git worktree remove {}

# Delete merged agent branches (-d fails on unmerged, which is intentional)
git branch | grep 'agent/' | xargs -r git branch -d

# Prune orphaned worktree refs
git worktree prune
```

If any branches survive `-d` (unmerged), report them to the user for manual resolution.

---

## Safety Notes

- Each worktree is isolated — workers can't interfere with each other's files
- The tracker in the main worktree is the source of truth (`.clanker/`)
- Tasks are claimed one at a time to prevent clobbering; if a commit conflicts, retry with next item
- Worktrees are disposable — delete the directory to abort
- The orchestrator reviews and merges after each worker finishes
- If a merge conflicts, the orchestrator aborts and preserves the branch for manual resolution
- Worktrees and branches are only deleted after a verified successful merge
- Use `git branch -d` (not `-D`) to catch unmerged branches
- `.worktrees/` is in `.gitignore` so worktree directories aren't tracked
