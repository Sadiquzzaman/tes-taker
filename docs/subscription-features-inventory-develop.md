# TaskTaker Feature Inventory for Subscription Planning

**Source branch:** `develop`  
**Generated:** 2026-08-23  
**Purpose:** Catalog every product capability in enough detail to design, price, and configure new subscription plans against the existing entitlements system.

---

## 1. Executive summary

TaskTaker (TestTaker) on `develop` is primarily a **teacher-centric exam platform** with:

- Teacher / student / admin / super-admin roles
- Class roster & student invite flows
- Multi-step exam creation (graded / ungraded / passage questions)
- Student exam taking with live proctoring
- Manual + auto grading, PDFs, teacher dashboard
- Dynamic subscription plans (JSONB feature flags + numeric limits)
- SSLCommerz payments and admin plan management

Subscriptions today apply to **individual teachers** (`teacher_subscriptions`), not organizations. There is **no organization/school module on `develop`** (that lives on `feature/organization-school-management`). Plan design for schools should treat org seats / multi-teacher workspaces as **new catalog keys**, not existing ones.

---

## 2. Existing subscription architecture (develop)

### 2.1 Core tables / entities

| Entity | Table | Role |
|--------|--------|------|
| `SubscriptionPlanEntity` | `subscription_plans` | Plan definition: name, slug, prices, `features` JSONB, `limits` JSONB, visibility, sort order, custom flag |
| `TeacherSubscriptionEntity` | `teacher_subscriptions` | Teacher ↔ plan assignment; status; billing cycle; usage counters; optional overrides |
| `PaymentHistoryEntity` | (payment history) | Payment records linked to subscription / plan |
| Payment module | `payments` | SSLCommerz initiate / callback / verify |

**Key files**

- `backend/src/subscriptions/constants/feature-catalog.ts` — canonical catalog + seed presets
- `backend/src/subscriptions/entitlements.service.ts` — effective features/limits + usage
- `backend/src/subscriptions/subscription.service.ts` — subscribe / upgrade / assign / admin
- `backend/src/subscriptions/subscription.controller.ts` — public + admin APIs
- `frontend/hooks/api/subscription/useEntitlements.ts`
- `frontend/app/billing/page.tsx`, `frontend/component/Account/AccountBilling.tsx`
- `frontend/app/admin/plans/page.tsx`, `frontend/component/Admin/AdminPlansManager.tsx`

### 2.2 Billing cycles & visibility

- **Billing:** `MONTHLY` | `HALF_YEARLY` | `YEARLY`
- **Prices (BDT):** `price_monthly`, `price_half_yearly`, `price_yearly`
- **Visibility:** `public` | `hidden` | `beta`
- **Legacy enum (unused in logic):** `FREE` / `BASIC` / `PREMIUM` / `PRO` — business logic uses **slug + feature/limit keys**

### 2.3 How gating works

1. Teacher has an `ACTIVE` subscription (or falls back to plan `slug: free`).
2. `EntitlementsService.getEntitlements(teacherId)` merges:
   - plan `features` / `limits`
   - optional per-subscription `overrides` (with optional `expires_at`)
3. Usage for exams is **derived from exam rows** (`created_by`), not only subscription counters:
   - `exams_used_this_month`
   - `total_exams_used`
4. Limit semantics: **`0` means unlimited** for that limit key.

### 2.4 APIs teachers / admins use

| Endpoint area | Capability |
|---------------|------------|
| `GET /subscriptions/plans` | Public plans |
| `GET /subscriptions/my-subscription` | Current subscription |
| `GET /subscriptions/my-entitlements` | Features + limits + usage |
| `GET /subscriptions/can-create-exam` | Pre-check exam quota |
| Subscribe / upgrade / downgrade / cancel | Self-serve plan changes |
| Admin plan CRUD / clone / reorder / activate | Super-admin plan ops |
| Assign plan / overrides / temp access / force change | Super-admin teacher ops |
| Payment initiate + SSLCommerz callbacks | Paid activation |

