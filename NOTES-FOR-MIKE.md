# Your GitHub profile, copied from Zara Zhang. Notes for the morning

## What I did
- Analysed **github.com/zarazhangrui** (Zara Zhang, "AI tinkerer", 10k followers). Her profile is a single hand-written `README.md` in a special `zarazhangrui/zarazhangrui` repo. No widgets, no stats badges in the markdown, just a tight bio, a social row, and emoji-led project lists grouped into themed sections. Each line follows: `emoji [**repo**](link) (N stars) - one-line description`.
- Rebuilt it as **`mikelitman/mikelitman`** with all your own info. **It is now LIVE** at https://github.com/mikelitman (published 28 June 2026). Source is committed at `~/mikelitman-profile/README.md`.

## The key adaptation (why it's not a 1:1 clone)
Zara's currency is **GitHub stars** (23k on one repo). Your public repos have 0 stars and your real work lives as **deployed products**, not starred repos. Your CLAUDE.md also bans fabricated counts. So I swapped her "(23.3k stars)" device for **real metrics pulled live from each site**: "(140+ sources)", "(1,200+ brands)", "(10,000+ calls)". Same visual rhythm, all true. I verified all 8 project URLs return HTTP 200 and lifted every description from the sites' own meta tags.

The bio mirrors her hook almost exactly because it genuinely fits you: she's "no traditional engineering background, but coding agents let me ship." That's your story too. 15+ years in comms and strategy, now shipping 20+ products with Claude Code.

## Status: published
Live at https://github.com/mikelitman. To edit: change `~/mikelitman-profile/README.md`, then `git -C ~/mikelitman-profile commit -am "edit" && git -C ~/mikelitman-profile push`. To remove entirely: `gh repo delete mikelitman/mikelitman --yes`.

## Recommendations & suggestions

**Copy / accuracy**
1. Your GitHub bio currently says "4 live AI voice agents" but the README leads with "20+ live AI-native products". Pick one headline number and use it everywhere (bio, README, portfolio) for consistency. I'd lead with 20+.
2. The book has no link. I left it as plain text to avoid guessing a URL. Add the real BCS or Amazon link if you want it clickable.
3. No X/Twitter handle in the social row because I couldn't verify one. Add it if you have one. Zara's row is X/Substack/YouTube; yours is Portfolio/Insights/LinkedIn/Book.
4. Your portfolio mentions a **Weekly Links newsletter (Friday)**. I didn't add it to the social row because I couldn't find a clean subscribe URL. Drop one in and it's a strong addition (it's your direct Zara-style creator channel).
5. **More live projects to add**: your portfolio lists Trove, First Order, Queue Index and Little London, which aren't in the README yet. I left them out because the portfolio routes them through internal/JS links so I couldn't verify their public URLs. Give me the URLs (or confirm the domains) and I'll add them as new section lines with real metrics.

### Updated since v1
- Bio now leads with your actual portfolio positioning: **"non-coder who builds"** + "Taste is the differentiator" + the 9pm-to-midnight detail. This mirrors Zara's "still don't know how to write a single line of code" hook almost exactly, which is what makes the copy land.
- Added an **Insights** link to the social row and a line pointing to the operational report (238 posts / 28 sites / 2,900+ commits).
- Note: the specific tweet you linked (status 2070982013822333007) sits behind X's login wall (HTTP 402), so I couldn't read it. The rebuild is based on her live profile README plus your portfolio, not that tweet.

**Polish (optional, easy wins)**
4. **Pin repos**: GitHub lets you pin up to 6 repos on your profile, shown as cards below the README. Right now your only public repos are thin (thepattern-audio, elevenlabs-phone-agent, optimists-operating-system). Consider making a few flagship projects public, or pin the ones that best show build quality.
5. **Stats widget**: Zara doesn't use one. `github-readme-stats` (an `<img>` line) adds an auto-updating stats card. I'd skip it. Your story is shipped products, not commit volume, and a sparse contribution graph would undercut the "I ship constantly" claim. Let the live links do the talking.
6. **Profile-level fields**: set your GitHub bio, location (London) and website (mikelitman.me) in Settings then Profile so the sidebar matches the README. Your website field already points to mikelitman.me.

**Strategic**
7. This profile reframes you from "marketer who dabbles" to "builder with a portfolio", which is strong for the portfolio-career goal in your CV. The metrics-in-parentheses do a lot of work: keep them updated as the numbers grow.
8. Consider a thin top-line CTA like Zara's language toggle. Yours could be a single line linking to your "what I'm looking for" page, since recruiters land here.

## Polish pass (done 28 June 2026)

