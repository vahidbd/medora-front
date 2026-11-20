#!/usr/bin/env node
/**
 * Preview-mode launcher: runs the mock API and Next together with
 * MEDORA_PREVIEW=1, and stops both when either exits or on Ctrl-C.
 *
 *   node dev/preview.mjs dev     [next dev args…]    mock API + next dev
 *   node dev/preview.mjs build   [next build args…]  next build into .next/preview
 *   node dev/preview.mjs start   [next start args…]  mock API + next start
 *
 * Env: MOCK_API_PORT (default 4010), PORT for Next (Next's own default 3000).
 * BACKEND_URL is pointed at the mock unless PREVIEW_BACKEND_URL says otherwise;
 * nothing here is read from or written to an env file.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [command = "dev", ...extra] = process.argv.slice(2);
if (!["dev", "build", "start"].includes(command)) {
  process.stderr.write(`Usage: node dev/preview.mjs <dev|build|start> [next args…]\n`);
  process.exit(2);
}

const mockPort = process.env.MOCK_API_PORT || "4010";
const backendUrl = process.env.PREVIEW_BACKEND_URL || `http://127.0.0.1:${mockPort}`;
const env = {
  ...process.env,
  MEDORA_PREVIEW: "1",
  MOCK_API_PORT: mockPort,
  BACKEND_URL: backendUrl,
  // Clerk is stubbed out; these keep any stray Clerk import from refusing to start.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_preview",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "sk_test_preview",
};

const require = createRequire(path.join(root, "package.json"));
const nextBin = require.resolve("next/dist/bin/next");
const children = new Set();
let stopping = false;

function run(label, args) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit" });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!stopping) {
      if (code !== 0 || command !== "build") process.stderr.write(`[preview] ${label} exited (${signal ?? code}); stopping.\n`);
      stop(signal ? 1 : code ?? 0);
    }
  });
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(code);
  }, 5000);
  timer.unref();
  const check = setInterval(() => {
    if (children.size === 0) {
      clearInterval(check);
      process.exit(code);
    }
  }, 50);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
    stop(0);
  });
}

if (command !== "build") {
  process.stdout.write(`[preview] mock API on ${backendUrl}, Next with MEDORA_PREVIEW=1\n`);
  run("mock-api", [path.join(root, "dev/mock-api/server.mjs")]);
}
run("next", [nextBin, command, ...extra]);
