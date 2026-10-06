---
name: brief
description: Turn a short request ("fix this", "build X for trove") into a proper brief before starting work. Use at the start of any task whose opening message is under ~3 sentences or has no clear "done" test, or when the user types /brief.
---

# Brief

Short requests make Claude guess. Before doing any work, turn the request into a brief.

## Steps

1. Look first, ask second. Read the repo, its CLAUDE.md, any product "Bible" in the Obsidian vault, recent commits, failing runs and open PRs. Most gaps can be filled from these.
2. Write the brief in this shape, in plain English, and keep it short:

   ```
   Goal: <one sentence: the outcome, not the steps>
   Done when: <2-4 checks anyone could verify, e.g. "page loads at 375px with no overflow", "cron run is green">
   Context: <what you found that matters: files, links, past attempts>
   Don't touch: <things to leave alone>
   Risky bits: <anything costly, public or hard to undo, if any>
   ```

3. If a guess would change the result, ask ONE question with your recommended answer, so a yes is enough to go on. Otherwise show the brief and start straight away.
4. Work to the brief. At the end, report against each "Done when" line: passed, failed, or not checked.

## Rules

- Never ask the user to run terminal commands. Do it yourself, or say exactly where to click.
- Don't pad the brief. If the request was already a full brief, skip this skill.
