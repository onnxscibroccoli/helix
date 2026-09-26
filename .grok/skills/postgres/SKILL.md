---
name: postgres
description: >
  Use the application's PostgreSQL database contract. The production provider is
  infrastructure-owned and may be AWS RDS/Aurora or another managed PostgreSQL
  service; application code must depend only on DATABASE_URL and PostgreSQL
  semantics. Local preview uses PGLite when DATABASE_URL is unset.
metadata:
  short-description: "Provider-neutral PostgreSQL with a local PGLite fallback"
user-invocable: false
---

# PostgreSQL

The application has a provider-neutral PostgreSQL contract. Do not add provider-
specific SDKs or provisioning assumptions to application code. Production gets
`DATABASE_URL` from the deployment/secret boundary; the current production
architecture provisions the authoritative database in AWS.

## Database modes

- **Configured:** regular PostgreSQL via `pg` using `DATABASE_URL`.
- **Preview:** embedded PGLite when `DATABASE_URL` is unset.
- Both modes expose the same `getSql()` surface from `@/lib/db`.

Never create `.env`, `.env.local`, or `.env.example` files for database
credentials. Never print or commit connection strings.

## Production contract

- PostgreSQL is authoritative for durable application, auth, workspace, and
  OmniKali control-plane state.
- The production database is managed outside the application runtime and is not
  hosted on the EC2 compute node.
- Migrations in `migrations/*.sql` are the schema source of truth.
- `production/database/migrate.mjs` applies migrations under a PostgreSQL
  advisory lock and records completed migrations.
- `production/database/readiness.mjs` is fail-closed and must succeed before
  production traffic is enabled.
- PostgreSQL features used by the application must remain compatible with a
  standard managed PostgreSQL service.

## Provider changes

If infrastructure changes from AWS RDS to another managed PostgreSQL service,
change infrastructure and secret/configuration binding only. Do not rename the
application database abstraction or introduce provider-specific query APIs.

## Per-user data

Use the authenticated server-side user identity to scope all per-user queries and
mutations. Never trust a client-supplied user ID. See the `auth` skill.

## Migrations

Use new ordered files under `migrations/`; never edit an already-applied
migration. Keep migrations transactional and compatible with PostgreSQL.

Preview differences to respect:

- PGLite is local/embedded and resets with the preview process.
- PGLite has no production extensions or distributed concurrency semantics.
- Do not rely on provider-specific pooling behavior, session state, or extensions
  unless the production architecture explicitly supports them.
