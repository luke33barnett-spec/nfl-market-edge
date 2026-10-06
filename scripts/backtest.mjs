import { readFile } from 'node:fs/promises';
import { parseCSV } from '../public/lib/csv.mjs';
import { historicalFeatures, fitRidge, predict, TEAM_NAMES } from './model.mjs';
import { summarize, settleBet, bootstrapROI } from './betstats.mjs';
import { readJSON, writeJSON } from './io.mjs';

const csv = await readFile('data/games.csv', 'utf8'), experiment = await readJSON('data/experiment.json');
if (Math.max(...experiment.discoverySeasons) >= Math.min(...experiment.evaluationSeasons)) throw new Error('Discovery must precede evaluation');
const { samples } = historicalFeatures(csv);
const raw = new Map(parseCSV(csv).map(r => [r.game_id, r]));
const forecasts = [];
for (const season of [...experiment.discoverySeasons, ...experiment.evaluationSeasons]) {
  const training = samples.filter(s => s.season < season && s.season >= season - experiment.trainingWindowSeasons);
  const model = fitRidge(training, experiment.ridgePenalty);
  for (const s of samples.filter(s => s.season === season)) {
    const r = raw.get(s.id);
    if (r.spread_line === '' || !Number.isFinite(Number(r.spread_line))) continue;
    forecasts.push({ ...s, forecast: predict(model, s.x), homeSpread: -Number(r.spread_line), homePrice: r.home_spread_odds === '' ? null : Number(r.home_spread_odds), awayPrice: r.away_spread_odds === '' ? null : Number(r.away_spread_odds) });
  }
}
function simulate(seasons, threshold) {
  const bets = []; let skippedPrices = 0;
  for (const s of forecasts.filter(s => seasons.includes(s.season))) {
    const gap = s.forecast + s.homeSpread;
    if (Math.abs(gap) <= threshold) continue;
    const home = gap > 0, price = home ? s.homePrice : s.awayPrice;
    if (price === null || !Number.isFinite(price) || Math.abs(price) < 100) { skippedPrices++; continue; }
    const spread = home ? s.homeSpread : -s.homeSpread;
    bets.push({ id: s.id, date: s.date, season: s.season, week: s.week, team: TEAM_NAMES[home ? s.home : s.away] ?? (home ? s.home : s.away), spread, price,
      ...settleBet(home ? s.y : -s.y, spread, price) });
  }
  return { bets, skippedPrices };
}
const discovery = experiment.candidateThresholds.map(threshold => {
  const { bets, skippedPrices } = simulate(experiment.discoverySeasons, threshold);
  const stats = summarize(bets); delete stats.curve;
  return { threshold, ...stats, skippedPrices };
});
const best = discovery.filter(r => r.bets >= experiment.minimumDiscoveryBets).sort((a, b) => b.roi - a.roi || a.threshold - b.threshold)[0];
if (!best) throw new Error('Not enough discovery bets with recorded spread prices');
const { bets, skippedPrices } = simulate(experiment.evaluationSeasons, best.threshold);
const stats = summarize(bets), interval = bootstrapROI(bets);
const bySeason = experiment.evaluationSeasons.map(season => {
  const summary = summarize(bets.filter(b => b.season === season)); delete summary.curve; return { season, ...summary };
});
const report = { generatedAt: new Date().toISOString(), experiment, selectedThreshold: best.threshold, discovery, evaluation: { ...stats, roiInterval: interval, skippedPrices, stressROI: stats.roi === null ? null : stats.roi - experiment.stressCostPerBet, bySeason },
  assessment: interval && interval.low > 0 ? 'Positive historical return with a bootstrap interval above zero; prospective confirmation and timestamped odds are still required.' : 'No reliable profitability edge established. The held-out return or its uncertainty does not support that claim.',
  limitations: [
    'Uses nflverse recorded historical spread lines and actual recorded spread prices, not a timestamped multi-book archive. Availability at a specific decision time is unverified.',
    'No historical public-money splits. This is a model-only experiment, not a backtest of the live sharp-action ranking.',
    'Five thresholds were searched in discovery. Later evaluation uses only the selected threshold; do not retune after viewing it.',
    'Fixed one-unit stakes, one selected side per game. No real executions, limits, fees, stake constraints, or selection of the best book.',
    'Block-bootstrap uncertainty depends on resampling weeks and assumes those blocks reasonably represent future variability. It cannot prove a durable edge.',
    'Missing historical prices are skipped and counted. Results may be affected by missing data and later revisions to source statistics.'
  ], bets };
await writeJSON('public/data/backtest.json', report);
console.log(`Frozen threshold: ${best.threshold} points. Later-season bets: ${stats.bets}. ROI: ${(stats.roi * 100).toFixed(2)}%.`);
console.log(report.assessment);
