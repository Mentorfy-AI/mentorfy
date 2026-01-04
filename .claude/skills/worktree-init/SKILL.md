---
name: worktree-init
description: "Create a git worktree for a bd issue. Use when spawning a worker agent for an issue. Keywords: worktree, worker, spawn, parallel, issue."
---

# worktree-init

Creates a git worktree configured for Claude Code agents to work on a bd issue.

## Workflow

When asked to spawn a worker or create a worktree for an issue:

1. **Get issue details**: `bd show <issue-id>`

2. **Create branch name** from issue type + title slug:
   - bug → `fix/short-description`
   - feature → `feat/short-description`
   - task, chore, epic → `chore/short-description`

   Example: Issue "Add dark mode toggle" (feature) → `feat/dark-mode-toggle`

3. **Create worktree**:
   ```bash
   worktree-init feat/dark-mode-toggle
   ```

4. **Output for user** - provide the command to start the worker:
   ```bash
   cd ../mentorfy-feat/dark-mode-toggle && claude "bd show mt-xyz && work on this issue"
   ```

## What worktree-init creates

`../<project>-<branch>` with:
- Beads redirect (shared issue database)
- Symlinked `.mcp.json` (MCP servers)
- Symlinked `.claude/` (settings & skills)
- Copied `.env*` files

## Cleanup

```bash
bd worktree remove ../<worktree-path> --force
```
