# TODO

Out-of-scope items noted during other tasks. One line each, with the reason.

- A paid subscription that was cancelled by a newer "subscribe" click is still activated when its old payment settles — P0-05 kept existing behaviour so a full payment is never lost; decide refund vs. activate.
- Test migrations on a copy of beta data, not only an empty database — Development Plan §5 definition of done; needs a sanitised beta dump.
- Decide on `POST /student/exams/:examId/save-answer` (positional options) — the frontend autosaves through `/answersheet`; with the legacy GET removed nothing serves positional options any more, so it can likely go too (needs owner approval to remove).
- Rotate the SSLCommerz sandbox store credentials that were committed in `backend/src/modules/payment/README.md` (now placeholders) and in git history — only needed if that store is used anywhere; owner action.
- Add vitest tests for the frontend fetch hooks changed in #69 (`useGetExamResult`, `useGetGradeDetails`, `useGetSubmissionGradingDetail`, `useGetAllSubject`) — the harness exists now; only `ExamCountdown`, the join pages and `useBrowserStorage` are covered.
- Alert on failed BullMQ jobs (design §7: Slack or email) — failed jobs are kept 7 days and visible in the queue dashboard, but nobody is notified yet (P0-04).
- API messages shown to users are English only (toasts with server text, exam `reason`) — design §8 (Language) says the API returns a `code` the clients translate; needs an error-code pass over the backend.
- Emails, SMS and PDFs in the recipient's language — P2-08 (message templates keyed by locale) and the PDF work; P1-04 covers screens only.
- Raise the library's default Button and IconButton (`h-10`, 40 px) to the 44 px tap target in plan §3.5 — P1-06 used `min-h-11` or `size="lg"` on the landing page only; changing the default touches every screen, so do it as its own change with a visual check.
- Translate the geometry, graph and chemistry workspaces inside the rich-text editor (`component/RichTextEditor/{geometry,graph,chemistry,panels}`, ~150 tool labels) — P1-05 covered the editor chrome (toolbar, node controls, equation dialog) only.
- Plan feature and limit names in Admin → Plans (`AdminPlansManager`) come from the API in English — P2-02 added translated names by key (`messages features.catalog`, `useFeatureNames`) for More features and Admin → Organisations; switch the plan editor to them.
- Terms of Service and Privacy Policy pages — the signup checkbox links went to `#`; P1-05 shows them as plain text until the pages exist.
- Proctoring flag details sent to the teacher's live log stay in English — the student now sees translated text by flag type; translate the teacher view with the teacher screens.
- Put `feature` on the first menu items in `frontend/utils/sidebarList.tsx` — P2-02 added the gate (hidden while the plan has the feature off), but today's keys are options inside pages, so no item uses it until the epics (attendance, homework, …) add their keys.
- Notification bell contents — the top-bar bell is decorative until the P2-08 inbox exists.
- Dark mode — not in the plan yet; the tokens are ready for a second set of values.
- Build the Docker images in GitHub Actions and have beta only pull them — beta (3.8 GB RAM) ran out of memory building the frontend on 2026-10-24; a 4 GB swap file fixed it for now.
- Translate the dashboard activity chart's labels ("Jan", "Mon", "Oct 5") — the API builds them as English text (`dashboard.service.ts`); return dates instead and format them in the browser.
- A real student home (next exam with a countdown, latest result, weak topics; review §4.5) — needs new API data; P1-05 rebuilt the existing workspace list only.
- Make `organization_id` NOT NULL on classes, exams, discussion posts and private conversations — P2-01 is expand + migrate only (design §12); after one release with no rows left NULL, ship the contract step.
- Hidden default branch per organisation (design §8.1, M2) — deferred from P2-01 because nothing uses it yet (`org_settings` came with P2-03; the P2-04 wizard does not need a branch); add it with attendance settings (P3-01) or branches (FND-06).
- Row-level security on tenant tables (design §8.1 phase 2) — P2-01 enforces tenancy in the guard, `TenantContext` and `tenantScoped()`; RLS is the database-level backstop.
- Move the remaining class and exam queries onto `tenantScoped()` — P2-01 switched the personal-workspace paths and kept existing organisation-session queries (already filtered by `organization_id`); convert the rest as those services are touched.
- P2-02 contract step (one release after #P2-02): drop `account_subscriptions.teacher_id`, `overrides`, `exams_used_this_month`, `total_exams_used`, `last_monthly_reset`, and the deprecated `GET /subscriptions/my-entitlements`; merge `payment_history` into `payments` (design §9.1) and make `payments.organization_id` NOT NULL.
- Notify platform admins of new feature requests (FND-08) — P2-02 stores and lists them; the SMS/email goes out through the outbox in P2-08.
- `@RequiresFeature` has no route yet — today's gates are per question type inside the exam service (same 403 code); use the decorator on the first whole-feature routes (attendance, homework, …).
- "More features" shows "Requested" only until the page reloads — there is no `GET /me/feature-requests`; the server keeps one open request per feature, so a second click does no harm.
- Class endpoints (`GET /classes`, `GET /classes/:id`, `/students`, `/teachers`, `/subjects`, subject-teacher assignments) and the admin subscription endpoints still return whole user rows (`google_id`, `is_active`, `locale`, …) — the password and refresh-token hashes are now `select: false`; map them to a small user view when the class screens are reworked.
- Flush cached exam papers (`exam:paper:*` in Redis) on beta and production after the user-secrets fix deploys, or wait for the 6-hour TTL — entries cached before the fix still hold target/excluded students' password and refresh-token hashes; owner decision.
- Section class teacher duties (approve leave, daily section attendance) — P2-03 stores the class teacher per section; the attendance epic (P3) uses it.
- Send the invitation for students invited from `POST /sections/:id/enrolments` (and P2-05's import) — P2-03 part 2a stores the INVITED row but sends nothing, because messages must go through the outbox (P2-08); the class screens still email directly as before.
- Soft delete for sections, subject classes, terms, subject class teachers and selected students — the owner chose to keep hard deletes there for now (P2-03); only students are soft-deleted and a class with student records cannot be deleted.
- Use the organisation's level names (`levelLabel()`, FND-03) in SMS and PDFs — P2-04 did the web app; message templates come with P2-08 and the PDF work.
- Level names in the Flutter app (FND-03) — read `GET /workspace/level-labels` and replace the same tokens when P4 builds the app.
- Clear `audit_logs.ip` after a set time (e.g. 12 months) — P2-09 stores the IP on every row (shown to platform admins only) and keeps rows for the organisation's lifetime (design §10); retention period is an owner decision.
