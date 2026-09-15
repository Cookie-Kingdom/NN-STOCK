<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Git Workflow

`develop` is the integration branch — that is where you start and where finished work
lands. `main` is release only.

**One card from `Tasks.md` = one branch = one merge.**

```bash
git switch develop && git pull            # always start here, up to date
git switch -c feature/<short-slug>        # e.g. feature/token-layer
# … implement the card …
git switch develop && git merge --no-ff feature/<short-slug>
```

- Branch name is `feature/<short-slug>` — English, kebab-case, named after the card, not
  after the files touched. `fix/<slug>` for a defect that is not a card.
- **Never commit directly to `main`.** Never commit card work directly to `develop`
  either — branch first, even when the card looks like a one-line change.
- Merge back only when the card's `Acceptance:` line is true and `pnpm build` and
  `pnpm lint` pass. A branch that does not build does not merge.
- One card per branch. If you find a second piece of work mid-card, it is a new card on
  the board, not an extra commit on this branch.

---

# UI Changes Start in Storybook

Any UI change (new component, restyle, layout, new state or variant) is built in
Storybook first and wired into the app second.

```bash
pnpm storybook                            # http://localhost:6006, no Supabase needed
```

1. Add or update the story next to the component (`src/components/<level>/X.stories.tsx`),
   covering the states you change, in both light and dark (toolbar toggle).
2. Get the component right in Storybook.
3. Only then use it in the real page/workspace and check it in `pnpm dev`.

Organism stories:

- Data comes from `.storybook/fixtures.ts`, built with the real `mutate()`. Extend those
  fixtures rather than hand-writing `Database` objects.
- `@/lib/persistence` and `@/lib/session` are aliased to `.storybook/mocks/`; saves show
  in the Actions panel. A component that reads `latestDatabase()` needs the story to set
  `parameters: { db }` (or pass a `db` arg).
- Forms and dialogs go in a file tagged `!autodocs` — modal `<dialog>`s would stack on a
  Docs page.