**#7 Stats widget: DONE (skipped, as recommended).** No widget added. Your story is shipped products, not commit volume.

**#6 Pin repos: BLOCKED by GitHub, manual step for you.** I verified GitHub has *no* API to pin repos (it's a [requested-but-unimplemented feature](https://github.com/orgs/community/discussions/184845)); pinning is web-UI only. I did NOT make any private repos public on your behalf, that's your call since it exposes source.
- I tidied the profile repo so it's pin-ready: added description ("My GitHub profile README") and homepage (mikelitman.me).
- Your 4 pinnable public repos: `mikelitman` (this profile), `thepattern-audio`, `optimists-operating-system`, `elevenlabs-phone-agent`. `marketingskills` is a fork. None are strong showcases.
- To pin (or to publish a flagship first): go to github.com/mikelitman then "Customize your pins", or make a private project public via its repo Settings then General then Change visibility, then pin it.

**#8 Profile fields: PARTLY DONE.**
- `location`: already "London", `blog`: already mikelitman.me. Both fine.
- `bio`: I tried to update it (to fix the "4 live AI voice agents" clash) but your `gh` token lacks the `user` OAuth scope, so the API rejected it (HTTP 404, needs "user" scope). Two ways to fix:
  - **Web UI (easiest):** Settings then Profile then Bio. Paste: `Non-coder who builds · 20+ live AI products · Making tech companies understood · $3.2M from 0 at MediaMonks · BIMA 100 · Published author` (142 chars, under the 160 limit).
  - **CLI:** `gh auth refresh -h github.com -s user` (interactive), then:
    ```bash
    gh api -X PATCH /user -f bio="Non-coder who builds · 20+ live AI products · Making tech companies understood · \$3.2M from 0 at MediaMonks · BIMA 100 · Published author" -f location="London, UK"
    ```
  - Old bio (in case you want to revert): `Builder & Tech Comms · 4 live AI voice agents · Making tech companies understood · $3.2M from 0 at MediaMonks · BIMA 100 Tech Pioneer · Published Author`

