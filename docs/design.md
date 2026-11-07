# Instructor — System Design, DFD & Schema v1

Oct 21, 2026 · @Instructor

This document is the technical design for the [Feature Specification v1](https://claude.ai/code/artifact/6ac6c80a-7758-4c4c-81e6-aff49c4715af): a modular NestJS monolith plus a background worker, on PostgreSQL, MongoDB and Redis in AWS Singapore. It is for developers. Story IDs (ATT-03, SYL-01, …) refer to the spec.

## 1. Key decisions and tech stack

| Area | Decision | Why |
| --- | --- | --- |
| Architecture | **Modular monolith** (one NestJS API) + **one worker process** + **ZKTeco sync agent** | Small team; module boundaries give the option to split later without the cost of microservices now |
| Web | Next.js (existing), App Router | Already built |
| Mobile | **Flutter** app on the same REST API, token login | Team decision. Device-only features: GPS + selfie check-in, push, offline class attendance |
| API | NestJS 11, REST `/api/v1`, Socket.IO for real-time | Existing |
| Background jobs | **BullMQ** queues on Redis, run by a separate worker process (same codebase, different entry point) | Scheduled jobs (11:59 PM absence, reminders) and heavy jobs (AI, PDFs, video) must not block the API |
| Main database | **PostgreSQL** (RDS) | Source of truth for everything except chat |
| Chat | **MongoDB** (existing, kept) | Keeps high-volume chat traffic off PostgreSQL as usage grows |
| Cache, queues, live state | **Redis** (ElastiCache) | OTPs, exam paper cache, BullMQ, Socket.IO adapter, live proctoring state, rate limits |
| Files | **S3 + CloudFront**, signed URLs; video via **AWS MediaConvert** → HLS 720p | Replaces local disk; works with several API instances |
| AI | **Gemini 3.5 Flash-Lite** (paid tier) behind an `AiProvider` interface; Groq for text-only fallback | \~3–6 US cents per syllabus import (tested on a Class 6 booklet) |
| Speech-to-text | On-device: browser Web Speech API (`bn-BD`, `en-US`) and Flutter `speech_to_text` | Free |
| Push | Firebase Cloud Messaging (FCM) | Flutter + web push |
| SMS / email | BulkSMS BD / Brevo (existing) | Already integrated |
| Payments | SSLCommerz (existing), fixed per the codebase review | Already integrated |
| Hosting | AWS `ap-southeast-1` (Singapore) | Lowest latency from Bangladesh |
| Time | Store `timestamptz` in UTC. `organizations.timezone` defaults to `Asia/Dhaka`, and all schedules use it | Only Bangladesh for now, but ready for more |
| Tenancy | Shared database, `organization_id` on every tenant table, enforced in a request-scoped guard; PostgreSQL row-level security in phase 2 | Simple, fits 100 orgs |
| Scale target (12 months) | 100 organisations, up to 200,000 students, 2,000–3,000 concurrent exam takers | From the owner; exam figure from the AWS doc |
| Retention | Check-in selfies and proctoring snapshots: 90 days; everything else is kept. Organisations are deactivated on request, never deleted (owner decision, 30 Oct) | From the owner |

## 2. DFD Level 0 — context

&#91;embedded content: DFD level 0 · context\]

Guardians never call the platform. They only receive SMS and signed report links. ZKTeco devices reach the platform through the sync agent at the institution, never directly.

## 3. System architecture

&#91;embedded content: System architecture · containers\]

The API and the worker are the same NestJS codebase with two entry points: `main.ts` (HTTP + Socket.IO) and `worker.ts` (BullMQ processors + schedulers). Both use PostgreSQL, MongoDB, Redis and S3. The API answers requests in under 300 ms and puts anything slower or scheduled on a queue.

**Rules for every request:**

- **API instances are stateless.** Sessions use JWTs, live state is in Redis, and files are in S3. Running 2 or more instances behind the load balancer is safe.
- **Files never pass through the API.** Clients upload straight to S3 with presigned URLs (section 8.5).
- **Socket.IO uses the Redis adapter.** That lets the live monitor and chat work across instances; the load balancer needs sticky sessions for the WebSocket upgrade.
- **External services are called with timeouts and retries.** The API calls SSLCommerz, and BulkSMS BD only for login OTPs. Everything else (SMS, email, push, AI, MediaConvert) goes through the worker.

## 4. Backend modules

One NestJS module per domain.

**Rule:** a module writes only to its own tables. To change another module's data it calls that module's service, or, for side effects, emits a domain event (in-process `EventEmitter2`, and a BullMQ job when the work is slow).

This keeps every table with one owner, so a module can later become a separate service.

| Module | Owns (tables / collections) | Calls | Epics |
| --- | --- | --- | --- |
| `tenancy` | organizations, branches, org\_settings, account\_subscriptions, feature\_overrides | billing | FND-07, FND-08 |
| `auth` | users, user\_devices, refresh\_tokens, otp (Redis) | tenancy, notifications | existing + mobile login |
| `academic` | academic\_sessions, classes, sections, subjects, class\_subjects, course\_offerings, offering\_teachers, offering\_enrolments, enrolments, terms, guardians | tenancy | FND-01–06, FND-09, PRF-02 |
| `attendance` | attendance\_devices, device\_user\_maps, attendance\_punches, daily\_attendance, class\_attendance, class\_attendance\_records, leave\_requests, attendance\_corrections | academic, calendar, notifications, files | Epic 1 |
| `homework` | homework, homework\_targets, homework\_submissions, submission\_files, homework\_scores | academic, question-bank, files, integrity, notifications | Epic 2 |
| `exams` | exams, exam\_question\_sections, exam\_questions, student\_exam\_submissions, student\_exam\_answers, offline\_exams, offline\_exam\_marks | academic, question-bank, proctoring | Epics 3, 5 |
| `question-bank` | question\_bank\_items, question\_tags, exam\_blueprints | syllabus | QA-01, QA-05 |
| `proctoring` | proctoring\_settings, proctoring\_events, proctoring\_snapshots, proctoring\_reviews; live state in Redis | exams, files, notifications | Epic 5 |
| `performance` | grading\_scales, grading\_bands, score\_weights, behaviour\_criteria, behaviour\_ratings, student\_term\_scores, report\_cards | academic, attendance, homework, exams | Epic 3 |
| `syllabus` | syllabi, syllabus\_units, syllabus\_topics, syllabus\_imports, lesson\_logs, lesson\_log\_topics, textbook\_chapters | academic, ai, files, calendar | Epic 6 |
| `chat` | MongoDB: group chats, messages, private conversations, private messages, discussion posts and comments; PostgreSQL: chat\_access\_logs, message\_reports | academic, notifications, files | Epic 7 |
| `resources` | resource\_folders, resources, resource\_shares, resource\_views | academic, files, syllabus | Epic 8 |
| `calendar` | routine\_slots, routine\_exceptions, events, event\_attendees, holidays, reminder\_rules | academic, notifications | Epic 9 |
| `integrity` | similarity\_checks, similarity\_matches, ai\_writing\_scores | homework, exams, ai | Epic 10 |
| `ielts` | ielts\_profiles, ielts\_band\_tables, ielts\_criteria\_scores, ielts\_mock\_tests, speaking\_recordings | exams, files | Epic 11 |
| `notifications` | notifications (inbox), notification\_outbox, sms\_credit\_ledger, push tokens (in user\_devices), message templates | external SMS, email, FCM | FND-12–14 |
| `files` | file\_objects | S3, MediaConvert | FND-15, FND-16 |
| `billing` | subscription\_plans, payments, payment\_history | SSLCommerz | existing, fixed |
| `ai` | ai\_requests (usage and cost log) | Gemini, Groq | SYL-01, QA-04, PLG-04 |
| `audit` | audit\_logs | — | ATT-12, COM-04, all admin actions |

**Deliberately left out:**

- A `fees` module (future epic).
- A guardian login module: guardians are rows in `guardians` that receive messages only.

## 5. DFD Level 1 — main processes

&#91;embedded content: DFD level 1 · 8 processes, 8 stores\]

Each process matches one or more modules from section 4, and only that process writes to its store. Files (S3, store D9) are shared by 3.0, 4.0, 6.0 and 8.0 through the `files` module.

The main flows between processes:

| # | From → To | Data | How |
| --- | --- | --- | --- |
| F1 | 1.0 → all | Identity, org context, enabled features | Request guard (section 8.2, 8.3) |
| F2 | 2.0 → 3.0, 4.0, 5.0, 6.0, 7.0 | Rosters, teaching assignments, guardians | Service call, cached per request |
| F3 | 3.0 → 5.0 | Attendance % per student per term | Read model, recalculated nightly and on correction |
| F4 | 4.0 → 5.0 | Exam and homework scores | `score.published` event |
| F5 | 6.0 → 4.0 | Topics, question bank items, exam blueprints | Service call |
| F6 | 7.0 → 3.0 | Holidays, routine slots (to know expected classes) | Service call |
| F7 | 7.0 → 6.0 | "Class ended" trigger for the lesson log prompt | `class.ended` job |
| F8 | 3.0 → 8.0 | Late, absent and leave alerts for guardians | `attendance.alert` event → outbox |
| F9 | 7.0 → 8.0 | Reminders and change notices | Scheduled reminder jobs → outbox |
| F10 | 4.0, 2.0 → 8.0 | Homework assigned or due, exam published, group chat membership | Events → outbox |
| F11 | 5.0 → 8.0 | Report card ready (signed link) | `report.ready` event → outbox |
| F12 | 8.0 → Guardian | SMS | Worker → BulkSMS BD |
| F13 | 6.0 ↔ Gemini | Page images out, syllabus JSON in | Worker job (6.3) |
| F14 | ZKTeco agent → 3.0 | Punches | Agent API (5.1) |
| F15 | 1.0 ↔ SSLCommerz | Payment session, validation, IPN | API (fixed flow, 8.8) |

## 6. DFD Level 2 — the three hardest flows

### 6.1 Attendance

&#91;embedded content: DFD level 2 · attendance\]

**ZKTeco agent:**

- Runs on a PC at the institution and authenticates with a per-device API key (`attendance_devices.api_key_hash`).
- Every hour it sends `POST /api/v1/attendance/agent/punches` with a batch of up to 5,000 punches (`device_user_id`, `punched_at`, `serial_no`). Batches are idempotent: there is a unique index on `(device_id, device_user_id, punched_at)`.
- `GET /agent/users` returns the user mapping so the agent can report unmapped device users.
- Two missed hourly heartbeats raise the device-offline alert (ATT-03).

**Status resolver (3.3):**

- Runs on every new punch (to mark Late at once, ATT-06) and as the 11:59 PM job per organisation, in the org's time zone (ATT-10).
- It writes exactly one `daily_attendance` row per student or teacher per working day. This uses an upsert on `(organization_id, person_id, date)`, so re-running it is safe.
- Statuses: Present, Late, Absent, Leave, Holiday.
- **Precedence:** approved leave beats absence. When daily presence is Off, class attendance decides presence.

**Alerts:**

- Late, absent and leave events go to the outbox once per student per day per type. This is enforced by a unique key on `notification_outbox.dedupe_key`.
- A correction (ATT-12) can queue a correction SMS.

### 6.2 Exam taking and proctoring

&#91;embedded content: DFD level 2 · exam and proctoring\]

**Changes from today's code:**

- **Deadline.** `effective_deadline` is stored on the submission at start. Every write (`save-answer`, `answersheet`, `submit`) checks `status = IN_PROGRESS AND now() <= effective_deadline + 60 s`. The current code skips this on final submit.
- **Shuffle.** Option order, and the right-hand column of matching questions, are shuffled per student with a seeded random function (seed = submission id), so a reload shows the same order. The answer key is never sent to the browser.
- **Auto-submit job.** It runs every minute and finalises attempts past their deadline. Abandoned attempts no longer stay IN\_PROGRESS forever.
- **Live state.** Proctoring live state moves from process memory to Redis hashes, `proc:{examId}:{studentId}` = status, flag counts, `last_seen`, with a 6 h TTL. Socket.IO runs with the Redis adapter, so the live monitor works across API instances. Flags are also written to `proctoring_events`, batched every 5 seconds, which survive restarts.
- **Monitoring lost.** No heartbeat for 60 s marks the student "Monitoring lost" (PRO-07). This is a Redis keyspace expiry plus a sweeper job.
- **Plan settings.** Proctoring settings come from the exam (`proctoring_settings`), limited by the plan (PRO-01), and are sent to the client with the paper. Disqualification is decided on the server from the flags, not taken from a client "reason".

### 6.3 AI syllabus import

&#91;embedded content: DFD level 2 · AI syllabus import\]

**Prompt and output:**

- The prompt is the tested v2 prompt plus rules 10–12 (comma lists split into topics, sub-headings kept separate, Part labels in the exam pattern).
- The output is validated against a JSON Schema. On a schema failure the job retries once, then the import is marked `failed` with manual entry offered.

**Cost controls:**

- Images are sent at medium resolution.
- The output has no duplicate `title` field: the title is derived from `source_text` in code.
- Plan limits count imports per month.

**Accuracy tracking:** `syllabus_imports` keeps `draft_json` and `published_snapshot`. A weekly job computes the edit rate (lines changed by reviewers ÷ lines extracted) per model. This is the accuracy metric we watch.

## 7. Background jobs

All jobs run in the worker on BullMQ.

- **Schedules:** repeatable jobs, with times computed in the org's time zone (`Asia/Dhaka`).
- **Idempotency:** every job can safely run twice, through a unique key or an upsert, because BullMQ retries.
- **Retries:** default 3 attempts with exponential back-off. Failed jobs stay in the failed set for 7 days and alert on Slack or email.

| Queue / job | Trigger | Does | Idempotency | Story |
| --- | --- | --- | --- | --- |
| `attendance.resolve-day` | Every day 23:59 per org | Writes Absent/Leave rows, then queues guardian SMS | Upsert on `daily_attendance (org, person, date)` | ATT-10 |
| `attendance.on-punch` | New punch | Marks Present/Late, queues the late SMS | Same upsert; outbox `dedupe_key` | ATT-06 |
| `attendance.device-health` | Every 15 min | Flags devices with no heartbeat for 2 h | — | ATT-03 |
| `attendance.repeat-absence` | Daily 08:00 | Alerts class teachers about 3+ days absent | Outbox key per student per streak | ATT-14 |
| `exams.auto-submit` | Every 1 min | Finalises attempts past `effective_deadline + 60 s` | `UPDATE … WHERE status = 'IN_PROGRESS'` | Review fix — **built (P0-04)** |
| `exams.proctoring-flush` | Every 5 s | Batch-inserts flags from Redis into `proctoring_events` | Event id is the primary key | PRO-03, 06 |
| `exams.monitoring-lost` | Every 30 s | Marks students with no heartbeat for 60 s | — | PRO-07 |
| `homework.due-reminder` | 24 h before due | Push to students who haven't submitted | Outbox key | HW-02 |
| `calendar.reminders` | Every 1 min | Sends reminders due in this minute (rules × events) | Outbox key `(rule, occurrence)` | CAL-05 |
| `calendar.class-ended` | Every 5 min | Asks teachers for the lesson log after each class | Outbox key | SYL-04 |
| `notifications.dispatch` | Outbox insert | Sends SMS, email and push; deducts credits; records status | Row lock + `status` | FND-12, 13 |
| `notifications.dlr` | Every 10 min | Pulls SMS delivery reports | — | FND-14 |
| `syllabus.import` | Import created | Runs Pass 1, Pass 2 × 2, compare, then status `review` | Import id; step checkpoints | SYL-01 |
| `reports.report-cards` | Admin request | Renders PDFs (headless Chromium), zips them, uploads to S3 | Job id = (term, section) | PRF-09 |
| `performance.recompute` | Score, weight or attendance change | Recomputes `student_term_scores` for affected students | Upsert | PRF-01, 05 |
| `integrity.similarity` | Homework due passed, or on demand | MinHash similarity over submission text; writes matches | Upsert per pair | PLG-01 |
| `files.process` | Upload complete | Compresses images, optimises PDFs, extracts text | file id | FND-15 — **built (P2-07)**: images only; PDFs and Word files stored as they are |
| `files.sweep` | Every 10 min | Marks links not completed in 24 h FAILED (frees quota); re-queues completed uploads still PENDING after 10 min | Status checks | FND-16 — **built (P2-07)** |
| `media.transcode` | Video uploaded | MediaConvert job → HLS 720p; deletes original | file id | RES-02 |
| `retention.purge` | Daily 03:00 | Deletes selfies and snapshots older than 90 days | — | Retention |
| `billing.expire` | Daily 00:10 | Expires subscriptions past `end_date`; sends renewal reminders 7 days and 1 day before | Upsert | Billing |

**SMS quiet hours (decided, 30 Oct): none.** SMS go out when they are queued; `urgent` only gives a message (sign-up codes) priority in the queue.

**Added job (SMS decision, 22 Oct):** `billing.sms-allowance` runs at the start of each org's billing month. It expires the unused allowance and grants the new one. Its idempotency key is (org, month).

## 8. Cross-cutting design

### 8.1 Multi-tenancy

- **Every account is an organisation.** A solo teacher gets an organisation with `kind = 'SOLO'` at sign-up. Today's "personal" mode becomes a SOLO org, so billing, features and data scoping follow one code path. A hidden default branch and session are created with it.
- **Organisation context.** It is resolved per request from the `X-Organization-Id` header (as today) and verified against `organization_members`. It is then stored in a request-scoped `TenantContext`.
- **Scoped data access.** Repositories go through a `TenantRepository<T>` helper that always adds `organization_id = :orgId`. A lint rule bans raw `getRepository()` in feature modules.
- **Phase 2: database-level enforcement.** PostgreSQL row-level security on tenant tables: `SET LOCAL app.org_id` in a per-request transaction, plus a policy `organization_id = current_setting('app.org_id')::uuid`.
- **Platform admin.** Endpoints live under `/api/v1/platform/*` and are the only code that may cross tenants.

### 8.2 Authentication

| Client | Login | Session |
| --- | --- | --- |
| Web | Phone/email + password, OTP, Google (existing) | httpOnly cookies set by the Next.js `/session/*` proxy (existing) |
| Flutter | Same endpoints | Access JWT for 15 min + rotating refresh token for 30 days, one per device, stored hashed in `refresh_tokens` and in secure storage on the phone |
| ZKTeco agent | Device API key | `Authorization: Device <key>`; only hashes are stored |

- **JWT claims:** `sub`, `role`, `sid` (session id), `ver` (token version, bumped to log out everywhere).
- **Organisation is not in the JWT.** It comes from the header, so switching workspace needs no new token.
- **Fixes from the review:**
  - The rate limiter keys on the **verified** user id, or on IP + identifier for login, OTP and reset.
  - OTPs come from `crypto.randomInt` and lock after 5 wrong tries for 15 minutes.
  - Swagger is off in production.

### 8.3 Feature switches and limits

- **Effective entitlements** = plan `features` and `limits` (from `subscription_plans`) + `feature_overrides` for the account, minus expired overrides.
- They are computed into one `Entitlements` object, cached in Redis at `ent:{orgId}` for 5 minutes, and dropped on any change.
- **Feature keys** are namespaced to match the spec: `attendance`, `attendance.zkteco`, `attendance.app_checkin`, `attendance.selfie`, `homework`, `performance`, `syllabus`, `syllabus.ai_import`, `chat`, `resources`, `resources.video`, `calendar`, `integrity`, `integrity.ai_writing`, `exams`, `proctoring.light`, `proctoring.strict`, `question_bank`, `ai.question_drafts`, `ielts`.
- **Limit keys:** `max_students` (built P2-05: enforced by the student CSV import; no preset value yet), `max_teachers`, `storage_gb`, `video_storage_gb`, `ai_imports_per_month`, `ai_drafts_per_month`, `max_exams_per_month`, `max_students_per_exam`.
- **Server enforcement:** `@RequiresFeature('attendance.zkteco')` on controllers returns 403 with `code: FEATURE_NOT_IN_PLAN`. Limits are checked in services, at the point of use.
- **Clients:** they read `GET /api/v1/me/entitlements` to hide locked menus (FND-07, FND-08).

* **Locked-feature message (decided):** the API returns 403 `FEATURE_NOT_IN_PLAN`, and the client picks the text by role. Org owners and admins see "This feature is one upgrade away — unlock it today!" with an upgrade button. Everyone else sees "Ask your admin to unlock this."
* **New limit key:** `sms_credits_per_month` (the plan's monthly SMS allowance).
* **Plan presets (decided):** the API creates the preset plans (`free`, `basic`, `premium`, `pro`, `SEED_PLAN_PRESETS`) only when a slug is missing; existing plans are never changed, so Admin → Plans owns prices, features, limits and visibility. The Free plan cannot be deleted (organisations without a subscription use it); deactivate other presets instead of deleting them, or they come back on the next start.
* **Built in P2-02 (decided):** plans keep the fine-grained keys the code enforces today (`allow_passage_questions`, `proctoring_tab_switch`, …, see `feature-catalog.ts`); the epic keys above are added when each epic is built, instead of renaming now. Entitlements are per organisation (a solo teacher's SOLO organisation or a school); no ACTIVE `account_subscriptions` row means Free. Usage is counted live from the organisation's exams; plan and overrides are cached in Redis (`ent:{orgId}`, 5 minutes). Errors carry `code` (`FEATURE_NOT_IN_PLAN`, `PLAN_LIMIT_REACHED`) and `feature` or `limit` at the top level of the error body. Existing schools started on Pro (owner decision).
* **Clients (P2-02 web):** the signed-in layout loads `/me/entitlements` once per page load (teachers only) and shares it. A 403 with `FEATURE_NOT_IN_PLAN` or `PLAN_LIMIT_REACHED` opens the locked-feature dialog instead of a toast; "owner or admin" means a solo teacher in their own workspace or a school's OWNER/ADMIN (`useBillingAccess`), who also are the only ones offered plans on Billing. Menu items can carry a `feature` key and are hidden while it is off. "More features" (`/features`) lists the catalog with translated names and "Request this feature". Platform admins set plan, feature switches and limits (optional end date and reason) per organisation in Admin → Organisations, which lists solo teachers' workspaces with `GET /organizations/admin?kind=SOLO`, and work through Admin → Feature requests.

* **Built in P3-01 (decided):** `attendance` is the first epic key and the first whole-feature gate: `@RequiresFeature('attendance')` on `/attendance/settings` and `/holidays` (holidays move to "`attendance` or `calendar`" when P5 adds the `calendar` key), and the first menu items with `feature` (Attendance settings, Holidays). The Premium and Pro presets include it for new installs only; existing plans are switched on in Admin → Plans. The method keys (`attendance.zkteco`, `attendance.app_checkin`, `attendance.selfie`) are added with those methods.

### 8.4 Real-time

- Socket.IO with `@socket.io/redis-adapter`, authenticated with the JWT in the handshake. The ALB uses sticky sessions for the WebSocket upgrade.
- **Namespaces:**
  - `/proctoring`: rooms `exam:{id}:monitors` and `exam:{id}:student:{sid}`.
  - `/chat`: rooms `group:{id}` and `dm:{conversationId}`.
  - `/notify`: room `user:{id}`, used for the bell and live dashboard counters.
- Push (FCM) is used when the user has no open socket.

### 8.5 Files

**Upload:**

1. The client asks `POST /files/presign` with `{purpose, mime, size}`.
2. The API checks the type, size (≤ 20 MB; video limit per plan) and the storage quota, then returns a presigned PUT to `s3://…/tmp/{uuid}`.
3. The client calls `POST /files/{id}/complete`.
4. The `files.process` job compresses the file (FND-15) and moves it to `org/{orgId}/{purpose}/{yyyy}/{uuid}.{ext}`. It updates `file_objects.size_bytes`, which counts toward the org's storage quota.

**Download:** CloudFront signed URLs valid for 1 hour; the bucket is private. Today's public `/uploads/content` route and local-disk storage are removed after migration.

* **Built in P2-07 (decided):**
  - S3 is the storage on beta and production; the local driver (`STORAGE_DRIVER=local`) is for development and tests only, where `PUT /files/local-upload` (HMAC-signed link) stands in for the presigned S3 PUT.
  - Purposes uploadable now: `EXAM` and `IMAGE` (JPG, PNG, WebP, GIF) and `DISCUSSION` (those plus PDF, DOC, DOCX, TXT). A discussion file belongs to its class's organisation (students outside a workspace session post there too); everything else to the current workspace. HEIC and PDF optimisation come later (TODO).
  - `files.process` turns images into WebP, at most 1600 px on the long side, quality 80; other files are stored as they are. Until it finishes, the uploaded file is served.
  - **Quota:** the plan's `max_storage_mb` (0 = unlimited; presets Free 500 MB, Basic 2 GB, Premium 10 GB, Pro 50 GB, added only where a plan has none). Usage = `size_bytes` of the organisation's PENDING and READY files that are not deleted; reservations take a per-organisation advisory lock. Over the limit: 403 `PLAN_LIMIT_REACHED` (`limit: max_storage_mb`); the presign answer and `GET /files/usage` (owner and admins, by homework / resources / video / other) carry `warning` from 90%.
  - **Download (decided):** no CloudFront yet. `GET /files/{id}/content` is reached by the unguessable file id (like the old proxy, so `<img>` tags work without the login header) and redirects to a 1-hour signed S3 link. `GET /files/{id}` (metadata) is login- and organisation-checked; another organisation's file is 404.
  - **Delete:** soft delete only (`deleted_at`, `deleted_by`), by the uploader or the workspace owner and admins; frees quota, keeps the object. Uploads and deletes are audited (`file.upload`, `file.delete`).
  - The older `POST /uploads/media` and `/uploads/discussion` run through the same service (quota, row, worker compression).

**Video:** `media.transcode` runs a MediaConvert job to HLS 720p, deletes the original, and streams through CloudFront signed cookies.

### 8.6 Notifications (outbox pattern)

1. A domain service writes a `notification_outbox` row **in the same database transaction** as the change that caused it (for example, the absent status). So nothing is sent for a change that rolled back, and nothing is lost if the worker is down.
2. `notifications.dispatch` picks pending rows (`FOR UPDATE SKIP LOCKED`) and sends them:
   - **SMS:** BulkSMS BD.
   - **Email:** Brevo.
   - **Push:** FCM to `user_devices`.
   - **In-app:** a `notifications` row + a socket event.
3. **Templates:** `message_templates`, keyed by `(event, channel, locale)`, with Bangla and English variables.
4. **SMS credits:** before sending, segments are counted (GSM: 160 for one message / 153 per part; Unicode Bangla: 70 / 67 per part). Credits are debited in `sms_credit_ledger` in one transaction. At zero balance the row is marked `no_credit` (FND-13).

**SMS credits model (decided: monthly allowance plus top-ups):**

- `sms_credit_ledger` rows carry a `bucket`: ALLOWANCE or TOPUP.
- `billing.sms-allowance` writes a MONTHLY\_GRANT row at the start of the billing month. It also writes a MONTHLY\_EXPIRE row for any unused allowance; whether unused allowance expires is a proposal, see FND-13.
- Dispatch debits ALLOWANCE first, then TOPUP, in the same transaction, with a row lock per org.
- The balance shown to the owner = allowance left + top-ups left.

**Built in P2-08 (decided):**

* **One way to send.** `NotificationsService.enqueue(message | messages, manager?)` writes `notification_outbox` rows (in the caller's transaction when `manager` is passed) and queues a `notifications.dispatch` job per row. A message names the event, channel, organisation (null = platform message, never charged, not in any log), and either a `userId` (address and language read at send time) or an `address` (with `recipientType: GUARDIAN` + `recipientId` for guardians), plus variables, an optional `dedupeKey` and `sendAfter`. Nothing is sent from a request; `SmsService.deliver` and `EmailService.deliver` are called only by the worker.
* **Dispatch.** The worker claims a row (`FOR UPDATE SKIP LOCKED`, status `SENDING`, commit), then calls the provider with no transaction open, then records `SENT`, or `PENDING` with `send_after` (+30 s, +2 min), `FAILED` after 3 attempts. `notifications.sweep` (every 30 s) sends due rows whose job was lost and marks rows left `SENDING` for 10 minutes as `FAILED` (never re-sent: they may have gone out). Push (FCM) is deferred until the mobile app.
* **Language.** Message language = the row's `locale`, else the user's, else the organisation's `default_locale`, else English. Dates (`*_at` variables) are shown in that language (Bangla digits) and the organisation's time zone.
* **Templates.** Platform defaults (bn + en per event and channel) are added at API start-up when missing; existing rows are never changed, so platform admins' edits (`PATCH /notifications/admin/templates/:id`, audited) are kept. Email bodies are HTML with variables escaped, wrapped in one layout.
* **Codes.** Sign-up and password-reset codes are urgent platform messages; their variables are emptied and their text not stored once sent.
* **Message log (FND-14).** `GET /notifications/log` for an organisation's owner and admins: filters by date, recipient (student), event (or area prefix), channel and status.
* **SMS credits (FND-13, part 2).** The plan limit `sms_credits_per_month` is the monthly allowance (0 = none, unlike other limits); presets: Free 50, Basic 300, Premium 1,000, Pro 3,000, added at start-up only to preset plans that have no value. The month is the calendar month in the organisation's time zone. The first time an organisation's credits are used or read in a month (and in the hourly `billing.sms-allowance` job) the rest of last month's allowance expires (MONTHLY_EXPIRE) and the month's allowance is granted (MONTHLY_GRANT, unique per org and month); a plan change applies from the next month. Dispatch charges an SMS when it claims the row, under a per-organisation advisory lock, allowance first, then top-ups, one credit per segment; with too few credits the row is `NO_CREDIT` ("Not sent — no credit") and nothing is sent. A retried SMS is charged once; one that fails for good is refunded. Platform messages are never charged. The owner(s) get one email a month when 10% or less of the month's credits (allowance + top-ups carried in + top-ups added) is left.
* **Top-ups.** Platform admins add credits (`POST /sms-credits/admin/:organizationId/top-ups`, audited `sms_credits.top_up`). Owners and admins buy packs (`POST /payments/sms-top-up {packId}`: 500 SMS ৳300, 1,000 ৳550, 5,000 ৳2,500, priced on the server); the credits are added in the payment's settlement transaction, once per payment. `GET /sms-credits` shows the month's allowance, top-ups and packs.
* **In-app inbox and channel choices (FND-12, part 3).** `NotificationsService.notifyUsers({eventType, organizationId, userIds, variables, dedupeKey})` sends a message to users on their channels: in-app always, plus SMS or email as each user chose in Account → Notifications (`user_notification_prefs`; no row = the event's default, e.g. a test notice = in-app + SMS). The worker delivers an IN_APP row by writing `notifications` in the claim transaction (once per row); a `path` variable becomes the item's link. The top-bar bell polls `GET /me/notifications/unread-count` every minute and when the tab is shown again, and opens the inbox in a side panel (`GET /me/notifications`, mark one or all read). Live updates over the `/notify` socket are in docs/TODO.md.

### 8.7 AI provider

```text
interface AiProvider {
  extractSyllabus(images: FileRef[], schema: JsonSchema, opts): Promise<AiResult<SyllabusDraft>>
  draftQuestions(request: DraftRequest, schema: JsonSchema): Promise<AiResult<QuestionDraft[]>>
  aiWritingScore(text: string): Promise<AiResult<{ likelihood: 'low'|'medium'|'high' }>>
}
```

- **Implementations:** `GeminiProvider` (default: model `gemini-3.5-flash-lite`, temperature 0, `media_resolution: medium`, minimal thinking, `responseSchema` set) and `GroqProvider` (text-only fallback).
- **Configuration** is per task, in `ai_task_configs`, so the model can be switched without a deploy.
- **Logging:** every call writes an `ai_requests` row with task, org, model, prompt version, input/output tokens, cost in USD and latency.
- **Quotas** come from plan limits.
- **Data rules:** paid tier only (no training on our data). Student names are removed from prompts where not needed.

### 8.8 Security fixes from the codebase review (P0)

| Fix | Where |
| --- | --- |
| Payment amount taken from the pending subscription on the server; login + ownership required on `/payments/initiate`; `GET /payments/:tranId` login + ownership | `billing` |
| Server-side deadline on every write; status check on autosave | `exams` (6.2) |
| Per-student shuffle of options and of matching right column | `exams` (6.2) |
| Proctoring settings stored per exam and limited by plan; auto-disqualify off by default; outcome decided on the server | `proctoring` |
| Student cap checked at `start` | `exams` |
| Verified-JWT rate limiting; OTP lockout; `crypto.randomInt` | `auth` (8.2) |
| Swagger disabled in production | `main.ts` |

### 8.9 Language and time

- **Language:** `users.locale` (`bn` | `en`) and `organizations.default_locale`. API error messages return a `code` and the clients translate it. Emails, SMS and PDFs use the recipient's locale.
- **Organisation language (P2-04, decided):** owners and admins set `organizations.default_locale` in the organisation settings. It is sent with an organisation session (`organization.default_locale`); a member who has not chosen a language (`users.locale` null) sees the app in it. The member's own choice always wins.
- **Level names (P2-04, FND-03, decided):** `organizations.level_labels` holds the names of the two academic levels: a preset (`CLASS_SECTION`, `COURSE_BATCH`) or the owner's own words in English (singular and plural) and Bangla; null means Class / Section. Only the workspace's Owner changes them (`PATCH /workspace/level-labels`; a solo teacher owns theirs and sets them on the account page, schools on the organisation overview); every member reads them (`GET /workspace/level-labels`). Not plan-gated. On the web, messages name the levels with tokens (`[[class]]`, `[[Classes]]`, `[[section]]`, …) that `i18n/request.ts` replaces from the `LEVEL_LABELS` cookie, so the server renders the right words on the first paint; `LevelLabelsSync` refreshes the cookie on each page load and workspace switch. Landing, sign-in and join-link pages keep Class / Section, and "class teacher" and "subject class" stay fixed terms. Server-written text (SMS, PDFs) uses `levelLabel()` in `organizations/level-labels.ts`.
- **Timestamps** are `timestamptz` in UTC.
- **School days** are stored as `date` (for example `daily_attendance.date`), computed in the org time zone with `AT TIME ZONE organizations.timezone`, so a punch at 11:30 PM UTC counts toward the correct Dhaka day.

### 8.10 Audit and observability

- **Audit:** `audit_logs` (actor, org, action, entity, before/after JSON, IP, reason) for all admin actions, corrections (ATT-12), chat access (COM-04), grade changes and plan changes.
* **Built in P2-09 (decided):** the `audit` module owns `audit_logs` and is global. A feature records an action after saving it with `AuditService.record({ action, organizationId, actorId, entityType, entityId, before, after, reason })` (or `recordMany` for a batch); action names live in `audit-actions.ts` (`area.verb`). The insert runs in the background and a failure is only logged, so auditing never slows or breaks the request; the caller's IP is taken from the request. Before/after hold only the changed fields (`auditChanges`) and keys that look like secrets (password, token, otp, hash, …) are always stripped. Recorded today: plan create/edit/delete/order/activation, plan assignment (with reason), cancel, feature and limit overrides (set and removed), payment confirmation, feature requests handled, organisation approve/reject, teacher requests, platform role changes, teacher enable/disable, members added (directly, by import, by invitation), role changes and removals, results published, and marks changed **after** results are published (design §8.11). Platform admins read every organisation's log, with IPs, at `GET /audit-logs/admin`; an organisation's OWNER and ADMINs (and a solo teacher) read their own at `GET /audit-logs`, tenant-scoped and without IPs. A trigger makes the table append-only. Organisations are never deleted (§10), so rows are kept; the `ON DELETE CASCADE` on `organization_id` never fires. **Kept in PostgreSQL (owner decision, 30 Oct):** only admin actions are recorded (estimated hundreds of thousands to a few million rows a year), writes run after the response, and the lists use the `(organization_id, created_at)` and `(actor_id, created_at)` indexes; moving it to MongoDB would lose the joins, tenant scoping, foreign keys and the append-only trigger. If it ever grows large: partition `audit_logs` by month on `created_at` (as `notification_outbox`) and move old months to S3; `AuditService.record` does not change. **Web:** Admin → Audit log (`/admin/audit-log`, every organisation, filter by area and dates, a row opens before → after, reason and IP); Activity log (`/activity-log`) in the menu of a school's owner and admins and of a solo teacher; "Recent changes" in Admin → Organisations → Plan & features, whose reason is now also saved with a plan assignment. Action and field names are translated in `messages audit.*` (an unknown action shows its key).
- **Logs:** structured logs (pino) with `request_id`, `org_id` and `user_id`.
- **Errors:** Sentry for the API, worker, web and Flutter.
- **Queue dashboard:** `bull-board` behind platform-admin auth.
- **Health checks:** `/health` covers PostgreSQL, Redis, MongoDB and queue lag.

### 8.11 Performance scores (decided)

- **Live to date.** Any change to marks, homework scores, attendance or behaviour ratings emits `score.changed`. `performance.recompute` then updates `student_term_scores` for that student within seconds, and the student page and dashboards read that table.
- **Frozen per term.** Generating report cards copies the term's scores into `report_cards.scores_snapshot`. Later changes never alter an issued card. A regenerated card is a new row with `version + 1`, and the old version is kept.
- **Traced.** Every score-affecting write also writes an `audit_logs` row: actor, entity, before/after, reason where required.
  - `GET /students/{id}/score-history` returns this history.
  - It is visible to the teacher who made the change, org admins and the org owner (filtered by role in the service).

* **Grading scale, built in P2-06 (decided):** the `performance` module owns `grading_scales` and `grading_bands` (FND-11). One scale per organisation, not per session. The migration seeds the platform default (Bangladesh national, `organization_id` NULL, `is_default`); an organisation without its own active scale uses it, and so do exams with no organisation. Grades are worked out when a result is read (`GradingScaleService.getScale/getScales/gradeFor`, `gradeForPercentage`), never stored, so a scale change regrades everything at once and never touches raw marks; report cards will freeze the grade in their snapshot. Bands are inclusive, two decimals, must cover 0–100 exactly once in 0.01 steps with distinct grades (codes `GRADING_SCALE_*`; the web client runs the same checks). The percentage is rounded to two decimals and kept within 0–100 before the lookup. **No hard deletes (owner):** saving bands deactivates the current scale (`is_active` 0, `deactivated_at`, `deactivated_by`) and inserts a new one; "Reset to Bangladesh default" only deactivates it. A partial unique index allows one active scale per organisation. Not plan-gated (every mark on every plan has a grade). API: `GET /grading-scale` (any member of the workspace), `PUT` and `DELETE /grading-scale` (OWNER/ADMIN, a solo teacher in their own workspace); both write `grading_scale.update` / `grading_scale.reset` audit rows with the bands before and after. Exam results that return `percentage` also return `grade: { grade, gpa }` (student results and history, teacher grading summary, submission detail and roster), graded on the exam's organisation's scale. **Web:** Settings → Grading scale (`/settings/grading-scale`), and marks are shown as "64/80 · 80% (A+)" (`formatScore`).

## 9. Database schema

The target PostgreSQL schema has **95 tables**: 4 kept as they are, 11 changed and 80 new. 9 legacy tables are dropped after migration (`organization_teacher_subjects` stays, P2-03). Chat stays in MongoDB.

Every column, type, index and enum is in the companion file `instructor-schema-v1.dbml`. Paste it into dbdiagram.io to see the ER diagram. The tables below give each table's purpose and the columns that matter for design.

**Conventions:**

- **Base columns:** `id uuid` primary key; `created_at`, `updated_at` (`timestamptz`); `created_by`, `updated_by`. The existing base entity's `is_active` and `*_user_name` columns are kept for compatibility.
- **Tenant tables** have `organization_id` (not null), and it is the first column of every composite index.
- **Money** is `numeric(10,2)` BDT. **Marks** are `numeric(6,2)`. **Percentages** are `numeric(5,2)`.
- **Enums** are PostgreSQL enums. Status columns that will grow use `varchar` with a check constraint.
- **Partitioned tables** (monthly, by date) are marked *(partitioned)*. Their primary key is `(id, date column)`.

### 9.1 Tenancy and billing

| Table | Status | Purpose and key columns |
| --- | --- | --- |
| organizations | Changed | + `workspace_type` (ACADEMIC/IELTS), `kind` (SCHOOL/COACHING/IELTS\_CENTRE/SOLO), `timezone`, `default_locale`, `level_labels` |
| branches | New | Campus; `geo_lat`, `geo_lng`, `checkin_radius_m`, hidden `is_default` |
| org\_settings | New | One row per org: attendance method, selfie, class attendance mode, weekly off days, entry times, guardian SMS switches, homework policy, thresholds |
| subscription\_plans | Changed | + `workspace_type`; features and limits use the namespaced keys (8.3) |
| account\_subscriptions | New | Org ↔ plan, `price_due` computed on the server, status, dates. Replaces `teacher_subscriptions` |
| feature\_overrides | New | Per-org feature or limit override with `expires_at` |
| payments | Changed | + `organization_id`, `user_id`, `subscription_id`, `purpose`; amount set only by the server. Absorbs `payment_history` |

### 9.2 Identity and audit

| Table | Status | Purpose and key columns |
| --- | --- | --- |
| users | Changed | + `locale`, `avatar_file_id`, `token_version`; `refresh_token` moves out; `personal_teacher_enabled` dropped |
| user\_devices | New | Platform, FCM token, app version |
| refresh\_tokens | New | Hashed rotating tokens per device (mobile) |
| organization\_members | Changed | + `branch_id`, `employee_code` (for ZKTeco mapping) |
| organization\_invitations | Existing | — |
| teacher\_role\_requests | Existing | — |
| audit\_logs | New | Append-only: actor, action, entity, before/after, reason |

### 9.3 Academic structure

| Table | Status | Purpose and key columns |
| --- | --- | --- |
| academic\_sessions | New | Name, dates, ACTIVE/CLOSED, `is_default` |
| terms | New | Session terms (অর্ধ বার্ষিক, বার্ষিক…) |
| classes | Changed | Reused across sessions; + `branch_id`, `curriculum_level` (links textbook chapters) |
| sections | New | `class_id` + `session_id`, shift, room, `class_teacher_id`, entry time override |
| subjects | Changed | Adds `credit_hours` (nullable, used by Tertiary later) |
| class\_subjects | Changed | + `full_marks` |
| course\_offerings, offering\_teachers, offering\_enrolments | New | Subject class (section + subject + session, optional term), its teachers, and the students of optional subjects. Replaces 2 legacy tables (`class_teachers`, `class_subject_teachers`) |
| enrolments | New | Student in a section for a session, roll no, status; unique per (session, class, student). Replaces `class_students` |
| guardians | New | Up to 2 per student: name, relation, phone, primary |

**Guardians (built P2-05, FND-09/10).** A student's guardians are edited through any of their enrolments (`GET/PUT /enrolments/:id/guardians`, saved as a whole), so an invited student who has not signed up yet can have guardians too (`guardians.enrolment_id`, `student_id` null); `EnrolmentsService.claimInvitation` hands them to the student in the same transaction (if the student already has guardians in that organisation, theirs stay and the invitation's are soft-deleted). Owners, admins, assistants and teachers who teach the enrolment's class may read and change them; removed guardians are kept (`deleted_at`, `deleted_by`) and every change is audited. SMS language: `guardians.sms_locale` (per student) → `org_settings.sms_locale` → `organizations.default_locale`; senders use `GuardiansService.contactsForStudent()`, which returns each guardian with that language.

**Student CSV import (built P2-05, FND-04).** From a class: `POST /classes/:classId/students/import/preview` checks every row without saving (name, phone or email, section of that class, roll number unique in the section, up to 2 guardians; one section per class per session; staff accounts refused) and `POST …/import` checks again and saves the rows that pass through `EnrolmentsService.enrol` and `GuardiansService.replace`. Students without an account become INVITED enrolments with `invited_name`. A student who already has guardians keeps them (warning `GUARDIANS_KEPT`). Invitations are sent only when the importer ticks it: email when the row has one, otherwise SMS (organisation credits, `org_settings.sms_locale`), both through the outbox. The plan limit `max_students` (students in open sessions; an account counts once, each invitation counts) refuses the whole import with `PLAN_LIMIT_REACHED`; it is in the plan catalogue with no preset value (0/unset = unlimited) until the platform admin sets it. Each import writes one `student.import` audit row with counts. At most 500 rows per import.

**Subject classes are the core teaching unit (decided 23 Oct, FND-19).**

A `course_offering` is section + subject + session, with an optional term. Every epic links to it: `class_attendance.offering_id`, `homework_targets`, `exams.offering_id`, `offline_exams`, `behaviour_ratings`, `syllabus_progress`, `lesson_logs`, `routine_slots`, `resource_shares` and the group chat.

Who takes an offering:

- **WHOLE\_SECTION** (default): every active enrolment in the section.
- **SELECTED**: only the rows in `offering_enrolments`. Used for religion subjects and electives today, and for Tertiary course registration later.

Rosters come from one service, `OfferingRoster.students(offeringId)`, so no module repeats this rule.

**Built in P2-03 part 1 (decided):**

- **Sessions:** every organisation has one default session, created on first use as this calendar year in its time zone (1 Jan – 31 Dec). Several sessions can be ACTIVE. The default session cannot be closed (make another default first). A closed session refuses changes to its sections, subject classes and terms; only the Owner reopens it (`assertSessionOpen` is for later epics too).
- **Roles:** staff read; Owner, Admin and Assistant change sections, subject classes, their teachers and students (as classes today); Owner and Admin manage sessions and terms.
- **Class teacher (owner decision):** one per section (`sections.class_teacher_id`), a teacher may be class teacher of several sections. Organisations switch class teachers on or off in `org_settings.class_teacher_enabled` (on for schools and coaching centres, off for solo teachers); switching off keeps the saved class teachers. Everyone else teaching in a section is a teacher of its subject classes; all teachers of a subject class are equal (no role column).
- **`organization_teacher_subjects` stays:** it lists what a teacher can teach in the organisation, not a class assignment, so it is not merged into `offering_teachers` and is not dropped.
- **Students (part 2a, decided):** `enrolments` is the class roster. The class screens write it through `EnrolmentsService` (academics module, the only writer); `class_students` was dropped in the contract step (below). "In the class" means an ACTIVE enrolment in a session that is not closed, or in the exam's own session for exam access (`enrolment-queries.ts`, shared by classes, exams, dashboard, discussions and the workspace picker). A student added from the class screens goes to the class's first section of the default session. Class responses keep the `classStudents` shape (JOINED/PENDING/INVITED) plus `section`.
- **No hard deletes of students (owner decision):** removing a student (any status) marks the enrolment LEFT with `left_at` and who removed them; adding them back in the same session reuses that row. Accepting an invitation when the student already has a row in that session (pending or LEFT) reuses their row and marks the invitation LEFT.
- **Section enrolment endpoints (for P2-05):** `POST /sections/:id/enrolments` (student, phone or email; an unknown contact becomes an INVITED row and nothing is sent until the outbox exists, P2-08) and `PATCH /enrolments/:id` (move to another section of the same class and session, roll number, LEFT).
- **Teacher access (part 2b, decided):** a teacher teaches in a class when they teach one of its subject classes (`offering_teachers`) or are the class teacher of one of its sections while the organisation uses class teachers; they teach a subject when they teach its subject class in one of the class's sections. Only sections in sessions that are not closed count (`teacher-queries.ts`). This drives a teacher's class list, opening and managing a class, creating tests (class-wide for a class teacher; per subject only for that subject's teachers), the test wizard's subject list and subject discussions. Compared with before, class teachers without a subject and section class teachers now get access (before, only `class_subject_teachers` did).
- **Teacher assignment (part 3b):** Organisation → Assignments works on subject classes: step 1 adds a subject to a class (class subjects; `LegacyClassSyncSubscriber` gives it a subject class in every section of open sessions), step 2 picks class → section (or all sections of the class) → subject → teacher and sets the subject class's teachers (`PUT /offerings/:id/teachers`), step 3 lists every section's subject classes and teachers for a session (`GET /sections`, `GET /offerings`, organisation-wide). A new class still gets section "A" in the default session, and new exams the default session, through `AcademicDefaultsSubscriber`.
- **Completed in P2-03 (decided):** the contract step dropped `class_students`, `class_teachers` and `class_subject_teachers` (migration `DropLegacyClassTables`: it stops if a class student has no enrolment, and logs the teacher links), with the class-level teacher endpoints and the legacy sync; `AcademicDefaultsSubscriber` keeps only the defaults above. A test can target one subject class (`exams.offering_id`, chosen in the wizard as "Section and subject"): only that subject class's students see and take it, and only its teachers (or the owner or an admin) create it. A closed session's tests cannot be edited, switched on or off, deleted, graded or published (`assertExamSessionOpen`); they stay viewable. A class with any student records (even students who left) cannot be deleted.
- **Academic setup wizard (P2-04, FND-02, decided):** schools and coaching centres only (a solo teacher gets level names only). Owners and admins open `/organization/setup`: names and language, session, classes and subjects, sections (the class screens' own section card), then a summary. Every step saves through the existing endpoints, so it can be left and resumed; `GET /setup` returns progress (default session, each class with its subject and section counts) and `POST /setup/complete` sets `org_settings.setup_completed_at` once every class has a section in the default session. Until then the organisation overview shows a banner (no redirect, owner decision). Organisations that had classes before were marked as set up by the migration.
- **Promotion (P2-04, FND-05, decided):** `POST /sections/:id/promotions` (Owner/Admin) moves chosen ACTIVE students to a section of another, open session (any class), in one transaction. The new enrolment is ACTIVE with no roll number and no optional-subject picks; the old one becomes `PROMOTED` (with `left_at`) and stays listed under "show students who left". Students already in the target class for that session are skipped and reported, so a second run changes nothing. The old session may be closed. A promoted student keeps that class's tests of that session (owner decision, option A): the exam-audience rules (`activeEnrolmentCondition` with a session, the subject-class roster for tests, `inOfferingRosterCondition`) accept `ACTIVE` or `PROMOTED`, eligibility and the per-class list accept `wasPromotedOutOfClass`, and the student's test lists add `promotedFromExamClassCondition`. Class rosters, counts and "in the class now" stay ACTIVE only.
- **Screens (part 3a):** `/sessions` (sidebar for school owners and admins, and for solo teachers — only when personal teaching is on, from the `personal_teacher` session cookie): sessions with dates, status and default, add/edit in a drawer, make default, close (confirmed; not the default) and reopen (owner only), and each session's terms. The organisation overview has a Settings card with the class-teacher switch. Every class page has a Sections tab for staff (school and solo classes): sections of a chosen session with shift, room, class teacher (only while class teachers are on) and student count; a section opens a drawer with its students (add by phone or email, change section or roll, mark as left, show students who left) and its subject classes (teachers, whole section or selected students, add or remove a class subject). Owners, admins, assistants and solo teachers change them; other teachers read; closed sessions are read-only. The Students tab shows each student's section and filters by section.

**Tertiary-ready.** These parts are reserved now and stay switched off:

- `workspace_type` TERTIARY and `org_kind` COLLEGE/UNIVERSITY
- `subjects.credit_hours`
- `course_offerings.term_id` (semester offerings)
- `report_cards.type` (TRANSCRIPT)

Departments, programmes, prerequisites, credit-weighted CGPA and registration windows come in the Tertiary version and add tables without changing these.

### 9.4 Attendance

| Table | Status | Purpose and key columns |
| --- | --- | --- |
| attendance\_devices | New | ZKTeco device, `api_key_hash`, heartbeat |
| device\_user\_maps | New | Device user id ↔ student or teacher |
| attendance\_punches | New *(partitioned)* | ZKTeco or app punch; GPS, accuracy, `selfie_file_id`, suspicious flag |
| daily\_attendance | New *(partitioned)* | One row per person per day: status, check-in/out, late minutes; unique (org, person, date) |
| class\_attendance | New | One roll call per section + subject + date (+ routine slot); `locked_at` |
| class\_attendance\_records | New *(partitioned)* | Status per student per roll call |
| class\_attendance\_photos | New | Up to 3 proof photos |
| leave\_requests | **Built P3-06** | Dates, reason, file, PENDING/APPROVED/REJECTED/CANCELLED, who applied, approver, comment |
| attendance\_corrections | New | Old/new status, reason, who corrected |

**Built in P3-01:** attendance settings live in `org_settings` (owned by `organizations`; the `attendance` module validates them: one method, a confirmation (409 `ATTENDANCE_METHOD_CHANGE_CONFIRM`) to switch it while a session covers today, SOLO orgs class attendance only). Daily presence methods are Off / Web / ZKTeco / App; only Off and **Web** (website check-in, owner decision 2 Nov 2026) can be chosen until ZKTeco and the app are built. `holidays` is owned by the `calendar` module, which exports `HolidaysService.closedDays(orgId, from, to)` (weekly off days + active holidays) for the P3-04 resolver and 11:59 PM job.

**Class-based design (decided 5 Nov 2026, spec Epic 1 "Design"; plan P3-02 to P3-07).** This changes the tables above as follows; each package adds its own migration and updates `schema.dbml`.

- **Sessions, not days.** `class_attendance` becomes one row per class session: a section meeting on a date from a schedule slot (`routine_slots`, owned by `calendar`, with `offering_id` null for a whole-section class). Sessions are created from the schedules by the worker, not by a teacher; a cancelled session (ATT-19) keeps its row with a status.
- **Records.** `class_attendance_records` holds one row per student or teacher per session: status (PRESENT, LATE, ABSENT, LEAVE), `checked_in_at` (server time), minutes late, source (SELF, IMPORT, CORRECTION), and for in-person check-ins the distance, accuracy and a `flagged` reason. Corrections go to `attendance_corrections` (ATT-12).
- **Branches.** `branches` (pin, `checkin_radius_m`) is built in P3-02 with a hidden default branch per organisation; `sections.branch_id` (not `classes.branch_id`: a coaching course runs batches at several branches).
- **Per-section settings** (class type, attendance mode, grace override) live in a table owned by `attendance` keyed by `section_id`, since `sections` belongs to `academic`.
- **Days.** `daily_attendance` was planned as the per-person-per-day summary for the end-of-day absence SMS and reports. Not built: P3-04 works out "absent all day" from the class records, and P3-07 measured the reports fast enough without it (see "Built in P3-07").
- **Later.** `attendance_devices`, `device_user_maps` and `attendance_punches` wait for ZKTeco gate presence; `class_attendance_photos` waits for ATT-08.
- **P3-01's settings:** `org_settings.attendance_method`, `selfie_required`, `student_entry_time`, `teacher_entry_time` and `class_attendance_mode` are replaced in P3-02 by the per-section mode, schedules and an organisation grace period (`weekly_off_days`, `guardian_sms`, `repeat_absence_days` and `holidays` stay). No organisation has used them yet (all OFF on beta, 2 Nov). **Expand → contract (owner, 5 Nov):** P3-02 stopped reading and writing them; after the P3-02 release (#166) migration `1756220000000-DropP301PresenceSettings` dropped the five columns and the `attendance_method` / `class_attendance_mode` types (owner approval 6 Nov: production does not use attendance yet; all values on beta were the defaults).

**Built in P3-02 part 1 (branches, ATT-15, ATT-01):** `branches` is owned by `organizations` (`BranchesService`: storage, and `defaultBranch()`, which creates the hidden main branch on first use with an insert that ignores the conflict on `UQ_branches_default`; the migration created one for every existing organisation). The `attendance` module owns the rules (`AttendanceBranchesService`): names unique per organisation (case-insensitive), a pin is both coordinates or none, radius 25–1000 m (a new branch takes the main branch's radius), the main branch is never removed and may stay unnamed ("Main branch" on the web), a branch used by sections of an open session cannot be removed (409 `ATTENDANCE_BRANCH_IN_USE`; sections of closed sessions keep pointing at it), removal is a soft delete, and a SOLO workspace has only the main branch. `sections.branch_id` (owned by `academic`; null = the main branch) is counted through `SectionsService.countOpenSectionsByBranch()`. `org_settings.late_grace_minutes` (0–60, default 10) is the organisation grace period. API (`attendance` feature; staff read, OWNER/ADMIN change): `GET/POST /attendance/branches`, `PATCH/DELETE /attendance/branches/:id`; `GET/PATCH /attendance/settings` now holds `late_grace_minutes`, `weekly_off_days`, `guardian_sms` and `repeat_absence_days`. Audit: `branch.create`, `branch.update`, `branch.remove`. **Web:** Settings → Attendance has a "Check-in location" card (the main branch's pin and radius while there is one location, otherwise a summary and a link) and the grace period; Branches (`/attendance-branches`, OWNER/ADMIN in the organisation menu). Pins are set without a map: paste a Google Maps link (parsed in the browser, `utils/attendance/location.ts`), use the device's location, or type coordinates, then check the pin on Google Maps.

**Built in P3-02 part 2 (class setup and schedules, ATT-16):** `section_attendance_settings` (owned by `attendance`; class type IN_PERSON/ONLINE, mode SELF_CHECKIN/PAPER_REGISTER, own grace 0–60 or null for the organisation's; no row = defaults) and `routine_slots` (owned by `calendar`; `RoutineSlotsService` holds the rules: real times, start before end on one day, no overlap within a section, a slot's optional teacher never in two overlapping slots of the session (409 `SCHEDULE_TEACHER_CLASH`), at most 70 slots, `SCHEDULE_TOO_MANY`). A section's schedule is saved as a whole: unchanged slots keep their row and id, the rest are soft-removed (`is_active` '0', `removed_at`, `removed_by`), so class sessions made from a slot (P3-03) keep their history; writes take a per-organisation advisory lock so two edits cannot together create a clash. `SectionSetupService` (attendance) ties it together through `SectionsService` (`listWithClasses`, `sectionIdsTaughtBy`, `setBranch`) and `BranchesService`. **Who:** OWNER/ADMIN/ASSISTANT set up every section, move sections between branches and apply a schedule to many sections; a TEACHER sets up the sections where they teach a subject class or are class teacher; closed sessions are read-only. **Copy and apply:** copy takes another section's slots of the same session without teachers; apply replaces the slots of every other section of the source's class or shift (one transaction, `dry_run` preview first), optionally with class type, mode and grace, never the branch. API (`attendance` feature): `GET /attendance/setup?session_id=`, `PATCH /attendance/setup/sections/:id`, `PUT /attendance/setup/sections/:id/slots`, `POST /attendance/setup/sections/:id/copy`, `POST /attendance/setup/apply`. Errors may carry `details` (the bad slot's index, the clashing section); the global error filter now passes `details` through with `code`. Audit: `section_attendance.update`, `schedule.update` (slots before and after, `source` grid / copy / apply / import). **Web:** Class setup (`/attendance-setup`, every staff role and solo teachers): one row per section with its schedule, branch (when there are several), class type, mode and "Late after"; a drawer edits the schedule one line per time (days ticked, start, end, optional teacher) with "copy from"; "Apply to…" previews and applies to the class or shift.

**Built in P3-02 part 3 (schedule CSV import, ATT-16):** the browser reads the CSV (`utils/attendance/scheduleImport.ts`: columns `class, section, days, start, end` and optional `class_type, mode, grace, branch`, English and Bangla header spellings) and sends the rows as JSON, like the student import. `ScheduleImportService` (attendance) checks every row (`POST /attendance/setup/import/preview`: class and section by name in the session, days in English or Bangla or ISO numbers, 24-hour or AM/PM times with Bangla or Latin digits, overlaps between lines of a section, conflicting settings between lines, the 30-slot limit, branch names, the caller's sections) and returns each row's problems (codes in `IMPORT_ISSUES`) and what each section gets. `POST /attendance/setup/import` runs only when no row has a problem (400 `ATTENDANCE_SCHEDULE_IMPORT_INVALID` otherwise), in one transaction: each section in the file gets exactly its listed times through `RoutineSlotsService.replace`, so the same file twice changes nothing; a teacher on an existing slot with the same day and times is kept; other sections are untouched. Empty settings cells leave a setting unchanged; `grace` "default" sets the organisation's period; `branch` takes a branch name or "main" (owners, admins and assistants only). Audit rows use `source: 'import'`. **Web:** "Import CSV" on Class setup opens a drawer with the template, the per-row check and the import button.

**Built in P3-03 part 1 (class sessions and web self check-in, ATT-04, 06, 11):** migration `1756230000000-ClassAttendance` creates `class_attendance` (one row per class session: `routine_slot_id` + `date` unique, `starts_at`/`ends_at` as instants, status SCHEDULED; P3-04 adds CLOSED and CANCELLED), `class_attendance_records` (one row per person per session: `person_type` STUDENT/TEACHER, status PRESENT/LATE/ABSENT/LEAVE, server `checked_in_at`, `late_minutes`, source SELF/AUTO_ABSENT/IMPORT/CORRECTION, and for in-person check-ins the position, `distance_m`, `accuracy_m` and a `flag`) and `attendance_corrections` (ATT-12). All are owned by `attendance`; a session row is made on the first check-in (or correction) of a slot and date, with an insert that ignores the conflict, so a worker can later make the rest. `ClassSessionsService` holds the shared reads (each section's class type, mode, grace period, branch and whether its session is open). `CheckInService` holds the rules: the window opens 15 minutes before the start and closes at the end time; Late after start + grace (the section's own, else the organisation's), with whole minutes since the start; the server's clock (`AttendanceClock`) in the organisation's time zone; no check-in on a weekly off day or holiday (`HolidaysService.closedDays`), in a paper-register section, or before the in-person branch has a pin; in-person check-ins need a position with an accuracy of 100 m or better inside the branch radius (else 400 with the distance or accuracy); online classes take check-ins from anywhere; one record per person per session (unique key, insert-or-ignore, 409 `ATTENDANCE_CHECKIN_ALREADY`). Odd check-ins are saved with a flag: `EDGE_ACCURACY` (accuracy worse than 50 m and the reported circle reaches outside the radius) or `IMPOSSIBLE_JUMP` (faster than 100 km/h, and over 2 km, from the person's previous in-person check-in in the last 12 hours). **Who:** students check in to the slots of the sections they are ACTIVE in (open sessions; also a solo teacher's students through their enrolment); staff of an organisation check in as TEACHER to slots that name them and to unnamed slots of sections they teach (subject class or class teacher); a solo teacher's own workspace has no teacher check-in. API (`attendance` feature, anyone in the workspace): `GET /attendance/me/today`, `POST /attendance/check-in` (`slot_id`, and `latitude`, `longitude`, `accuracy_m` for in-person classes). The position is stored but never returned. 

**Built in P3-03 part 2 ("My attendance", ATT-18, ATT-04 on the web):** `GET /attendance/me/calendar?month=YYYY-MM` (`MyAttendanceService`, anyone in the workspace, only the caller's own records) returns every day of the month with its closed-day reason and the caller's classes, each with a calendar status: UPCOMING, OPEN, PRESENT, LATE, ABSENT, LEAVE, CLOSED_DAY or NOT_RECORDED. A class counts only from the day its slot was added and, for a student, the day they joined the section. A class whose check-in has closed with no record shows as ABSENT; P3-04 saves that Absent when check-in closes, so the calendar does not change then. A paper-register class without its register shows as NOT_RECORDED, never Absent. Records of slots removed since still show. Counts are per class; the attendance % is (present + late) / (present + late + absent), whole percent, with leave not held against anyone. **Web:** "My attendance" (`/my-attendance`, students in the Platform menu and every staff role in the Organization menu, `attendance` feature) shows today's classes with a "Check in" button while a class is open. In-person classes ask the browser for a high-accuracy position, with no cached position. The server's error codes are explained on the row ("You are 340 m away…"), and the list is re-read every minute. Below it is the month calendar, Saturday first: one mark per class with the agreed colour and a letter (P/L/A/LV/H in English, উ/দে/অ/ছু/ব in Bangla), a legend, the counts and the %. 

**Built in P3-03 part 3 (class view and corrections, ATT-07, ATT-12, ATT-11):** `SectionAttendanceService` (attendance).
- `GET /attendance/sessions?date=` lists the classes of a school date (default today) with student counts: present, late, absent, leave, not in yet, and flagged.
- `GET /attendance/sessions/:slotId/:date` returns one class: every ACTIVE student of the section who had joined by that date, plus the slot's named teacher and anyone who checked in as a teacher. Each person has a status (the same computed statuses as "My attendance"), their record without the position, and their corrections.
- `PUT /attendance/sessions/:slotId/:date/records/:personId` corrects a status. It takes `status` (PRESENT, LATE with optional `late_minutes`, or ABSENT; LEAVE comes only from leave requests, P3-06) and a `reason` of 3–500 characters, and returns the class.
- **How a correction is saved:** under a row lock it updates the record, or creates it with source CORRECTION when nobody checked in, making the session row if needed. A self check-in keeps its check-in time, distance and accuracy. It adds an `attendance_corrections` row (old status null when there was no record) and an audit row `attendance.correct` (area "Attendance"; before/after status and minutes late, with the reason).
- **Refused corrections:** before the class starts (409 `ATTENDANCE_CORRECTION_NOT_STARTED`), on a closed day (409 `…_CLOSED_DAY`), and with no change (400 `…_NO_CHANGE`).
- **Who:** owners, admins and assistants see and correct every class of open sessions, including teachers' records. A teacher sees the classes of the sections they teach and the slots that name them, and corrects students only (403 `…_TEACHER_RECORD`). Students get 403. Another organisation's class or a person outside the class is 404.
- **Web:** "Class attendance" (`/attendance`) is in the Organization menu for every staff role and in a solo teacher's own workspace. It shows a date picker (today or earlier) and a table of the day's classes with time, teacher, check-in state and count badges. "View and correct" opens a drawer listing each person with their mark (colour and letter), check-in time, minutes late, distance and accuracy, any flag, and their corrections ("No check-in → Present by …, reason"). The **Correct** form takes the new status, minutes late for Late, and a reason.

**Built in P3-04 part 1 (closing job and class cancellation, ATT-10, ATT-19):** migration `1756240000000-ClassSessionCloseCancel` adds `closed_at`, `cancelled_at`, `cancelled_by` and `cancel_note` to `class_attendance`.
- **Closing job** (`attendance.close-sessions` on the new `attendance` queue, every 5 minutes, `SessionClosingService`): for every organisation with active slots and the `attendance` feature, every class from 7 days ago to today whose check-in has closed and that is still SCHEDULED gets an Absent record (source AUTO_ABSENT) for each ACTIVE student of the section without one, and for the slot's named teacher in an organisation (not in a solo workspace); the session becomes CLOSED. One transaction per session under a row lock, with insert-or-ignore on (session, person), so running twice (or two at once) saves nothing twice and check-ins and corrections are kept. Looking 7 days back catches up after the worker was down. Skipped: weekly off days and holidays, cancelled classes, paper-register sections (P3-05 imports them), closed academic sessions, slots added after the class started, and students who joined after it started. The same rule (`countsFor`: the slot and the enrolment existed when the class started) now decides what "My attendance" and the class view show, so saving the Absent changes nothing on screen. Each run that closes something adds an audit row `attendance.auto_absent` (system, with the counts and dates).
- **Cancel one class** (ATT-19): `POST /attendance/sessions/:slotId/:date/cancel` (`note` up to 300 characters, optional) and `POST …/restore`. Who: whoever may see the class (the section's teachers, the slot's named teacher, owners, admins and assistants). When: today or up to 60 days ahead, before the class ends, on a school day (409 `ATTENDANCE_CANCEL_PAST`, `…_TOO_FAR`, `…_ENDED`, `…_CLOSED_DAY`, `…_ALREADY`; restore 409 `…_NOT_CANCELLED` or `…_ENDED`). The session row is made if needed and kept with status CANCELLED, who, when and the note; check-ins already made stay. A cancelled class takes no check-in (409 `ATTENDANCE_CHECKIN_CANCELLED`, `blocked: CANCELLED` on "Today"), is not closed, shows as CANCELLED (striped) and is not counted; it cannot be corrected (409 `…_CORRECTION_CANCELLED`). The section's students get an in-app notice (`attendance.class_cancelled` / `attendance.class_restored`, through the outbox in the same transaction). Audit: `attendance.cancel`, `attendance.restore`. The class view returns `cancelled` (who, when, note), `can_cancel` and `can_restore`.
- **Correction limit (decided in P3-04):** teachers correct classes of the last 7 days (409 `ATTENDANCE_CORRECTION_TOO_OLD`; `can_correct` false); owners, admins and assistants have no limit while the academic session is open.
- **Templates:** variables ending in `_on` are school dates (`YYYY-MM-DD`), shown as day and month in the recipient's language.

**Built in P3-04 part 2 (guardian SMS and the repeated-absence alert, ATT-06, ATT-10, ATT-14):** `AttendanceAlertsService` (attendance); no migration. Every message goes through the outbox (credits, "Not sent — no credit" and the message log are the dispatcher's), to the student's live guardians (`GuardiansService.contactsForStudent`: removed guardians left out) in each guardian's SMS language (the student's, else the organisation's `sms_locale`). The `guardian_sms` switches turn the Late and Absent SMS on or off.
- **Late, at once:** a student's late self check-in queues an SMS per guardian in the check-in's transaction (`attendance.late`), once per student per day (dedupe `attendance.late:{student}:{date}:{guardian}`), even with two late classes. Corrections to Late send nothing.
- **Absent, once a day:** `attendance.end-of-day` (every 5 minutes) works on a school day from 23:59 in the organisation's time zone, and, after a worker outage, until 08:00 the next morning (later the day's SMS are dropped, so families never get yesterday's news at noon). It first closes that day's classes (the closing job), then sends one SMS per guardian (`attendance.absent`, dedupe per student, date and guardian) for each student with an Absent and no Present, Late or Leave that day, in classes that were not cancelled. A student with a paper-register class that day gets none (the register is not in yet, P3-05). Closed days and cancelled classes have no Absent, so they never count.
- **Repeated absence (ATT-14):** in the same run, for each student absent all day, the school days in a row (days with a class for them) on which they missed every class are counted back from that day; at `repeat_absence_days` or more (default 3), an in-app alert (`attendance.repeat_absence`, link to Class attendance) goes to the section's class teacher (while class teachers are on), else its subject-class teachers, else the teacher named on its slot, else the organisation's owners; once per streak (dedupe on the streak's first day). A class attended ends the streak.
- **Templates (bn + en):** Late "Rahim (Class 8 A) checked in late at 7 Nov 2026, 16:24. {organisation}", Absent "Rahim (Class 8 A) was absent from class on 7 Nov. {organisation}", and the in-app alert.

**Built in P3-04 part 3 (screens):** Class attendance (`/attendance`) lets you pick a date up to 60 days ahead. A cancelled class shows "Cancelled" in the list. Its drawer has "Cancel this class", which opens a short form with an optional note for students, and "Restore the class". The drawer shows who cancelled the class, when, and the note, and why corrections are closed (not started yet, or older than a teacher's 7 days). "My attendance" and the calendar show a cancelled class striped, with the letter C (বা in Bangla), and the legend includes it. The check-in row says the class is cancelled today. The message log has an "Attendance" type: guardian Late and Absent SMS, cancellation notices and repeated-absence alerts. The activity log names `attendance.cancel`, `attendance.restore` and `attendance.auto_absent`. Attendance messages no longer name the "assistant" role (neutral wording, owner rule).

**Built in P3-06 part 1 (leave requests and approvals, ATT-09, ATT-11):** migration `1756250000000-LeaveRequests` creates `leave_requests` (own enums `leave_status`, `leave_person_type`) and adds `class_attendance_records.leave_request_id`. `LeaveService` (attendance) under `/attendance/leave` (`attendance` feature): `GET mine` (the caller's requests and those they applied for, plus `can_apply`, `person_type`, `can_apply_for_others`, `can_approve`), `GET approvals?status=PENDING|DECIDED|ALL`, `GET people?q=` (whom the caller may apply for), `GET :id`, `POST` (`from_date`, `to_date`, `reason` 3–500, optional `file_id` of an upload with purpose `LEAVE`, optional `person_id`), `POST :id/approve` (`note` optional), `POST :id/reject` (`note` required), `POST :id/cancel`. Errors carry `ATTENDANCE_LEAVE_*` codes.
- **Who applies:** students and staff for themselves (a solo teacher's own workspace has no teacher attendance, so no teacher leave there); for a student, their approvers, owners, admins and office staff (ASSISTANT); for a teacher, owners and admins.
- **Who approves:** a student's leave, the class teacher of one of their sections while `class_teacher_enabled`, else the section's subject-class teachers (`SectionsService.followUpTeachers`, as for ATT-14), and always owners and admins (a solo teacher is the owner). A teacher's leave, owners and admins. Nobody decides their own; an owner's own leave is approved at once, and so is a request made by someone who may approve it. A new request goes in-app to the follow-up teachers, else to owners and admins.
- **Dates:** at most 60 days, starting no more than 30 days back and up to 365 ahead, with at least one day that is not a weekly off day or holiday (`school_days` is returned); no overlap with the person's pending or approved leave (409 `ATTENDANCE_LEAVE_OVERLAP`, under an advisory lock per person).
- **Effect on attendance:** the closing job saves LEAVE (source AUTO_ABSENT, `leave_request_id` set) instead of Absent for anyone on approved leave that day; its result and audit count `on_leave`. Approving leave that covers days already closed turns their Absent records into LEAVE (source CORRECTION, linked to the request) with an `attendance_corrections` row each ("Approved leave", by the approver). Present and Late records stay. The end-of-day Absent SMS already ignores a student with a Leave that day, so a day fully on leave sends none. "My attendance", today's classes (`on_leave`) and the class view show a class without a record on a day of approved leave as Leave.
- **Withdrawing:** the person, the applicant or an approver; a pending request at any time, an approved one only before its first day (so no record needs undoing). Status CANCELLED, never deleted.
- **Messages:** `attendance.leave_applied` SMS to the student's guardians when `guardian_sms.leave` is on (organisation credits, dedupe per request and guardian, bn + en); in-app `attendance.leave_requested` to approvers, `attendance.leave_approved` / `attendance.leave_rejected` to the person and the applicant, `attendance.leave_cancelled` to the others involved. Audit: `leave.apply`, `leave.approve` (with `absent_to_leave`), `leave.reject`, `leave.cancel`.

**Built in P3-06 part 2 (screens):** "Leave" (`/leave`, `attendance` feature) in the student menu, for every staff role of an organisation, and in a solo teacher's own workspace. "Apply for leave" opens a drawer: who (yourself, or for staff a student or teacher found by name through `GET /attendance/leave/people`), first and last day (one day when the last is empty; no earlier than 30 days back), reason, and an optional image or PDF uploaded with file purpose `LEAVE`. "My leave" lists requests with their status (Waiting, Approved, Not approved, Withdrawn), the answer and a Withdraw button after a confirmation. "To approve" (approvers only) lists waiting, decided or all requests with the person, class, dates, school days, reason and attachment; Approve takes an optional comment, "Don't approve" requires one. "My attendance" says when today is a day of approved leave and links to Leave; the calendars already show Leave in blue with LV / ছু. All text in English and Bangla.

**Built in P3-05 part 1 (paper register import and the register export, ATT-17, ATT-13):** `PaperRegisterService` (attendance); no migration (records use source `IMPORT`, changes use `attendance_corrections`). API (`attendance` feature) under `/attendance/register`:
- `GET sections`: the sections whose register the caller may download, with their mode.
- `GET sections/:id?month=YYYY-MM`: the month's classes (columns) and each student's marks. This is both the template and the export (ATT-13, "the same format as ATT-17"). The CSV is roll number, name, then one column per class: the date (`2026-11-07`), plus the start time (`2026-11-07 16:00`) when the section has two classes that day. Holidays, weekly off days and cancelled classes are not columns. Future classes of the month are, so a teacher can fill in as they go. A mark is the record's status, else Leave on a day of approved leave, else empty.
- `POST sections/:id/preview` and `POST sections/:id/import` take the file as the browser read it: `header`, `rows[].cells`, and optionally `overwrite_check_ins` and `file_name`. Only paper-register sections take a file (409 `ATTENDANCE_REGISTER_SELF_CHECKIN`); a closed academic session gives 409 `…_SESSION_CLOSED`.
- **The check** (`REGISTER_ISSUES`):
  - Columns: the header must be a date of the month (headers rewritten by a spreadsheet, such as `7/11/2026`, `11/7/2026`, `07-Nov-26`, `7 Nov` or a bare `7`, are read; the register's month tells day from month). It must also be a class day (`NOT_CLASS_DAY`), not a holiday or off day (`CLOSED_DAY` with the reason), not a cancelled class (`CANCELLED`), and a class that has started (`NOT_STARTED`). A second class that day needs its time (`TIME_NEEDED`, `NOT_CLASS_TIME`). One column per class (`DUPLICATE_COLUMN`).
  - Rows: the student is found by roll number (Bangla digits and leading zeros allowed), else by a unique name, among the section's ACTIVE students (`STUDENT_NOT_FOUND`, `…_AMBIGUOUS`, `…_DUPLICATE`, `…_MISSING`). A roll number with a different name only gets a note (`NAME_DIFFERS`).
  - Cells: P, L, A or Leave, in English or Bangla (উ, দে, অ, ছু and the full words), with empty or "-" meaning nothing written (`STATUS_INVALID`). A student who joined after a class has no mark in it (`NOT_JOINED`). A teacher changing a saved mark older than 7 days is refused (`TOO_OLD`, the correction limit); first marks have no limit.
  - A column or row with a problem but no marks is ignored. Anything else makes the file invalid, and the import is refused (400 `ATTENDANCE_REGISTER_INVALID`).
- **Applying** (one transaction, an advisory lock per section, row locks on the records): a new mark saves a record (source IMPORT). A different mark updates the record (source IMPORT, a self check-in keeps its time and position) and adds an `attendance_corrections` row ("Paper register import (file name)", who). The same mark, or an empty cell, changes nothing, so the same file twice changes nothing.
- **Approved leave:** a record saved from approved leave is never changed (`LEAVE_KEPT`). On a day of approved leave, Absent (or Leave) is saved as Leave linked to the request (`ON_LEAVE`); Present and Late are saved as written, as for a check-in.
- **Self check-ins:** a self check-in the file disagrees with is listed (`SELF_CHECKIN`, `summary.check_ins`) and kept, unless the import is sent with `overwrite_check_ins`.
- **Audit:** one `attendance.import` row per import (the section, month, file name, counts and dates written).
- **Guardian SMS:** the end-of-day job holds back a student's Absent SMS only while one of their paper-register classes that day has no mark for them. After an import, `AttendanceAlertsService.releaseHeldAbsences` sends the held-back Absent SMS, and the repeated-absence alert, for the section's students on the days written. The P3-04 rules apply: every class that day missed, the same dedupe keys, the `guardian_sms.absent` switch. It covers only days whose end has come (from 23:59) and at most 3 days back (`PAPER_ABSENT_SMS_DAYS`); an older register still counts but sends nothing. There is no Late SMS for an import, because that SMS is sent "at once".
- **Who:** as for the class view. Owners, admins and assistants can use every section; a teacher the sections they teach and the sections whose slots name them.

**Built in P3-05 part 2 (screens):** "Monthly register" (`/attendance-register`, `attendance` feature) is in the Organization menu for every staff role and in a solo teacher's own workspace.
- **The page:** pick a section (paper-register sections first; the list says each one's mode) and a month (previous and next). The table shows each student's Present, Late, Absent and Leave counts for the month, and the classes held so far with no mark ("No mark yet").
- **Downloads:** "Download template" writes the CSV with empty marks; "Export CSV" writes it with the marks in the user's language (P/L/A/Leave or উ/দে/অ/ছু). Both use the browser's own CSV writer, with a byte-order mark so Excel shows Bangla.
- **"Import CSV"** (paper-register sections only) opens a drawer. Choose the file, and the browser reads it (the same CSV reader as the other imports) and sends it for the check. The drawer then shows:
  - what the import does: new marks, changed marks (kept in the correction trail), already saved, kept;
  - each column's problem (holiday or off day, no class, cancelled…, with "empty, ignored" for columns without marks);
  - each line with its own and its cells' problems and notes ("checked in themselves as Late; the file says Present", "On approved leave: saved as Leave");
  - a box to also replace the self check-ins the file disagrees with.
- The import button counts the marks it will save and stays off while anything has a problem. After an import, the page reloads and a toast gives the counts.
- The register's error codes are explained in their own words (`register.errors`). The activity log names `attendance.import`. All text in English and Bangla.

**Built in P3-07 part 1 (reports API, ATT-13, ATT-11):** `AttendanceReportsService` (attendance); no migration. API (`attendance` feature) under `/attendance/reports`:
- `GET daily?date=&section_id=` is the daily summary per section (default today). Each section with classes that day lists its classes (time, named teacher, check-in state, cancelled, and the class view's counts) and every student with their mark in each class (the class view's statuses, so Leave shows before a record exists and a paper register not in yet shows as not recorded) and their **day**:
  - **Absent:** missed every class held that day. This is the rule of the guardians' Absent SMS.
  - **Late:** late to at least one class. **Present:** otherwise. In both cases `missed` counts the classes they still missed.
  - **Leave:** on leave and at no class.
  - **Waiting:** classes still to come, or a paper register not in yet. A student absent so far stays Absent, with `waiting` above 0.
  - Cancelled classes and closed days never count.
  - The section's counts: students, present, late, absent, leave, waiting, and `missed_some` (present or late but missed a class). The one rule is `dayMark` in `attendance-report.ts`.
- `GET sections/:id/month?month=` is the monthly register. It is P3-05's register view (the same grid as the register CSV; cancelled classes and closed days left out), plus:
  - `days`: the class days, with how many classes each had. The printed register has one column per day.
  - per student: a day mark per day, their counts and `attendance_pct`;
  - the section's counts and %.
- `GET teachers?from=&to=` (owners and admins only, 403 otherwise; at most 31 days, `ATTENDANCE_REPORT_RANGE_*`; default today) lists the teachers with saved records in the period. For each: counts, %, minutes late added up, and the classes that were not on time (late, absent, leave) with the section and time. Cancelled classes are left out. With one day it is the admins' daily summary of late and absent teachers (ATT-11). Absent is counted once the closing job has saved it, when check-in closes.
- **Attendance %:** one formula, `attendancePct` (present + late) ÷ (present + late + absent), whole percent, null with nothing counted. "My attendance", the reports and the Performance read all use it.
- **Performance read:** `AttendanceReportsService.studentAttendance(organizationId, studentIds, from, to)` is exported from `AttendanceModule` for Epic 3 (design §8.11, F3). It returns, per student, `{ counts: { present, late, absent, leave }, attendance_pct }` from the saved class records of the period, with cancelled classes left out. It is one grouped query on `(organization_id, person_id, date)`, and has no access check (the caller checks).
  - It equals "My attendance" for the same period once the closing job has run (≤ 5 minutes after a class).
  - Students with no records get zero counts and null.
- **Who:** sections as on the class view and the register. Owners, admins and assistants see every section; a teacher sees the sections they teach or are named on (another section is 404). Students get 403; they see their own attendance on "My attendance". Another organisation's section is 404.
- **No summary table (decided in P3-07):** reports are worked out from the class records on request. On a realistic month (40 students × 6 classes a day × 26 days = 6,240 records), the e2e test measured the monthly register at 440 ms, the daily summary at 59 ms and the Performance read at 18 ms. `daily_attendance` stays unbuilt (TODO if term-wide reports get slow).

**Built in P3-07 part 2 (screens):** "Attendance reports" (`/attendance-reports`, `attendance` feature) is in the Organization menu for every staff role and in a solo teacher's own workspace. It has three tabs:
- **Daily summary:** a date (default today) and all sections or one. Each section shows its mode, its classes (cancelled ones marked) and its students in groups, most urgent first: absent all day, missed some classes, late, on leave, not in yet, present. Each group has its count and the names ("Rahim (missed 1)").
- **Monthly register:** a section and a month. The grid is students × class days, one cell per day in the calendar colours with its letter (P/L/A/LV, or উ/দে/অ/ছু). A small number shows the classes missed on a day the student came to others. Then each student's Present, Late, Absent and Leave counts and attendance %, and the section's % in the card. "Export CSV (Excel)" writes P3-05's register CSV with a byte-order mark, so Excel keeps Bangla and the file can be imported again.
- **Teachers** (owners and admins of an organisation only; not in a solo workspace): from and to (default today, with "Today" and "This month"). Each teacher's counts, %, minutes late and a table of the classes not on time. CSV with the same columns.
- **Print / Save as PDF:** each tab has a print sheet rendered under `<body>` and shown only when printing. It has the organisation, the title, the section and month (or date or period) and the letter legend, with A4 landscape, the header row repeated on every page, rows never split, and each section of the daily summary kept together. The browser's print writes the PDF, so Bangla is shaped by the browser's fonts. **No PDF or Excel package:** jsPDF does not shape Bangla conjuncts, and a real .xlsx needs a package (TODO).
- All text in English and Bangla, with Bangla digits in Bangla.

### 9.5 Homework

| Table | Status | Purpose and key columns |
| --- | --- | --- |
| homework | New | Title, instructions, type (FILE/TEXT/QUESTIONS/PAPER), marks, due, status, `topic_id` |
| homework\_attachments, homework\_targets, homework\_items | New | Teacher files; sections or students; bank questions |
| homework\_submissions | New | Versioned per student; late flag; `extracted_text` for plagiarism |
| submission\_files | New | Pages in order |
| homework\_scores | New | Raw score, penalty, final, feedback, ratings; unique (homework, student) |

### 9.6 Exams and proctoring

| Table | Status | Purpose and key columns |
| --- | --- | --- |
| exams | Changed | + `session_id`, `term_id`, `is_homework_mode` |
| exam\_question\_sections | Existing | — |
| exam\_questions | Changed | + `question_bank_item_id`, `topic_id` |
| student\_exam\_submissions | Changed | + `effective_deadline`, `shuffle_seed`, `finalize_reason`; proctoring columns move out |
| student\_exam\_answers | Existing | — |
| proctoring\_settings | New | Per exam: level, enabled checks, snapshots, auto-disqualify threshold |
| proctoring\_events | New *(partitioned)* | Every flag with time, severity, snapshot |
| proctoring\_reviews | New | CONFIRM/REINSTATE/RETAKE with reason |
| offline\_exams, offline\_exam\_marks | New | Paper exams and marks per student (PRF-03) |

### 9.7 Question bank and syllabus

| Table | Status | Purpose and key columns |
| --- | --- | --- |
| question\_bank\_items | New | Reusable question; class, subject, topic, difficulty, visibility, source |
| exam\_blueprints | New | Exam pattern rows from the syllabus import |
| textbook\_chapters | New | Platform catalogue: NCTB class + subject + chapter number → Bangla and English titles |
| syllabus\_imports | New | AI import job: files, status, model, tokens, cost, `draft_json`, `edit_rate` |
| syllabi | New | One per session + class + subject; DRAFT/PUBLISHED |
| syllabus\_units, syllabus\_topics | New | Term → unit → topic, with `source_text`, `source_image`, `needs_review` |
| syllabus\_progress | New | Topic status per section |
| lesson\_logs, lesson\_log\_topics | New | What a teacher covered after a class |

In IELTS workspaces the UI calls the syllabus a **course path**, built from each centre's own curriculum. The same tables are used; only the label changes, driven by `organizations.workspace_type`.

### 9.8 Performance and reporting

| Table | Status | Purpose and key columns |
| --- | --- | --- |
| grading\_scales, grading\_bands | New (built P2-06) | Bangladesh default + org-edited bands (pct range → grade, GPA); replaced scales kept inactive |
| score\_weights | New | Exams / homework / attendance / behaviour % per session + class |
| behaviour\_criteria, behaviour\_ratings | New | 1–5 ratings per student per criterion |
| student\_term\_scores | New | Read model: component %, overall, grade, GPA, rank per term (and per subject) |
| report\_cards | New | PDF, remarks, guardian share token (30 days) |

`report_cards` gains `version` and `scores_snapshot` (the frozen term scores). Its unique key becomes (term, student, version).

### 9.9 Communication, resources, calendar

| Table | Status | Purpose and key columns |
| --- | --- | --- |
| chat\_access\_logs | New | Admin opened a chat: who, which, why |
| message\_reports | New | Reported message with context |
| resource\_folders, resources, resource\_shares, resource\_views | New | Library; FILE/VIDEO/LINK; download allowed; views and watch % |
| routine\_slots, routine\_exceptions | New | Weekly routine and one-day changes |
| events, event\_attendees | New | Exams, meetings, activities and who attends |
| holidays | New | Closed days and ranges |
| reminder\_rules | New | Up to 5 offsets with channel, org default or per user |

**Built in P5-04 part 1 (weekly routine, CAL-01, CAL-02):** the routine is built on the section schedules' `routine_slots` rows (no migration): each slot can now name a subject class of its section (`offering_id`), a teaching member and a room (free text, 40 characters, matched without case). `RoutineService` (calendar, new feature key `calendar`, on in the Basic, Premium and Pro presets) adds, changes and removes one slot at a time. **Rules:** a section never has two overlapping slots (400 `SCHEDULE_OVERLAP`); a teacher or room booked in another overlapping slot of an open session is a clash, refused with 409 `ROUTINE_CLASH` and `details.clashes` (kind TEACHER/ROOM, the other slot, its section and times) unless the request sends `confirm_clashes`; the grid then marks the clash on both slots (worked out when read, nothing stored). Back-to-back slots are not a clash. Changing a slot's subject, teacher or room changes the row; a new day or time removes the old row (kept, as in P3-02) and adds a new one, so class sessions keep their history. Class setup's whole-section save (P3-02) now checks teacher clashes only for slots it adds, so a clash confirmed in the routine never blocks it. **Who:** owners, admins and assistants change the routine (open sessions only); every staff member reads it; `GET /routine/mine` gives students their sections' slots and teachers the slots that name them or belong to a subject class they teach with no other teacher named. API (`calendar` feature): `GET /routine?session_id=`, `GET /routine/mine`, `POST /routine/slots`, `PATCH /routine/slots/:id`, `DELETE /routine/slots/:id` (soft). Audit: `routine.add`, `routine.change`, `routine.remove`. One-day changes (`routine_exceptions`) come in P5-04 part 3.

### 9.10 Notifications, files, AI, integrity, IELTS

| Table | Status | Purpose and key columns |
| --- | --- | --- |
| notification\_outbox | New *(partitioned)* | Every outgoing message, `dedupe_key`, status, credits used |
| notifications | New | In-app inbox |
| message\_templates | New | (event, channel, locale) → body |
| sms\_credit\_ledger | New | Top-ups and sends; `balance_after` |
| user\_notification\_prefs | New | Channels per event type |
| file\_objects | New | Every file in S3: purpose, size, status, `delete_after` |
| ai\_task\_configs, ai\_requests | New | Model per task; every call's tokens and cost |
| similarity\_checks, similarity\_matches, ai\_writing\_scores | New | Plagiarism runs, pairs and review decisions |
| ielts\_profiles, ielts\_band\_tables, ielts\_mock\_tests, ielts\_results | New | Target bands, raw → band tables, mocks, module bands with criteria |

### 9.11 MongoDB (chat)

| Collection | Status | Notes |
| --- | --- | --- |
| group\_chats | New | One per subject class (course offering); `announcementOnly`, pinned |
| group\_messages | New | Index `{groupId, createdAt}`; soft delete |
| private\_conversations, private\_messages | Existing | + `orgId` index, `readAt` |
| discussion\_posts, discussion\_comments, discussion\_attachments | Existing | Shown as the Discussions tab |
| user\_mutes | New | Admin mutes (COM-04) |

**Comment threads on posts (COM-01 update):**

- `group_messages.parentId` is null for a post and set for a comment on that post.
- Posts carry `commentCount` and `lastCommentAt`.
- Index: `{groupId: 1, parentId: 1, createdAt: 1}`.
- In announcement mode only teachers create posts, but every member can comment.

### 9.12 Dropped after migration

`teacher_subscriptions`, `payment_history`, `class_students`, `class_teachers`, `class_subject_teachers` (these three dropped in P2-03), and the four Postgres chat tables (`class_discussion_posts`, `class_discussion_comments`, `class_private_conversations`, `class_private_messages`). Each is kept read-only for one release before it is dropped.

## 10. Volume, partitioning, indexes and retention

Attendance dominates the row count. At the 12-month target (200,000 students, about 250 school days), class attendance alone reaches about 300 million rows a year. That is why the four high-volume tables are partitioned by month from day one.

| Table | Rows per year at target | Estimate basis | Partitioning |
| --- | --- | --- | --- |
| class\_attendance\_records | \~300 M | 200k students × 6 classes × 250 days, if every org uses per-session roll | Monthly by `date` |
| attendance\_punches | \~100 M | 2 punches (in/out) per person per day | Monthly by `punched_at` |
| daily\_attendance | \~50 M | 1 row per person per day | Monthly by `date` |
| notification\_outbox | \~10–30 M | Absences, reminders, homework and exam notices | Monthly by `created_at` |
| proctoring\_events | Depends on exam volume | Flags only, not heartbeats | Monthly by `occurred_at` |

**Partitioning:**

- Monthly partitions are created 3 months ahead by `pg_partman`, run from the worker's nightly maintenance job.
- Every query on these tables must include the date column, so PostgreSQL scans only the relevant months. Reports always have a date range.
- `daily_attendance` uniqueness `(organization_id, person_id, date)` holds because the partition key `date` is in the key.

**Indexes that matter (beyond primary and foreign keys):**

- `daily_attendance (organization_id, section_id, date)`: daily section summary and monthly register (ATT-13).
- `class_attendance_records (organization_id, student_id, date)`: student attendance %.
- `student_exam_submissions (status, effective_deadline)`: the auto-submit job.
- `notification_outbox (status, send_after)`: the dispatcher.
- `enrolments (section_id, status)`: rosters, used on almost every request.
- `offering_teachers (teacher_id)`: "my sections".
- `question_bank_items (organization_id, subject_id, topic_id)`: bank filters.
- `routine_slots (teacher_id, day_of_week, start_time)` and `(section_id, …)`: clash check and routine views.
- MongoDB: `group_messages {groupId: 1, createdAt: -1}`.

**Read models instead of live aggregation:**

- `student_term_scores` holds the computed scores. Dashboards and report cards read it and never aggregate raw attendance on request.
- Daily section attendance counts are cached in Redis for the current day (`att:{sectionId}:{date}`).

**Retention and deletion:**

- **Selfies and proctoring snapshots:** `file_objects.delete_after = created_at + 90 days`. `retention.purge` deletes the S3 object and nulls the reference. The attendance or flag row stays.
- **Everything else** is kept for the organisation's lifetime.
- **Organisations are never deleted (owner decision, 30 Oct):** on request an organisation is deactivated: hidden and closed to its members at once, with all its rows and files kept, so its history and audit log stay. There is no hard-delete job. (Earlier plan: hard delete 30 days after a soft delete.)
- **User deletion on request:** the user is anonymised (name, phone and email removed), and the IDs are kept so class statistics stay correct.
- **Backups:** RDS automated backups with point-in-time recovery for 14 days; MongoDB Atlas daily snapshots; S3 versioning on the `org/` prefix for 30 days.

## 11. Deployment on AWS

The sizing starts from the existing `docs/AWS-PRODUCTION-COST-AND-INFRASTRUCTURE.md` (1 API, `db.t4g.medium`, `cache.t4g.micro`, Atlas M10) and adds what the new epics need: a second API instance, a worker, and more database and Redis headroom. Prices are not re-quoted here; re-run the AWS calculator with these sizes.

| Component | Launch size | Scale-up trigger | Change vs the AWS doc |
| --- | --- | --- | --- |
| API (NestJS) | 2 × `t4g.large` (or 2 ECS tasks, 2 vCPU / 4 GB) behind the ALB, sticky WebSockets | CPU > 60% or p95 latency > 500 ms during exams | 1 → 2 (Redis adapter makes this safe) |
| Worker | 1 × `t4g.medium` | Queue lag > 60 s | New |
| Web (Next.js) | 1 × `t4g.small` (standalone) + CloudFront | — | Same |
| PostgreSQL | RDS `db.t4g.large`, gp3, Single-AZ → Multi-AZ when paid orgs > 20 | CPU > 60%, or connections > 70% of max | medium → large (attendance volume) |
| Redis | ElastiCache `cache.t4g.small` | Memory > 70% | micro → small (queues + Socket.IO + live state) |
| MongoDB | Atlas M10 | — | Same |
| S3 + CloudFront | Private bucket, signed URLs | — | Replaces local disk |
| MediaConvert | On demand, pay per minute | — | New, only for plans with video |
| ZKTeco agent | Small Windows/Linux service on a PC at each org (who installs it: open item, section 12) | — | New |

**Environments:**

- `dev`: docker-compose (existing).
- `beta`: served from `develop` (as today).
- `prod`: a separate AWS account, or at least a separate VPC and database.

**CI/CD (GitHub Actions):**

1. Lint and type-check.
2. Backend unit tests + critical-path tests: payment settlement, deadline enforcement, matching shuffle, tenancy guard, attendance resolver.
3. Run migrations against a throwaway PostgreSQL, then fail if the schema differs from the entities (`migration:check`). The first migration, `BaselineSchema`, builds the base schema on an empty database and does nothing where the schema already exists.
4. Build the Docker images (api, worker, web) and push them to ECR.
5. Deploy to beta automatically; deploy to prod by manual approval.

TypeORM `synchronize` stays off everywhere except local dev. All schema changes go through migrations.

**Mobile:** the Flutter app is released through Play Store and App Store. The API keeps `/api/v1` backward compatible. Breaking changes go to `/api/v2`, and the app checks `GET /api/v1/app/min-version` on start to force updates.

## 12. Migration plan from today's schema

Migrations follow **expand → migrate → contract**:

1. **Expand:** add new tables and columns.
2. **Migrate:** backfill with a script that can run twice, and switch the code to read the new tables.
3. **Contract:** keep the old tables read-only for one release, then drop them.

Every step ships separately and can be rolled back until the contract step. Each backfill ends with a count check: old rows = new rows, logged.

1. **M1 — P0 fixes (no data move).**
   - Add `payments.organization_id/user_id/subscription_id/purpose`.
   - Add `student_exam_submissions.effective_deadline/shuffle_seed/finalize_reason` and backfill `effective_deadline` for open attempts.
   - Add `proctoring_settings` (default OFF for new exams; existing exams get LIGHT so they keep current behaviour).
   - Ship the fixes in section 8.8.
2. **M2 — One tenancy model.**
   - Create a SOLO organisation for every teacher who has personal classes or a subscription.
   - Set `organization_id` on their classes and exams.
   - Copy `teacher_subscriptions` → `account_subscriptions` and `overrides` → `feature_overrides`.
   - Rename plan feature keys to the namespaced keys.
   - Create `org_settings` and a default branch per org.
   - Merge `payment_history` into `payments`.
3. **M3 — Academic structure.**
   - Create a default session ("2026") per org and one default section ("A") per class.
   - Copy `class_students` → `enrolments`, keeping status.
   - Merge `class_teachers` and `class_subject_teachers` into `course_offerings + offering_teachers` (one offering per section + subject; teachers deduplicated; a class teacher without a subject teaches every subject, and the earliest becomes the section's class teacher where class teachers are on). `organization_teacher_subjects` is not an assignment and stays (P2-03).
   - Backfill `exams.session_id`.
4. **M4 — Files to S3.**
   - Copy `./uploads` to S3 under `org/{orgId}/legacy/` and create `file_objects` rows.
   - Rewrite URLs in `exam_questions.image_url`, option and matching JSON, and discussion attachments.
   - Keep the local `/uploads` route read-only for one release.
   - **Built in P2-07:** `pnpm files:migrate-legacy` (in the container: `node dist/src/files-migrate-legacy.js`), a dry run unless `--apply`. It finds old links (`/uploads/…`, direct S3 URLs and `/uploads/content?key=…`) in exam questions and in Mongo discussion posts and private messages, copies each file to `org/{orgId}/legacy/{old key}`, records it (unique `legacy_key`, so a re-run reuses it) and rewrites the link to `/api/v1/files/{id}/content`. It logs found / copied / reused / missing / no organisation / rewritten per source and never deletes the old files.
5. **M5 — Chat tables.** Verify that MongoDB holds every post, comment and message (counts by class), then mark the four PostgreSQL chat tables read-only.
6. **M6 — New epics.** Only additive tables, released per epic: Foundations → Attendance → Homework → Calendar → Syllabus → Performance → Resources → Communication upgrades → Integrity → IELTS.
7. **M7 — Contract.** Drop the 9 legacy tables in 9.12 one release after their replacement went live, after a final backup snapshot.

**Open items for the team:**

- **SMS quiet hours (section 7):** confirm the 10 PM–7 AM hold, apart from the 11:59 PM absence message.
- **Default proctoring level for existing exams in M1:** LIGHT is proposed so live behaviour doesn't change silently.
- **Who installs the ZKTeco agent:** our team or the customer. This affects onboarding and support costs.
