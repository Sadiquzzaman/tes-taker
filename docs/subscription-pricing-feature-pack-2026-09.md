# TaskTaker / TestTaker — Subscription & Pricing Feature Pack

**Source branch:** `develop` (`e4ed37b` and later)  
**Generated:** 2026-09-21  
**Audience:** Founders / product / pricing workshop  
**Purpose:** Full, current feature inventory so you can design subscription plans (individual teachers + institutions).  
**Supersedes:** [`subscription-features-inventory-develop.md`](./subscription-features-inventory-develop.md) (2026-08-23 — outdated; that doc said orgs / IELTS / discussions were *not* on develop; they **are** now).

---

## 1. How to use this document

| Section | Use it for |
|---------|------------|
| §2 Product snapshot | Shared context in the room |
| §3 Billing architecture (today) | What you can configure *without* engineering |
| §4 Existing catalog keys | Admin Plans checkboxes / numbers that already exist |
| §5 Full product feature list | Everything customers can do (gated + ungated) |
| §6 Enforcement gaps | Don’t sell what isn’t enforced yet |
| §7 Suggested new plan keys | What to add to the catalog for org / IELTS / discussions |
| §8 Packaging frameworks | Draft SKUs for discussion |
| §9 Pricing workshop checklist | Decisions to lock before launch |

---

## 2. Product snapshot (develop today)

TestTaker is no longer “individual teacher exams only.” On current `develop` it is:

1. **Individual teacher workspace** — personal classes, tests, grading, billing  
2. **Organization / school workspace** — org number login, members, subjects, class–subject–teacher assignments, batch-style classes  
3. **Academic exams** — graded / ungraded / Passage–CQ, model tests, rich STEM editors, images  
4. **IELTS exams** — Reading / Writing / Listening / Speaking modules + IELTS question types  
5. **Class subject discussions** — public feed + private 1:1 teacher–student chat + attachments (S3 or local)  
6. **Proctoring suite** — browser + camera/ML hooks + live monitoring infra  
7. **Dynamic subscriptions** — JSONB feature flags + limits on **teacher** plans (SSLCommerz)

**Critical billing fact:**  
Subscriptions still attach to **`teacher_subscriptions`** (the creating teacher). There is **no separate organization subscription entity** yet. School plans need a product decision: seat-based org billing vs “owner’s teacher plan covers the school.”

---

## 3. Subscription architecture (what exists)

### 3.1 Entities

| Entity | Role |
|--------|------|
| `subscription_plans` | Plan name, slug, BDT prices, `features` JSONB, `limits` JSONB, visibility, sort order |
| `teacher_subscriptions` | Teacher ↔ plan; status; billing cycle; usage; optional overrides |
| Payments (SSLCommerz) | Initiate / callback / activate paid plan |

### 3.2 Cycles & prices

- Billing: `MONTHLY` | `HALF_YEARLY` | `YEARLY`  
- Prices: `price_monthly`, `price_half_yearly`, `price_yearly` (BDT)  
- Visibility: `public` | `hidden` | `beta`  
- Plan logic uses **slug + feature/limit keys**, not the legacy FREE/BASIC/PREMIUM enum

### 3.3 Limit semantics

- **`0` = unlimited** for that limit key  
- Exam usage is derived from exams created by the teacher (`exams_used_this_month`, `total_exams_used`)

### 3.4 Teacher / admin APIs

| Area | Capability |
|------|------------|
| Public plans | List sellable plans |
| My subscription / entitlements | Features + limits + usage |
| Can create exam | Quota pre-check |
| Subscribe / upgrade / cancel | Self-serve |
| Admin plan CRUD / clone / reorder | Super-admin |
| Assign plan / overrides / temp access | Super-admin ops |
| Feature catalog endpoint | Powers Admin Plans UI |

**Key files:**  
`backend/src/subscriptions/constants/feature-catalog.ts`  
`backend/src/subscriptions/entitlements.service.ts`  
`frontend/hooks/api/subscription/useEntitlements.ts`  
`frontend/component/Admin/AdminPlansManager.tsx`  
`frontend/component/Account/AccountBilling.tsx`

