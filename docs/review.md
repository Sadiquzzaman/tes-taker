# Instructor Academy — Codebase Review (develop)

Oct 20, 2026 · @Instructor

## Summary

The exam engine is strong, but four loopholes need fixing before more selling: payments can be underpaid, matching questions show their answers, exam time limits aren't enforced on submit, and proctoring ignores plans. Reviewed `develop` at commit `5ba8995` (22 Sep 2026), the same commit as the local folder. Live screens were checked on beta.instructor.academy (public pages only; I didn't sign in).

**Fix this week (money and trust):**

1. **A teacher can buy Pro for 1 BDT.** The browser sends the payment amount, and the server never checks it against the plan price.
2. **Matching questions show students the answer.** The right-hand column is shown in the correct order and is never shuffled.
3. **Time limits aren't enforced on final submit.** A student who started can submit hours or days later.
4. **Proctoring ignores the plan and the teacher.** Every exam runs every check, including auto-disqualification, even on Free.
5. **Login and OTP rate limits can be bypassed.** Password-reset codes have no wrong-guess limit, so accounts can be taken over.

**Product position:** Instructor is a proctored-exam tool with a thin organisation layer. Management features a coaching centre pays for are absent: attendance, fees, routines, notices, guardian access, report cards. The code is set up for teacher subscriptions, not organisation subscriptions. That gap blocks the "proctoring + management" SaaS plan.

**UI:** It looks clean but generic. The pages carry no design system (95 hard-coded colours, 14 ad-hoc font sizes). The landing page has no product screenshot, and the student home is nearly empty. The mobile header breaks on the landing page.

## 1. Features today and what to add

The exam builder and the proctoring client are the most complete parts. Everything after the exam (insight, communication, reuse) is the weakest, and that is where customers decide to renew.

| Area | What exists on develop | Add to attract customers |
| --- | --- | --- |
| Accounts & roles | Email/phone + OTP sign-up, Google login, student → teacher request flow, separate org login, workspace switcher | Bangla interface; invite by link or QR for a whole class; parent/guardian accounts linked to students |
| Exam builder | Multi-step wizard; MCQ, multiple-response, true/false, fill-in-blank, matching/ordering, essay, passage (CQ); maths, chemistry (Ketcher), geometry, graphs, speech-to-text; model tests; IELTS category in the builder | **Question bank** with tags by class/subject/chapter (SSC/HSC); import from Word/Excel; per-student question and option shuffle; question sets A/B/C; exam templates |
| Taking exams | Join by link/code, permission check, autosave, countdown, resume, auto-submit | Offline-tolerant answer queue; low-bandwidth mode with no camera; a clear "you're reconnected" state |
| Proctoring | Tab switch, fullscreen, refresh, copy-paste, idle, devtools, second screen, face/no-face/multiple faces, looking away, phone, voice; flags count; auto-DQ | **Teacher live monitor** (backend exists, no screen built); per-exam proctoring presets (Off / Light / Strict); snapshot evidence at flag time; teacher can review and overturn a disqualification; integrity report PDF per student |
| Grading & results | Auto-score objectives, manual essay marking, publish grades, roster with violation counts, PDF paper and results export with watermark | Rubrics and comment bank for essays; **analytics** (score distribution, question difficulty, weak topics per student); merit list; printable report cards; SMS/WhatsApp result delivery to students and guardians |
| Classes | Create class, add by email/phone/CSV, approve joins, share link, subject discussions and private teacher–student chat (MongoDB) | Announcements/notice board; class routine; assignments with file submission; attendance |
| Organisation | Org sign-up with admin approval; owner/admin/assistant/teacher/student roles; members import; subjects; classes; teacher–subject assignment; org exam monitor list | Org billing and seats; branches; org-wide exam calendar; centre-level dashboards; custom branding (logo on PDFs and login) |
| Billing | 4 teacher plans, SSLCommerz, admin plan editor with overrides and temporary access | Org plans; bKash/Nagad as first choice; invoices and receipts; renewal reminders; coupon codes |
| Admin | Users, teachers, requests, orgs, subjects, plans, payments | Revenue/MRR, active users, failed payments, churn; support impersonation with audit log |

