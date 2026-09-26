# Production control-plane database

Helix requires one authoritative PostgreSQL database in production. The EC2
hypervisor is compute substrate only; it does not own the control-plane database.

## Contract

- `DATABASE_URL` is injected by the production secret/configuration boundary. It
  is never committed, printed, or placed in source.
- Managed PostgreSQL is authoritative for users, workspaces, and OmniKali task
  state. The production infrastructure decision is AWS-owned; the application
  contract deliberately remains provider-neutral.
- `REDIS_URL` is optional for short-lived distributed locks; PostgreSQL
  transactions remain authoritative for task state.
- Production migrations are the ordered files in `/migrations/`.
- `production/database/migrate.mjs` applies pending migrations under a PostgreSQL
  advisory lock and records successful filenames in `_helix_migrations`.
- `production/database/readiness.mjs` fails closed unless PostgreSQL is reachable
  and the control-plane/OmniKali tables exist.

## Bootstrap sequence

1. Provision the authoritative managed PostgreSQL database in AWS, using the
   existing production VPC/network and an allowlisted application security group.
2. Keep the database private unless the deployment architecture explicitly
   requires external access. Prefer IAM authentication or an AWS-managed secret
   over long-lived credentials where the client path supports it.
3. Bind the production runtime to the database through the existing secret/config
   boundary. The application receives only its database contract; it does not
   provision infrastructure.
4. Run `node production/database/migrate.mjs` from a controlled environment that
   can reach the database.
5. Run `node production/database/readiness.mjs` and require a zero exit status.
6. Verify automated backups, point-in-time recovery, encryption, deletion
   protection, and recovery configuration.
7. Only after readiness succeeds, restart/roll the gateway and deploy the Vercel
   application with the approved PostgreSQL binding.
8. Execute the authenticated gateway -> task state -> worker -> Kali acceptance
   test, including stale-worker recovery.

## Safety

Never paste `DATABASE_URL` or a database password into source control, tickets,
logs, or chat. Never point production at the temporary test database used by
integration tests. A missing binding is a deployment/configuration failure, not
permission to invent a replacement database.
