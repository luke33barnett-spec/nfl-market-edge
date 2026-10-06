import { decimalOdds } from '../public/lib/signals.mjs';
export function settleBet(margin, spread, price) {
  const adjusted = margin + spread;
  return adjusted === 0 ? { status: 'push', profit: 0 } : adjusted > 0 ? { status: 'win', profit: decimalOdds(price) - 1 } : { status: 'loss', profit: -1 };
}
export function summarize(bets) {
  let equity = 0, peak = 0, maxDrawdown = 0;
  const curve = [];
  for (const b of bets) { equity += b.profit; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak - equity); curve.push({ date: b.date, units: equity }); }
  const wins = bets.filter(b => b.status === 'win').length, losses = bets.filter(b => b.status === 'loss').length;
  return { bets: bets.length, wins, losses, pushes: bets.length - wins - losses, profit: equity, roi: bets.length ? equity / bets.length : null, winRate: wins + losses ? wins / (wins + losses) : null, maxDrawdown, curve };
}
export function bootstrapROI(bets, iterations = 2000) {
  if (!bets.length) return null;
  const groups = new Map();
  for (const bet of bets) {
    const key = `${bet.season}-${bet.week}`;
    const group = groups.get(key) ?? { profit: 0, n: 0 };
    group.profit += bet.profit; group.n++; groups.set(key, group);
  }
  const blocks = [...groups.values()];
  if (blocks.length < 10) return null;
  let seed = 20261005;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const rois = [];
  for (let i = 0; i < iterations; i++) {
    let profit = 0, n = 0;
    for (let j = 0; j < blocks.length; j++) { const block = blocks[Math.floor(random() * blocks.length)]; profit += block.profit; n += block.n; }
    rois.push(profit / n);
  }
  rois.sort((a, b) => a - b);
  return { low: rois[Math.floor(iterations * .025)], high: rois[Math.floor(iterations * .975)], blocks: blocks.length, iterations,
    method: 'Percentile bootstrap resampling season-week blocks; conditional on this dataset and frozen strategy. Does not correct data quality, strategy searching, or market-regime changes.' };
}