Three additions do the most for sales in the Bangladesh coaching market:

1. **Guardian results by SMS.** You already have SMS (BulkSMS BD) and grading. Parents seeing results is what centres sell to families.
2. **Question bank + paper sets.** This cuts teacher effort per exam, which is the main reason tutors churn.
3. **Live monitor + integrity report.** It turns proctoring from a hidden feature into something a centre owner can see and show.

## 2. Loopholes in existing features

Each item below was traced through the code. Paths are relative to `backend/src` or `frontend`. Critical items let someone take money, marks or accounts.

| # | Severity | Loophole | Where | Fix |
| --- | --- | --- | --- | --- |
| 1 | Critical | **Underpaying for a plan.** `/payments/initiate` takes `amount` and `subscriptionId` from the browser and needs no login. Settlement checks the gateway amount against that same client amount, then activates the subscription. Paying 1 BDT activates Pro. | `modules/payment/payment.controller.ts`, `payment.service.ts` (`initiatePayment`, `activateSubscriptionIfNeeded`); `component/Account/AccountBilling.tsx` | Require login; take only `subscriptionId`; read the price from the PENDING subscription on the server; check that the subscription belongs to the caller |
| 2 | Critical | **Matching answers visible.** The answer is stored as left\[i\] ↔ right\[i\], and the right column is stored and served in that order. The "shuffled automatically" hint in the builder is not implemented. | `exams/utils/exam-question.util.ts` (`mapOptionsForStorage`); `exam.service.ts` (`formatAutoScoredQuestionResponse`); `lib/features/create-test/createTestDomain.ts` | Shuffle the right column per student when serving (seeded by submission id); never serve stored order |
| 3 | High | **Unlimited time.** `POST /:examId/answersheet` (final submit) checks neither the exam end time nor started\_at + duration. Autosave also allows saving after the exam ends while the attempt is IN\_PROGRESS. Nothing closes abandoned attempts. | `exams/student-exam.service.ts` (`finalizeAnswerSheet`, `assertExamOpenForTaking`) | Reject or auto-submit past `computeEffectiveDeadline` + 60 s grace; add a scheduled job that auto-submits expired attempts |
| 4 | High | **Edit after submit.** `saveAnswer` and `saveAnswerSheet` don't check that the attempt is still IN\_PROGRESS (the status filter is commented out). Within the exam window, a student can rewrite essay answers after submitting, before the teacher marks them. | `student-exam.service.ts` (`saveAnswer`, `saveAnswerSheet`) | Only allow writes when the status is IN\_PROGRESS |
| 5 | High | **Rate-limit bypass and OTP guessing.** The throttler keys requests by the user id in an *unverified* JWT. Sending a fake token per request gives unlimited login, OTP and reset attempts. Reset OTPs (6 digits, valid 5 min) have no wrong-guess counter. | `common/guard/app-throttler.guard.ts`; `auth/auth.service.ts` (`verifyResetOtp`); `sms/sms.service.ts` | Verify the JWT before using it as a key (or key auth routes by IP + identifier); lock an OTP after 5 wrong tries; generate OTPs with `crypto.randomInt` |
| 6 | High | **Plans don't control proctoring.** `useProctoring` is called without `proctoringFeatures`, so every check defaults to on, including auto-DQ. Free users get the full Pro suite, and teachers can't run a camera-free quiz. | `app/test/page.tsx`; `hooks/tests/proctoring/useProctoring.ts` | Store the proctoring settings on the exam (limited by plan); send them with the exam; default auto-DQ to off |
| 7 | High | **Proctoring is client-only.** Disqualification is whatever reason the browser sends. A student who blocks the script or edits requests is never flagged. | `student-exam.service.ts` (`finalizeAnswerSheet` reason); `proctoring/proctoring.gateway.ts` | Treat client flags as evidence, not verdicts; the server computes the outcome; flag missing heartbeats as "monitoring lost" |
| 8 | Medium | **Student caps leak.** `max_students_per_exam` is checked only at creation, against class size. "Anyone with link" exams and students who join later are never counted, so a Free teacher can run a 1,000-student exam. | `exams/exam.service.ts` (\~line 352) | Enforce at `startExam` by counting submissions |
| 9 | Medium | **No appeal for wrong disqualifications.** Face and voice checks give false positives in noisy coaching rooms. Teachers can't reinstate a student or allow a retake. | `student-exam.service.ts` | Teacher action: reinstate / allow retake, with an audit note |
| 10 | Medium | **Login rate limit hurts real classrooms.** Login allows 10 per minute per IP. A lab of 40 students behind one router will be blocked at exam start. | `auth/auth.controller.ts` `@Throttle` | Key login by IP + account identifier; raise per-IP limits |
| 11 | Medium | **Payment record lookup is public.** `GET /payments/:transactionId` needs no login and returns the customer's name, email and phone. | `payment.controller.ts` | Require login and ownership, or remove |
| 12 | Low | **API docs public in production.** Swagger is served at `/apidoc` on every environment. | `main.ts` | Serve only when not in production, or put it behind auth |
| 13 | Low | **Marketing promises unbuilt features.** The landing page sells "auto-disqualification on Pro plans", risk scoring and push notifications. Premium and Basic both allow 5 exams a month. | `app/page.tsx`, `component/Landing/LandingPricing.tsx`, plan seeds | Only list enforced features; give Premium more volume than Basic |

