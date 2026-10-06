import test from 'node:test';
import assert from 'node:assert/strict';
import { currentSlate } from '../public/lib/week.mjs';
const game = (id, kickoff) => ({ id, kickoff, homeTeam: 'Dallas Cowboys', awayTeam: 'New York Giants' });
test('Tuesday slate includes Monday night in UTC Tuesday but excludes next Thursday', () => {
  const result = currentSlate([game('sun', '2026-10-11T17:00:00Z'), game('mon1', '2026-10-12T23:15:00Z'), game('mon2', '2026-10-13T02:15:00Z'), game('next', '2026-10-16T00:15:00Z')], '2026-10-06T18:00:00Z');
  assert.equal(result.monday, '2026-10-12');
  assert.deepEqual(result.games.map(g => g.id), ['sun', 'mon1', 'mon2']);
  assert.deepEqual(result.mondayGames.map(g => g.id), ['mon1', 'mon2']);
});
test('Monday remains this slate and Tuesday rolls to the next slate', () => {
  assert.equal(currentSlate([], '2026-10-13T03:00:00Z').monday, '2026-10-12');
  assert.equal(currentSlate([], '2026-10-13T06:00:00Z').monday, '2026-10-19');
});
test('winter UTC kickoff and past games are handled correctly', () => {
  const result = currentSlate([game('past', '2026-11-15T18:00:00Z'), game('mnf', '2026-11-17T01:15:00Z'), game('next', '2026-11-20T01:15:00Z')], '2026-11-16T15:00:00Z');
  assert.deepEqual(result.games.map(g => g.id), ['mnf']);
});
