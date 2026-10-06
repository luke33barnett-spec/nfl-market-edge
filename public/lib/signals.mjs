export const DEFAULT_WEIGHTS = { sharp: 60, model: 25, value: 15 };
export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export function decimalOdds(american) {
  if (!Number.isFinite(american) || Math.abs(american) < 100) throw new Error('Invalid American odds');
  return american > 0 ? 1 + american / 100 : 1 + 100 / -american;
}
export function expectedValue(probabilities, american) {
  return probabilities.win * (decimalOdds(american) - 1) - probabilities.loss;
}
export function coverProbabilities(homeMargin, residuals, spread, homeSide = true) {
  if (!residuals?.length) return null;
  let win = 0, push = 0;
  for (const residual of residuals) {
    const margin = Math.round(homeMargin + residual) * (homeSide ? 1 : -1);
    if (margin + spread > 0) win++;
    else if (Math.abs(margin + spread) < 1e-9) push++;
  }
  return { win: win / residuals.length, push: push / residuals.length, loss: (residuals.length - win - push) / residuals.length };
}
export function freshAt(timestamp, now, hours) {
  const age = Date.parse(now) - Date.parse(timestamp);
  return Number.isFinite(age) && age >= -5 * 60_000 && age <= hours * 3600_000;
}
export function latestSplit(game, splits, now) {
  return splits.filter(s => s.eventId === game.id && s.team === game.homeTeam && s.market === 'spreads' && Date.parse(s.capturedAt) <= Date.parse(now) && freshAt(s.capturedAt, now, 24))
    .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))[0] ?? null;
}

// Each sportsbook is compared with its own earliest collected quote. These are
// first observations, not guaranteed opening lines. Public splits are source-specific.
export function analyzeSide(game, team, weights = DEFAULT_WEIGHTS, now = new Date().toISOString()) {
  const home = team === game.homeTeam;
  const current = game.quotes.filter(q => q.team === team && freshAt(q.updatedAt, now, 18));
  if (!current.length) return null;
  const sorted = current.map(q => ({ ...q, probabilities: coverProbabilities(game.predictedHomeMargin, game.residuals, q.spread, home) }));
  sorted.forEach(q => { q.ev = q.probabilities ? expectedValue(q.probabilities, q.price) : null; });
  sorted.sort((a, b) => a.ev !== null && b.ev !== null ? b.ev - a.ev : b.spread - a.spread || decimalOdds(b.price) - decimalOdds(a.price));
  const best = sorted[0];
  const prior = (game.firstQuotes ?? []).filter(q => q.team === team);
  const movements = current.map(q => {
    const start = prior.find(p => p.bookmaker === q.bookmaker && Date.parse(p.capturedAt) < Date.parse(game.capturedAt));
    return start ? { bookmaker: q.bookmaker, from: start.spread, to: q.spread, toward: start.spread - q.spread } : null;
  }).filter(Boolean);
  const toward = movements.filter(m => m.toward >= .5);
  const split = game.split && freshAt(game.split.capturedAt, now, 24) ? game.split : null;
  const tickets = split ? (home ? split.ticketsPct : 100 - split.ticketsPct) : null;
  const money = split ? (home ? split.moneyPct : 100 - split.moneyPct) : null;
  const reverse = tickets !== null && tickets <= 40 && toward.length >= 2;
  const againstMoney = money !== null && money <= 40 && toward.length >= 2;
  const gap = money === null ? null : money - tickets;
  const movementScore = movements.length >= 2 ? clamp(toward.length / movements.length * 100) : 0;
  // Missing public splits lower coverage and never become invented contrarian evidence.
  const sharpScore = .35 * movementScore + (reverse ? 25 : 0) + (againstMoney ? 20 : 0) + (gap === null ? 0 : .2 * clamp(gap * 4));
  const consensus = [...current].map(q => q.spread).sort((a, b) => a - b)[Math.floor(current.length / 2)];
  const pointAdvantage = best.spread - consensus;
  const modelScore = best.ev === null ? 0 : clamp(best.ev * 1000);
  const valueScore = clamp(pointAdvantage * 65 + Math.max(0, decimalOdds(best.price) - 1.9091) * 100);
  const total = weights.sharp + weights.model + weights.value;
  const score = total > 0 ? (sharpScore * weights.sharp + modelScore * weights.model + valueScore * weights.value) / total : 0;
  const live = game.mode !== 'demo';
  const started = Date.parse(game.kickoff) <= Date.parse(now);
  const qualified = !started && best.ev !== null && best.ev > .025 && sharpScore >= 45 && reverse && game.residuals.length >= 200;
  return { team, opponent: home ? game.awayTeam : game.homeTeam, home, best, score, sharpScore, modelScore, valueScore, tickets, money, gap, reverse, againstMoney, movements, towardCount: toward.length, pointAdvantage, consensus, split, started, qualified,
    status: started ? 'Started' : live && !split ? 'Splits unavailable' : qualified ? 'Review candidate' : 'Watchlist' };
}

export function rankGames(games, weights, now) {
  return games.map(game => {
    const sides = [game.homeTeam, game.awayTeam].map(t => analyzeSide(game, t, weights, now)).filter(Boolean).sort((a, b) => b.score - a.score);
    return { ...game, sides, pick: sides[0] ?? null };
  }).sort((a, b) => (b.pick?.score ?? -1) - (a.pick?.score ?? -1));
}
