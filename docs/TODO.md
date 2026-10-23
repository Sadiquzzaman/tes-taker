# TODO

Out-of-scope items noted during other tasks. One line each, with the reason.

- Organization subject duplicate checks use `ILike`, so `%` and `_` in a name or code act as wildcards — `organization.service.ts` find-or-create/update; the DB index (`LOWER()`) is exact.
- Move the frontend to pnpm — Development Plan §2.1 step 3 ("one package manager"); the frontend still uses npm and `package-lock.json`.
- Add the "TaskTaker Production Deployment Runbook" to the repo or fix the reference — `scripts/deploy/deploy-beta.sh` cites its §4 and §15, but it is not in the repo and `DEPLOYMENT.md` §4 covers pgAdmin.
- Confirm the beta server can `git pull` from GitHub (deploy key) — `deploy-beta.sh` fetches `develop` on the server.
- Add a frontend test harness and tests for `ExamCountdown`, the join pages and the fetch hooks — the lint-fix PR (#69) changed them with only manual browser checks.
- A paid subscription that was cancelled by a newer "subscribe" click is still activated when its old payment settles — P0-05 kept existing behaviour so a full payment is never lost; decide refund vs. activate.
- Add `organization_id` to `teacher_subscriptions` and payments — subscriptions are per teacher today, so P0-05 checks ownership by `teacher_id`; P2-02 (account subscriptions) should scope by organisation.
- Replace the SSLCommerz store id/password example values in `backend/src/modules/payment/README.md` with placeholders and rotate them if they are real — CLAUDE.md rule 12; noticed during P0-05.
- Add a real DB test for payment initiate → settle → activate — P0-05 tests use mocked repositories until P0-03 adds a DB test harness.
- Remove the dead SMTP branch in `backend/src/email/email.service.ts` (reads `EMAIL_USER`/`EMAIL_PASSWORD` only to log "Falling back to SMTP") and the unused `nodemailer` / `@types/nodemailer` dependencies — no SMTP sender exists; found in P0-01 env clean-up.
- Move the rate-limiter storage to Redis (`ThrottlerStorage`) before running more than one backend instance — counters are in memory per process (P0-08).
- Add a backend lint script (ESLint) and wire it into `make lint` — `backend/package.json` has no lint script, so `make lint` only lints the frontend; needs a new dev dependency, which requires approval.
- Switch CI to the `make` targets (`make install`, `make check`) — Development Plan P0-02; `ci.yml` still calls pnpm/npm directly.
- Auto-submit job for abandoned exam attempts (every minute: `status = IN_PROGRESS AND effective_deadline < now() - 60 s` → AUTO_SUBMITTED with saved answers, conditional update, compute the deadline when `effective_deadline` is NULL for attempts started before P0-06) — owner chose to build it in the P0-04 BullMQ worker instead of adding `@nestjs/schedule` now; until then abandoned attempts stay IN_PROGRESS (no further writes are accepted).
- Test migrations on a copy of beta data, not only an empty database — Development Plan §5 definition of done; needs a sanitised beta dump.
- Decide on `POST /student/exams/:examId/save-answer` (positional options) — the frontend autosaves through `/answersheet`; with the legacy GET removed nothing serves positional options any more, so it can likely go too (needs owner approval to remove).
