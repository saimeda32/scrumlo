# Security Policy

Ephem is a no-login, no-database, ephemeral tool — room state lives only in a Cloudflare Durable Object while the room is active and is deleted when everyone leaves. There is no user database and no stored credentials to breach.

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for an exploitable vulnerability.

- Open a [GitHub security advisory](../../security/advisories/new) on this repository, **or**
- Email the maintainer (see the repository owner's profile).

Please include steps to reproduce and the impact. We'll acknowledge as soon as we can.

## Scope notes

- Ephem is intended for **trusted shared links** among colleagues, not anonymous public boards. Abuse on a hosted instance is mitigated by: per-IP rate-limited room creation, a facilitator "end room" kill switch, and a "report" path (two reports end a room). The room itself is ephemeral and stores nothing across sessions.
- The hosted instance is best-effort with no SLA.
