# Production control-plane database

Helix requires one authoritative PostgreSQL database in production. The EC2 hypervisor is compute substrate only; it does not own the control-plane database.

## Contract

- `DATABASE_URL` is injected by the production secret/configuration boundary. It is never committed, printed, or placed in source.
- PostgreSQL/Neon is authoritative for users, workspaces, and OmniKali task state.
- `REDIS_URL` is optional for short-lived distributed locks; PostgreSQL transactions remain authoritative for task state.
- Production migrations are the ordered files in `/migrations/`.
- `production/database/migrate.mjs` applies pending migrations under a PostgreSQL advisory lock and records successful filenames in `_helix_migrations`.
- `production/database/readiness.mjs` fails closed unless PostgreSQL is reachable and the control-plane/OmniKali tables exist.

## Bootstrap sequence

1. Select the already-authorized production PostgreSQL/Neon project. Do not create a second database merely because the gateway host lacks a binding.
2. Bind the production runtime to that database through the existing secret-management boundary.
3. Run `node production/database/migrate.mjs` once from the controlled deployment environment.
4. Run `node production/database/readiness.mjs` and require a zero exit status.
5. Verify backups/snapshots and recovery configuration on the database provider.
6. Only after readiness succeeds, restart/roll the gateway so it receives `DATABASE_URL`.
7. Execute the authenticated gateway -> task state -> worker -> Kali acceptance test, including stale-worker recovery.

## Safety

Never paste `DATABASE_URL` or a database password into source control, tickets, logs, or chat. Never point production at the temporary test database used by integration tests. A missing binding is a deployment/configuration failure, not permission to invent a replacement database.
