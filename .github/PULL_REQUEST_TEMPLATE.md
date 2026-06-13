<!-- Thanks for contributing to Scrumlo. Keep PRs small and focused (see CONTRIBUTING.md). -->

## What and why

<!-- What does this change, and what problem does it solve? Link any related issue: Closes #123 -->

## Type of change

- [ ] Bug fix
- [ ] New retro format / estimation deck (data only, in `shared/protocol.ts`)
- [ ] New / improved ceremony tool
- [ ] Docs or chore
- [ ] Other:

## Checklist

- [ ] `pnpm build` and `pnpm typecheck` pass
- [ ] `pnpm lint` passes
- [ ] If behaviour changed in the UI, I added or updated a Playwright test (`pnpm test:e2e`)
- [ ] It matches the surrounding code style
- [ ] It stays **ephemeral**: no accounts, no database, no persistence, no third-party data sharing, no AI on room content (see the non-goals in CONTRIBUTING.md)
- [ ] New ceremony tools reuse the existing engines (blind-reveal, cards, dot-vote, presence) and survive a room that forgets everything

## Notes for reviewers

<!-- Screenshots / screen recordings for UI changes, edge cases you considered, anything you want a second pair of eyes on. -->
