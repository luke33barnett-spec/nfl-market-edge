import { readFile } from 'node:fs/promises';
import { parseCSV, validateSplits } from '../public/lib/csv.mjs';
import { rankGames, latestSplit, DEFAULT_WEIGHTS } from '../public/lib/signals.mjs';
import { predictMatchup, TEAM_NAMES } from './model.mjs';
import { get, readJSON, writeJSON } from './io.mjs';
import { makeDemo } from './demo.mjs';
import { collectSBD } from './sbd.mjs';
import { currentSlate } from '../public/lib/week.mjs';

if (process.argv.includes('--demo')) {
  await writeJSON('public/data/dashboard.json', makeDemo());
  console.log('Wrote clearly labeled synthetic demo. No odds credits used.');
  process.exit(0);
}
const previous = await readJSON('public/data/dashboard.json', { mode: 'demo' });
if (!process.env.ODDS_API_KEY) {
  if (previous.mode === 'live') throw new Error('ODDS_API_KEY missing. Preserving the last live dashboard.');
  await writeJSON('public/data/dashboard.json', makeDemo());
  console.log('No ODDS_API_KEY: keeping demo mode. Add a GitHub Actions secret to activate live collection.');
  process.exit(0);
}
const now = new Date().toISOString();
const url = new URL('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/');
url.search = new URLSearchParams({ apiKey: process.env.ODDS_API_KEY, regions: 'us', markets: 'spreads', oddsFormat: 'american' }).toString();
const { value: events, headers } = await get(url);
if (!Array.isArray(events)) throw new Error('Unexpected odds response');
const model = await readJSON('data/model.json', null);
if (!model || Date.parse(now) - Date.parse(model.trainedAt) > 7 * 86400_000) throw new Error('Model missing or older than seven days. Run npm run train before refreshing.');
const oldHistory = await readJSON('data/history.json', {});
const splits = validateSplits(parseCSV(await readFile('data/splits.csv', 'utf8')));
let sbdStatus = { enabled: process.env.SBD_ENABLED === 'true' };
if (sbdStatus.enabled) {
  const stored = await readJSON('data/sbd-splits.json', []);
  let archive = stored;
  try {
    const result = await collectSBD(events, now);
    const unique = new Map(stored.map(r => [`${r.eventId}|${r.capturedAt}`, r]));
    for (const r of result.records) unique.set(`${r.eventId}|${r.capturedAt}`, r);
    archive = [...unique.values()];
    await writeJSON('data/sbd-splits.json', archive);
    sbdStatus = { ...sbdStatus, status: 'ok', matched: result.records.length, unmatched: result.unmatched, invalid: result.invalid, observedAt: now };
    console.log(`SBD: ${result.records.length} matched spread splits; ${result.unmatched} unmatched; ${result.invalid} invalid.`);
  } catch (error) {
    sbdStatus = { ...sbdStatus, status: 'unavailable', observedAt: now, message: error.message };
    console.warn(`SBD unavailable: ${error.message}. Continuing odds collection; old splits retain their original timestamp.`);
  }
  splits.push(...archive);
}
const history = { ...oldHistory }, games = [];
for (const event of events) {
  if (!event.id || !event.home_team || !event.away_team || !Number.isFinite(Date.parse(event.commence_time))) throw new Error('Malformed event');
  if (Date.parse(event.commence_time) <= Date.parse(now) || Date.parse(event.commence_time) > Date.parse(now) + 8 * 86400_000) continue;
  const quotes = [];
  for (const book of event.bookmakers ?? []) {
    const market = book.markets?.find(m => m.key === 'spreads');
    for (const outcome of market?.outcomes ?? []) {
      if (![event.home_team, event.away_team].includes(outcome.name) || !Number.isFinite(outcome.point) || !Number.isFinite(outcome.price) || Math.abs(outcome.price) < 100) continue;
      quotes.push({ bookmaker: book.title, team: outcome.name, spread: outcome.point, price: outcome.price, updatedAt: market.last_update ?? book.last_update });
    }
  }
  const firstQuotes = [...(oldHistory[event.id]?.firstQuotes ?? [])];
  for (const q of quotes) if (!firstQuotes.some(p => p.bookmaker === q.bookmaker && p.team === q.team)) firstQuotes.push({ ...q, capturedAt: now });
  const homeQuotes = quotes.filter(q => q.team === event.home_team).map(q => q.spread).sort((a, b) => a - b);
  const observations = [...(oldHistory[event.id]?.observations ?? [])];
  if (homeQuotes.length) observations.push({ capturedAt: now, homeSpread: homeQuotes[Math.floor(homeQuotes.length / 2)] });
  const game = { id: event.id, homeTeam: event.home_team, awayTeam: event.away_team, kickoff: event.commence_time, mode: 'live', capturedAt: now, quotes, firstQuotes,
    predictedHomeMargin: predictMatchup(model, event.home_team, event.away_team, event.commence_time), residuals: model.residuals, history: observations.slice(-80) };
  if (game.predictedHomeMargin === null) game.residuals = [];
  game.split = latestSplit(game, splits, now);
  history[event.id] = { firstQuotes, observations: observations.slice(-80) };
  games.push(game);
}
const tracking = await readJSON('data/tracking.json', []);
const slate = currentSlate(games, now);
for (const game of rankGames(slate.games, DEFAULT_WEIGHTS, now)) {
  const p = game.pick;
  if (p?.qualified && !tracking.some(t => t.eventId === game.id)) tracking.push({ eventId: game.id, homeTeam: game.homeTeam, awayTeam: game.awayTeam, kickoff: game.kickoff, team: p.team, spread: p.best.spread, price: p.best.price, coverProbability: p.best.probabilities.win, capturedAt: now, modelVersion: model.version, status: 'pending', profit: null });
}
const nflGames = parseCSV(await readFile('data/games.csv', 'utf8'));
for (const t of tracking) {
  if (t.status !== 'pending' || Date.parse(now) - Date.parse(t.kickoff) < 12 * 3600_000) continue;
  const result = nflGames.find(g => TEAM_NAMES[g.home_team] === t.homeTeam && TEAM_NAMES[g.away_team] === t.awayTeam && Math.abs(Date.parse(g.gameday) - Date.parse(t.kickoff)) < 2 * 86400_000 && g.home_score !== '' && g.away_score !== '');
  if (!result) continue;
  const margin = (Number(result.home_score) - Number(result.away_score)) * (t.team === t.homeTeam ? 1 : -1);
  t.status = margin + t.spread > 0 ? 'win' : margin + t.spread === 0 ? 'push' : 'loss';
  t.profit = t.status === 'push' ? 0 : t.status === 'loss' ? -1 : t.price > 0 ? t.price / 100 : 100 / -t.price;
}
await writeJSON('data/history.json', history);
await writeJSON('data/tracking.json', tracking);
const performance = await readJSON('public/data/performance.json', {});
await writeJSON('public/data/performance.json', { ...performance, paperBets: tracking });
await writeJSON('public/data/dashboard.json', { schemaVersion: 1, mode: 'live', capturedAt: now, creditsRemaining: Number(headers.get('x-requests-remaining') ?? 0), games: slate.games, slate: { monday: slate.monday, mondayGames: slate.mondayGames, timeZone: slate.timeZone }, sbdStatus,
  notice: 'Odds collected from The Odds API. Sharp action is inferred, not identified. Public splits are optional and specific to their source; SBD figures are aggregate percentages. Model probabilities are experimental.' });
console.log(`Published ${games.length} upcoming games. Credits remaining: ${headers.get('x-requests-remaining') ?? 'unknown'}.`);
