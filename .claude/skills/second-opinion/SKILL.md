---
name: second-opinion
description: Get an independent review of finished work before merging or shipping, so the user doesn't have to copy the work into another AI and paste its review back. Use before any merge, deploy or "done" report on a non-trivial change, or when the user types /second-opinion or says "check with GPT" / "get a second opinion".
---

# Second opinion

The user used to paste work into ChatGPT for review and paste the verdict back. This skill does that step automatically.

## Steps

1. Collect the evidence: the brief or goal, the diff (or the PR number), and what you tested and the results.
2. Start a fresh subagent (Agent tool, general-purpose) that has NOT seen this conversation. Give it only the evidence and this instruction:

   > You are a sceptical senior reviewer. Your job is to stop a bad merge. Check: does the change meet the goal and every "done when" line? Are there bugs, missing edge cases, broken pages on mobile, secrets in code, silent failures in scheduled jobs, or costs that could run away? Verify claims yourself where you can (run tests, open the page, read the code); don't trust the summary. Reply with: VERDICT (ship / fix first / needs the user's decision), then BLOCKERS, then NICE-TO-HAVES, each one line.

3. Fix every blocker yourself, then run the reviewer again on the new diff. Stop after 3 rounds and report what is still open.
4. Ask the user only about "needs the user's decision" items: product, taste, money or anything public. Give your recommendation with each one.
5. Report back in at most 5 lines: verdict, what the reviewer caught, what you fixed, and anything waiting on the user.

## Rules

- The reviewer must be a fresh agent. Never review your own work in the same context.
- For a security or money finding, take the safer fix.