---

## 4. Existing feature catalog (machine-readable)

These keys already appear in Admin Plans. Grouped as in `feature-catalog.ts`.

### 4.1 Question features

| Key | Label | Enforced today? |
|-----|--------|-----------------|
| `allow_graded_questions` | Graded questions | Seeded baseline; weakly re-asserted |
| `allow_ungraded_questions` | Ungraded questions | **Yes** — create API + Questions step |
| `allow_passage_questions` | Passage / CQ | **Yes** — create API + Questions step |
| `allow_model_tests` | Model tests | **Yes** — create API + Basic Info |
| `allow_question_images` | Question images | **Yes** — create API + question header |
| `allow_question_import_export` | Import / export questions | Catalog only — **no full product surface** |

### 4.2 Branding

| Key | Label | Enforced today? |
|-----|--------|-----------------|
| `enable_report_watermark` | Report watermark | **No** — PDFs watermark regardless of plan |

### 4.3 Analytics

| Key | Label | Enforced today? |
|-----|--------|-----------------|
| `graphical_analytics` | Graphical analytics | Catalog / seed — dashboard not plan-gated |
| `performance_graphs` | Performance graphs | Same |
| `advanced_analytics` | Advanced analytics | Same |
| `student_risk_score` | Student risk score | Same |

### 4.4 Notifications

| Key | Label | Enforced today? |
|-----|--------|-----------------|
| `push_notifications` | Push notifications | Catalog only |
| `suspicious_activity_notifications` | Suspicious activity notifications | Catalog only |

### 4.5 Proctoring (each maps to a frontend hook)

| Key | Label |
|-----|--------|
| `proctoring_tab_switch` | Tab switch |
| `proctoring_fullscreen_exit` | Fullscreen exit |
| `proctoring_page_refresh` | Page refresh |
| `proctoring_copy_paste` | Copy/paste |
| `proctoring_idle` | Idle |
| `proctoring_browser_change` | Browser change |
| `proctoring_no_face` | No face |
| `proctoring_multiple_face` | Multiple faces |
| `proctoring_looking_away` | Looking away |
| `proctoring_devtools` | DevTools |
| `proctoring_double_display` | Dual display |
| `proctoring_phone` | Phone |
| `proctoring_voice` | Voice |
| `proctoring_video_monitoring` | Video monitoring |
| `proctoring_real_time_alerts` | Real-time alerts |
| `proctoring_auto_disqualification` | Auto-disqualification |

**Enforcement note:** hooks *can* take a feature map, but the live exam take path largely defaults monitors **on**. Treat integrity tiers as **sellable only after wiring entitlements into the take-exam page**.

### 4.6 Numeric limits

| Key | Label | Enforced today? |
|-----|--------|-----------------|
| `max_exams_per_month` | Max exams / month | **Yes** |
| `max_total_exams` | Max lifetime exams | **Yes** |
| `max_students_per_exam` | Max students per exam | **Yes** |
| `max_question_bank_size` | Max question bank size | **No** |
| `max_storage_mb` | Max storage (MB) | **No** (uploads exist; quota not applied) |

### 4.7 Seed plan presets (reference — BDT)

Live DB plans may differ after admin edits. Seeds:

| Plan | Monthly | Half-year | Yearly | Typical limits | Feature posture |
|------|---------|-----------|--------|----------------|-----------------|
| **Free** | 0 | 0 | 0 | Lifetime exams **2**; students/exam **15** | Graded + watermark + basic browser proctoring |
| **Basic** | 100 | 500 | 1000 | Monthly exams **5**; students/exam **30** | + ungraded + import/export flag + more browser proctoring |
| **Premium** | 300 | 1650 | 3000 | Monthly exams **5**; students/exam **80** | + images + face/devtools/dual-display + graphical analytics |
| **Pro** | 500 | 2800 | 5000 | Monthly exams **50**; students/exam **200** | + Passage + model tests + full proctoring + advanced analytics + notifications |

---

