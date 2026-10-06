import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
export async function readJSON(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw e; }
}
export async function writeJSON(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}
export async function get(url, type = 'json') {
  // Never log the URL: odds credentials are query parameters.
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`Data request failed with HTTP ${response.status}`);
  return { value: type === 'text' ? await response.text() : await response.json(), headers: response.headers };
}
