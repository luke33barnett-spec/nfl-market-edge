const zone = 'America/Chicago';
const localDate = iso => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

// Each display slate ends on Monday in Central Time, including all Monday games.
export function currentSlate(games, now) {
  const today = localDate(now);
  const calendar = new Date(`${today}T12:00:00Z`);
  calendar.setUTCDate(calendar.getUTCDate() + (8 - calendar.getUTCDay()) % 7);
  const monday = calendar.toISOString().slice(0, 10);
  const visible = games.filter(g => Number.isFinite(Date.parse(g.kickoff)) && Date.parse(g.kickoff) > Date.parse(now) && localDate(g.kickoff) <= monday);
  const mondayGames = visible.filter(g => localDate(g.kickoff) === monday).sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  return { games: visible, monday, mondayGames: mondayGames.map(g => ({ id: g.id, homeTeam: g.homeTeam, awayTeam: g.awayTeam, kickoff: g.kickoff })), timeZone: zone };
}