---

## 3. Catalog: feature flags already defined

Grouped as in `feature-catalog.ts`. Each key is a boolean on the plan.

### 3.1 Question (`FeatureGroup.QUESTION`)

| Key | Label | What it controls | Enforced today? |
|-----|--------|------------------|-----------------|
| `allow_graded_questions` | Graded questions | Objective / auto-scored question category | Seeded; not heavily re-asserted (graded is baseline) |
| `allow_ungraded_questions` | Ungraded questions | Manual essay / ungraded category | **Yes** — exam create/update + UI |
| `allow_passage_questions` | Passage questions | Passage / CQ parent + children | **Yes** — exam create/update + UI |
| `allow_model_tests` | Model tests | `is_model_test` / exam kind `model` | **Yes** — exam create/update + UI (`BasicInfoStep`) |
| `allow_question_images` | Question images | Image on questions | **Yes** — exam create/update + UI |
| `allow_question_import_export` | Import / export questions | Bulk import/export of questions | Catalog + seed; confirm UI/API coverage when pricing |

### 3.2 Branding (`FeatureGroup.BRANDING`)

| Key | Label | What it controls | Enforced today? |
|-----|--------|------------------|-----------------|
| `enable_report_watermark` | Report watermark | Watermark on PDF exports | Catalog + PDF watermark helpers exist; treat as branding toggle for plans |

### 3.3 Analytics (`FeatureGroup.ANALYTICS`)

| Key | Label | Notes |
|-----|--------|--------|
| `graphical_analytics` | Graphical analytics | Dashboard / activity charts — gate when productizing analytics tiers |
| `performance_graphs` | Performance graphs | Same family as above |
| `advanced_analytics` | Advanced analytics | Pro-tier analytics bundle |
| `student_risk_score` | Student risk score | Intended for proctoring + analytics combo |

**Enforcement:** mostly catalog/seed today; dashboard still loads for teachers without per-flag checks. Safe to sell as future gates.

### 3.4 Notifications (`FeatureGroup.NOTIFICATIONS`)

| Key | Label | Notes |
|-----|--------|--------|
| `push_notifications` | Push notifications | Not fully productized as a delivery channel on develop |
| `suspicious_activity_notifications` | Suspicious activity notifications | Ties to proctoring alerts |

### 3.5 Proctoring (`FeatureGroup.PROCTORING`)

Each maps to a frontend monitoring hook (see catalog `proctoringHook`).

| Key | Label | Hook / behavior |
|-----|--------|-----------------|
| `proctoring_tab_switch` | Tab switch detection | `useTabSwitchDetection` |
| `proctoring_fullscreen_exit` | Fullscreen exit | `useFullscreenExitDetection` |
| `proctoring_page_refresh` | Page refresh | `usePageRefreshDetection` |
| `proctoring_copy_paste` | Copy/paste | `useCopyPasteDetection` |
| `proctoring_idle` | Idle | `useIdleDetection` |
| `proctoring_browser_change` | Browser change | `useBrowserChangeDetection` |
| `proctoring_no_face` | No face | Face monitoring |
| `proctoring_multiple_face` | Multiple faces | Face monitoring |
| `proctoring_looking_away` | Looking away | Head/eye monitoring |
| `proctoring_devtools` | DevTools | `useDevToolsDetection` |
| `proctoring_double_display` | Double display | `useDoubleDisplayMonitoring` |
| `proctoring_phone` | Phone detection | Object detection |
| `proctoring_voice` | Voice detection | `useVoiceDetection` |
| `proctoring_video_monitoring` | Video monitoring | Camera / video preview |
| `proctoring_real_time_alerts` | Real-time alerts | Socket + teacher live view |
| `proctoring_auto_disqualification` | Auto-disqualification | Auto-fail on threshold |

**Infra on develop:** `backend/src/proctoring/*` (gateway, store, controller) + many `frontend/hooks/tests/proctoring/*` and exam UI panels.

