# Ephem

**Estimate. Retro. Forgotten.**

An open-source, no-login, ephemeral sprint room. Run blind-reveal planning poker and a retrospective over one shareable link — no account, no database, no record kept after the room ends. Retro cards are clustered **on your device**, for free.

> Status: pre-alpha. Design spec in [`docs/superpowers/specs/`](docs/superpowers/specs/). Landscape research in [`docs/research/`](docs/research/).

## Why it exists
The only sprint tool that runs **poker AND retro** in one no-login, no-database, evaporates-when-you-leave room — built so a single maintainer can run the public instance at ~$0 idle. See the spec for the honest 10x scorecard (it's 10x for the maintainer and the privacy-bound user; ~1.3x for everyone else).

## Stack
- Frontend: React + Vite + TypeScript + Tailwind → Cloudflare Pages (static)
- Realtime: one Cloudflare Worker hosting one Durable Object per room (in-memory authoritative state, WebSocket fan-out, idle TTL). No database.
- AI: on-device retro clustering (transformers.js + all-MiniLM-L6-v2, in a Web Worker). Keyless, private, free.

## Privacy (the honest version)
No database. No accounts. No cross-session records. A room is deleted when everyone leaves. Room state is briefly held in encrypted Durable Object storage so a server restart can't nuke a live retro — so we say "no database / deleted when the room ends," never "nothing is ever written." On-device clustering sends nothing to any server (watch the Network tab).

## License
[AGPL-3.0](LICENSE).
