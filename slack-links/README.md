# Link Archaeology

Two things in one folder:

- **`weekly.mjs`**: a Slack DM every Sunday with every link you saved that week, and why ([setup](#weekly-digest-in-slack))
- **`run.mjs`**: a one-off deep dive across everything you have ever saved

You use Slack as a bookmark dump. This goes back through every link you've posted and works out:

- **What it is**: a clean title, a one-line summary, a category and a type (tool, article, product…)
- **Why you saved it**: worked out from what you wrote with it, the thread, the channel and the date
- **What you meant to do with it**: read later, try it, inspiration, idea for a project, buy…
- **Themes across everything**: the actual questions and obsessions running through your links, whether each one is rising or fading, and a short portrait of what you've been chasing
- **What's worth going back to now**, plus **open loops**: things you clearly meant to act on and didn't

It ends with one file, `report.html`, that you open in your browser. Click a theme to see its links; search across titles, reasons and your own notes.

## What you need

1. **Node.js 20 or newer** (`node --version` to check)
2. **An Anthropic API key**, from https://console.anthropic.com
3. **Your Slack links**, from one of these two:
   - **A Slack export (easiest).** In Slack: workspace name → *Tools & settings* → *Workspace settings* → *Import/Export Data* → *Export*. You get a zip by email. Unzip it. You need to be the workspace owner/admin, which you are for a personal workspace.
   - **A Slack user token.** Make an app at https://api.slack.com/apps, add the user scope `search:read`, install it to your workspace and copy the *User OAuth Token* (starts `xoxp-`). This reads links from every channel and DM you're in, not just ones you own.

## Run it

```bash
cd slack-links
npm install
export ANTHROPIC_API_KEY=sk-ant-...

# Optional but worth it: tell it a bit about you, so the "why" is sharper
cp about.example.txt about.txt   # then edit it

# Try 50 links first to see what you get
node run.mjs --export ~/Downloads/my-slack-export --limit 50

# Then do the lot
node run.mjs --export ~/Downloads/my-slack-export
```

Or, with a token instead of an export:

```bash
export SLACK_TOKEN=xoxp-...
node run.mjs --api
```

Then open `report.html`.

## Weekly digest in Slack

Every Sunday evening you get a Slack DM listing **every** link you saved that week, grouped into what you were actually thinking about, each with what it is and why you probably saved it. It opens with a short read on your week and 1–3 nudges ("try this", "this connects to that project").

It runs on GitHub's schedule (`.github/workflows/weekly-links.yml`), so your computer doesn't need to be on.

**One-time setup (about 10 minutes):**

1. At https://api.slack.com/apps → *Create New App* → *From scratch*, pick your workspace.
2. *OAuth & Permissions*:
   - Under **User Token Scopes** add `search:read` and `chat:write`.
   - Under **Bot Token Scopes** add `chat:write` and `im:write`. (Optional, but this is what makes the DM ping you. Without it the digest lands silently in your own "notes to self" DM.)
3. *Install to Workspace*. Copy the **User OAuth Token** (`xoxp-…`) and the **Bot User OAuth Token** (`xoxb-…`).
4. In this GitHub repo: *Settings* → *Secrets and variables* → *Actions* → *New repository secret*. Add:
   - `SLACK_TOKEN`: the `xoxp-` token
   - `SLACK_BOT_TOKEN`: the `xoxb-` token
   - `ANTHROPIC_API_KEY`: your Anthropic key
   - `ABOUT_ME` (optional): a few lines about you, like `about.example.txt`
5. Test it now: *Actions* tab → *Weekly links digest* → *Run workflow*.

To try it locally first without sending anything: `node weekly.mjs --dry-run`. To change the day or time, edit the `cron` line in the workflow. To cover only one channel, add a secret `SLACK_QUERY` set to e.g. `has:link from:me in:#bookmarks`.

Costs pennies a week (a few cents per 25 links). The GitHub logs only show counts, never your links.

## Running it again later

Results are saved in `data/`. Each new run only analyses links it hasn't seen before, then refreshes the themes across everything, so re-running monthly is cheap. To rebuild the page without any AI calls: `node run.mjs --report-only`.

## Useful options

| Option | What it does |
|---|---|
| `--limit 50` | Only analyse the 50 newest new links (a cheap trial) |
| `--user U012ABC` | Export only: just your messages, if others post in the workspace too |
| `--query "has:link in:#reading"` | API only: any Slack search, e.g. one channel |
| `--no-fetch` | Don't visit pages to read their titles (faster; less accurate) |
| `--about file.txt` | Use a different "about me" file |

## Cost and time

It uses Claude Opus 5.5, 25 links per request. Estimated **about $5 per 1,000 links**, and a few minutes. Start with `--limit 50` to see real cost and quality. Pages are visited only to read their title and description.

## Privacy

Your links, the report and `about.txt` stay on your machine and are git-ignored. Don't commit them: this repo is public. Link details go to the Anthropic API for analysis and nowhere else.
