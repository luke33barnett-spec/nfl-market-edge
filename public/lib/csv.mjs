export function parseCSV(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (!quoted && field.length) throw new Error('Unexpected quote in CSV');
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(v => v.length)) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(v => v.trim());
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV column');
  return rows.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${i + 2} has the wrong number of columns`);
    return Object.fromEntries(headers.map((key, j) => [key, values[j].trim()]));
  });
}

export function validateSplits(rows) {
  return rows.map((r, i) => {
    const required = ['event_id', 'team', 'bookmaker', 'source', 'captured_at', 'tickets_pct', 'money_pct'];
    if (required.some(k => !r[k])) throw new Error(`Split row ${i + 2}: missing required field`);
    const tickets = Number(r.tickets_pct), money = Number(r.money_pct);
    if (![tickets, money].every(v => Number.isFinite(v) && v >= 0 && v <= 100)) throw new Error(`Split row ${i + 2}: percentages must be between 0 and 100`);
    if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(r.captured_at) || !Number.isFinite(Date.parse(r.captured_at))) throw new Error(`Split row ${i + 2}: use an ISO timestamp with timezone`);
    return { eventId: r.event_id, team: r.team, bookmaker: r.bookmaker, source: r.source, capturedAt: r.captured_at, ticketsPct: tickets, moneyPct: money, market: 'spreads' };
  });
}
