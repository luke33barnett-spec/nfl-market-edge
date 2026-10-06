import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSBD } from '../scripts/sbd.mjs';

const now = '2026-10-06T18:00:00Z';
const event = { id: 'odds-id', home_team: 'Dallas Cowboys', away_team: 'Tampa Bay Buccaneers', commence_time: '2026-10-09T00:15:00Z' };
const row = () => ({ id: 'sbd-id', scheduled: event.commence_time, competitors: { home: { abbreviation: 'DAL' }, away: { abbreviation: 'TB' } }, bettingSplits: { spread: { updated: '2026-10-06T17:00:00Z', home: { betsPercentage: 30, stakePercentage: 60 }, away: { betsPercentage: 70, stakePercentage: 40 } } } });
test('SBD uses spread percentages, home team, odds ID, and original source time', () => {
  const result = normalizeSBD({ data: [row()] }, [event], now);
  assert.equal(result.records[0].eventId, 'odds-id');
  assert.equal(result.records[0].ticketsPct, 30);
  assert.equal(result.records[0].moneyPct, 60);
  assert.equal(result.records[0].capturedAt, '2026-10-06T17:00:00.000Z');
  assert.equal(result.records[0].observedAt, now);
});
test('SBD refuses ambiguous matches, missing percentages, invalid sums and future timestamps', () => {
  assert.equal(normalizeSBD({ data: [row()] }, [event, event], now).records.length, 0);
  for (const change of [r => { r.bettingSplits.spread.home.betsPercentage = null; }, r => { r.bettingSplits.spread.away.stakePercentage = 50; }, r => { r.bettingSplits.spread.updated = '2026-10-07T00:00:00Z'; }]) {
    const r = row(); change(r);
    assert.equal(normalizeSBD({ data: [r] }, [event], now).records.length, 0);
  }
});
test('SBD skips games with a different opponent or kickoff and rejects schema changes', () => {
  assert.equal(normalizeSBD({ data: [row()] }, [{ ...event, away_team: 'Miami Dolphins' }], now).records.length, 0);
  assert.equal(normalizeSBD({ data: [row()] }, [{ ...event, commence_time: '2026-10-10T00:15:00Z' }], now).records.length, 0);
  assert.throws(() => normalizeSBD({}, [event], now), /format changed/);
});
