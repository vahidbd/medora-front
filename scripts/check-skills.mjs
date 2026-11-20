#!/usr/bin/env node
/**
 * Skills live in .agents/skills (read by most coding agents) and are copied
 * to .claude/skills (read by Claude Code). This fails when the copies differ;
 * `npm run skills:sync` (--write) makes .claude/skills match.
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = '.agents/skills';
const COPY = '.claude/skills';

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
    .sort();
}

if (process.argv.includes('--write')) {
  rmSync(COPY, { recursive: true, force: true });
  cpSync(SOURCE, COPY, { recursive: true });
  console.log(`Copied ${SOURCE} to ${COPY}.`);
  process.exit(0);
}

const source = files(SOURCE);
const copy = files(COPY);
const problems = [
  ...source.filter((file) => !copy.includes(file)).map((file) => `${COPY}/${file} is missing`),
  ...copy.filter((file) => !source.includes(file)).map((file) => `${COPY}/${file} has no source in ${SOURCE}`),
  ...source
    .filter((file) => copy.includes(file) && !readFileSync(join(SOURCE, file)).equals(readFileSync(join(COPY, file))))
    .map((file) => `${COPY}/${file} differs from ${SOURCE}/${file}`),
];
if (problems.length > 0) {
  console.error(`Skills are out of sync. Edit ${SOURCE}, then run npm run skills:sync:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Skills: ${source.length} files, ${COPY} matches ${SOURCE}.`);