---

## 4. Catalog: numeric limits already defined

| Key | Label | Semantics | Enforced today? |
|-----|--------|-----------|-----------------|
| `max_exams_per_month` | Max exams per month | Soft cap; `0` = unlimited | **Yes** via `canCreateExam` |
| `max_total_exams` | Max total exams (lifetime) | Soft cap; `0` = unlimited | **Yes** via `canCreateExam` |
| `max_students_per_exam` | Max students per exam | Audience size for class / targeted exams | **Yes** in exam service |
| `max_question_bank_size` | Max question bank size | Catalog ready | **Not strongly enforced** — candidate for new plans |
| `max_storage_mb` | Max storage (MB) | Local/S3 uploads | **Not strongly enforced** — candidate for new plans |

---

## 5. Seeded plan presets (reference pricing)

From `SEED_PLAN_PRESETS` in `feature-catalog.ts` (BDT). These are seeds / defaults — live DB plans may differ after admin edits.

| Plan | Monthly | Half-yearly | Yearly | Core limits | Feature posture |
|------|---------|-------------|--------|-------------|-----------------|
| **Free** | 0 | 0 | 0 | Lifetime exams **2**; students/exam **15** | Graded + watermark + basic browser proctoring (tab/fullscreen/refresh) |
| **Basic** | 100 | 500 | 1000 | Monthly exams **5**; students/exam **30** | + ungraded + import/export + more browser proctoring |
| **Premium** | 300 | 1650 | 3000 | Monthly exams **5**; students/exam **80** | + images + face/dev/display proctoring + graphical analytics |
| **Pro** | 500 | 2800 | 5000 | Monthly exams **50**; students/exam **200** | Passage + model tests + full proctoring suite + advanced analytics + notifications |

---

## 6. Product features on develop (full inventory)

Use this section as the **capability map**. Items marked **Gated** already have catalog keys; **Ungated** are candidates for new plan dimensions.

### 6.1 Identity, auth, account

| Feature | Description | Roles | Plan note |
|---------|-------------|-------|-----------|
| Email/phone registration | Student default registration; OTP SMS verification | Student → Teacher path via request | Ungated |
| Google OAuth | Google sign-in / callback | Users | Ungated |
| Login / JWT / refresh | Session cookies via Next `/session/*` | All | Ungated |
| Forgot / reset password | OTP-based reset | All | Ungated |
| Account profile | Profile & password change | All | Ungated |
| Billing page | View plan, entitlements, upgrade | Teacher | Uses entitlements |
| Become a teacher | `teacher_role_requests` workflow; admin review | Student → Teacher | Ungated process; teaching features then gated |

### 6.2 Roles

| Role | Capabilities (develop) |
|------|-------------------------|
| **STUDENT** | Join classes/tests, take exams, view results |
| **TEACHER** | Classes, exams, grading, dashboard, billing |
| **ADMIN** | Elevated ops (subset of portal) |
| **SUPER_ADMIN** | Users, subjects, plans, payments, teacher requests, assign plans/overrides |

### 6.3 Classes & students

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Create class | Name, description, optional student contacts | Ungated — candidate: `max_classes` |
| Class list / cards | Teacher class grid with student & tests-taken stats | Ungated |
| Class details | Students / Tests tabs | Ungated |
| Add students | Email/phone tags + CSV upload/template | Ungated — candidate: `max_students_per_class` |
| Invite / pending / joined | Status workflow; approve pending | Ungated |
| Share class / join link | Share modal; `/join/class/:id` | Ungated |
| Student class list | Enrolled classes for students | Ungated |
| Remove students | Delete membership | Ungated |

**Not on develop:** organization classes, class subjects, CST teacher assignment, class discussions/chat (those are on the org feature branch).

### 6.4 Subjects (admin)

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Admin subject CRUD | Global subjects for exams | Platform admin; not teacher-billed |

