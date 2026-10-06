# NFL Market Edge

A free-tier NFL analytics portfolio: market movement, optional public betting splits, a reproducible scoring-margin model, chronological historical experiments, and forward paper tracking.

**This project has not established a profitable betting edge.** The dashboard makes uncertainty and missing data visible. Demo games, odds, splits, and forecasts are explicitly synthetic; historical model evaluation uses real nflverse results.

## What works

- Responsive market board, team search, contrarian filters, adjustable ranking weights, and inspectable game details.
- Twice-daily odds collection from The Odds API when you supply a free key.
- First-observed versus current sportsbook spreads and consensus movement charts.
- Optional CSV imports of source-specific spread tickets and money percentages.
- Sharp evidence is the largest default ranking weight: 60%, versus 25% model edge and 15% available price.
- Dependency-free ridge regression with pregame Elo, recent scoring/defense, home field, and rest.
- Chronological season holdouts, margin accuracy, archived live paper candidates, and grading at actual recorded prices.
- An experiment page reporting a frozen discovery rule, later-season returns, weekly bootstrap uncertainty, drawdown, all discovery candidates, and losing seasons.
- CI tests and a GitHub Actions collector. No database or application server required in production.

## Run locally

Install Node.js 22 or newer from [nodejs.org](https://nodejs.org/). There are no external JavaScript dependencies and no npm install is required.

```sh
npm start
```

Open http://localhost:3000. The included demo and real historical reports work immediately.

```sh
npm test
npm run check
npm run train       # Downloads public nflverse game results and retrains
npm run backtest    # Reproduces the discovery/evaluation experiment
npm run demo        # Explicitly restores the synthetic demonstration board
```

To collect live odds locally, put `ODDS_API_KEY` in your shell environment, then run `npm run train` and `npm run refresh`. `.env.example` documents the names but no dotenv loader is used. Do not place credentials in source files, browser scripts, or public data.

## Create the repository in your preferred GitHub account

Nothing in this package creates or publishes a repository. You control which account owns it.

1. Sign into your intended account at [GitHub](https://github.com/new).
2. Create `nfl-market-edge`. Use a personal account repository. Start empty without GitHub-generated README, license, or ignore files.
3. Extract this package. Upload the contents of the `nfl-market-edge` folder, including `.github`, `.gitignore`, `public`, `scripts`, `data`, and `tests`. Do not upload the ZIP as your repository's only file. Do not upload `data/games.csv`, `.env`, or credentials.
4. Alternatively, use the Git commands shown by the empty repository's setup page. Initialize Git inside this project, commit, set your intended account's remote, and push `main`. Check `git remote -v` before pushing. If your computer signs into another account, switch Git authentication to the intended account first.
5. Open the repository's **Actions** tab. Confirm that **Verify project** passes.

Public standard GitHub-hosted runners are free. Private repositories have included usage limits. Choose public for a portfolio; the package contains no credentials. Do not turn the source files into a standalone redistributed odds feed.

## Deploy free on Vercel

1. Sign into Vercel and import this GitHub repository from the intended account. Connect that GitHub account to Vercel when prompted.
2. Choose the **Other** framework preset. Keep root directory at the repository root.
3. Build command: `npm run check`. Output directory: `public`. These values are also in `vercel.json`.
4. Deploy. The demo dashboard and historical experiment work without any API secret in Vercel.
5. Keep it a personal, noncommercial portfolio project to stay within Hobby use rules.

Vercel serves only `public/`; scripts, cached source data, and model training state are not deployed as application endpoints.

## Activate automated live collection

1. Get a free key from [The Odds API](https://the-odds-api.com/), which currently lists 500 credits/month.
2. In GitHub **Settings → Secrets and variables → Actions**, create repository secret `ODDS_API_KEY`.
3. Optional but recommended: create a Vercel **Deploy Hook** for `main`, then save its URL in GitHub as secret `VERCEL_DEPLOY_HOOK`. This reliably requests deployment after automated data commits. Treat the hook URL as a credential.
4. In GitHub **Actions → Collect NFL markets**, select **Run workflow**.
5. Verify the new analytical data commit and deployment, then check for **LIVE COLLECTION** on the board.

The schedule is 11:17 and 23:17 UTC daily. In Chicago this is 6:17 AM/PM during daylight saving and 5:17 AM/PM during standard time. GitHub schedules may be delayed or dropped; public-repo schedules may disable after 60 days without activity. The dashboard shows freshness and excludes quotes older than 18 hours. Workflow failures preserve the previously published dashboard and appear in Actions.

At one market and one region, roughly 62 monthly scheduled odds requests fit comfortably within the listed free quota. Manual runs use additional credits. Offseason requests may return no games. Training and backtesting use public nflverse data, not odds credits. No paid fallback or automatic upgrade exists.

## Add public-money evidence

The Odds API does not provide public ticket/money splits in this integration. There is no verified free automated split feed configured. The project does not scrape restricted sites or mislabel unavailable evidence.

Import a permitted source's **spread** percentages, with the exact event ID and **home team's percentages**:

```csv
event_id,team,bookmaker,source,captured_at,tickets_pct,money_pct
ACTUAL_EVENT_ID,Kansas City Chiefs,DraftKings,Your permitted source,2026-10-05T18:00:00Z,75,65
```

`data/splits.example.csv` is a synthetic example for the included demo. Browser imports change the current session only. For persistent deployment, edit `data/splits.csv` in GitHub and run the collector. Blank file means no split data. Splits older than 24 hours or future-dated splits are excluded. Percentages describe their named source, not every sportsbook or all bettors.

## Ranking and model

Sharp score components: 35% multi-book movement, 25% reverse movement, 20% movement against reported money, 20% positive money-ticket gap. Reverse signals require at least two books moving toward a side with at most 40% of source tickets/dollars. These are heuristic rules; they do not identify individual professional bettors.

The overall review score defaults to 60% sharp evidence, 25% positive model EV, and 15% available spread/price advantage. Missing components get zero points rather than invented values. Slider settings are session-local and do not change cover probabilities or the archived automated strategy.

The model's six features are built before each game date from earlier completed games. Elo regresses toward average between seasons, and recent form resets. Ridge penalty is fixed at 30. The current model uses up to 12 prior seasons plus the available current season. Historical yearly evaluations fit only earlier seasons and report the last three completed seasons. Holdout residuals approximate a discrete scoring-margin distribution with explicit push probabilities. These are uncalibrated estimates, not certified win probabilities.

Review candidates require future kickoff, positive estimated EV greater than 2.5%, sharp score at least 45, reverse movement, and at least 200 holdout residuals. One first qualifying live candidate per event is archived and graded after results are available. Demo candidates never count as paper results.

## Historical profitability experiment

`data/experiment.json` fixes the first experiment:

- Discovery: 2017–2022, five margin-gap thresholds: 0, 1.5, 3, 4.5, 6.
- Selection: highest discovery ROI among thresholds with at least 100 discovery bets.
- Evaluation: 2023–2025, the selected threshold only, with no later retuning.
- Yearly models fit on earlier seasons. One side and one unit risked per game.
- Source odds: nflverse's recorded `spread_line`, `home_spread_odds`, and `away_spread_odds`. `spread_line` is the number of points the home team was favored by, so the home handicap is its negative.
- Actual recorded prices settle returns; missing prices are skipped and counted. No assumption that every price was −110.
- Uncertainty: 2,000 deterministic season-week block bootstrap samples, with a 95% percentile interval. A simple 0.01-unit per-wager cost sensitivity is shown separately.

Initial generated result: selected threshold 6 points; 58 later-season wagers, 31 wins and 27 losses, +1.32 units, +2.28% ROI. The bootstrap ROI interval is approximately −25.99% to +30.21%. 2025 returned −25.04%. **No reliable profitability edge is established.** Reruns can differ if source results change.

These historical lines have no decision-time timestamps in this dataset. This is a research proxy, not evidence that a particular early-week line was executable. No public splits are available in the historical experiment, so it does not backtest sharp signals. Historical score revisions, small samples, and regime changes remain limitations. The evaluation seasons cease being untouched if you use their results to edit the rule.

Next research steps: preregister a combined sharp/model rule; archive full decision-time evidence before games; test model-only versus model-plus-sharp signals; track the last observed pregame quote separately from a verified closing line; evaluate calibration; keep all experiments, including failures; and confirm results prospectively. Do not repeatedly tune against the same holdout or claim profitability from a short positive run.

## Architecture

```text
nflverse public results → pregame features → ridge model + chronological evaluations
The Odds API → normalized quote history → movement evidence
Permitted manual splits → source/timestamp validation → contrarian evidence
All three → experimental ranking → static analytical dashboard
GitHub Actions → data commits → optional Vercel hook → website refresh
Historical recorded lines → frozen discovery rule → later-year returns + uncertainty
```

Main files:

- `public/`: website and its analytical reports; the only production output.
- `scripts/model.mjs`: features, ridge solver, Elo updates, and model evaluation.
- `scripts/refresh.mjs`: collection, quote history, ranking, and paper grading.
- `scripts/backtest.mjs`, `scripts/betstats.mjs`: experiment and return statistics.
- `public/lib/signals.mjs`: shared ranking, freshness, probabilities, and price math.
- `data/`: model state, optional splits, persistent observations, experiment config, and paper ledger.
- `tests/`: leakage, contrarian direction, missing evidence, CSV validation, payouts, and bootstrap checks.
- `.github/workflows/`: tests and scheduled analytics collection.

## Known limits

Twice-daily snapshots miss rapid movement and do not establish which book led it. Live forecasts do not yet adjust reliably for neutral sites, injuries, weather, lineup changes, or information released after the last collection. Model and sharp score are deliberately separate; the sharp score is not learned from historical split data. Paper tracking lacks verified closing-line value and probability calibration metrics. A strong résumé project can report these limitations honestly without claiming to beat sportsbooks.

## Sources and free-tier references

- [nflverse data and attribution](https://github.com/nflverse/nfldata)
- [Schedule data dictionary](https://nflreadr.nflverse.com/articles/dictionary_schedules.html)
- [The Odds API pricing](https://the-odds-api.com/) and [data-use terms](https://the-odds-api.com/terms-and-conditions.html)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Scheduled workflow limits](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)

nflverse data belongs to its respective contributors and sources. Code is provided under the included MIT license; that license does not relicense external data or sportsbook brands. This project is independent and is not endorsed by the NFL or any sportsbook.
