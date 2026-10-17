import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, relative } from 'node:path';

export function spaceReturns(source) {
  const lines = [];
  for (const line of source.split('\n')) {
    if (/^\s*return\b/.test(line) && lines.length > 0 && lines.at(-1).trim() !== '') lines.push('');
    lines.push(line);
  }
  return lines.join('\n');
}

function* sources(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !['obj', 'bin'].includes(entry.name)) yield* sources(path);
    else if (entry.isFile() && entry.name.endsWith('.cs')) yield path;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const path of sources(join(root, 'backend'))) {
    const source = readFileSync(path, 'utf8');
    const formatted = spaceReturns(source);
    if (formatted === source) continue;
    if (process.argv.includes('--write')) writeFileSync(path, formatted);
    else {
      console.error(`${relative(root, path)}: a blank line is required before each return. Run node scripts/backend-style.mjs --write.`);
      process.exitCode = 1;
    }
  }
}
