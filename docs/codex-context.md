# Codex project context

Reading notes recorded on 2026-11-27. This is a navigation guide, not a second specification. Re-read the linked sources when working on the affected area.

## Start here

1. `AGENTS.md`: repository workflow and Storybook requirements.
2. `CLAUDE.md`: shared architecture, development commands, persistence/auth constraints and production cautions. It is locally available but gitignored; a new clone may not include it.
3. `PRODUCT.md`: product purpose, users, vocabulary and design principles.
4. Vault `C:\Web Documents\NN-Stock`: read the relevant task and specification before implementation. This vault is outside the repository and is not supplied by a clone.

If a local source is unavailable, report the missing path rather than assuming its contents. Use `package.json`, current code and migrations to verify implementation details; distinguish intended behavior in the vault from behavior actually present on the current branch.

## Vault map

Paths below are relative to `C:\Web Documents\NN-Stock`.

| When                                             | Read                                                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selecting work and checking acceptance           | `Tasks.md`; cards include branch names and may still be pending review after merge                                                                         |
| Changing behavior, permissions or calculations   | `Spec/Account Stocking v2/Spec v2.md`; read its changelog and affected `V2-*` rules, and keep the specification in sync with behavior changes              |
| Looking for supporting product or design context | Relevant notes under `Features/`, `Design/`, `Client/`, `Feedback/` and `Reference/`                                                                       |
| Investigating previous decisions                 | Relevant dated entries in `Log, <Month> <Year>.md`; historical context, not proof a branch was merged                                                      |
| Using the existing knowledge graph               | `Reference/Graphify False Call Edges.md`; the graph is in the repository's gitignored `graphify-out/`, and inferred call edges require import verification |

Read only documents needed for the task. Configuration and credential notes are not onboarding material; do not copy secrets into this guide, agent instructions or the vault.

## Product and code map

NN-STOCK is a Thai note-taking application for meat supply-chain stock and accounting. The Owner and two branch accounts (ศาลาแดง and มีนบุรี) jot business events; the system derives stock, cost, cash and profit from the log. Foodiva and Chef House are partners whose steps the Owner records, not signed-in users. Notes can be backdated and incomplete; missing data must remain distinguishable from zero. Owner and branch permissions differ, including which notes each can change.

| Area                           | Entry points and invariants                                                                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts and navigation        | `src/lib/accounts.ts`, `src/lib/nav.ts`, `src/app/owner/`, `src/app/branch/`; both routes use `src/components/pages/Workspace.tsx`                                                                               |
| Domain and calculations        | Public API `src/lib/store.ts`; implementation in `store/model.ts`, `mutate.ts`, `derived.ts`, `visibility.ts`, `ledger.ts`; keep the domain independent of React and Supabase                                    |
| Saving notes                   | `mutate()` is the domain write boundary; field definitions/validation involve `src/lib/forms.ts`; edits and voids append entries instead of overwriting history                                                  |
| Persistence                    | `src/lib/persistence.ts`: a versioned `Database` JSON payload, optimistic cache and revision checks; Owner saves the whole state, branch appends scoped entries                                                  |
| Server authorization           | `supabase/migrations/` and `src/lib/role-scope.ts`; UI visibility and `AccountGate` alone do not secure data                                                                                                     |
| Local/server parity            | `src/lib/local-db.server.ts`, `src/app/api/local-db/`, `supabase/tests/`, `tests/unit/server.test.ts`; update SQL and local behavior together                                                                    |
| Authentication and attachments | `src/lib/session.ts`, `src/proxy.ts`, `src/lib/supabase/`, `src/lib/attachment-store.ts`; consult `CLAUDE.md` before changing account switching or attachment persistence                                        |
| UI                             | Atomic layers in `src/components/`; page content under `organisms/owner`, `branch`, `shared`; composer and workspace state under `organisms/workspace`                                                           |
| Stories and styles             | `.storybook/fixtures.ts`, `.storybook/mocks/`, colocated `*.stories.tsx`, `src/styles/tokens.css`; follow the Storybook-first workflow in `AGENTS.md`                                                            |
| Verification                   | Scripts in `package.json`, pipeline in `.github/workflows/ci.yml`, unit tests in `tests/unit/`, SQL tests in `supabase/tests/`; consult `CLAUDE.md` for local E2E isolation and ask before writing new E2E tests |

## Caveats to carry forward

- At onboarding, the checkout was on `fix/quiet-bell` with existing changes in domain, forms, composer, SQL and tests. The spec changelog also describes that work. This is historical context: inspect git status afresh each session.
- `CLAUDE.md` mentions Next.js 16.3 and ten migrations, including backup/history migrations. At onboarding, `package.json` specified Next.js 16.4.6 and this checkout had eight migration files. Verify the current files and branch before relying on those descriptions or assuming backup tooling exists.
- `CLAUDE.md` warns that production migration history differs from the squashed repository history: do not run `supabase db push` against production. Investigate migration history before proposing a deployment.
- Keep runtime versions and commands sourced from `package.json`, the lockfile and installed documentation. Before writing Next.js code, read the relevant bundled guide under `node_modules/next/dist/docs/`.
- Daily work logs are separate from these onboarding notes. Write them only on request, to the current month's file under `C:\Web Documents\sunny-system-doc\Sunny-Working-Records`, following that file's front matter.