### 6.5 Exam / test creation

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Create test wizard | Multi-step: basic info → questions → reorder → publish | Entry gated by exam limits |
| Exam kinds | `hybrid`, `model` | Model requires `allow_model_tests` |
| Audience | Anyone / selected class / specific students (+ exclusions) | Size gated by `max_students_per_exam` |
| Publish timing | Immediately / later; start & end times | Ungated |
| Enable/disable exam | Teacher exam details controls | Ungated |
| Exam duration / marks | Duration, total marks, pass marks fields | Ungated |

### 6.6 Question types (builder)

**Categories**

| Category | Catalog gate |
|----------|--------------|
| Graded (`graded`) | `allow_graded_questions` |
| Ungraded (`ungraded`) | `allow_ungraded_questions` |
| Passage / CQ (`passage-question`) | `allow_passage_questions` |

**Auto-scored subtypes:** `multiple-choice`, `multiple-response`, `true-false`, `fill-in-the-blanks`, `answer-box`, `matching-ordering`  

**Manual subtypes:** `true-false`, `essay`, `fill-in-the-gaps`  

**Passage children:** all auto-scored subtypes + `essay`

| Content tool | Description | Plan note |
|--------------|-------------|-----------|
| Question images | Upload/attach images | `allow_question_images` |
| Rich text editor | TipTap editor for question text | Ungated — candidate: `allow_rich_editor` |
| Math formulas | MathLive / formula nodes | Ungated — candidate: advanced editor pack |
| Geometry figures | JSXGraph geometry workspace | Ungated — candidate: `allow_geometry_editor` |
| Chemistry figures | Ketcher structure editor + keyboard | Ungated — candidate: `allow_chemistry_editor` |
| Graphs | Graph panel / renderer | Ungated |
| Speech-to-text | Dictate questions via mic | Ungated — candidate: `allow_speech_input` |
| Import/export questions | Catalog feature | `allow_question_import_export` |

### 6.7 Student exam experience

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Join test | Link / code join flows | Ungated |
| Permissions gate | Camera/mic/fullscreen prerequisites | Tied to enabled proctoring features |
| Take exam UI | Sections, MCQ, essay, matching, passages | Follows exam content |
| Auto / manual submit | Lifecycle statuses; resume support | Ungated |
| Results view | Student results pages | Ungated |
| Live proctoring | Violations, flags, disqualification screens | Per proctoring feature keys |
| WebSocket monitoring | Teacher live monitoring gateway | `proctoring_real_time_alerts` / video suite |

### 6.8 Grading & results

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Grading list / cards | Needs marking, progress | Ungated |
| Manual grade essays | Points + explanation | Ungated |
| Auto-score objectives | Matching / MCQ / etc. | Ungated |
| Publish grades | Finalize / publish gating | Ungated |
| Class exam roster | Per-exam student status dashboard | Ungated |
| PDF question paper | jsPDF export | Watermark via branding feature |
| PDF results table | Results export | Watermark via branding feature |

### 6.9 Teacher dashboard

| Widget | Description | Plan note |
|--------|-------------|-----------|
| Live tests | Ongoing exams | Candidate analytics pack |
| Upcoming tests | Scheduled | Same |
| My classes | Class summary | Same |
| Total / top students | Student stats | Same |
| Needs marking | Pending grading | Same |
| My activity | Time-series participation | Maps to `graphical_analytics` / `performance_graphs` |
| Calendar | Exam calendar | Ungated |

### 6.10 Payments

| Feature | Description | Plan note |
|---------|-------------|-----------|
| SSLCommerz sandbox/live | Initiate payment, success/fail/cancel pages | Monetization rail |
| Admin payments table | Payment history oversight | Admin |
| Confirm / activate subscription after pay | Swaps teacher to paid plan | Core |

### 6.11 Storage

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Local storage driver | Dev uploads | Candidate `max_storage_mb` |
| S3 storage driver | Production-ready abstraction | Same |

### 6.12 Platform ops

