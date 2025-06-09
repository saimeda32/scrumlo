# Scrumlo

**Estimate. Retro. Forgotten.**

An open-source, no-login, ephemeral sprint room. Run blind-reveal **planning poker**, a **retrospective**, a random **picker**, and a shared **timer** over one shareable link — no account, no database, nothing kept after the room ends. The facilitator switches activities live and everyone follows.

> **Scrumlo** *(SCRUM-lo)* — the agile loop that comes around each sprint, then clears. One link runs the whole ceremony; when everyone leaves, *poof*.

## Why it exists

Other tools keep your boards; Scrumlo keeps **nothing** — on purpose. There's no database to leak and no account to manage. Each room is one little server that holds your votes and cards only while you're there, then deletes itself. It's open-source, so you can read exactly how — it's not a promise in a privacy policy, it's the architecture.

## What's in a room

- **Estimate** — blind simultaneous reveal (values withheld server-side until reveal), 6 decks, color-coded consensus + a plain-logic outlier nudge ("not in sync — talk to the 3 and the 13"), re-vote, claimable facilitator baton.
- **Retro** — 10 real formats (Start/Stop/Continue, Mad/Sad/Glad, 4Ls, Sailboat, Starfish, …), anonymous cards, dot-voting.
- **Pick** — random person / shuffle order / pick-from-list.
- **Timer** — a shared facilitator-run countdown.
- **Export** — one-click Markdown of the session (client-side), so the team keeps what matters when the room forgets.

## Using a room

1. **Open the app** and hit *Start a room* — you get a private link like `scrumlo.app/r/brave-otter-42`.
2. **Share the link.** Anyone who opens it lands as a spectator and renders instantly; they **drop a name** to grab a seat and act. No sign-up.
3. **The facilitator drives.** Whoever claims the baton switches between **Estimate / Retro / Pick** and starts the shared **timer** — everyone's screen follows live.
   - **Estimate:** pick a card (or press a number key; `R` reveals). Votes stay hidden until everyone's in, then reveal together. Queue a backlog of stories and step through them.
   - **Retro:** pick a format, drop stickies anywhere on the zoomable canvas, drag to arrange, dot-vote, react, and spotlight a card for the room. You can see everyone's **live cursors**.
   - **Pick:** spin the wheel for a random person, shuffle an order, or pick from a comma-separated list — with confetti and no repeats.
4. **Export before you go.** One click gives you **Markdown** or a **full-board PNG/PDF** — the only thing that survives the room.
5. **Leave.** When the last person leaves (or the room idles out), it **deletes itself**. Nothing to clean up.

## Stack

- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 → static assets.
- **Backend:** **one Cloudflare Worker** that serves the app **and** hosts **one SQLite Durable Object per room** — authoritative in-memory state, WebSocket fan-out (with Hibernation), write-through to DO storage, idle TTL. **No database.**
- **Realtime:** server-authoritative snapshots over WebSockets; high-frequency presence (typing, live cursors, drag) rides lightweight side-channels so a room scales to ~20 people without snapshot spam.

## Privacy (the honest version)

No database. No accounts. No cross-session records. A room is deleted when everyone leaves (or after it idles out). Room state is briefly held in encrypted Durable Object storage so a server restart can't nuke a live retro — so we say *"no database / deleted when the room ends,"* never *"nothing is ever written."*

## Run it locally

```bash
pnpm install
pnpm dev          # web (vite --watch) + worker (wrangler dev) together
# → http://localhost:8787
```

Or run the two halves yourself:

```bash
pnpm build        # build the web app -> dist/
pnpm dev:worker   # wrangler dev serves the SPA + the DO at http://localhost:8787
```

> Note: `wrangler dev` serves the **last built** `dist/`. After changing frontend code, rebuild (`pnpm build`) or use `pnpm dev` (which watches) so you're not staring at a stale bundle.

## Deploy your own

One Worker, no other services:

```bash
npx wrangler login
pnpm deploy        # vite build && wrangler deploy
```

SQLite-backed Durable Objects run on the Cloudflare **Free** plan; an idle room costs nothing (WebSocket Hibernation). Room creation is rate-limited per IP.

> Honest scope: Scrumlo is for **trusted shared links** among colleagues, not anonymous public boards. The facilitator can end a room instantly; anyone can report one (two reports end it). See [TERMS.md](TERMS.md).

## Contributing

Small, focused PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). New retro formats and estimation decks are pure data in [`shared/protocol.ts`](shared/protocol.ts).

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md).

## License

[AGPL-3.0](LICENSE) — it stays open forever.
