export function makeDemo() {
  const capturedAt = '2026-10-05T18:00:00Z', firstAt = '2026-10-04T18:00:00Z';
  const fixtures = [
    ['demo-01', 'Kansas City Chiefs', 'Buffalo Bills', -3.5, -2.5, 75, 65, 1.1],
    ['demo-02', 'Philadelphia Eagles', 'Dallas Cowboys', -4.5, -3, 72, 61, 1.5],
    ['demo-03', 'Detroit Lions', 'Green Bay Packers', -2.5, -3.5, 39, 62, 4.8],
    ['demo-04', 'San Francisco 49ers', 'Seattle Seahawks', -6.5, -6, 68, 57, 4.5],
    ['demo-05', 'Baltimore Ravens', 'Cincinnati Bengals', -3, -3, 56, 52, 3.0],
    ['demo-06', 'Chicago Bears', 'Minnesota Vikings', 2.5, 1.5, 34, 49, .4]
  ];
  const residuals = Array.from({ length: 400 }, (_, i) => {
    // Deterministic illustrative distribution. Not a real fitted model.
    const u = (i + .5) / 400;
    return Math.log(u / (1 - u)) * 7.5;
  });
  const games = fixtures.map(([id, homeTeam, awayTeam, open, current, tickets, money, predictedHomeMargin], i) => {
    const bookmakers = ['DraftKings', 'FanDuel', 'BetMGM'];
    const quotes = [], firstQuotes = [];
    bookmakers.forEach((bookmaker, j) => {
      const spread = current + (j === 2 ? .5 : 0), old = open + (j === 2 ? .5 : 0);
      quotes.push({ bookmaker, team: homeTeam, spread, price: j === 1 ? -105 : -110, updatedAt: capturedAt }, { bookmaker, team: awayTeam, spread: -spread, price: -110, updatedAt: capturedAt });
      firstQuotes.push({ bookmaker, team: homeTeam, spread: old, capturedAt: firstAt }, { bookmaker, team: awayTeam, spread: -old, capturedAt: firstAt });
    });
    return { id, homeTeam, awayTeam, kickoff: `2026-10-11T${i < 4 ? '17' : '20'}:00:00Z`, mode: 'demo', capturedAt, quotes, firstQuotes, predictedHomeMargin, residuals,
      split: { eventId: id, team: homeTeam, bookmaker: 'Illustrative sample', source: 'Synthetic demo', market: 'spreads', ticketsPct: tickets, moneyPct: money, capturedAt },
      history: [open, open, (open + current) / 2, current].map((homeSpread, k) => ({ capturedAt: `2026-10-0${k < 2 ? '4' : '5'}T${k % 2 ? '18' : '06'}:00:00Z`, homeSpread })) };
  });
  return { schemaVersion: 1, mode: 'demo', capturedAt, creditsRemaining: null, games,
    notice: 'Illustrative games, prices, public splits, and model estimates. These are not the actual NFL schedule or betting recommendations.' };
}