| Feature | Description |
|---------|-------------|
| Health checks | App / DB / Redis health |
| SMS OTP + rate limit | BulkSMS BD |
| Email | Brevo / SMTP invitations & auth |
| Throttling | Nest throttler defaults |

---

## 7. What is enforced vs catalog-only (gap analysis)

### Strongly enforced on develop

- Exam creation monthly / lifetime quotas  
- Students-per-exam cap  
- Model tests  
- Ungraded questions  
- Passage questions  
- Question images  

### Defined in catalog but weak / incomplete enforcement

- Most analytics flags  
- Push / suspicious notifications  
- Per-proctoring-key enforcement (hooks exist; plan-driven enablement should be verified end-to-end when packaging)  
- Report watermark as a hard plan gate  
- Question import/export  
- `max_question_bank_size`  
- `max_storage_mb`  

**Implication for new plans:** you can sell any catalog key immediately in Admin Plans UI, but engineering must finish enforcement for keys you intend to differentiate on.

---

## 8. Recommended new plan dimensions (not on develop catalog yet)

These product areas exist (or are emerging) but lack dedicated keys. Suggested additions for future plans:

| Suggested key | Type | Why |
|---------------|------|-----|
| `max_classes` | limit | Cap teaching load on Free/Basic |
| `max_students_per_class` | limit | Separate from per-exam audience |
| `max_teachers_per_org` | limit | Needed when org module ships |
| `max_org_members` | limit | Org seats |
| `allow_organization_workspace` | feature | School / multi-teacher mode |
| `allow_class_discussions` | feature | Public subject discussions |
| `allow_private_student_chat` | feature | 1:1 teacher–student chat |
| `allow_geometry_editor` | feature | JSXGraph tools |
| `allow_chemistry_editor` | feature | Ketcher tools |
| `allow_math_editor` | feature | MathLive |
| `allow_speech_to_text` | feature | Voice question authoring |
| `allow_pdf_export` | feature | Question/results PDF |
| `allow_results_publish` | feature | Control grade release |
| `allow_live_proctoring_dashboard` | feature | Teacher live roster / socket |
| `max_concurrent_exams` | limit | Simultaneous ongoing exams |
| `max_proctoring_hours_per_month` | limit | Meter expensive video monitoring |
| `allow_custom_branding` | feature | Logo / watermark customization beyond default |
| `priority_support` | feature | Commercial SKU only |

---

## 9. Suggested packaging frameworks

### 9.1 Keep current 4-tier shape (individual teachers)

Align marketing names with seeded presets, but tighten enforcement gaps before launch:

1. **Free** — trial / acquisition  
2. **Basic** — solo tutors, light volume  
3. **Premium** — serious coaches, mid volume + mid proctoring  
4. **Pro** — high volume + full proctoring + model/passage  

### 9.2 Alternate: capability packs (à la carte)

Sell base plan + add-ons that map cleanly to catalog groups:

| Pack | Includes |
|------|----------|
| **Content Pack** | Passage, ungraded, images, import/export, editors |
| **Integrity Pack (Lite)** | Browser proctoring keys |
| **Integrity Pack (Full)** | Face/voice/phone/video + auto-DQ + real-time alerts |
| **Insights Pack** | Graphical / advanced analytics / risk score |
| **Scale Pack** | Higher exam/month + students/exam + storage |

### 9.3 Institutional (post-org merge)

When organization features merge from the feature branch, introduce **School / Institution** plans with:

- Org approval workflow (already admin-side conceptually)  
- Seat limits (teachers + students)  
- Shared subjects / class-subject-teacher assignment  
- Optional discussion/chat metering  

Do **not** overload teacher-only `teacher_subscriptions` without a clear org billing entity.

---

## 10. Feature ↔ plan matrix (seed defaults)

Legend: ● included in seed preset · ○ not included (false / unset)

