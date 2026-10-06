import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSide, coverProbabilities, expectedValue, rankGames, freshAt } from '../public/lib/signals.mjs';
import { parseCSV, validateSplits } from '../public/lib/csv.mjs';
import { makeDemo } from '../scripts/demo.mjs';

test('Contrarian movement selects the side opposite the ticket and dollar majority', () => {
  const d = makeDemo(), g = d.games[0], p = analyzeSide(g, g.awayTeam, undefined, d.capturedAt);
  assert.equal(p.reverse, true); assert.equal(p.againstMoney, true);
  assert.equal(p.tickets, 25); assert.equal(p.money, 35);
  assert.equal(analyzeSide(g, g.homeTeam, undefined, d.capturedAt).reverse, false);
});
test('Missing splits never become public-money evidence', () => {
  const d = makeDemo(), g = { ...d.games[0], mode: 'live', split: null };
  const p = analyzeSide(g, g.awayTeam, undefined, d.capturedAt);
  assert.equal(p.reverse, false); assert.equal(p.againstMoney, false);
  assert.equal(p.tickets, null); assert.equal(p.qualified, false); assert.ok(p.sharpScore <= 35);
});
test('Integer lines count pushes and EV uses price', () => {
  const probabilities = coverProbabilities(3, [-1, 0, 1], -3);
  assert.equal(probabilities.win, 1 / 3); assert.equal(probabilities.push, 1 / 3);
  assert.ok(Math.abs(expectedValue({ win: .55, loss: .45 }, -110) - .05) < 1e-10);
  assert.ok(expectedValue({ win: .55, loss: .45 }, -120) < expectedValue({ win: .55, loss: .45 }, -110));
});
test('Stale quotes and splits are excluded; future kickoffs are required', () => {
  const d = makeDemo(), g = d.games[0];
  assert.equal(analyzeSide(g, g.homeTeam, undefined, '2026-10-07T18:00:00Z'), null);
  assert.equal(freshAt('2026-10-10T00:00:00Z', d.capturedAt, 24), false);
  const p = analyzeSide({ ...g, kickoff: '2026-10-04T00:00:00Z' }, g.awayTeam, undefined, d.capturedAt);
  assert.equal(p.qualified, false); assert.equal(p.started, true);
});
test('No movement claim is made from a single book or its first observation', () => {
  const d = makeDemo(), g = d.games[0];
  const single = { ...g, quotes: g.quotes.filter(q => q.bookmaker === 'DraftKings') };
  assert.equal(analyzeSide(single, g.awayTeam, undefined, d.capturedAt).reverse, false);
  const initial = { ...g, firstQuotes: g.firstQuotes.map(q => ({ ...q, capturedAt: d.capturedAt })) };
  assert.equal(analyzeSide(initial, g.awayTeam, undefined, d.capturedAt).movements.length, 0);
});
test('Weight changes affect rankings, not probability estimates', () => {
  const d = makeDemo(), g = d.games[0];
  const a = analyzeSide(g, g.awayTeam, { sharp: 100, model: 0, value: 0 }, d.capturedAt);
  const b = analyzeSide(g, g.awayTeam, { sharp: 0, model: 100, value: 0 }, d.capturedAt);
  assert.notEqual(a.score, b.score); assert.deepEqual(a.best.probabilities, b.best.probabilities);
  assert.ok(rankGames(d.games, undefined, d.capturedAt).every(g => Number.isFinite(g.pick.score)));
});
test('CSV supports quotes, CRLF and empty imports; rejects malformed splits', () => {
  assert.deepEqual(parseCSV('a,b\r\n"hello, world","a""b"\r\n'), [{ a: 'hello, world', b: 'a"b' }]);
  assert.deepEqual(validateSplits(parseCSV('event_id,team,bookmaker,source,captured_at,tickets_pct,money_pct\n')), []);
  const r = { event_id: 'a', team: 'b', bookmaker: 'x', source: 's', captured_at: '2026-10-05T18:00:00Z', tickets_pct: '50', money_pct: '101' };
  assert.throws(() => validateSplits([r]), /percentages/);
  assert.throws(() => parseCSV('a,b\n"unclosed,2'), /Unclosed/);
});