## 5. Full product feature list (current develop)

Mark each row for pricing:

- **Gated** = already has a catalog key (may or may not be enforced)  
- **Ungated** = ships to all eligible users today → candidate for a new key or pack  
- **Platform** = admin/ops, not teacher-billed

### 5.1 Identity, auth, account

| Feature | Who | Plan note |
|---------|-----|-----------|
| Email / phone signup (student default) | Users | Ungated |
| Organization signup (school registration) | Org owner | Ungated → candidate org plan |
| Google OAuth | Users | Ungated |
| Login + JWT / session cookies | All | Ungated |
| Individual vs organization login / context switch | Teachers in both modes | Ungated → candidate `allow_organization_workspace` |
| Forgot / reset password (OTP) | All | Ungated |
| Account profile / password | All | Ungated |
| Billing page (plan, usage, upgrade) | Teacher | Uses entitlements |
| Become a teacher (request + admin review) | Student → Teacher | Ungated process |

### 5.2 Roles

**Platform roles:** `STUDENT`, `TEACHER`, `ADMIN`, `SUPER_ADMIN`

**Organization member roles:**

| Org role | Can do |
|----------|--------|
| OWNER / ADMIN | Members, subjects, classes, assignments, overview; monitor org exams |
| ASSISTANT | Academic structure (classes / subjects / assignments); **not** exam creation |
| TEACHER | Exams only for assigned class–subjects; grading on own exams |
| STUDENT | Join org classes / take tests / discussions as member |

### 5.3 Organization / school workspace (major new surface)

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Org pending → approve / reject | Admin portal | Platform |
| Org number + phone login | School session | Ungated |
| Members: teachers, assistants, students | Add / import / roles / remove | Ungated → seat limits |
| Org subjects catalog | CRUD subjects scoped to org | Ungated → `max_org_subjects` |
| Assignments (class–subject–teacher) | Who teaches what | Ungated |
| Org overview / monitor exams | Owner/admin see org exams | Ungated |
| Workspace switcher | Individual ↔ org | Ungated |

### 5.4 Classes & students

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Personal classes | Individual teacher classes | Ungated → `max_classes` |
| Organization classes | School classes; IELTS UI may label **Batch** | Ungated |
| Class details: students / tests | Tabs | Ungated |
| Add students (tags + CSV) | Invite / pending / joined | Ungated → `max_students_per_class` |
| Share / join class link | `/join/class/:id` | Ungated |
| Multi-teacher on class subjects | CST assignments | Ungated |

### 5.5 Discussions & messaging (ungated today)

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Public class-subject feed | Categories: general / question / idea / resource | Candidate `allow_class_discussions` |
| Comments on posts | CRUD own | Same pack |
| Private 1:1 teacher–student chat | Per subject context; ~20s poll | Candidate `allow_private_student_chat` |
| Attachments (image + PDF/doc) | Upload → S3/local; inline image display | Candidate `allow_discussion_attachments` + storage limit |
| Attachment-only posts | Empty text allowed when files present | Same |

### 5.6 Exam / test creation (shared)

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Create-test wizard | Basic info → questions → review → reorder → publish | Entry: exam quotas |
| Audience | Anyone / selected class (batch) / specific students + exclusions | `max_students_per_exam` |
| Publish timing | Immediate / scheduled start–end | Ungated |
| Duration / passing score / negative marking | Form fields | Negative marking → candidate gate |
| Enable / disable exam | Teacher controls | Ungated |
| Edit before start | Locked after start | Ungated |

### 5.7 Academic exam line

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Exam category **Academic** | Default product line | Baseline |
| Subject selection | Individual catalog or org assigned subjects | Ungated |
| Model tests (multi-subject) | Multi-subject exam | **Gated** `allow_model_tests` |
| Graded questions | MCQ, multi-response, T/F, fill-blanks, matching | Baseline / `allow_graded_questions` |
| Ungraded / essay-style | Manual mark | **Gated** `allow_ungraded_questions` |
| Passage / CQ | Multi-passage, child questions, BN\|EN instruction | **Gated** `allow_passage_questions` |
| Question images | Upload / compress / S3 proxy preview | **Gated** `allow_question_images` |
| Rich text + Math / Graph / Geometry / Chemistry | TipTap + MathLive + JSXGraph + Ketcher | Ungated → STEM editor pack |
| Speech-to-text authoring | Mic dictation | Ungated → candidate |