| Capability key | Free | Basic | Premium | Pro |
|----------------|:----:|:-----:|:-------:|:---:|
| `allow_graded_questions` | ● | ● | ● | ● |
| `allow_ungraded_questions` | ○ | ● | ● | ● |
| `allow_passage_questions` | ○ | ○ | ○ | ● |
| `allow_model_tests` | ○ | ○ | ○ | ● |
| `allow_question_images` | ○ | ○ | ● | ● |
| `allow_question_import_export` | ○ | ● | ● | ● |
| `enable_report_watermark` | ● | ● | ○* | ○* |
| Browser proctoring (tab/fullscreen/refresh) | ● | ● | ● | ● |
| Extended browser (copy/idle/browser change) | ○ | ● | ● | ● |
| Face / looking away / DevTools / dual display | ○ | ○ | ● | ● |
| Phone / voice / video / alerts / auto-DQ | ○ | ○ | ○ | ● |
| Graphical + performance analytics | ○ | ○ | ● | ● |
| Advanced analytics + risk score | ○ | ○ | ○ | ● |
| Push + suspicious notifications | ○ | ○ | ○ | ● |
| `max_total_exams` | 2 | — | — | — |
| `max_exams_per_month` | — | 5 | 5 | 50 |
| `max_students_per_exam` | 15 | 30 | 80 | 200 |

\* Premium/Pro seeds omit watermark (likely intentional “remove branding on paid”). Confirm product intent.

---

## 11. Frontend touchpoints for plan UX

| Location | Behavior |
|----------|----------|
| `CreateTestActionButton` | Blocks create when exam limit reached |
| `BasicInfoStep` | Hides/disables model tests without feature |
| `QuestionsStep` | Filters ungraded / passage categories by feature |
| `QuestionCardHeader` | Image upload gated |
| `AccountBilling` | Shows entitlements / plan |
| Admin Plans Manager | Full feature/limit checkbox & number editor from catalog |

---

## 12. Practical checklist before launching new plans

1. Decide which catalog keys are **must-enforce** vs marketing-only.  
2. Implement missing enforcement for any key you differentiate on (especially proctoring toggles, analytics, storage, question bank).  
3. Confirm watermark behavior: Free shows watermark; paid removes it.  
4. Align prices/currency (BDT) and SSLCommerz live credentials.  
5. Define upgrade path (proration? end-of-cycle?).  
6. Add new catalog keys **before** inventing parallel hard-coded plan names.  
7. If selling schools: design org billing separately from teacher Free/Basic/Premium/Pro.  
8. Document customer-facing plan cards from this inventory so marketing matches Admin Plans.

---

## 13. Scope note: develop vs organization feature branch

On **`develop` (this report’s scope):** individual teacher product + dynamic subscriptions.

On **`feature/organization-school-management` (not develop):** organizations, CST assignments, workspace switching, class discussions (MongoDB), richer member import — **not part of develop’s live feature surface**. Include them in roadmap packaging only after merge, using new catalog keys from §8.

---

## 14. Primary source files (develop)

```
backend/src/subscriptions/constants/feature-catalog.ts
backend/src/subscriptions/entitlements.service.ts
backend/src/subscriptions/subscription.service.ts
backend/src/subscriptions/subscription.controller.ts
backend/src/subscriptions/entities/subscription-plan.entity.ts
backend/src/subscriptions/entities/teacher-subscription.entity.ts
backend/src/exams/exam.service.ts
backend/src/exams/enums/question.enums.ts
backend/src/exams/enums/exam-wizard.enums.ts
backend/src/proctoring/*
backend/src/modules/payment/*
backend/src/dashboard/dashboard.service.ts
backend/src/classes/*
backend/src/teacher-requests/*
frontend/hooks/api/subscription/useEntitlements.ts
frontend/component/Admin/AdminPlansManager.tsx
frontend/component/Account/AccountBilling.tsx
frontend/component/Tests/Create/*
frontend/hooks/tests/proctoring/*
frontend/component/RichTextEditor/*
```

---

*End of report. Use §3–§4 as the machine-readable contract for Admin Plans; use §6–§9 for product/pricing workshops.*
