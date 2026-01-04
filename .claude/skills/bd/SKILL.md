---
name: bd
description: "The 'bd' command is called 'beads'. Use this skill for ANY issue tracking: filing issues, creating tasks, updating status, closing work, or managing dependencies. Keywords: bd, beads, issue, task, bug, ticket. (project)"
---

# bd (beads) Issue Tracking

Run `bd prime` for full workflow context.

## Commands

### Find Work

```bash
bd ready                          # Show unblocked issues (open or in_progress)
bd ready -n 20                    # Show up to 20 issues
bd ready -t bug                   # Only bugs
bd ready -p 1                     # Only priority 1
bd ready -u                       # Only unassigned
bd list                           # List open issues
bd list --all                     # Include closed
bd list -s in_progress            # Filter by status
bd list -t feature                # Filter by type
bd list -a eli                    # Filter by assignee
```

### View Issues

```bash
bd show mf-3nm                    # View issue details
bd show mf-3nm --refs             # Show issues that reference this one
bd show mf-3nm mf-d51             # View multiple issues
```

### Create Issues

```bash
bd create "Fix login bug"                           # Simple task (default type=task, priority=2)
bd create "Fix login bug" -t bug -p 1               # Bug with priority 1
bd create "Add dark mode" -t feature -d "Support system preference"
bd create "Refactor auth" -t chore -l tech-debt     # With label
bd create "Big feature" -t epic                     # Create epic
bd create "Subtask" --parent mf-3nm                 # Child of epic/parent
```

### Update Issues

```bash
bd update mf-3nm -s in_progress           # Change status
bd update mf-3nm --claim                  # Claim: set assignee=you + status=in_progress
bd update mf-3nm -p 1                     # Change priority
bd update mf-3nm -a eli                   # Assign
bd update mf-3nm --title "New title"      # Rename
bd update mf-3nm -d "Updated description" # Update description
bd update mf-3nm --add-label urgent       # Add label
bd update mf-3nm --remove-label wontfix   # Remove label
```

### Close Issues

```bash
bd close mf-3nm                   # Close issue
bd close mf-3nm -r "Fixed in commit"  # Close with reason
bd close mf-3nm --suggest-next    # Show newly unblocked issues
bd reopen mf-3nm                  # Reopen closed issue
```

### Dependencies

```bash
bd dep add mf-3nm mf-d51          # mf-3nm blocks mf-d51 (d51 depends on 3nm)
bd dep remove mf-3nm mf-d51       # Remove dependency
bd dep list mf-3nm                # Show what mf-3nm blocks/is blocked by
bd dep tree mf-3nm                # Show dependency tree
```

### Sync

```bash
bd sync                           # Sync with git remote
```

## Critical Rules

**Priority**: 0-4 only (0=critical, 4=backlog). Use `-p 1` not `-p high`.

**Types**: bug, feature, task, epic, chore

**Status**: open, in_progress, blocked, deferred, closed

**Session close is MANDATORY:**
```bash
git add <files> && git commit -m "..."
bd sync
git push
```

Work is NOT complete until `git push` succeeds.