### 5.8 IELTS exam line (ungated today — high pricing relevance)

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Exam category **IELTS** | Separate product line from Academic | Candidate `allow_ielts_exams` |
| Modules | Reading, Writing, Listening, Speaking (multi-select) | Could split by module |
| Batch (class) required in org | UI label “Batch” | Same as class entity |
| IELTS auto question types | MCQ, multi-response, TFNG, YNNG, matching, completions, diagram label, short answer, etc. | IELTS pack |
| Writing Task 1 / 2 | Manual grading | Candidate `allow_ielts_writing` |
| Speaking Part 1 / 2 / 3 | Audio-record answers | Candidate `allow_ielts_speaking` |
| Listening audio URL on passage | External URL field | Candidate `allow_ielts_listening` |
| Model test disabled for IELTS | Product rule | — |

### 5.9 Student exam experience

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Join test (link / code) | Student entry | Ungated |
| Permissions gate | Camera / mic / fullscreen when proctoring on | Ties to proctoring pack |
| Take UI | Sections, MCQ, essay, matching, passages, IELTS inputs | Follows exam content |
| Auto / manual submit + resume | Lifecycle | Ungated |
| Results view | Student results | Ungated |
| Live integrity monitors | Client hooks + violation UX | Should follow proctoring keys |
| Teacher live monitor | Socket-based | Candidate `allow_live_proctoring_dashboard` |

### 5.10 Grading & exports

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Needs-marking list | Teacher grading inbox | Ungated |
| Auto-score objectives | Graded / IELTS auto | Ungated |
| Manual grade essays / writing / speaking | Points + notes | Ungated |
| Class / batch exam roster | Per-exam student status | Ungated |
| Publish grades | Finalize release | Candidate `allow_results_publish` |
| PDF question paper | jsPDF | Candidate `allow_pdf_export` + watermark key |
| PDF results | Export | Same |

### 5.11 Dashboard & analytics

| Widget / idea | Plan note |
|---------------|-----------|
| Live / upcoming tests | Candidate Insights pack |
| My classes / students / needs marking | Same |
| Activity time-series | Maps to `graphical_analytics` / `performance_graphs` |
| Calendar | Ungated |
| Risk score | Maps to `student_risk_score` (not enforced) |

### 5.12 Media & storage

| Feature | Description | Plan note |
|---------|-------------|-----------|
| Local or S3 storage driver | Env-configurable | Ops |
| Exam / discussion / image uploads | Compress + optimize | Enforce `max_storage_mb` |
| Private S3 content proxy | Preview without public bucket | Baseline |

### 5.13 Payments & admin

| Feature | Plan note |
|---------|-----------|
| SSLCommerz pay + activate | Monetization rail |
| Admin plans manager | Configure catalog keys |
| Admin payments / users / subjects / orgs / teacher requests | Platform |

---

## 6. Enforcement gaps (pricing risk)

**Sell only after engineering confirms**, or label as “coming soon”:

| Catalog / product claim | Reality on develop |
|-------------------------|--------------------|
| Per-proctoring feature tiers | Monitors often all on; entitlements not fully wired into take page |
| Analytics tiers | Dashboard not plan-gated |
| Watermark “Free only” | PDF watermark always applied |
| Import / export questions | Flag without complete product |
| Storage / question bank caps | Limits unused |
| IELTS / org / discussions | Full products with **zero** catalog keys |

---

## 7. Suggested new catalog keys (for this pricing round)

### 7.1 Features (boolean)

