---
name: clanker-work
description: Load project context from spec and tracker to work on implementation tasks
argument-hint: [task description]
user-invocable: true
---

# clanker Work Session

**Assumption:** `clanker` is a CLI project tracker for AI coding agents, installed in PATH. Run `clanker help` for usage.

## Task

$ARGUMENTS

Run `clanker prompt work` and follow the instructions it outputs.

## Claude Code-Specific

### Context Limits

Before starting a new task, check the remaining free space in Claude Code's context window.

**Thresholds:**

- **Below 30% free**: Stop before starting new work. Warn the user that context is too low to reliably plan and implement a task.
- **30-50% free**: Proceed with caution. Mention the constraint and prefer smaller, well-scoped subtasks.
- **Above 50% free**: No action needed.

**When context is too low (below 30%):**

1. Do NOT begin planning or implementing the next queue item.
2. Find a stopping point in the current task or subtask.
3. Tell the user: "Context window is running low. I recommend clearing context before starting the next task."
4. Offer to write a **handoff summary** before the user clears context. The summary should include:
   - Current task status (what's done, what's remaining)
   - Key decisions made in this session
   - Any open questions or blockers
   - The next task to pick up from the tracker
5. Write the summary as a message to the user (not to a file) so they can paste it into the new session if needed.
