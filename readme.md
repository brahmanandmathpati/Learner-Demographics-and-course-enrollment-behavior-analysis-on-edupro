# EduPro Learner Analytics

An interactive learner intelligence dashboard that analyzes the supplied EduPro Users CSV for demographic reach, representation, and roster-level exploration.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/edupro-learner-analytics/src/App.tsx` — dashboard UI, CSV parsing, filters, derived demographic metrics, and roster export
- `artifacts/edupro-learner-analytics/src/index.css` — EduPro dashboard theme and responsive visual system
- `artifacts/edupro-learner-analytics/public/data/users.csv` — supplied learner roster used by the dashboard
- `artifacts/edupro-learner-analytics/public/data/requirements.txt` — supplied analysis brief

## Architecture decisions

- The first build is frontend-only and reads the supplied CSV from the artifact's public data directory; no database or external integration is needed for this static source.
- Age bands are derived from the analysis brief and demographic summaries recompute from the active filters.
- Course, enrollment, category, level, and transaction metrics are intentionally not fabricated because only the Users table was supplied.

## Product

- Shows roster size, average age, observed age range, age-band distribution, and supplied gender composition.
- Supports age-band, gender, and free-text learner search filters.
- Exports the current filtered learner roster as CSV.
- Communicates the dataset coverage boundary and preserves raw gender labels.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