| Suggested key | What it unlocks | Suggested tier idea |
|---------------|-----------------|---------------------|
| `allow_organization_workspace` | School login / org UI | Institution |
| `allow_org_member_import` | Bulk member CSV | Institution |
| `allow_class_discussions` | Public subject feed | Add-on or Premium+ |
| `allow_private_student_chat` | 1:1 chat | Add-on or Premium+ |
| `allow_discussion_attachments` | Images/files in chat | With discussions |
| `allow_ielts_exams` | IELTS category | IELTS pack / Pro+ |
| `allow_ielts_listening` | Listening module + audio | IELTS pack |
| `allow_ielts_speaking` | Speaking + recording | IELTS pack |
| `allow_ielts_writing` | Writing tasks | IELTS pack |
| `allow_math_editor` | MathLive | Content pack |
| `allow_geometry_editor` | Geometry board | Content pack |
| `allow_chemistry_editor` | Ketcher | Content pack |
| `allow_graph_editor` | Graphs | Content pack |
| `allow_speech_to_text` | Dictate questions | Content pack |
| `allow_pdf_export` | PDF paper/results | Premium+ |
| `allow_negative_marking` | Negative marking | Basic+ |
| `allow_live_proctoring_dashboard` | Teacher live room | Integrity Full |
| `allow_custom_branding` | Logo / remove watermark | Paid |

*(Also finish enforcing existing proctoring / analytics / watermark / storage keys.)*

### 7.2 Limits (numeric)

| Suggested key | What it caps |
|---------------|--------------|
| `max_classes` | Personal + org classes |
| `max_students_per_class` | Roster size |
| `max_teachers_per_org` | Teacher seats |
| `max_assistants_per_org` | Assistant seats |
| `max_org_students` | Student seats |
| `max_org_subjects` | Org subject catalog |
| `max_discussion_posts_per_month` | Discussion volume |
| `max_ielts_exams_per_month` | Separate IELTS quota |
| `max_concurrent_exams` | Simultaneous live exams |
| `max_proctoring_hours_per_month` | Video/ML cost |

Keep using existing: `max_exams_per_month`, `max_total_exams`, `max_students_per_exam`, `max_storage_mb`, `max_question_bank_size`.

---

## 8. Packaging frameworks (draft for founders)

### 8.1 Individual teachers (keep 4 tiers, refresh content)

| Tier | Positioning | Must include | Differentiator to decide |
|------|-------------|--------------|---------------------------|
| **Free** | Acquisition | Graded + tiny exam quota + basic browser integrity | Watermark on? Lifetime exams? |
| **Basic** | Solo tutors | Ungated essays + modest monthly exams | Import? Negative marking? |
| **Premium** | Growing coaches | Images + mid audience + face proctoring + graphs | Discussions? STEM editors? |
| **Pro** | Power users | Passage + model tests + full integrity + high volume | IELTS add-on included or separate? |

### 8.2 Add-on packs (recommended)

| Pack | Includes | Why |
|------|----------|-----|
| **IELTS Pack** | `allow_ielts_*`, optional listening/speaking meters | New high-value line, currently free |
| **School / Institution Pack** | Org workspace + seat limits + CST | New surface, no billing entity yet |
| **Engagement Pack** | Discussions + private chat + attachments | Currently free; drives retention |
| **Content / STEM Pack** | Geometry, chemistry, math, graphs, speech | Differentiation vs basic MCQ tools |
| **Integrity Lite** | Browser proctoring keys | Cheap to run |
| **Integrity Full** | Face/voice/phone/video + live dashboard + auto-DQ | Expensive infra |
| **Insights Pack** | Graphical / advanced / risk | Finish gating first |
| **Scale Pack** | Higher exam/month, students/exam, storage | Pure limit bumps |

### 8.3 Institutional SKU (needs product decision)

Propose a **School** plan separate from teacher Free–Pro:

| Decision | Options |
|----------|---------|
| Who pays? | Org entity vs owner’s teacher subscription |
| Seats | Teachers / assistants / students priced separately |
| Exam quota | Shared org pool vs per-teacher |
| IELTS | Included or add-on for language schools |
| Discussions | Included for schools by default? |

Until an **org subscription** table exists, any School SKU is either:

