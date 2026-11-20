#!/usr/bin/env node
/**
 * File names (ADR 0032): code files and their folders are kebab-case, with
 * dot-separated suffixes for their role.
 *
 *   staff-page.tsx   tenant-context.tsx   relay.test.ts   schema.d.ts
 *
 * Next's routing folders keep their own marks around a kebab-case name:
 * (app), [path], [...path], [[...rest]].
 *
 * Checked: .ts, .tsx, .mjs, .cjs and .js files under src/, test/, scripts/ and dev/.
 */
import { execFileSync } from "node:child_process";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CODE = /\.(ts|tsx|mjs|cjs|js)$/;
const ROUTE_FOLDER = /^(\(([a-z0-9-]+)\)|\[\[\.\.\.([a-z0-9-]+)\]\]|\[(\.\.\.)?([a-z0-9-]+)\])$/;

function folderOk(dir) {
  return KEBAB.test(dir) || ROUTE_FOLDER.test(dir);
}

function problemWith(file) {
  const parts = file.split("/");
  if (!["src", "test", "scripts", "dev"].includes(parts[0]) || !CODE.test(file)) return null;
  const pieces = parts.at(-1).replace(CODE, "").split(".");
  if (!pieces.every((piece) => KEBAB.test(piece))) return `${file}: name the file in kebab-case`;
  const folder = parts.slice(1, -1).find((dir) => !folderOk(dir));
  if (folder) return `${file}: the folder "${folder}" is not kebab-case`;
  return null;
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const files = [...git("ls-files").split("\n"), ...git("ls-files", "--others", "--exclude-standard").split("\n")].filter(Boolean);
const problems = files.map(problemWith).filter(Boolean);
if (problems.length > 0) {
  console.error(`File names must be kebab-case (ADR 0032):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`File names: ${files.length} files, all kebab-case.`);
