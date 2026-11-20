#!/usr/bin/env node
/**
 * Other products' names never appear in this repo (ADR 0032). Every tracked
 * file (and every new one not yet ignored) is checked against
 * scripts/blocked-names.json, which holds only hashes, so the check itself
 * names nothing.
 *
 * A file's path and text are split into words (on anything but letters and
 * digits, and on camelCase), and each word, each two and three neighbouring
 * words joined, and for the names marked as substrings every slice of a
 * word of their length, is hashed and compared.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const blocked = JSON.parse(readFileSync(new URL('./blocked-names.json', import.meta.url), 'utf8'));
const words = new Set(blocked.words);
const substrings = blocked.substrings;
const lengths = [...new Set(substrings.map((s) => s.length))];
const substringHashes = new Set(substrings.map((s) => s.hash));
const hash = (text) => createHash('sha256').update(text).digest('hex');
const SELF = 'scripts/blocked-names.json';

function wordsOf(line) {
  return line
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hits(line) {
  const found = new Set();
  const parts = wordsOf(line);
  for (let i = 0; i < parts.length; i += 1) {
    for (let n = 1; n <= 3 && i + n <= parts.length; n += 1) {
      const joined = parts.slice(i, i + n).join('');
      if (words.has(hash(joined))) found.add(joined);
    }
    const word = parts[i];
    for (const length of lengths) {
      for (let start = 0; start + length <= word.length; start += 1) {
        const slice = word.slice(start, start + length);
        if (substringHashes.has(hash(slice))) found.add(word);
      }
    }
  }
  return [...found];
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const files = [...new Set([...git('ls-files').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(
  (file) => file && file !== SELF,
);

const problems = [];
for (const file of files) {
  for (const word of hits(file)) problems.push(`${file}: the path contains "${word}"`);
  let text;
  try {
    text = readFileSync(file);
  } catch {
    continue;
  }
  if (text.includes(0)) continue;
  text
    .toString('utf8')
    .split('\n')
    .forEach((line, index) => {
      for (const word of hits(line)) problems.push(`${file}:${index + 1}: "${word}"`);
    });
}

if (problems.length > 0) {
  console.error(`Blocked names found (ADR 0032). Replace them with Medora's own words:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Names: ${files.length} files checked, none blocked.`);
