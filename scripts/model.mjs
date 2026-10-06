import { parseCSV } from '../public/lib/csv.mjs';

export const FEATURE_NAMES = ['home field', 'Elo difference', 'recent margin difference', 'offense difference', 'defense difference', 'rest advantage'];
const freshTeam = () => ({ elo: 1500, recent: [], lastDate: null });
export function featureVector(home, away, date, neutral = false) {
  const mean = (t, f) => t.recent.length ? t.recent.reduce((s, g) => s + g[f], 0) / t.recent.length : 0;
  const rest = t => t.lastDate ? Math.min(14, Math.max(3, (Date.parse(date) - Date.parse(t.lastDate)) / 86400_000)) : 7;
  return [neutral ? 0 : 1, (home.elo - away.elo) / 100, (mean(home, 'margin') - mean(away, 'margin')) / 10,
    (mean(home, 'scored') - mean(away, 'scored')) / 10, (mean(away, 'allowed') - mean(home, 'allowed')) / 10, (rest(home) - rest(away)) / 7];
}

export function historicalFeatures(csv, cutoff = new Date().toISOString()) {
  const games = parseCSV(csv).filter(r => r.game_type === 'REG' && r.home_score !== '' && r.away_score !== '' && r.gameday && Date.parse(r.gameday) < Date.parse(cutoff))
    .map(r => ({ id: r.game_id, season: Number(r.season), week: Number(r.week), date: r.gameday, home: r.home_team, away: r.away_team, homeScore: Number(r.home_score), awayScore: Number(r.away_score), neutral: r.location === 'Neutral' }))
    .filter(r => Number.isFinite(r.homeScore) && Number.isFinite(r.awayScore)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const states = {}, samples = []; let season = null;
  for (let i = 0; i < games.length;) {
    const date = games[i].date, batch = [];
    while (i < games.length && games[i].date === date) batch.push(games[i++]);
    if (batch[0].season !== season) {
      for (const s of Object.values(states)) { s.elo = 1500 + (s.elo - 1500) * .67; s.recent = []; }
      season = batch[0].season;
    }
    for (const g of batch) {
      const h = states[g.home] ??= freshTeam(), a = states[g.away] ??= freshTeam();
      samples.push({ ...g, x: featureVector(h, a, date, g.neutral), y: g.homeScore - g.awayScore });
    }
    // Results update state only after all pregame features for this date exist.
    for (const g of batch) {
      const h = states[g.home], a = states[g.away];
      const expected = 1 / (1 + 10 ** ((a.elo - h.elo - (g.neutral ? 0 : 55)) / 400));
      const actual = g.homeScore === g.awayScore ? .5 : g.homeScore > g.awayScore ? 1 : 0;
      const change = 20 * (actual - expected);
      h.elo += change; a.elo -= change;
      for (const [t, scored, allowed] of [[h, g.homeScore, g.awayScore], [a, g.awayScore, g.homeScore]]) {
        t.recent.push({ scored, allowed, margin: scored - allowed }); t.recent = t.recent.slice(-8); t.lastDate = date;
      }
    }
  }
  return { samples, states, season };
}

// Ridge least squares; the intercept is unpenalized. Small feature count makes
// a dependency-free solver sufficient. Partial pivoting guards numeric stability.
function solve(matrix, rhs) {
  const a = matrix.map((row, i) => [...row, rhs[i]]), n = rhs.length;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    if (Math.abs(a[i][i]) < 1e-10) throw new Error('Singular model matrix');
    const d = a[i][i]; for (let k = i; k <= n; k++) a[i][k] /= d;
    for (let j = 0; j < n; j++) if (j !== i) { const m = a[j][i]; for (let k = i; k <= n; k++) a[j][k] -= m * a[i][k]; }
  }
  return a.map(row => row[n]);
}
export function fitRidge(samples, lambda = 30) {
  if (samples.length < 50) throw new Error('Need at least 50 completed training games');
  const p = samples[0].x.length + 1, matrix = Array.from({ length: p }, () => Array(p).fill(0)), rhs = Array(p).fill(0);
  for (const s of samples) {
    const x = [1, ...s.x];
    for (let i = 0; i < p; i++) { rhs[i] += x[i] * s.y; for (let j = 0; j < p; j++) matrix[i][j] += x[i] * x[j]; }
  }
  for (let i = 1; i < p; i++) matrix[i][i] += lambda;
  return { coefficients: solve(matrix, rhs), lambda };
}
export function predict(model, x) { return model.coefficients[0] + x.reduce((s, v, i) => s + v * model.coefficients[i + 1], 0); }
export function train(csv, now = new Date().toISOString()) {
  const { samples, states, season } = historicalFeatures(csv, now);
  const useful = samples.filter(s => s.season >= season - 12);
  const validationSeasons = [...new Set(useful.map(s => s.season))].filter(y => y < season).slice(-3);
  const evaluations = [], residuals = [];
  for (const year of validationSeasons) {
    const training = useful.filter(s => s.season < year), test = useful.filter(s => s.season === year);
    if (training.length < 50 || !test.length) continue;
    const model = fitRidge(training), errors = test.map(s => s.y - predict(model, s.x));
    residuals.push(...errors);
    const baseline = test.map(s => s.y - 2.5);
    evaluations.push({ season: year, games: test.length, mae: errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length,
      rmse: Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length), baselineMae: baseline.reduce((s, e) => s + Math.abs(e), 0) / baseline.length });
  }
  const model = fitRidge(useful);
  return { ...model, version: 'ridge-v1', trainedAt: now, season, trainingGames: useful.length, featureNames: FEATURE_NAMES, residuals, evaluations, states,
    limitation: 'Score-based pregame baseline. Residual probabilities are uncalibrated estimates; historical margin errors are not betting returns. Sharp weights are heuristics, not learned coefficients.' };
}
export const TEAM_NAMES = { ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills', CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns', DAL: 'Dallas Cowboys', DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers', HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs', LA: 'Los Angeles Rams', LAR: 'Los Angeles Rams', LAC: 'Los Angeles Chargers', LV: 'Las Vegas Raiders', MIA: 'Miami Dolphins', MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants', NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SEA: 'Seattle Seahawks', SF: 'San Francisco 49ers', TB: 'Tampa Bay Buccaneers', TEN: 'Tennessee Titans', WAS: 'Washington Commanders' };
export function predictMatchup(model, homeName, awayName, kickoff) {
  const code = name => Object.keys(TEAM_NAMES).find(k => TEAM_NAMES[k] === name && model.states[k]);
  const home = model.states[code(homeName)], away = model.states[code(awayName)];
  if (!home || !away || Date.parse(kickoff) < Date.parse(model.trainedAt)) return null;
  if ((Date.parse(kickoff) - Date.parse(model.trainedAt)) > 14 * 86400_000) return null;
  // Offseason forecasts should not use last season's eight-game form.
  if (model.season < Number(kickoff.slice(0, 4))) return null;
  return predict(model, featureVector(home, away, kickoff));
}
