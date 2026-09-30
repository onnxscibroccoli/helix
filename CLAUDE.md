# Claude context pack — Helix

Hard limit: stay under the model context window. If a read would add more than ~8k tokens, stop and ask for a path.

## Always load

- `AGENTS.md`
- this file

## Load on demand only

| Task | Open |
| --- | --- |
| Auth / UI | `src/` file that matches the symptom |
| Gateway | `production/` file named in the issue |
| IaC | one stack under `infra/` |
| Tests | the failing file under `test-suite/` |
| Live URLs | `docs/LIVE_PATHS.md` |

## Never auto-load

- `.grok/skills/` and `.grok/references/` (Grok App Builder leftover; not Helix ops)
- `package-lock.json`
- `screenshots/`
- the entire `docs/` or `infra/` tree

## Default command

`HELIX_SKIP_LIVE=1 pytest test-suite/tests -q`
