# 0004. Stack: TypeScript, Next.js, Fastify, Zod, Drizzle and Postgres

- Status: Accepted
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Build strategy and external rails
- Regulation: none
- Sign-off: product owner, 20 Nov 2026

## Context

Medora needs a relational database with transactions, row-level security and exact money arithmetic, a typed API whose inputs and outputs are declared, and a web frontend that can render on the server and keep tokens away from the browser. An edge-worker stack with a SQLite-style database was considered and set aside: it has no row-level security, weaker transactions and no stored procedures for the tenancy and audit guarantees below.

## Decision

- **Backend:** TypeScript on Node.js 22, Fastify 5 as a REST API under `/api/v1`, Zod 4 schemas on every request and reply, PostgreSQL 16 through Drizzle ORM, SQL migrations under `src/db/migrations`.
- **Frontend:** Next.js 16 App Router, React 19, Tailwind CSS v4, shadcn/ui on Base UI, TanStack Query.
- **One language end to end**, strict TypeScript in both repos.

## Consequences

- Row-level security, CHECK constraints, triggers and transactions are available for the rules that must not depend on application code alone.
- Every route declares its contract, which feeds the generated frontend types ([0014](0014-one-contract-package.md)).

## Where it lives

- `package.json`, `tsconfig.json` and `src/` in each repo.
