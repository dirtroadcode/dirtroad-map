---
name: clanker-code-quality
description: Review codebase for code quality issues like complexity, duplication, and maintainability
argument-hint: [file or area to focus on]
user-invocable: true
---

# Code Quality Review

Review the codebase for quality issues that affect maintainability and readability.

## Scope

$ARGUMENTS

If no arguments provided, review recently changed files (use `git diff --name-only HEAD~5` to find them).

## What to Look For

### Complexity
- Functions that are too long or do too many things
- Deeply nested control flow
- Complex boolean expressions that need simplification

### Duplication
- Repeated logic that should be extracted into shared functions
- Copy-pasted blocks with minor variations

### Dead code
- Unused functions, imports, or variables
- Unreachable branches

### Naming and clarity
- Misleading or unclear names
- Missing context where the logic isn't self-evident

### Rust-specific
- Unnecessary `.clone()` or `.unwrap()` calls
- Missing error context (bare `?` without `.context()` or `.map_err()`)
- Overly broad type signatures
- `pub` items that could be private

## Process

1. Identify the files to review (from arguments or recent changes)
2. Read each file thoroughly
3. Report findings grouped by category
4. For each issue, include the file path, line number, and a brief explanation
5. Suggest concrete fixes — don't just flag problems

## Rules

- Focus on substantive issues, not style nitpicks
- Don't suggest adding comments or docs unless clarity is genuinely poor
- Skip test files unless explicitly asked to review them
- Present findings as a prioritized list — most impactful issues first
