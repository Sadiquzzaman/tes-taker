# TODO

Out-of-scope items noted during other tasks. One line each, with the reason.

- Move the frontend to pnpm — Development Plan §2.1 step 3 ("one package manager"); the frontend still uses npm and `package-lock.json`.
- Add a frontend test harness and tests for `ExamCountdown`, the join pages and the fetch hooks — the lint-fix PR (#69) changed them with only manual browser checks.
- A paid subscription that was cancelled by a newer "subscribe" click is still activated when its old payment settles — P0-05 kept existing behaviour so a full payment is never lost; decide refund vs. activate.
- Add `organization_id` to `teacher_subscriptions` and payments — subscriptions are per teacher today, so P0-05 checks ownership by `teacher_id`; P2-02 (account subscriptions) should scope by organisation.
- Add a real DB test for payment initiate → settle → activate — P0-05 tests use mocked repositories until P0-03 adds a DB test harness.
- Move the rate-limiter storage to Redis (`ThrottlerStorage`) before running more than one backend instance — counters are in memory per process (P0-08).
- Add a backend lint script (ESLint) and wire it into `make lint` — `backend/package.json` has no lint script, so `make lint` only lints the frontend; needs a new dev dependency, which requires approval.
- Auto-submit job for abandoned exam attempts (every minute: `status = IN_PROGRESS AND effective_deadline < now() - 60 s` → AUTO_SUBMITTED with saved answers, conditional update, compute the deadline when `effective_deadline` is NULL for attempts started before P0-06) — owner chose to build it in the P0-04 BullMQ worker instead of adding `@nestjs/schedule` now; until then abandoned attempts stay IN_PROGRESS (no further writes are accepted).
- Test migrations on a copy of beta data, not only an empty database — Development Plan §5 definition of done; needs a sanitised beta dump.
- Decide on `POST /student/exams/:examId/save-answer` (positional options) — the frontend autosaves through `/answersheet`; with the legacy GET removed nothing serves positional options any more, so it can likely go too (needs owner approval to remove).
- Rotate the SSLCommerz sandbox store credentials that were committed in `backend/src/modules/payment/README.md` (now placeholders) and in git history — only needed if that store is used anywhere; owner action.
