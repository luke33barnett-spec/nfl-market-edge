import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historicalFeatures, fitRidge, predict, predictMatchup } from '../scripts/model.mjs';

const csv = scores => 'game_id,season,game_type,gameday,home_team,away_team,home_score,away_score,location\n' + scores.map((s, i) => `g${i},2025,REG,2025-09-${i < 2 ? '07' : '14'},${i === 1 ? 'C' : 'A'},${i === 1 ? 'D' : 'B'},${s},10,Home`).join('\n');
test('Pregame features never use the current or future result', () => {
  const original = historicalFeatures(csv([20, 14, 24]), '2025-10-01T00:00:00Z');
  const changed = historicalFeatures(csv([20, 14, 99]), '2025-10-01T00:00:00Z');
  assert.deepEqual(original.samples.map(s => s.x), changed.samples.map(s => s.x));
  const earlierChanged = historicalFeatures(csv([99, 14, 24]), '2025-10-01T00:00:00Z');
  assert.deepEqual(original.samples[0].x, earlierChanged.samples[0].x);
  assert.notDeepEqual(original.samples[2].x, earlierChanged.samples[2].x);
});
test('Incomplete games and games after cutoff are excluded', () => {
  const data = historicalFeatures(csv([20, '', 24]), '2025-09-10T00:00:00Z');
  assert.equal(data.samples.length, 1);
});
test('Ridge solver learns a known relationship and rejects insufficient data', () => {
  const samples = Array.from({ length: 100 }, (_, i) => ({ x: [(i - 50) / 10], y: 2 + 3 * (i - 50) / 10 }));
  const model = fitRidge(samples, .00001);
  assert.ok(Math.abs(predict(model, [2]) - 8) < .001);
  assert.throws(() => fitRidge(samples.slice(0, 10)), /at least 50/);
});
test('Unavailable teams and retrospective forecasts are not silently estimated', () => {
  const model = { trainedAt: '2026-10-05T00:00:00Z', states: {}, season: 2026 };
  assert.equal(predictMatchup(model, 'Unknown', 'Unknown', '2026-10-10T00:00:00Z'), null);
});
