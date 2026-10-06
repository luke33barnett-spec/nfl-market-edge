import { readFile } from 'node:fs/promises';
const dashboard = JSON.parse(await readFile('public/data/dashboard.json', 'utf8'));
if (dashboard.schemaVersion !== 1 || !['demo', 'live'].includes(dashboard.mode) || !Array.isArray(dashboard.games)) throw new Error('Invalid dashboard');
for (const f of ['public/index.html', 'public/styles.css', 'public/experiments.css', 'public/app.mjs', 'public/experiments.mjs', 'public/data/performance.json', 'public/data/backtest.json']) await readFile(f);
console.log(`Static site verified: ${dashboard.games.length} games, ${dashboard.mode} mode.`);
