# Instructor (task-taker) — rules for Claude Code

These rules apply to every task in this repository. If a rule and a request conflict, stop and ask.

## How to work

1. **Read the code first.** Before proposing anything, read the files involved and the related docs in `docs/`.
2. **Show me the plan.** Present a short plan (files, migrations, endpoints, screens, tests) and wait for approval before changing code.
3. **Ask before deleting.** Never delete files, tables, columns, branches or data without explicit approval.
4. **Do not touch `.env` files.** Never read, edit, create or print `.env`, `.env.production` or any secret file. Use `*.example` files for documentation.
5. **Match existing code.** Follow the patterns, naming, folder structure and style already used in the module you are changing.
6. **Ask before installing new packages.** Name the package, version and why it is needed; wait for approval. This includes GitHub Actions from the marketplace.
7. **One change at a time.** One task, one branch, one pull request. Do not mix unrelated fixes into a change.
8. **Write a test** for every behaviour you add or fix (at least one per acceptance criterion of the story).
9. **Run the tests** (`cd backend && pnpm test`, frontend lint/build) before saying a task is done.
10. **Do not fake a test pass.** Never skip, delete, weaken or mock away a failing test to make it green. If a test fails, report it.
11. **Todos for later.** Anything out of scope goes in `docs/TODO.md` with a one-line reason, not into the current change.
12. **No secrets in code.** No keys, passwords, tokens or real phone numbers in code, tests, fixtures, logs or commits.
13. **Commit every change.** Small commits with clear messages (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`).
14. **Ask when unsure.** If requirements, data impact or design are unclear, ask instead of guessing.
15. **Say what changed.** End every task with: files changed, migrations added, how it was tested, and anything left undone.
16. **Do not flatter or agree by default.** Don't say I'm right unless I am. Point out mistakes, risks and better options plainly.

## Branches and releases

17. **Branch rule.**
    - `main` is the release branch ("master"); `develop` deploys to beta.
    - New work always starts from `main`: `git checkout -b <type>/<short-task-name> origin/main`.
      Types: `feature/` (new capability), `task/` (chore, setup, refactor), `fix/` (bug or issue), `hotfix/` (urgent fix on main).
    - Open a pull request into `develop` first. After CI passes and the change works on beta, open a pull request from `develop` into `main`.
    - **Ask me before anything goes to `main`.** Merges into `develop` and `main` happen only through pull requests that I approve manually. Never push directly to `develop` or `main`, never force-push them.

## Project rules

- Source of truth: `docs/spec.md` (feature stories, IDs like ATT-06), `docs/design.md` (architecture), `docs/schema.dbml` (target schema), `docs/ui/design-system.md` (UI). Read the parts named in the task.
- Backend (NestJS, pnpm): one module per domain. A module writes only its own tables; other modules are reached through their service or an event.
- Multi-tenancy: every query on tenant data is scoped by `organization_id`. Never return or modify another organisation's data.
- Feature switches: gate new features by plan/feature keys (see `docs/design.md` §8.3).
- Anything sent to users (SMS, email, push) goes through the notification outbox, never directly from a request handler.
- Schema changes: a TypeORM migration in `backend/src/migrations` plus an update to `docs/schema.dbml`. Do not rely on `DATABASE_SYNCRONIZE`.
- Times are stored as `timestamptz` in UTC; school days as `date` in the organisation's time zone (default `Asia/Dhaka`).
- Frontend (Next.js, npm): use the shared UI components and design tokens; no hard-coded colours or font sizes in new code. All user-facing text in Bangla and English.
- Deployment to beta is done by `.github/workflows/deploy-beta.yml` on merge to `develop`. Never run database reset, `docker compose down -v`, or production migrations by hand without approval.
