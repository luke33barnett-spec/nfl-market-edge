import { TEAM_NAMES } from './model.mjs';

export const SBD_URL = 'https://www.sportsbettingdime.com/wp-json/adpt/v1/nfl-odds?books=sr%3Abook%3A7612%2Csr%3Abook%3A31520%2Csr%3Abook%3A28901%2Csr%3Abook%3A32784&format=us';
const source = 'https://www.sportsbettingdime.com/nfl/public-betting-trends/';
const teamName = t => TEAM_NAMES[t?.abbreviation] ?? TEAM_NAMES[t?.alias];
const percent = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100;

export function normalizeSBD(payload, events, observedAt) {
  if (!Array.isArray(payload?.data)) throw new Error('SBD response format changed');
  const records = [];
  let unmatched = 0, invalid = 0;
  for (const row of payload.data) {
    const home = teamName(row.competitors?.home), away = teamName(row.competitors?.away);
    const kickoff = Date.parse(row.scheduled), spread = row.bettingSplits?.spread;
    if (!home || !away || !Number.isFinite(kickoff)) { invalid++; continue; }
    if (kickoff <= Date.parse(observedAt) || kickoff > Date.parse(observedAt) + 8 * 86400_000) continue;
    const matches = events.filter(e => e.home_team === home && e.away_team === away && Math.abs(Date.parse(e.commence_time) - kickoff) <= 15 * 60_000);
    if (matches.length !== 1) { unmatched++; continue; }
    const values = [spread?.home?.betsPercentage, spread?.away?.betsPercentage, spread?.home?.stakePercentage, spread?.away?.stakePercentage];
    const updated = Date.parse(spread?.updated);
    if (!values.every(percent) || Math.abs(values[0] + values[1] - 100) > .2 || Math.abs(values[2] + values[3] - 100) > .2 || !Number.isFinite(updated) || updated > Date.parse(observedAt) + 5 * 60_000) { invalid++; continue; }
    records.push({ eventId: matches[0].id, team: home, bookmaker: 'Sports Betting Dime aggregate', source, capturedAt: new Date(updated).toISOString(), observedAt, ticketsPct: values[0], moneyPct: values[2], market: 'spreads', sourceEventId: row.id });
  }
  return { records, unmatched, invalid, sourceGames: payload.data.length };
}

export async function collectSBD(events, observedAt) {
  // One ordinary request per refresh. No retries, proxies, cookies, or access-block bypasses.
  const response = await fetch(SBD_URL, { signal: AbortSignal.timeout(20_000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`SBD returned HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('json')) throw new Error('SBD returned a non-JSON response');
  return normalizeSBD(await response.json(), events, observedAt);
}
