# Enable the experimental SBD collector

The collector made a successful ordinary public request on October 6, 2026. The same public data request powers SBD's JavaScript betting table. It returned 29 events with spread bet and money percentages. This is an undocumented endpoint, not a guaranteed or licensed API. SBD's published terms restrict automated collection; this technical test does not establish permission to republish their data.

## Update your existing repository

Upload these files from this updated project, keeping their folder paths:

- scripts/sbd.mjs (new)
- scripts/refresh.mjs (replace)
- public/lib/week.mjs (new)
- public/app.mjs (replace)
- data/sbd-splits.json (new, empty archive)
- tests/sbd.test.mjs (new)
- tests/week.test.mjs (new)
- .github/workflows/refresh.yml (replace)

Do not replace your odds secret, existing data/model.json, data/history.json, data/tracking.json, or data/splits.csv. If you already have an SBD archive, preserve it too.

On GitHub, open your repository, then Settings → Secrets and variables → Actions → Variables → New repository variable. Set Name to SBD_ENABLED and Value to true. This is a switch, not a secret or API key.

Open Actions → Collect NFL markets → Run workflow → Run workflow. Inspect its collection step for `SBD: ... matched spread splits`. A successful odds update then deploys through your existing Vercel setup.

To stop SBD collection, change SBD_ENABLED to false. Manual imports and odds collection remain available.

## What changes

- One SBD request per existing refresh (twice daily by default); no access-block bypasses or repeated retries.
- Match home team, away team and kickoff within 15 minutes; refuse ambiguous matches.
- Use spread percentages only, not moneyline or totals. Label as Sports Betting Dime aggregate, never an individual sportsbook.
- Store source update time separately from the time we fetched it. Existing 24-hour freshness checks still apply.
- Preserve and deduplicate timestamped split records in data/sbd-splits.json. Failures leave old timestamps intact and don't interrupt odds updates.
- Store future quotes within the existing eight-day odds collection window and SBD split records matched to those quotes, but publish only upcoming games through the current slate's Monday in America/Chicago.
- Show every scheduled Monday matchup in the collection header, including doubleheaders. A UTC Tuesday kickoff can still be Monday evening in Central Time. The slate rolls over on Tuesday in Central Time; this is a calendar rule, not an official NFL week number.
- Future games are excluded from ranking and paper-bet selection until their slate. Existing past history is preserved.

If SBD changes format or blocks requests, the dashboard reports collector status in public/data/dashboard.json and the workflow log. Don't interpret an unavailable response as zero betting activity.

This collector doesn't establish a profitable edge or identify professional bettors. The odds-movement history still needs multiple observations.
