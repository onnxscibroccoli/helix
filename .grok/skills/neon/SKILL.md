---
name: neon
description: >
  Deprecated compatibility skill. Production uses the provider-neutral PostgreSQL
  contract; use the postgres skill instead.
metadata:
  short-description: "Deprecated Neon-specific database skill"
user-invocable: false
---

# Deprecated

Neon is no longer the authoritative production database for Helix. Use
.grok/skills/postgres/SKILL.md and the AWS production database module instead.
Application code must depend only on PostgreSQL semantics and DATABASE_URL.