- **Policy-only** (manual admin assign of Pro to owner), or  
- **Requires a short engineering epic** for `organization_subscriptions`.

---

## 9. Suggested feature ↔ draft plan matrix (discussion starter)

Legend: ● include · ○ exclude · ◐ add-on  

| Capability | Free | Basic | Premium | Pro | School | IELTS add-on |
|------------|:----:|:-----:|:-------:|:---:|:------:|:------------:|
| Graded questions | ● | ● | ● | ● | ● | — |
| Ungraded / essay | ○ | ● | ● | ● | ● | — |
| Passage / CQ | ○ | ○ | ○ | ● | ● | — |
| Model tests | ○ | ○ | ○ | ● | ● | — |
| Question images | ○ | ○ | ● | ● | ● | — |
| STEM editors | ○ | ○ | ◐ | ● | ● | — |
| IELTS exams | ○ | ○ | ○ | ◐ | ◐ | ● |
| Org / school workspace | ○ | ○ | ○ | ○ | ● | — |
| Discussions + private chat | ○ | ○ | ◐ | ● | ● | — |
| Browser proctoring | ● | ● | ● | ● | ● | — |
| Face / advanced proctoring | ○ | ○ | ● | ● | ● | — |
| Video + live + auto-DQ | ○ | ○ | ○ | ● | ● | — |
| Analytics (basic graphs) | ○ | ○ | ● | ● | ● | — |
| Advanced analytics / risk | ○ | ○ | ○ | ● | ● | — |
| PDF export | ●* | ● | ● | ● | ● | — |
| Remove watermark | ○ | ○ | ● | ● | ● | — |
| Exams / month (example) | — | 5 | 10 | 50 | shared pool | — |
| Students / exam (example) | 15 | 30 | 80 | 200 | 500 | — |
| Teacher seats (example) | — | — | — | — | 5–50 | — |

\* If Free PDF always watermarked.

---

## 10. Founder workshop checklist

1. **Confirm SKUs:** Keep Free/Basic/Premium/Pro? Rename? Add School?  
2. **Org billing model:** Owner’s Pro covers school vs true org subscription.  
3. **IELTS:** Included in Pro vs paid add-on; meter Listening/Speaking?  
4. **Discussions:** Free for all vs Engagement pack.  
5. **Integrity:** Don’t publish paid proctoring tiers until entitlements wire into take-exam.  
6. **Watermark intent:** Free keeps brand; paid removes — enforce `enable_report_watermark`.  
7. **Prices (BDT):** Validate seed vs market (100 / 300 / 500 monthly may be placeholders).  
8. **Upgrade rules:** Immediate proration vs end-of-cycle.  
9. **Engineering order:** (a) wire existing gates, (b) add new catalog keys, (c) org billing if School ships.  
10. **Marketing cards:** Copy must match Admin Plans checkboxes exactly.

---

## 11. Primary source files

```
backend/src/subscriptions/constants/feature-catalog.ts
backend/src/subscriptions/entitlements.service.ts
backend/src/exams/exam.service.ts
backend/src/exams/enums/exam-category.enum.ts
backend/src/exams/enums/question.enums.ts
backend/src/organizations/*
backend/src/classes/class-discussion.*
backend/src/chat-mongo/schemas/*
backend/src/storage/*
backend/src/proctoring/*
frontend/constants/examCategory.ts
frontend/utils/createTestOptions.ts
frontend/component/Tests/Create/*
frontend/component/Classes/discussions/*
frontend/component/RichTextEditor/*
frontend/hooks/api/subscription/useEntitlements.ts
frontend/component/Admin/AdminPlansManager.tsx
docs/organization-school-model.md
```

---

## 12. One-line summary for the pricing meeting

> Today you can bill **individual teachers** with Free→Pro on exam types, quotas, and (intended) proctoring/analytics; but **schools, IELTS, discussions, STEM editors, and storage** are real products that are still largely **ungated** — so this round’s pricing should either add catalog keys for those packs or explicitly leave them free until enforcement exists.

---

*End of document. Pair this with Admin Plans UI when setting live plan rows.*
