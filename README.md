# Ephem

**Estimate. Retro. Forgotten.**

An open-source, no-login, ephemeral sprint room. Run blind-reveal **planning poker**, a **retrospective**, a random **picker**, and a shared **timer** over one shareable link — no account, no database, nothing kept after the room ends. The facilitator switches activities live and everyone follows.

## Why it exists

Other tools keep your boards; Ephem keeps **nothing** — on purpose. There's no database to leak and no account to manage. Each room is one little server that holds your votes and cards only while you're there, then deletes itself. It's open-source, so you can read exactly how — it's not a promise in a privacy policy, it's the architecture.

## What's in a room

- **Estimate** — blind simultaneous reveal (values withheld server-side until reveal), 6 decks, color-coded consensus + a plain-logic outlier nudge ("not in sync — talk to the 3 and the 13"), re-vote, claimable facilitator baton.
- **Retro** — 10 real formats (Start/Stop/Continue, Mad/Sad/Glad, 4Ls, Sailboat, Starfish, …), anonymous cards, dot-voting.
- **Pick** — random person / shuffle order / pick-from-list.
- **Timer** — a shared facilitator-run countdown.
- **Export** — one-click Markdown of the session (client-side), so the team keeps what matters when the room forgets.

## Stack

- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 → static assets.
- **Backend:** **one Cloudflare Worker** that serves the app **and** hosts **one SQLite Durable Object per room** — authoritative in-memory state, WebSocket fan-out, write-through to DO storage, idle TTL. **No database.**

## Privacy (the honest version)

No database. No accounts. No cross-session records. A room is deleted when everyone leaves (or after it idles out). Room state is briefly held in encrypted Durable Object storage so a server restart can't nuke a live retro — so we say *"no database / deleted when the room ends,"* never *"nothing is ever written."*

## Run it locally

```bash
pnpm install
pnpm build        # build the web app -> dist/
pnpm dev:worker   # wrangler dev serves the SPA + the DO at http://localhost:8787
```

## Deploy your own

One Worker, no other services:

```bash
npx wrangler login
pnpm deploy        # vite build && wrangler deploy
```

SQLite-backed Durable Objects run on the Cloudflare **Free** plan; an idle room costs nothing (WebSocket Hibernation). Room creation is rate-limited per IP.

> Honest scope: Ephem is for **trusted shared links** among colleagues, not anonymous public boards. The facilitator can end a room instantly; anyone can report one (two reports end it). See [TERMS.md](TERMS.md).

## Contributing

Small, focused PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). New retro formats and estimation decks are pure data in [`shared/protocol.ts`](shared/protocol.ts).

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md).

## License

[AGPL-3.0](LICENSE) — it stays open forever.
