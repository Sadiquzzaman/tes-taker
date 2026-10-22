# TODO

Out-of-scope items noted during other tasks. One line each, with the reason.

- Add a type-check step to CI (`tsc --noEmit` for backend and frontend) — Development Plan P0-02 asks for it; `ci.yml` does not run it yet.
- Add a CI job that runs migrations on an empty PostgreSQL database — Development Plan P0-02 and §5; schema changes are not checked before deploy yet.
- Add a root `Makefile` (`make test`, `make lint`, `make build`, `make migrate`) — Development Plan §2.1 step 3.
- Move the frontend to pnpm — Development Plan §2.1 step 3 ("one package manager"); the frontend still uses npm and `package-lock.json`.
- Add the "TaskTaker Production Deployment Runbook" to the repo or fix the reference — `scripts/deploy/deploy-beta.sh` cites its §4 and §15, but it is not in the repo and `DEPLOYMENT.md` §4 covers pgAdmin.
- Confirm the beta server can `git pull` from GitHub (deploy key) — `deploy-beta.sh` fetches `develop` on the server.
- Add a frontend test harness and tests for `ExamCountdown`, the join pages and the fetch hooks — the lint-fix PR (#69) changed them with only manual browser checks.
- Remove the dead SMTP branch in `backend/src/email/email.service.ts` (reads `EMAIL_USER`/`EMAIL_PASSWORD` only to log "Falling back to SMTP") and the unused `nodemailer` / `@types/nodemailer` dependencies — no SMTP sender exists; found in P0-01 env clean-up.
- A paid subscription that was cancelled by a newer "subscribe" click is still activated when its old payment settles — P0-05 kept existing behaviour so a full payment is never lost; decide refund vs. activate.
- Add `organization_id` to `teacher_subscriptions` and payments — subscriptions are per teacher today, so P0-05 checks ownership by `teacher_id`; P2-02 (account subscriptions) should scope by organisation.
- Replace the SSLCommerz store id/password example values in `backend/src/modules/payment/README.md` with placeholders and rotate them if they are real — CLAUDE.md rule 12; noticed during P0-05.
- Add a real DB test for payment initiate → settle → activate — P0-05 tests use mocked repositories until P0-03 adds a DB test harness.