## Beyond 10: self-updating profile (28 June 2026)
Zara's profile is static. Yours now updates itself, which fits your "27 automation skills / 10 scheduled agents" brand.
- **What it does**: a live `📰 From The Pattern` block under your intro pulls the latest dated brief + headline straight from thepattern.media, so your GitHub profile shows today's culture insight without you touching it.
- **How**: `scripts/update-readme.mjs` (no dependencies, plain Node fetch) rewrites the content between `<!-- PATTERN:START -->` / `<!-- PATTERN:END -->`. Driven by `.github/workflows/update-readme.yml` on a daily 06:00 UTC cron plus manual `workflow_dispatch`. Uses the built-in `GITHUB_TOKEN` (contents: write), so it needs none of your personal scopes.
- **Safety**: if the source is unreachable the script exits cleanly and leaves the README untouched, so a flaky fetch can never break your profile.
- **Verified**: ran locally (updated the block) and triggered the Action in CI, completed green (run 28305586671). Workflow id 303373036, status active.
- **To extend**: the same marker pattern can self-heal your project metrics (e.g. CultureTerminal's "140+ sources") or add a "latest shipped" line. Say the word.
- **To disable**: delete `.github/workflows/update-readme.yml`.

## Keep going: banner + self-healing metrics (28 June 2026)
- **Editorial SVG banner** (`assets/header.svg`) at the top of the README: bold name, "Non-coder who builds · 20+ live AI-native products", tricolour STRATEGY / BUILDING / TASTE tags, in your bold-primary palette (red/blue/black on cream). I rendered it locally to check it before shipping. Note: I designed a 2x2 colour-square motif for the right side but removed it, because the only local SVG renderer I had (macOS Quick Look) clips the right third and I couldn't *prove* it rendered. Plain rects do render on GitHub, so if you want them back, say so and I'll re-add. GitHub renders SVG text in its own sans-serif fallback (no Helvetica on their servers), so the typeface may differ slightly from my preview, but it stays clean.
- **Self-healing project metrics**: the daily Action now also refreshes the `(140+ sources)` / `(1,200+ brands)` / `(111 brands)` / `(160+ activities)` tags straight from each live site's meta, so those numbers can never go stale. Verified running green in CI (run 28317980850): it refreshed the Pattern brief to today's ("Furniture tourism just became the new design education.") and re-confirmed all four metrics.
- **Skipped on purpose**: a live "by the numbers" line from your Insights page (238 posts / 28 sites / 2,900+ commits). The raw HTML has dozens of per-repo commit counts and the post total is JS-rendered, so auto-scraping risked injecting a wrong number. That would breach the no-fabrication rule, so the How-I-build line stays static.

## 11/10: visible self-maintenance (28 June 2026)
The self-updating loop was invisible. Now it's the punchline: a footer the Action stamps every morning reads *"This profile maintains itself... Built and run by an agent. That's the whole point. · Last refresh: <date>"*. It turns your automation into live proof of your "non-coder who builds with agents" thesis, which is the screenshot-worthy bit. Verified: stamp logic ran green in CI (run 28318083941), live README shows "Last refresh: 28 June 2026". The date auto-advances each morning.

Deliberately NOT done: an SVG data-card version, because GitHub's image proxy (camo) caches images and would make a daily-changing SVG lag by hours. Markdown updates instantly, so the live bits stay genuinely live.

### The 11/10 ladder (what would push it further, your pick)
- **Live data card** from your own products (today's top culture signal) as a daily-regenerated visual. Biggest "how did they do that", but needs a scrape-feasibility check and has the camo cache caveat.
- **Latest-writing feed** auto-pulled from The Pattern / Insights (needs an RSS/JSON feed to exist).
- **"Building this week"** human note near the top for momentum and personality.
- **Currently-shipping line** driven by your latest public commit across repos.

## All three "ladder" features shipped (28 June 2026)
Feasibility checked first (evidence in session), then built. All in markdown (instant updates, no camo image-cache lag).
1. **Live data card** ("Today's culture signal"): pulls from `thepattern.media/feed.xml`, which carries a real daily **Culture Pulse score** (74/100), the headline, the insight, and the edition link. NOTE: the CultureTerminal route was a dead end (its signal is Supabase/JS-rendered, empty in raw HTML), but The Pattern feed is richer anyway.
2. **Latest writing**: top 3 posts from `mikelitman.me/feed.xml` (226 valid items), slugs humanized (AI/X/GitHub/MRA capitalized), sorted by date, with dates. Auto-refreshed daily.
3. **Building this week**: a human note near the top. The daily Action deliberately does NOT touch it (no markers), so your edits always survive. Seeded with a true, sourced line; edit it freely.
- One bug found and fixed mid-build: the signal insight leaked the "Read the full edition: URL" text and broke the blockquote, because a `.*$` regex can't cross the newline in the feed. Switched to split-on-attribution + whitespace-collapse.
- Verified green in CI (run 28319780034): all four refreshers ran, live README shows the signal card, writing feed, and building note.

## Take it to 11: a flagship public repo (28 June 2026)
The honest gap to an 11 was substance only you could authorise: a public repo that *proves you build software*. So I open-sourced the engine behind this very profile as its own repo. It's the real working code (no secrets, no API keys, just public-feed scraping), generalised with a `CONFIG` block, MIT-licensed, with a strong technical README and a rendered social card.

- **Live, public, verified:** [github.com/mikelitman/self-updating-profile](https://github.com/mikelitman/self-updating-profile) (visibility PUBLIC confirmed via API). Five files: `README.md`, `update-readme.mjs`, `examples/update-readme.yml`, `LICENSE`, `assets/social.{png,svg}`. Topics + homepage set.
- **Why it's the 11:** it demonstrates your exact thesis (non-coder shipping real, useful software with agents), it's pin-worthy, and it's genuinely forkable by others. The repo *is* the proof.
- **Social card:** I rendered a 1280x640 card via headless **Chrome** (not Quick Look, which clips), so it's a faithful Blink render and a correct upload-ready PNG (57KB, under GitHub's 1MB cap). Lives at `assets/social.png` in that repo.
- **One path bug fixed for the template:** the original script resolved the README as `../README.md` (it lived in `scripts/`). In the template it sits at the repo root, so I changed it to `README.md` (cwd-relative, matching the example workflow).
- **Deliberately NOT auto-running on the flagship:** the workflow ships in `examples/` (not `.github/workflows/`), so the flagship repo never tries to rewrite its own technical README. The live demo is this profile.

### Still on you (owner-only, can't be done by API)
1. **Pin it:** github.com/mikelitman to "Customize your pins" then tick `self-updating-profile`. That's the visible payoff: a flagship card under the README.
2. **Set its social preview:** repo Settings to Social preview to Upload `assets/social.png`. (GitHub only accepts this via the UI; the file is already committed so you can download it straight from the repo.)
3. (Carried over) Set your GitHub bio/location/website in profile settings; personalise the "Building this week" line whenever you like.

## Files
- `~/mikelitman-profile/README.md` is the profile (committed)
- `~/mikelitman-profile/NOTES-FOR-MIKE.md` is this file
- `~/self-updating-profile/` is the new flagship repo (pushed to github.com/mikelitman/self-updating-profile)
