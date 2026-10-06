import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleBet, summarize, bootstrapROI } from '../scripts/betstats.mjs';
test('Returns use actual odds, pushes refund stake, and losses risk one unit', () => {
  assert.equal(settleBet(3, -3, -110).profit, 0);
  assert.equal(settleBet(2, -3, -110).profit, -1);
  assert.ok(Math.abs(settleBet(4, -3, 120).profit - 1.2) < 1e-10);
  const stats = summarize([{ date: 'a', profit: 1, status: 'win' }, { date: 'b', profit: -1, status: 'loss' }, { date: 'c', profit: -1, status: 'loss' }]);
  assert.equal(stats.maxDrawdown, 2); assert.equal(stats.roi, -1 / 3);
});
test('Weekly block intervals are reproducible and include mixed-return uncertainty', () => {
  const bets = Array.from({ length: 40 }, (_, i) => ({ season: 2025, week: i % 20, profit: i % 2 ? -1 : 1 }));
  const result = bootstrapROI(bets, 1000);
  assert.deepEqual(result, bootstrapROI(bets, 1000));
  assert.ok(result.low < 0 && result.high > 0);
  assert.equal(bootstrapROI(bets.slice(0, 3)), null);
});