Your own docs already cover these engineering risks, and I confirmed them:

- 5 backend test files, no frontend tests, no CI.
- The proctoring session store is in memory, so state is lost on restart.
- Discussion data lives in two stores, and teacher assignments in two tables.

## 3. Getting to "proctoring, management, or both"

The code can't sell modules yet. Subscriptions belong to a teacher (`teacher_subscriptions`), the `/billing` page is blocked in organisation mode, and there is no management module to sell.

What each module should contain, and what's missing:

| Module | Built today | Missing |
| --- | --- | --- |
| Exams + Proctoring | Builder, taking, grading, results, client-side proctoring | Live monitor, per-exam presets, evidence, plan enforcement (loopholes 1–8) |
| Management | Org members and roles, classes, subjects, teacher assignment, discussions/chat | Attendance, fee collection and dues, class routine, notices/SMS broadcast, guardian portal, report cards, branches |
| Shared core | Users, orgs, classes, students, subjects | Org-level subscription with seats and enabled modules |

Changes needed to the data model:

1. **Subscriptions belong to an account, not a teacher.** Add `account_subscriptions` (owner = organisation or solo teacher) with `modules: ['exams','proctoring','management']`, seat limits (teachers, students) and an add-on list. A solo teacher becomes a one-person account, so one model covers both.
2. **One check for module access.** A guard and decorator (`@RequiresModule('management')`) on controllers, plus the same check in the frontend sidebar. Today's catalog flags become sub-features inside a module.
3. **Proctoring as a tier inside Exams.** Exams-only (no camera, browser checks off) → Proctoring Light (browser checks) → Proctoring Full (camera, voice, phone, live monitor, evidence). Meter Full by proctored-student-hours if camera costs grow.
4. **Management sold per student per month.** Coaching centres think in student counts, for example a fixed BDT price per active student with a minimum.

Suggested packages (prices to be set by you):

- **Solo Tutor:** Exams + Proctoring Light; up to 1 teacher.
- **Coaching Centre:** Management + Exams; Proctoring Light; up to N teachers and M students.
- **Centre Pro:** Everything, with Proctoring Full, guardian SMS and branding.
- **Add-ons:** extra SMS packs, extra proctored hours, extra branches.

## 4. UI review and suggestions

The UI feels unattractive because every screen is styled by hand with no shared system. Fixing the foundation first makes every later screen faster to polish. Live landing and login pages were checked on beta; logged-in screens were reviewed from the code.

**What the code shows:**

