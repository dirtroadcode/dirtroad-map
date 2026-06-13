---
name: clanker-code-review
description: Review code for quality, security, and correctness issues. Invoke manually to review files or areas, or automatically as a blind quality gate on diffs. Use whenever someone asks about code quality, code smells, wants a code review, or when the worktree quality gate runs.
argument-hint: [file, area, or diff to review]
user-invocable: true
---

# Code Review

**Assumption:** `clanker` is a CLI project tracker for AI coding agents, installed in PATH. Run `clanker help` for usage.

## Scope

$ARGUMENTS

Run `clanker prompt code-review` and follow the instructions it outputs.
