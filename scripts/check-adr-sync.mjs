#!/usr/bin/env node
/**
 * The ADRs (docs/adr/) and the glossary (GLOSSARY.md) are the same files in
 * medora-backend and medora-front, byte for byte (ADRs 0001, 0032).
 *
 * Compared with, in order:
 *   1. a checkout of the other repo beside this one (../medora-front or ../medora-backend);
 *   2. in CI, the other repo on GitHub, read with SIBLING_REPO_TOKEN: the branch of
 *      the same name if it exists (a pair of pull requests), otherwise main.
 * In CI a missing token fails the run. On a machine without the other repo
 * the check says it was skipped.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const here = basename(resolve('.'));
const sibling = here === 'medora-front' ? 'medora-backend' : 'medora-front';
const SHARED_FILES = ['GLOSSARY.md'];
const ADR_DIR = 'docs/adr';

function localSet(root) {
  const set = new Map();
  for (const name of readdirSync(join(root, ADR_DIR)).filter((n) => n.endsWith('.md')).sort()) {
    set.set(`${ADR_DIR}/${name}`, readFileSync(join(root, ADR_DIR, name), 'utf8'));
  }
  for (const file of SHARED_FILES) if (existsSync(join(root, file))) set.set(file, readFileSync(join(root, file), 'utf8'));
  return set;
}

async function remoteSet(owner, token) {
  const api = `https://api.github.com/repos/${owner}/${sibling}`;
  const headers = { authorization: `Bearer ${token}`, 'user-agent': 'medora-adr-sync', 'x-github-api-version': '2022-11-28' };
  const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'main';
  const branchExists = (await fetch(`${api}/branches/${encodeURIComponent(branch)}`, { headers })).ok;
  const ref = branchExists ? branch : 'main';
  const list = await fetch(`${api}/contents/${ADR_DIR}?ref=${encodeURIComponent(ref)}`, { headers });
  if (!list.ok) throw new Error(`Could not list ${sibling}/${ADR_DIR} at ${ref}: ${list.status}`);
  const set = new Map();
  const raw = { ...headers, accept: 'application/vnd.github.raw' };
  for (const entry of (await list.json()).filter((e) => e.name.endsWith('.md'))) {
    const file = await fetch(`${api}/contents/${ADR_DIR}/${entry.name}?ref=${encodeURIComponent(ref)}`, { headers: raw });
    set.set(`${ADR_DIR}/${entry.name}`, await file.text());
  }
  for (const name of SHARED_FILES) {
    const file = await fetch(`${api}/contents/${name}?ref=${encodeURIComponent(ref)}`, { headers: raw });
    if (file.ok) set.set(name, await file.text());
  }
  return { set, ref };
}

const mine = localSet('.');
let theirs;
let where;
if (existsSync(join('..', sibling, ADR_DIR))) {
  theirs = localSet(join('..', sibling));
  where = `../${sibling}`;
} else if (process.env.CI) {
  const token = process.env.SIBLING_REPO_TOKEN;
  if (!token) {
    console.error(`SIBLING_REPO_TOKEN is not set, so the ADRs can't be compared with ${sibling}. Add a read-only token for ${sibling} as a repository secret.`);
    process.exit(1);
  }
  const owner = (process.env.GITHUB_REPOSITORY ?? '').split('/')[0];
  const remote = await remoteSet(owner, token);
  theirs = remote.set;
  where = `${owner}/${sibling}@${remote.ref}`;
} else {
  console.log(`ADR sync: skipped, no ../${sibling} checkout here. CI compares with GitHub.`);
  process.exit(0);
}

const problems = [];
for (const [file, text] of mine) {
  if (!theirs.has(file)) problems.push(`${file} is missing from ${where}`);
  else if (theirs.get(file) !== text) problems.push(`${file} differs from ${where}`);
}
for (const file of theirs.keys()) if (!mine.has(file)) problems.push(`${file} is in ${where} but not here`);
if (problems.length > 0) {
  console.error(`ADRs and the glossary must match ${sibling} exactly:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`ADR sync: ${mine.size} files match ${where}.`);