- **No design tokens.** `globals.css` has an empty `@theme`. 294 components use 95 distinct hard-coded hex colours and 14 arbitrary font sizes (`text-[13px]`, `text-[15px]`...).
- **No component library.** `Ui/` has 8 inputs. There is no shared Button, Card, Modal, Table, Badge, Tabs or EmptyState: there are 285 raw `<button>` tags and 15 separate modal files. MUI is also installed next to Tailwind.
- **Three typefaces** (Instrument Sans, Public Sans, DM Serif Display), often set with inline `style` attributes.
- **No dark mode, no Bangla.** Neither exists anywhere in the app.

**What the screens show:**

- **Landing hero is an empty grey box** with the logo and "Trusted by educators across Bangladesh". There is no product screenshot, no customer logos, no testimonials, and no story aimed at coaching centres or management.
- **Mobile header breaks.** At phone width, "Log in" and "Sign up free" wrap onto 2–3 lines and run into the logo. Most of your users will see this first.
- **Login page is half empty.** The left panel is a single headline over a large blank area.
- **The student home is just a list of workspaces.** There is no "next exam", no recent results and no progress, so students have no reason to come back between exams.

**Suggestions, in order:**

1. **Build a small design system first (about 1 week).** Define tokens in `@theme`: colour scale from your green #49734F, neutrals, success/warning/danger, a 6-step type scale, radius and shadow. Then build 10 primitives: Button, IconButton, Input, Select, Card, Modal/Drawer, Table, Badge/StatusPill, Tabs, EmptyState. Pick one typeface family for the UI and keep DM Serif for marketing headings. Remove MUI or limit it to the date picker.
2. **Fix mobile first.** Students take exams on phones. Collapse the landing nav into a menu at phone width, and test the exam screen, permission flow and results at 375 px.
3. **Redesign the landing page around outcomes and proof.** Use a real product screenshot or short loop of the exam builder and live monitor in the hero. Add a "For coaching centres" section (management + guardian SMS) and a Bangla/English toggle. Only list enforced features in the plan cards.
4. **Make the teacher dashboard about action.** Put one "Today" strip at the top (live now, starting soon, needs marking), then performance charts. Add a 3-step setup checklist (create class → add students → create exam) for new teachers.
5. **Build a student home that brings them back.** Show the next exam with a countdown, the latest result with change since last time, weak topics, and practice tests.
6. **Polish the exam-taking screen.** Show a question navigator grid, answered/flagged states and a calm proctoring status pill. Explain each warning in plain language rather than as a red alarm.
7. **Add a live monitor screen for teachers.** Show a grid of student tiles with status colour, latest flag and time left, and click a tile for the flag timeline. This is the screen that sells proctoring in a demo.
8. **Handle loading and errors consistently.** Use skeletons rather than spinners, friendly empty states with one clear action, and toasts written in plain words.

## 5. Suggested order of work

The order is: close the holes, make plans honest, then build the management module on an account-level subscription.

1. **Week 1: stop the leaks.** Fix loopholes 1–5 and 11. Add tests for payment settlement, matching shuffle, deadline enforcement and OTP lockout. Add a CI job that builds both apps.
2. **Weeks 2–3: make plans real.** Store proctoring settings per exam, limited by plan (loophole 6); default auto-DQ off; enforce student caps at start (8); fix the landing page and pricing copy (13). Start the design tokens and primitives.
3. **Weeks 4–6: make proctoring sellable.** Live monitor screen; server-side outcome rules (7); reinstate/retake (9); integrity report PDF; persist proctoring state in Redis.
4. **Weeks 6–10: account subscriptions + management v1.** `account_subscriptions` with modules and seats; org billing; attendance, fees/dues, notices with SMS, guardian access to results.
5. **Ongoing: UI rollout.** Move screens onto the new primitives, busiest first: exam-taking, then the teacher dashboard, the landing page and the student home.

Two questions only you can answer before step 4: will management be priced per student, per teacher or as a flat fee? And do you want a management-only tier at launch, or management bundled with exams?
