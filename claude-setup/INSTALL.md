# Install the AI-habits upgrades on your Mac

You don't need the terminal for this. Open a normal Claude Code session on your Mac (desktop app) and paste this one message:

> Install my AI-habits upgrades from github.com/mikelitman/mikelitman (branch `claude/ai-habits-upgrades`, or `main` if it has been merged):
> 1. Copy `.claude/skills/brief/` and `.claude/skills/second-opinion/` into `~/.claude/skills/`.
> 2. Add the section in `claude-setup/global-CLAUDE-additions.md` to the end of `~/.claude/CLAUDE.md`. Don't duplicate lines that are already there, and keep everything else as it is.
> 3. Confirm both skills show up, then show me the final CLAUDE.md section.

## What you get

| # | Upgrade | Where it lives |
|---|---|---|
| 1 | Weekly "everything OK?" check of all repos | Claude Routine, Mondays 07:52 London, push + email |
| 2 | Automatic second opinion before merging (replaces copying work to ChatGPT) | `second-opinion` skill |
| 3 | Short requests become proper briefs | `brief` skill |
| 4 | No more terminal paste blocks | CLAUDE.md rule |
| 5 | Hand off long sessions sooner (~200k tokens) | CLAUDE.md rule |
| 6 | Monthly re-grade of your AI habits | Claude Routine, 1st of the month 08:47 London, push + email |
