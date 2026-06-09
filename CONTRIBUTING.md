# Contributing to Scrumlo

Thanks for wanting to help. Scrumlo is intentionally tiny · one Worker, one Durable Object per room, no database. Please keep PRs small and focused.

## Setup

```bash
pnpm install
pnpm build && pnpm dev:worker   # http://localhost:8787
```

## Easiest contributions

- **New retro formats / estimation decks** are pure data in [`shared/protocol.ts`](shared/protocol.ts) (`RETRO_TEMPLATES`, `DECKS`) · no other code needed.
- **Bug fixes** with a clear repro.

## Non-goals (please don't PR these)

Accounts, a database, persistent history, integrations/OAuth, or anything that makes Scrumlo keep data across sessions. The whole point is that the room forgets. New ceremony tools must reuse the existing engines (blind-reveal, cards, dot-vote, presence) and survive being ephemeral.

## Ground rules

- Match the surrounding code style. Run `pnpm build` before pushing.
- Be kind in reviews. Maintained by volunteers; responses may take time.
