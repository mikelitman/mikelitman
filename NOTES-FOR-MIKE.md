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

## Files
- `~/mikelitman-profile/README.md` is the profile (committed)
- `~/mikelitman-profile/NOTES-FOR-MIKE.md` is this file
