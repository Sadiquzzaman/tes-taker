# Instructor — Development Plan v1 (solo + Claude Code)

Oct 23, 2026 · @Instructor

**Current target: a beta-ready web release in 7 days**, with Claude Code writing all the code and you reviewing. The mobile app, ZKTeco and the remaining epics follow after the beta. Section 0 is the one-week plan. Sections 1–6 are the full catalogue of work packages and the original full-roadmap estimate, which the beta sprint draws from. Stories are traced to the [Feature Specification](https://claude.ai/code/artifact/6ac6c80a-7758-4c4c-81e6-aff49c4715af) and the [System Design](https://claude.ai/artifact/CNHNafqHsNU3XVx5HyHoB8).

## 0. One-week web beta

**In the beta (web only, Must stories):** security fixes, the new design system, foundations, attendance on the web, homework, calendar and reminders, syllabus (AI import + progress), performance and report cards, proctoring settings and live monitor, group chat threads, and resources as links.

**After the beta:**

- Flutter app and app check-in with selfie
- ZKTeco
- S3 move (beta keeps local file storage) and video upload
- Question bank, voice drafts, print-ready paper sets
- Plagiarism
- IELTS workspace
- Production launch

**Before day 1 (you):**

- [ ] Link GitHub to Claude (Settings → Connectors) and allow `task-taker`
- [ ] Confirm how beta deploys today (server access or a CI deploy key)
- [ ] A paid-tier Gemini API key for the beta `.env`
- [ ] BulkSMS BD sandbox/test number and a small SMS budget for beta
- [ ] A copy of beta data to test migrations on

| Day | Claude Code builds (2–3 parallel sessions) | Packages | You review that evening |
| --- | --- | --- | --- |
| 1 | Repo setup, CI, worker; payment, exam-deadline, shuffle and OTP fixes; design tokens | P0-01–08, P1-01 | Payment and exam diffs line by line; CI green |
| 2 | Components, `/dev/ui`, app shell, Bangla/English; rebuild dashboard, classes, tests, grading | P1-02–06 | Component screenshots at 375 and 1280 px |
| 3 | Tenancy (SOLO orgs), subscriptions + feature switches, sessions/sections/subject classes + migration, setup wizard, student + guardian import, grading scale | P2-01–06, P2-09 | Migration on the beta data copy; tenancy tests |
| 4 | Notifications (outbox, SMS allowance + top-ups, bell); attendance settings, holidays, roll call, leave, status resolver + 11:59 PM SMS, reports | P2-08, P3-01–04, P3-06 | Test SMS to your own phone; run the 11:59 PM job twice |
| 5 | Homework (create, submit, score, paper grid); routine with clash check, events, reminders | P5-01–05 | Full homework loop as teacher and student |
| 6 | AI syllabus import + review + progress; performance weights, live scores, student page, report cards; proctoring level per exam + live monitor | P6-01–04, P7-01–04, P8-01–03 | Import your Class 6 booklet; generate one report card |
| 7 | Group chat with post threads; resources (links); tenancy tests on every endpoint; deploy to beta; smoke test of every flow in bn and en | P9-01–03, P11-02 | Sign off the beta |

**If a day slips:** move the day 6 proctoring work and day 7 resources to after the beta, never the day 1 security fixes or the day 3 migration tests.

## 1. Full roadmap (original estimate, all platforms)

&#91;embedded content: Roadmap · 12 phases, estimated weeks\]

**Why this order:**

1. **Security fixes first.** The payment and exam loopholes affect money and fairness today.
2. **The design system before any new screen,** so the 60+ new screens are built attractive once, not rebuilt later.
3. **Foundations before features.** Every epic depends on tenancy, subject classes, files and notifications.
4. **Attendance + SMS, the app, then homework and calendar.** These sell management to coaching centres, so they reach beta first (week 23).
5. The rest follows by value: syllabus and performance next, then IELTS last.

Weeks are estimates for full-time work. Re-plan at the end of every phase using the actual days spent.

## 2. How to build with Claude Code

Claude Code writes most of the code. Your job is to choose the next work package, approve its plan, review the risky parts and test on beta. Six habits make that safe for one person.

### 2.1 One-time repo setup (in P0)

1. **Put the source of truth in the repo.** Export the three docs to Markdown and commit them where Claude Code reads them in every session:
   - `docs/spec.md` (Feature Specification)
   - `docs/design.md` (System Design)
   - `docs/schema.dbml` (schema)
   - `docs/ui/design-system.md` (section 3 of this plan)
2. **Write a `CLAUDE.md` at the repo root** with the rules below. Claude Code loads it in every session, so you never repeat them.
3. **Use one package manager** (pnpm) for backend, web and the agent, and a root `Makefile`/`justfile`: `make test`, `make lint`, `make build`, `make migrate`.
4. **Turn on CI from day one:** lint, type-check, unit tests, critical-path tests, production build of web and API, and migrations run on an empty database. Claude Code can't merge red.
5. **Branches:** `feature/<package-id>` → PR to `develop` (beta) → `main` (production) at the end of each phase.

### 2.2 What goes in `CLAUDE.md`

```markdown
# Instructor — rules for every change
- Read docs/spec.md, docs/design.md and docs/schema.dbml for the story IDs in the task before planning.
- Backend: NestJS modules per docs/design.md §4. A module writes only its own tables; cross-module = service call or event.
- Every tenant query goes through TenantRepository (organization_id always applied). Never use getRepository() in feature modules.
- Gate features with @RequiresFeature('<key>'); check limits in services. Keys are listed in docs/design.md §8.3.
- Anything sent to a user (SMS, email, push) is written to notification_outbox in the same transaction. Never call providers from the API.
- Rosters always come from OfferingRoster.students(offeringId).
- Schema changes = TypeORM migration + update docs/schema.dbml. synchronize is never turned on.
- Times: timestamptz UTC; school days are `date` in organizations.timezone.
- UI: use components from frontend/ui only; colours, spacing and type from tokens only (no hex, no text-[13px]). Every string through i18n (bn + en).
- Tests: every story's acceptance criteria get at least one test. Run `make test` and `make build` before saying a task is done.
- Never commit secrets. Never edit .env files.
```

### 2.3 The loop for every work package

1. **Plan.** Start Claude Code in plan mode with the package prompt (2.4). It reads the stories and proposes files, migrations, endpoints, screens and tests.
2. **Approve or correct.** Spend 5 minutes here; it saves hours. Check tables and endpoints against `docs/design.md`.
3. **Build.** Let it implement, tests included. For UI packages, ask it to use the `frontend-design` skill and to screenshot the pages with Playwright at 375 px and 1280 px.
4. **Verify.**
   - `make test` and `make build` pass.
   - Open the screens yourself.
   - For auth, payments, tenancy and migrations, read the diff line by line.
5. **Review with fresh eyes.** Ask a separate Claude Code session (or a subagent) to review the PR against the story's acceptance criteria and `CLAUDE.md`. Fix what it finds.
6. **Ship to beta.** Merge to `develop`, let CI deploy, smoke-test the flow on beta, and tick the package in this plan.

### 2.4 Prompt template for a work package

```text
Work package P3-04 — Status resolver and guardian SMS.
Stories: ATT-06, ATT-10 (docs/spec.md). Design: docs/design.md §6.1, §7 (attendance.on-punch, attendance.resolve-day), §8.6.
Tables: daily_attendance, notification_outbox (docs/schema.dbml).
Done when:
- every acceptance criterion in ATT-06 and ATT-10 has a passing test
- the 11:59 PM job is idempotent (running twice sends no second SMS)
- holidays and weekly off days are skipped
Out of scope: UI changes.
Start in plan mode and wait for my approval.
```

## 3. UI direction and design-system brief

The UI gets better by building **one design system first (P1)** and then rebuilding every screen on it. Polishing screens one by one doesn't work. Today's code has 95 hard-coded colours, 14 ad-hoc font sizes and 285 raw buttons. This section is written for Claude Code: save it as `docs/ui/design-system.md`, and every UI package follows it.

### 3.1 Direction

- **Feel: calm, trustworthy, fast to scan.** Teachers use it between classes; owners show it to parents. Avoid slideware gradients and heavy shadows.
- **Keep the brand green.** `#49734F` stays the primary colour. Warm off-white canvas, white cards, one attention colour (amber) for things that need action today.
- **Bangla-first typography.** Bangla text must never look like an afterthought: proper font, larger line height, Bangla digits when the user picks Bangla.
- **Mobile-first.** Most students and many teachers are on phones. Every screen is designed at 375 px first, then widened.

### 3.2 Tokens

All tokens are defined once in `frontend/ui/tokens.json` and generated into Tailwind `@theme` (web) and `ThemeData` (Flutter). Nothing outside the token file uses a raw value.

| Group | Tokens |
| --- | --- |
| Colour — brand | `primary` #49734F (existing), `primary-hover` #3D6242 (existing), `primary-soft` (tint for selected rows and badges) |
| Colour — text | `ink` #232A25 (existing), `ink-muted` #747775 (existing), `ink-inverse` |
| Colour — surfaces | `canvas` (warm off-white), `surface` (white), `surface-raised`, `border` #E5E5E5 (existing) |
| Colour — status | `success`, `warning` (amber, "needs action"), `danger`, `info`, each with a soft background |
| Type | Latin: Instrument Sans (existing brand). Bangla: Hind Siliguri. Marketing headings only: DM Serif Display. Scale: 12 / 14 / 16 / 20 / 24 / 32; line height 1.5 Latin, 1.7 Bangla |
| Spacing | 4-point scale: 4, 8, 12, 16, 24, 32, 48 |
| Radius | 6 (inputs), 10 (cards), 16 (sheets and modals), full (pills) |
| Elevation | 2 levels only: card and overlay |
| Motion | 150 ms ease-out for hover and focus; 250 ms for sheets; respects reduced motion |

Dark mode: tokens are named by role (not by colour), so it can be added later without touching screens.

### 3.3 Components (build in P1, in this order)

1. Button, IconButton, Link
2. Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, DatePicker, TimePicker, FileDrop (with the compression progress from FND-15)
3. Card, StatTile, Badge/StatusPill, Avatar, Tag
4. Table with sorting, filters, empty and loading states, row selection and a mobile card view
5. Tabs, Breadcrumb, Pagination, Stepper (for wizards)
6. Modal, Drawer (forms open in drawers), Sheet (mobile), Toast, Confirm dialog
7. EmptyState (illustration + one action), Skeleton, ErrorState with retry
8. Layout: AppShell (sidebar by role and feature switches, top bar with org switcher, bell, language toggle), PageHeader, FilterBar

A `/dev/ui` page shows every component in every state. Claude Code screenshots it at the end of P1 for your review.

### 3.4 Screen patterns

| Pattern | Rule | Used by |
| --- | --- | --- |
| Home = "Today" | Top strip shows what needs action now: classes now and next, roll calls not taken, leave to approve, work to mark, live exams. Charts sit below | Teacher, admin, owner, student homes |
| One-tap roll call | Everyone starts Present; tap a student to cycle Absent → Late → Leave; one Save; works offline on mobile | ATT-07 |
| List → detail | Filterable list; the detail page has tabs; edits open in a drawer, never a new page | Classes, students, homework, exams |
| Side-by-side review | Source on the left (photo crop or submission), editable result on the right, flagged items highlighted amber | Syllabus import, homework marking, plagiarism |
| Live grid | Tiles with a status colour, sorted with problems first, click for a timeline | Proctoring live monitor, attendance today |
| Calm exam screen | Question navigator, answered/flagged states, a small proctoring status pill; warnings explained in one plain sentence | Exam taking |
| Wizard | Stepper, maximum 5 steps, a summary before finishing | Academic setup, exam builder, report-card run |

### 3.5 Quality bar for every UI package

- Built only from `frontend/ui` components and tokens. CI fails on raw hex values or `text-[Npx]`.
- Loading, empty, error and success states are designed, not left to chance.
- Works at 375, 768 and 1280 px. Tap targets are at least 44 px. Text contrast meets WCAG AA.
- Bangla and English both checked; long Bangla labels must not break layouts.
- Playwright screenshots at 375 and 1280 px are attached to the PR.

## 4. Phases and work packages

68 work packages in 12 phases, about 208 working days in total. Sizes are **working days for one developer with Claude Code**, including review and beta testing. Each phase ends with a beta release, and its packages can be shipped behind feature switches (FND-07), so unfinished work stays hidden.

### P0 — Setup and security fixes (weeks 1–2)

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P0-01 | Repo hygiene: `docs/` folder, `CLAUDE.md`, pnpm everywhere, Makefile, env clean-up | Plan §2 | 1 |
| P0-02 | CI: lint, type-check, tests, builds, migration check on an empty DB | Design §11 | 1 |
| P0-03 | Test harness: Postgres and Redis in Docker for tests, data factories, first API tests | — | 2 |
| P0-04 | Worker process: `worker.ts`, BullMQ, bull-board (admin only) | Design §3, §7 | 1 |
| P0-05 | Payment fix: server-side price, login + ownership, private lookup | Design §8.8 | 1.5 |
| P0-06 | Exam fixes: `effective_deadline`, status checks, auto-submit job | Design §6.2 | 2 |
| P0-07 | Per-student shuffle of options and matching columns | Design §6.2 | 1 |
| P0-08 | Rate-limit fix, OTP lockout, `crypto.randomInt`, Swagger off in production | Design §8.2 | 0.5 |

### P1 — Design system and app shell (weeks 3–5)

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P1-01 | Tokens file → Tailwind theme; fonts (Instrument Sans + Hind Siliguri) | Plan §3.2 | 1 |
| P1-02 | Core components, groups 1–4 of §3.3, plus `/dev/ui` page | Plan §3.3 | 4 |
| P1-03 | Components, groups 5–8 of §3.3 | Plan §3.3 | 3 |
| P1-04 | i18n (bn/en), language toggle, Bangla digits and dates | FND-18 | 2 |
| P1-05 | Rebuild existing screens on the new system: dashboard, classes, tests, grading, billing | Review §4 | 4 |
| P1-06 | Landing page redesign with real product shots; mobile header fix | Review §4 | 1 |

### P2 — Foundations (weeks 6–10)

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P2-01 | One tenancy model: SOLO orgs, `TenantRepository`, tenancy guard tests | Design §8.1, M2 | 3 |
| P2-02 | Account subscriptions, entitlements, `@RequiresFeature`, role-based upgrade message | FND-07, FND-08 | 3 |
| P2-03 | Sessions, terms, sections, course offerings, enrolments + data migration | FND-01, 02, 04, 19, M3 | 5 |
| P2-04 | Academic setup wizard and level renaming | FND-02, 03, 05 | 3 |
| P2-05 | Student CSV import with preview; guardians | FND-04, FND-09, 10 | 3 |
| P2-06 | Grading scale settings | FND-11 | 1 |
| P2-07 | Files: S3 presign, compression job, quota, move `/uploads` to S3 | FND-15, 16, M4 | 3 |
| P2-08 | Notifications: outbox, templates, SMS allowance + top-ups, inbox bell, FCM, message log | FND-12, 13, 14 | 4 |
| P2-09 | Audit log; platform-admin feature switches and limits UI | Design §8.3, §8.10 | 2 |

### P3 — Attendance on the web + ZKTeco (weeks 11–14)

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P3-01 | Attendance settings and holidays | ATT-01, CAL-04 | 1.5 |
| P3-02 | One-tap roll call (web), locking, photo proof | ATT-07, 08 | 3 |
| P3-03 | Leave requests and approvals (students and teachers) | ATT-09, 11 | 2 |
| P3-04 | Status resolver, 11:59 PM job, guardian SMS | ATT-06, 10 | 3 |
| P3-05 | ZKTeco: device registry, user mapping, agent program, hourly push, health alerts | ATT-02, 03 | 5 |
| P3-06 | Corrections, daily summary, monthly register (PDF/Excel), repeated-absence alert | ATT-12, 13, 14 | 3 |

### P4 — Flutter app v1 (weeks 15–19)

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P4-01 | Flutter project, theme from tokens, i18n, API client generated from OpenAPI, token login + refresh | Design §8.2 | 4 |
| P4-02 | Login/OTP, org switcher, "Today" home per role, notification inbox + push | FND-12, 17 | 4 |
| P4-03 | Check-in with radius, selfie and mock-location detection | ATT-04, 05 | 3 |
| P4-04 | Offline roll call for teachers; leave apply/approve | ATT-07, 09 | 3 |
| P4-05 | Play Store internal testing + TestFlight pipeline | Design §11 | 2 |

### P5 — Homework and calendar (weeks 20–23) → management v1 on beta

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P5-01 | Homework create, target subject classes, publish, notify | HW-01, 02 | 3 |
| P5-02 | Submit on web and app (photos → PDF), late flag, resubmission | HW-03 | 3 |
| P5-03 | Review and score, paper-homework grid, overview and reminders | HW-04, 05, 06 | 3 |
| P5-04 | Weekly routine builder with clash warnings and one-day exceptions | CAL-01, 02 | 3 |
| P5-05 | Events, calendar views, iCal; multi-reminder rules and jobs; change notices | CAL-03, 05, 06, 07 | 3 |

### P6 — Syllabus AI and question bank (weeks 24–27)

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P6-01 | `AiProvider` (Gemini, Groq fallback), `ai_requests`, quotas | Design §8.7 | 2 |
| P6-02 | Syllabus import job: pass 1, pass 2 × 2, compare, draft | SYL-01, Design §6.3 | 4 |
| P6-03 | Side-by-side review screen and publish (terms, units, topics, blueprints) | SYL-01 | 3 |
| P6-04 | Manual editor, plan dates, lesson-log prompt, progress views, admin coverage | SYL-02–06 | 4 |
| P6-05 | Question bank: save, tag, search, random pick; homework uses the builder | QA-01, 02 | 3 |
| P6-06 | Voice-request question drafts; formula templates | QA-03, 04 | 2 |

### P7 — Performance and reports (weeks 28–30)

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P7-01 | Offline exams and marks grid/import; behaviour ratings | PRF-03, 04 | 3 |
| P7-02 | Weights, live recompute, score history | PRF-01, 02, Design §8.11 | 3 |
| P7-03 | Student page, strengths and weaknesses, class and org dashboards | PRF-05–08 | 4 |
| P7-04 | Report cards: bn/en PDF, bulk, versions, guardian link; merit position | PRF-09, 10 | 3 |

### P8 — Exams and proctoring upgrade (weeks 31–33)

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P8-01 | Proctoring level per exam, limited by plan; auto-disqualify settings | PRO-01, 02 | 2 |
| P8-02 | Redis live state, Socket.IO Redis adapter, `proctoring_events`, monitoring lost | PRO-07, Design §6.2 | 3 |
| P8-03 | Teacher live monitor and alerts | PRO-03, 08 | 3 |
| P8-04 | Snapshots, review/overturn, integrity report PDF | PRO-04, 05, 06 | 3 |
| P8-05 | Exam screen redesign, low-bandwidth answer queue, print-ready papers (sets A/B/C) | PRO-09, QA-05 | 4 |

### P9 — Chat and resources (weeks 34–36)

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P9-01 | Real-time group chat per subject class, post comment threads, announcement mode | COM-01, 03 | 4 |
| P9-02 | Private chat upgrade, admin access log, reports, mutes, retention | COM-02, 04, 05, 06 | 2 |
| P9-03 | Resource library, sharing, views, download control | RES-01, 03–06 | 3 |
| P9-04 | Video upload → MediaConvert HLS | RES-02 | 2 |
| P9-05 | Flutter: homework, chat, resources, results screens | — | 4 |

### P10 — Plagiarism and IELTS (weeks 37–40)

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P10-01 | Similarity engine (bn/en), side-by-side review, thresholds | PLG-01–03 | 3 |
| P10-02 | IELTS workspace, dashboards, profiles, course path label | IEL-01, 02 | 3 |
| P10-03 | Listening (audio) and Reading builders, band tables | IEL-03, 04 | 4 |
| P10-04 | Writing and Speaking: recording, criteria marking | IEL-05, 06 | 4 |
| P10-05 | Mock tests, band progress chart, band report | IEL-07, 08, 09 | 3 |

### P11 — Hardening and launch (weeks 41–42)

| ID | Work package | Stories / design | Days |
| --- | --- | --- | --- |
| P11-01 | Load test: 2,000 concurrent exam takers and the 11:59 PM job for 100 orgs (k6) | AWS doc | 2 |
| P11-02 | Security pass: tenancy tests on every endpoint, dependency audit, secrets scan | Design §8 | 2 |
| P11-03 | Production on AWS; backup restore drill; monitoring and alerts | Design §10, §11 | 3 |
| P11-04 | Drop legacy tables (M7); onboarding guide in Bangla and English; pricing page with the real plans | Design §12 | 3 |

The AI-writing indicator (PLG-04, Could) is not scheduled. Add it only if customers ask for it.

## 5. Definition of done, testing and release

**A work package is done when:**

- [ ] Every acceptance criterion of its stories has a passing automated test, or a written manual check for pure UI.
- [ ] `make test` and `make build` pass in CI. Migrations run on an empty database and on a copy of beta data.
- [ ] Screens meet the quality bar in §3.5, with screenshots in the PR.
- [ ] `docs/schema.dbml` and `docs/design.md` are updated if tables or flows changed.
- [ ] A fresh-eyes review (separate Claude Code session) found nothing open.
- [ ] It works on beta, checked by you, in Bangla and English.

**Tests that must exist before launch:**

| Area | Why it can't break | Kind |
| --- | --- | --- |
| Payments | Money | API tests against SSLCommerz sandbox: underpay rejected, ownership enforced |
| Tenancy | One school must never see another's data | A test per endpoint, run with two orgs |
| Exam rules | Fairness | Deadline, status, shuffle and answer stripping |
| Attendance resolver | Guardian SMS go to real parents | Late, absent, leave, holidays, running twice, time zone edge at midnight |
| SMS credits | Money and trust | Allowance first, then top-ups, zero balance, monthly reset |
| Scores | Report cards | Weights, live recompute, frozen snapshot, history |
| AI import | Cost and accuracy | Schema validation, retry, quota; a stored sample booklet as a fixture |

**Release rhythm:**

- Merge to `develop` deploys to beta automatically.
- At the end of each phase: one week of use on beta with 1–2 friendly coaching centres, then merge to `main` for production.
- New epics stay behind feature switches until you turn them on per organisation, so you can pilot with one customer first.
- The Flutter app releases at the end of P4, P5, P9 and P10 through Play Store internal testing and TestFlight first.

## 6. Risks and cut lines

| Risk | Effect | Mitigation |
| --- | --- | --- |
| One person, 42 weeks | Illness or support load stalls everything | Ship per phase; keep production to the existing product until P5; time-box support to mornings |
| Flutter is new to you | P4 overruns | Claude Code writes the Flutter code; keep app v1 to check-in, roll call, leave, inbox and home; use the web for everything else until P9 |
| ZKTeco hardware | Can't test the agent without a device | Buy the ZKTeco model your first customers use before P3; test the agent against it; support only tested models at first |
| Code you didn't write | Hidden bugs in money, tenancy, exams | Tests first in those areas; read those diffs line by line; fresh-eyes review on every PR |
| AI accuracy on poor photos | Teachers lose trust in syllabus import | Required review screen; photo tips; manual editor always available; track edit rate |
| Scope creep from early customers | The plan slips | New requests go to a backlog and are scheduled at the end of a phase, never in the middle |
| SMS and storage costs | Margin | Monthly allowance + top-ups, plan limits enforced from P2, cost dashboard for you |

**If time runs short, cut in this order** (each cut keeps the product coherent):

1. IELTS Writing/Speaking marking (P10-04): keep Listening/Reading auto-scored mocks.
2. Video upload (P9-04): links only.
3. Voice-request question drafts and formula templates (P6-06).
4. Snapshots and integrity report PDF (P8-04): keep the live monitor and flags.
5. Org-wide dashboard (part of P7-03): keep the student page and class dashboard.

**Never cut:** P0 (security), P2 (foundations), tests for payments, tenancy and attendance SMS.
