import { rankGames, DEFAULT_WEIGHTS, freshAt } from './lib/signals.mjs';
import { parseCSV, validateSplits } from './lib/csv.mjs';
import { renderExperiment } from './experiments.mjs';
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const signed = v => v > 0 ? `+${v}` : `${v}`;
const pct = v => v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`;
const date = iso => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
let dashboard, performance, ranked = [], filter = 'all', weights = { ...DEFAULT_WEIGHTS }, query = '';
function now() { return dashboard.mode === 'demo' ? dashboard.capturedAt : new Date().toISOString(); }
function stale() { return dashboard.mode === 'live' && !freshAt(dashboard.capturedAt, now(), 18); }
const short = team => team.split(' ').slice(-1).join(' ');
function render() {
  ranked = rankGames(dashboard.games, weights, now());
  const withQuotes = ranked.filter(g => g.pick), candidates = stale() ? 0 : withQuotes.filter(g => g.pick.qualified).length;
  const reverse = withQuotes.filter(g => g.pick.reverse).length;
  $('#mode').textContent = dashboard.mode === 'demo' ? 'DEMO DATA' : stale() ? 'STALE DATA' : 'LIVE COLLECTION';
  $('#mode').className = `badge ${dashboard.mode === 'live' && !stale() ? 'live' : ''}`;
  const mondayGames = dashboard.slate?.mondayGames ?? [];
  const mondayNote = mondayGames.length ? ` · Monday: ${mondayGames.map(g => `${short(g.awayTeam)} at ${short(g.homeTeam)} (${date(g.kickoff)})`).join('; ')}` : dashboard.slate ? ` · Slate through Monday ${dashboard.slate.monday}` : '';
  $('#updated').textContent = `Collected ${date(dashboard.capturedAt)}${mondayNote}`;
  $('#notice').className = `notice ${stale() ? 'error' : dashboard.mode === 'live' ? 'live' : ''}`;
  $('#notice').textContent = stale() ? 'Collection is more than 18 hours old. Review candidates are suppressed until a successful refresh. Check the GitHub workflow.' : dashboard.notice;
  $('#summary').innerHTML = [
    ['Games tracked', dashboard.games.length, dashboard.mode === 'demo' ? 'Illustrative matchups' : 'Current slate through Monday'],
    ['Against the crowd', reverse, 'Confirmed at two or more books'],
    ['Review candidates', candidates, dashboard.mode === 'demo' ? 'Illustrative screening results' : 'Experimental screening rule'],
    ['Public-split coverage', `${withQuotes.filter(g => g.pick.split).length}/${dashboard.games.length}`, dashboard.mode === 'demo' ? 'Synthetic source' : 'Source-specific, within 24 hours']
  ].map(([label, value, note], i) => `<div class="stat ${i === 1 ? 'accent' : ''}"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></div>`).join('');
  let games = ranked.filter(g => `${g.homeTeam} ${g.awayTeam}`.toLowerCase().includes(query));
  if (filter === 'reverse') games = games.filter(g => g.pick?.reverse);
  if (filter === 'qualified') games = games.filter(g => !stale() && g.pick?.qualified);
  if (!games.length) {
    $('#games').innerHTML = `<div class="empty"><h2>${filter === 'qualified' ? 'No qualifying opportunities' : 'No matching games'}</h2><p class="muted">${stale() ? 'The collection must refresh before candidates can appear.' : 'Try another filter, or wait for more evidence. A quiet board is a valid result.'}</p></div>`;
    return;
  }
  $('#games').innerHTML = `<table class="market-table"><thead><tr><th>MATCHUP / SELECTED SIDE</th><th>MARKET EVIDENCE</th><th>SELECTED SIDE’S SPLITS</th><th>MODEL / BEST QUOTE</th><th>RANK SCORE</th></tr></thead><tbody>${games.map(gameRow).join('')}</tbody></table>`;
  $('#games').querySelectorAll('[data-detail]').forEach(b => b.addEventListener('click', () => showDetail(b.dataset.detail)));
}
function gameRow(g) {
  const p = g.pick, rank = ranked.indexOf(g) + 1;
  if (!p) return `<tr><td><span class="team">${esc(g.awayTeam)} at ${esc(g.homeTeam)}</span><span class="meta">${esc(date(g.kickoff))}</span></td><td colspan="4"><span class="muted">No fresh sportsbook quotes. Ranking withheld.</span></td></tr>`;
  const signal = p.reverse ? 'Reverse movement' : p.towardCount >= 2 ? 'Multi-book movement' : 'Limited movement';
  const best = p.best, probability = best.probabilities;
  return `<tr><td><div class="matchup"><span class="rank">${String(rank).padStart(2, '0')}</span><div><span class="team">${esc(p.team)}</span><span class="opponent">vs. ${esc(p.opponent)} · ${p.home ? 'Home' : 'Away'}</span><span class="meta">${esc(date(g.kickoff))}</span></div></div></td>
    <td><span class="tag ${p.reverse ? 'orange' : ''}">${esc(signal)}</span><p class="signal-text">${p.towardCount} / ${p.movements.length} observed books toward this side</p><span class="meta">${p.againstMoney ? 'Also against reported dollars' : p.gap > 0 ? `Money-ticket gap: +${p.gap.toFixed(2)} pts` : p.status}</span></td>
    <td>${p.tickets === null ? '<span class="meta">Unavailable</span><span class="meta">No public-money inference</span>' : `<div class="split-bars">${splitBar('Bets', p.tickets)}${splitBar('Money', p.money, true)}</div><span class="meta">${esc(p.split.source)}</span>`}</td>
    <td><span class="figure">${signed(best.spread)} <small>(${signed(best.price)})</small></span><span class="meta">${esc(best.bookmaker)}</span><span class="meta">Cover ${probability ? pct(probability.win) : 'unavailable'} · EV ${best.ev === null ? '—' : signed((best.ev * 100).toFixed(1)) + '%'}</span></td>
    <td><div class="score-cell"><span class="score-number">${Math.round(p.score)}</span><span class="score-scale"><span style="--bar-width:${p.score}%"></span></span></div><button class="detail-button" data-detail="${esc(g.id)}" aria-label="Inspect ${esc(p.team)} evidence">Inspect evidence</button></td></tr>`;
}
function splitBar(label, value, money = false) { return `<div class="bar-row"><span>${label}</span><span class="bar ${money ? 'money' : ''}"><span style="--bar-width:${value}%"></span></span><span>${value.toFixed(2)}%</span></div>`; }
function showDetail(id) {
  const g = ranked.find(g => g.id === id), p = g.pick;
  if (!p) return;
  const probabilities = p.best.probabilities;
  $('#dialog-content').innerHTML = `<div class="dialog-header"><div><p class="eyebrow">${dashboard.mode === 'demo' ? 'ILLUSTRATIVE EVIDENCE' : 'MARKET EVIDENCE'}</p><h2>${esc(g.awayTeam)} at ${esc(g.homeTeam)}</h2><p class="subtle">${esc(date(g.kickoff))}</p></div><button class="close" aria-label="Close game details">×</button></div><div class="dialog-body">
    <div class="detail-summary"><div><small>Selected side</small><strong>${esc(short(p.team))} ${signed(p.best.spread)}</strong><small>${esc(p.best.bookmaker)} / ${signed(p.best.price)}</small></div><div><small>Estimated cover / push</small><strong>${probabilities ? `${pct(probabilities.win)} / ${pct(probabilities.push)}` : 'Unavailable'}</strong><small>${dashboard.mode === 'demo' ? 'Synthetic estimate' : 'Uncalibrated model estimate'}</small></div><div><small>Evidence score</small><strong>${Math.round(p.score)} / 100</strong><small>${stale() ? 'Stale · review suppressed' : esc(p.status)}</small></div></div>
    <h3>Home-team consensus spread</h3>${lineChart(g.history)}<p class="chart-caption">From ${g.history.length ? esc(date(g.history[0].capturedAt)) : '—'} to ${esc(date(g.capturedAt))}. Each point is the median available home spread at collection time.</p>
    <h3>Evidence for ${esc(p.team)}</h3><ul class="evidence-list"><li>${p.reverse ? 'Reverse movement: yes' : 'Reverse movement: not established'}. Requires ≤40% of reported tickets and movement toward this side at two or more books.</li><li>${p.againstMoney ? 'Movement against reported money: yes.' : 'Movement against reported money: not established.'}</li><li>${p.split ? `Public split source: ${esc(p.split.source)} (${esc(p.split.bookmaker)}), captured ${esc(date(p.split.capturedAt))}. This is a source-specific sample.` : 'No fresh public splits. We cannot infer movement against the crowd.'}</li><li>Sharp / model / price component scores: ${Math.round(p.sharpScore)} / ${Math.round(p.modelScore)} / ${Math.round(p.valueScore)}.</li><li>Best available spread is ${p.pointAdvantage.toFixed(1)} points above this side’s median. Prices are considered separately through estimated EV.</li><li>${g.predictedHomeMargin === null ? 'Forecast unavailable: the model is missing, stale, or cannot map both teams.' : `Predicted home margin: ${g.predictedHomeMargin.toFixed(1)} points. ${dashboard.mode === 'demo' ? 'This estimate is synthetic.' : 'Uses score-based pregame features; no injury or weather adjustment.'}`}</li></ul>
    <div class="table-wrap"><table class="simple-table"><thead><tr><th>Book</th><th>First seen</th><th>Current</th><th>Price</th><th>Quote updated</th></tr></thead><tbody>${g.quotes.filter(q => q.team === p.team).map(q => { const first = g.firstQuotes.find(f => f.bookmaker === q.bookmaker && f.team === p.team); return `<tr><td>${esc(q.bookmaker)}</td><td>${first ? signed(first.spread) : '—'}</td><td>${signed(q.spread)}</td><td>${signed(q.price)}</td><td>${esc(date(q.updatedAt))}</td></tr>`; }).join('')}</tbody></table></div><p class="event-id">Event ID for imports: <code>${esc(g.id)}</code>. Home team: ${esc(g.homeTeam)}.</p><p class="subtle">Line movement can reflect news, book adjustments, or ordinary price discovery. A move alone does not identify professional bettors.</p></div>`;
  $('#game-dialog').showModal(); $('#game-dialog .close').addEventListener('click', () => $('#game-dialog').close());
}
function lineChart(history) {
  if (history.length < 2) return '<p class="subtle">At least two snapshots are needed to show movement.</p>';
  const w = 680, h = 180, pad = 35, values = history.map(h => h.homeSpread), low = Math.min(...values) - .5, high = Math.max(...values) + .5;
  const y = v => h - pad - (v - low) / (high - low) * (h - pad * 2);
  const start = Date.parse(history[0].capturedAt), end = Date.parse(history.at(-1).capturedAt);
  const x = (point, i) => pad + (end > start ? (Date.parse(point.capturedAt) - start) / (end - start) : i / (history.length - 1)) * (w - pad * 2);
  const path = history.map((v, i) => `${i ? 'L' : 'M'}${x(v, i).toFixed(1)},${y(v.homeSpread).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Home consensus spread moved from ${values[0]} to ${values.at(-1)}"><path d="M${pad},${h - pad}H${w - pad}" stroke="#dce4ee" fill="none"/><path d="${path}" fill="none" stroke="#ed6039" stroke-width="3"/>${history.map((v, i) => `<circle cx="${x(v, i)}" cy="${y(v.homeSpread)}" r="3.5" fill="#ed6039"/>`).join('')}<text x="${pad}" y="20" fill="#667789" font-size="13">${signed(values[0])} first seen</text><text x="${w - pad}" y="20" text-anchor="end" fill="#102338" font-size="13">${signed(values.at(-1))} latest</text></svg>`;
}
function renderPerformance() {
  const evals = performance.evaluations ?? [], games = evals.reduce((s, e) => s + e.games, 0);
  const mae = games ? evals.reduce((s, e) => s + e.mae * e.games, 0) / games : null;
  const baseline = games ? evals.reduce((s, e) => s + e.baselineMae * e.games, 0) / games : null;
  const bets = performance.paperBets ?? [], settled = bets.filter(b => b.status !== 'pending'), profit = settled.reduce((s, b) => s + b.profit, 0);
  $('#performance-content').innerHTML = `<div class="performance-grid"><article class="panel"><p class="eyebrow">REAL HISTORICAL RESULTS</p><h2>Season-by-season holdout</h2><p>Each season’s coefficients were trained on earlier seasons. Team features update from games completed before the forecast date. No sportsbook data or public splits enter this historical accuracy test.</p><div class="metric-pair"><div><strong>${mae === null ? '—' : mae.toFixed(2)}</strong><small>Model MAE, points</small></div><div><strong>${baseline === null ? '—' : baseline.toFixed(2)}</strong><small>Constant +2.5 home-margin MAE</small></div><div><strong>${games}</strong><small>Holdout games</small></div></div>
    <table class="simple-table"><thead><tr><th>Season</th><th>Games</th><th>Model MAE</th><th>RMSE</th><th>Baseline MAE</th></tr></thead><tbody>${evals.length ? evals.map(e => `<tr><td>${e.season}</td><td>${e.games}</td><td class="${e.mae < e.baselineMae ? 'good' : ''}">${e.mae.toFixed(2)}</td><td>${e.rmse.toFixed(2)}</td><td>${e.baselineMae.toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="5">Run model training to populate real evaluation results.</td></tr>'}</tbody></table><p class="subtle">MAE is average absolute scoring-margin error. Lower is better. This test does not establish betting profitability or validate the sharp-action ranking.</p></article>
    <article class="panel"><p class="eyebrow">BASELINE MODEL</p><h2>Small, inspectable, reproducible</h2><p>Ridge regression with six pregame features and a fixed regularization strength. Forecasts use the latest trained coefficients.</p><div class="model-bars">${(performance.coefficients ?? []).map(c => `<div class="coefficient"><span>${esc(c.name)}</span><span class="coef-track"><span style="--bar-width:${Math.min(100, Math.abs(c.value) * 15)}%"></span></span><span>${signed(c.value.toFixed(2))}</span></div>`).join('')}</div><p class="subtle">Coefficients use different feature scales; bar lengths are not feature-importance scores.</p><p class="subtle">${performance.trainingGames ?? 0} training games · ${esc(performance.version ?? 'not trained')}<br>${performance.trainedAt ? esc(date(performance.trainedAt)) : ''}</p></article></div>
    <article class="panel paper-section"><p class="eyebrow">FORWARD TRACKING / ACTUAL COLLECTED QUOTES</p><h2>Paper results</h2><p>${bets.length ? 'First qualifying live candidate per event is archived at its observed line and price. One unit is risked per recorded candidate.' : 'No live paper candidates have been recorded. Demo picks are never counted as results.'}</p><div class="metric-pair"><div><strong>${bets.length}</strong><small>Recorded candidates</small></div><div><strong>${settled.length}</strong><small>Settled</small></div><div><strong>${signed(profit.toFixed(2))}u</strong><small>Net paper profit</small></div><div><strong>${settled.length ? signed((profit / settled.length * 100).toFixed(1)) + '%' : '—'}</strong><small>Paper ROI</small></div></div>${bets.length ? `<div class="table-wrap"><table class="simple-table"><thead><tr><th>Selected side</th><th>Line</th><th>Price</th><th>Status</th><th>Profit</th></tr></thead><tbody>${bets.slice(-30).reverse().map(b => `<tr><td>${esc(b.team)}</td><td>${signed(b.spread)}</td><td>${signed(b.price)}</td><td>${esc(b.status)}</td><td>${b.profit === null ? '—' : signed(b.profit.toFixed(2)) + 'u'}</td></tr>`).join('')}</tbody></table></div>` : ''}<p class="subtle">No retrospective picks, synthetic wins, or claimed historical sharp-money returns. Closing-line value and probability calibration are future extensions, not current metrics.</p></article>`;
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== button.dataset.view; });
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b === button); if (b === button) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
}));
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button ? 'true' : 'false'); }); render();
}));
$('#search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); if (dashboard) render(); });
function updateWeights() {
  for (const key of Object.keys(weights)) { weights[key] = Number($(`#weight-${key}`).value); $(`#out-${key}`).textContent = weights[key]; }
  const sum = Object.values(weights).reduce((s, v) => s + v, 0);
  $('#weight-summary').textContent = sum ? `${Math.round(weights.sharp / sum * 100)}% sharp · ${Math.round(weights.model / sum * 100)}% model · ${Math.round(weights.value / sum * 100)}% price` : 'All weights are zero';
  if (dashboard) render();
}
for (const key of Object.keys(weights)) $(`#weight-${key}`).addEventListener('input', updateWeights);
$('#reset-weights').addEventListener('click', () => { for (const key of Object.keys(weights)) $(`#weight-${key}`).value = DEFAULT_WEIGHTS[key]; updateWeights(); });
$('#import-button').addEventListener('click', () => { if (dashboard) $('#split-file').click(); });
$('#split-file').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 1_000_000) throw new Error('Please use a CSV smaller than 1 MB.');
    const rows = validateSplits(parseCSV(await file.text()));
    let applied = 0;
    for (const split of rows) {
      const g = dashboard.games.find(g => g.id === split.eventId && g.homeTeam === split.team);
      if (!g) throw new Error(`Unknown event/home team: ${split.eventId}. Use IDs from game details.`);
      if (!freshAt(split.capturedAt, now(), 24)) throw new Error('A split timestamp is stale or in the future. Use the collection time shown on the board for demo imports.');
    }
    for (const split of rows.sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))) { dashboard.games.find(g => g.id === split.eventId).split = split; applied++; }
    render(); $('#notice').textContent = `${applied} split rows imported for this session. ${dashboard.mode === 'demo' ? 'All quotes and model estimates remain synthetic demo data.' : 'These percentages are user supplied, not independently verified.'}`;
  } catch (error) { $('#notice').className = 'notice error'; $('#notice').textContent = `Import failed: ${error.message}`; }
  e.target.value = '';
});
$('#game-dialog').addEventListener('click', e => { if (e.target === $('#game-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
try {
  const responses = await Promise.all([fetch('/data/dashboard.json'), fetch('/data/performance.json'), fetch('/data/backtest.json')]);
  if (responses.some(r => !r.ok)) throw new Error('Could not load analytical data');
  const loaded = await Promise.all(responses.map(r => r.json()));
  [dashboard, performance] = loaded;
  renderExperiment(loaded[2]);
  render(); renderPerformance();
  setInterval(() => { if (dashboard.mode === 'live') render(); }, 60_000);
} catch (error) { $('#notice').className = 'notice error'; $('#notice').textContent = `${error.message}. Refresh the page or check the data update workflow.`; }

