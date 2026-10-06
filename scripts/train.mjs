import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { train } from './model.mjs';
import { get, writeJSON } from './io.mjs';

await mkdir('data', { recursive: true });
if (process.argv.includes('--download')) {
  const { value } = await get('https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv', 'text');
  await writeFile('data/games.csv', value);
}
const model = train(await readFile('data/games.csv', 'utf8'));
await writeJSON('data/model.json', model);
await writeJSON('public/data/performance.json', {
  version: model.version, trainedAt: model.trainedAt, trainingGames: model.trainingGames,
  evaluations: model.evaluations, limitation: model.limitation,
  coefficients: model.featureNames.map((name, i) => ({ name, value: model.coefficients[i + 1] })),
  source: 'nflverse regular-season game results', paperBets: []
});
console.log(`Trained ${model.version} on ${model.trainingGames} games. Evaluated ${model.evaluations.length} earlier seasons.`);
