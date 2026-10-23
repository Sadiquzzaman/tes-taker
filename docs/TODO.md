# TODO

Out-of-scope items noted during other tasks. One line each, with the reason.

- A paid subscription that was cancelled by a newer "subscribe" click is still activated when its old payment settles — P0-05 kept existing behaviour so a full payment is never lost; decide refund vs. activate.
- Add `organization_id` to `teacher_subscriptions` and payments — subscriptions are per teacher today, so P0-05 checks ownership by `teacher_id`; P2-02 (account subscriptions) should scope by organisation.
- Add a real DB test for payment initiate → settle → activate — P0-05 tests use mocked repositories until P0-03 adds a DB test harness.
- Auto-submit job for abandoned exam attempts (every minute: `status = IN_PROGRESS AND effective_deadline < now() - 60 s` → AUTO_SUBMITTED with saved answers, conditional update, compute the deadline when `effective_deadline` is NULL for attempts started before P0-06) — owner chose to build it in the P0-04 BullMQ worker instead of adding `@nestjs/schedule` now; until then abandoned attempts stay IN_PROGRESS (no further writes are accepted).
- Test migrations on a copy of beta data, not only an empty database — Development Plan §5 definition of done; needs a sanitised beta dump.
- Decide on `POST /student/exams/:examId/save-answer` (positional options) — the frontend autosaves through `/answersheet`; with the legacy GET removed nothing serves positional options any more, so it can likely go too (needs owner approval to remove).
- Rotate the SSLCommerz sandbox store credentials that were committed in `backend/src/modules/payment/README.md` (now placeholders) and in git history — only needed if that store is used anywhere; owner action.
- Add vitest tests for the frontend fetch hooks changed in #69 (`useGetExamResult`, `useGetGradeDetails`, `useGetSubmissionGradingDetail`, `useGetAllSubject`) — the harness exists now; only `ExamCountdown`, the join pages and `useBrowserStorage` are covered.
