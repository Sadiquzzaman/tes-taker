# TODO

Out-of-scope items noted during other tasks. One line each, with the reason.

- A paid subscription that was cancelled by a newer "subscribe" click is still activated when its old payment settles — P0-05 kept existing behaviour so a full payment is never lost; decide refund vs. activate.
- Add `organization_id` to `teacher_subscriptions` and payments — subscriptions are per teacher today, so P0-05 checks ownership by `teacher_id`; P2-02 (account subscriptions) should scope by organisation.
- Test migrations on a copy of beta data, not only an empty database — Development Plan §5 definition of done; needs a sanitised beta dump.
- Decide on `POST /student/exams/:examId/save-answer` (positional options) — the frontend autosaves through `/answersheet`; with the legacy GET removed nothing serves positional options any more, so it can likely go too (needs owner approval to remove).
- Rotate the SSLCommerz sandbox store credentials that were committed in `backend/src/modules/payment/README.md` (now placeholders) and in git history — only needed if that store is used anywhere; owner action.
- Add vitest tests for the frontend fetch hooks changed in #69 (`useGetExamResult`, `useGetGradeDetails`, `useGetSubmissionGradingDetail`, `useGetAllSubject`) — the harness exists now; only `ExamCountdown`, the join pages and `useBrowserStorage` are covered.
- Alert on failed BullMQ jobs (design §7: Slack or email) — failed jobs are kept 7 days and visible in the queue dashboard, but nobody is notified yet (P0-04).
- Organisation default language (`organizations.default_locale`, FND-18 "the org sets the default") — P1-04 stores only the user's choice; the column belongs with the other new organisation columns (P2-01/P2-04).
- API messages shown to users are English only (toasts with server text, exam `reason`) — design §8 (Language) says the API returns a `code` the clients translate; needs an error-code pass over the backend.
- Emails, SMS and PDFs in the recipient's language — P2-08 (message templates keyed by locale) and the PDF work; P1-04 covers screens only.
- Raise the library's default Button and IconButton (`h-10`, 40 px) to the 44 px tap target in plan §3.5 — P1-06 used `min-h-11` or `size="lg"` on the landing page only; changing the default touches every screen, so do it as its own change with a visual check.
- Translate the geometry, graph and chemistry workspaces inside the rich-text editor (`component/RichTextEditor/{geometry,graph,chemistry,panels}`, ~150 tool labels) — P1-05 covered the editor chrome (toolbar, node controls, equation dialog) only.
- Plan feature and limit names in the admin plan editor come from the API in English (`/subscriptions/feature-catalog`) — return keys and translate them in the browser.
- Terms of Service and Privacy Policy pages — the signup checkbox links went to `#`; P1-05 shows them as plain text until the pages exist.
- Proctoring flag details sent to the teacher's live log stay in English — the student now sees translated text by flag type; translate the teacher view with the teacher screens.
- Hide sidebar items by feature switch — AppShell shows items by role only; needs the P2-02 entitlements.
- Notification bell contents — the top-bar bell is decorative until the P2-08 inbox exists.
- Dark mode — not in the plan yet; the tokens are ready for a second set of values.
- Build the Docker images in GitHub Actions and have beta only pull them — beta (3.8 GB RAM) ran out of memory building the frontend on 2026-10-24; a 4 GB swap file fixed it for now.
- Translate the dashboard activity chart's labels ("Jan", "Mon", "Oct 5") — the API builds them as English text (`dashboard.service.ts`); return dates instead and format them in the browser.
- A real student home (next exam with a countdown, latest result, weak topics; review §4.5) — needs new API data; P1-05 rebuilt the existing workspace list only.
