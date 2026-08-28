# Product Weaknesses, Improvements & Owner Roadmap

**Project:** TaskTaker (TestTaker)  
**Scope:** Current `develop` product surface  
**Date:** 2026-08-29  
**Purpose:** Product assessment of weak features, how to strengthen them, and what an owner would change or add next.

---

## 1. Executive snapshot

Commercially, TaskTaker’s strongest spine is:

**Create exam → invite/roster → take exam (with proctoring) → grade → results**, plus an emerging **organization/school workspace**.

The weakest commercial surfaces are where the **feature list looks rich but the product is thin or unenforced**: monetization packaging, proctoring operations, analytics, notifications, and true institutional billing.

---

## 2. Which features are weak today

### 2.1 Monetization / packaging (weakest commercially)

- Plan catalog is broad (question types, proctoring keys, analytics, notifications).
- Enforcement is incomplete for many flags.
- Billing is teacher-centric while organizations already exist.
- Org sessions are blocked from `/billing`.

**Risk:** Selling tiers the product does not actually gate; schools cannot pay as schools.

### 2.2 Proctoring as a product (strong client tech, weak product ops)

- Client ML / browser integrity hooks are impressive.
- Teacher live dashboard, durable session state, plan-gated “integrity packs,” and post-exam evidence packs are incomplete relative to marketing potential.

**Risk:** Differentiator becomes a demo feature instead of a paid trust product.

### 2.3 Analytics & student insight

- Catalog keys exist (`graphical_analytics`, `performance_graphs`, `advanced_analytics`, `student_risk_score`).
- Teacher-facing insight product is thin; little hard gating.

**Risk:** “Pro analytics” is not a real upgrade path yet.

### 2.4 Notifications

- Push / suspicious-activity flags are mostly catalog.
- SMS/email exist for OTP/invites, but not a reliable productized digest channel for results or integrity alerts.

**Risk:** Teachers and parents do not get operational value after exams end.

### 2.5 School ops beyond CRUD

- Orgs can manage members, classes, subjects, assignments.
- Seating, org billing, school-wide reporting, and a finished institutional admin loop are incomplete.

**Risk:** Org module looks like a school product but behaves like multi-user CRUD on a teacher app.

### 2.6 Student experience outside the exam

- Learning / student org views exist.
- Retention features (practice loops, progress, reminders) are lighter than authoring and proctoring depth.

**Risk:** Platform is teacher-heavy; student habit formation is weak.

### 2.7 Content operations (import/export / bank)

- Create wizard is deep (graded / ungraded / passage / model tests / editors).
- Reusable question bank and reliable import/export are uneven vs authoring depth.

**Risk:** High teacher effort per exam; low content reuse.

---

## 3. How to improve weak features

| Weak area | Concrete improvement |
|-----------|----------------------|
| Subscriptions | Enforce before sell; ship honest Free/Basic/Premium/Pro matrices; add a School SKU |
| Proctoring | Persist events; teacher live roster; Lite vs Full integrity packs; post-exam integrity report |
| Analytics | Score distributions, attempt trends, at-risk students; gate Advanced behind Pro |
| Org | Seat limits, invite lifecycle, org-wide exam calendar, billing on organization |
| Content | Question bank + import/export + reusable passages across exams |
| Trust / student UX | Clear DQ messaging; teacher audit trail of flags; answer autosave recovery |

---

## 4. If I were the owner — what I would change

### Stop / simplify

- Stop selling catalog flags that are not enforced.
- Stop growing dual models (assignment tables, discussion stores).
- Do not put workspace-required hooks on standalone exam routes.
- Do not treat personal teacher billing as “good enough” once schools are a GTM motion.

### Double down

- Exam create → take → grade → results (already the spine).
- Organization as the primary **B2B** surface for coaching centers / schools.
- Integrity + evidence (proctoring reports) as the paid differentiator vs Google Forms / lightweight LMS tools.

### Operating changes

- Weekly review: “Can we charge for this flag?”
- Production build + smoke tests on `/test`, login, org switch, create exam.
- One package manager, one deploy playbook, secrets only via env.

---

## 5. New features I would add (priority order)

1. **School subscription + seats** — org plan, teacher seats, student caps, shared subjects.
2. **Question bank / reuse** — save questions across exams; tags by subject/chapter (SSC/HSC aligned).
3. **Integrity report pack** — per-attempt flag timeline; later optional short evidence clips; export for admin/parents.
4. **Parent / guardian light portal** — results + DQ/absence notices (high value for BD coaching market).
5. **Scheduled exam windows + clearer join UX** — reduce wrong-link / wrong-class support load.
6. **Teacher live proctoring dashboard** — who is flagged now; intervene without ending the whole exam.
7. **WhatsApp/SMS result & invite digests** — productize existing SMS/email plumbing.
8. **Practice / model-test mode for students** — turn model-test capability into a retention loop.
9. **Offline-tolerant answer autosave recovery** — exam dropouts destroy trust.
10. **Admin revenue & churn dashboard** — active plans, failed payments, org seats as decision tools.

---

## 6. Suggested product sequence (next 90 days)

1. **Enforce + honest individual pricing** (stop fiction).
2. **Harden exam/proctoring reliability** (persist + CI).
3. **Org billing + seats**.
4. **Integrity reports + live monitor**.
5. **Analytics + parent/result notifications**.

---

## 7. Packaging guidance (product)

### Individual teachers (keep 4-tier shape)

1. Free — acquisition / trial  
2. Basic — solo tutors, light volume  
3. Premium — mid volume + mid proctoring  
4. Pro — high volume + full integrity + advanced insights  

Only include flags that are enforced.

### Schools (new)

- Separate org billing entity (do not overload `teacher_subscriptions` forever)
- Seat limits (teachers + students)
- Shared subjects / class assignment
- Optional metering for discussions/chat and proctoring hours

Capability packs (optional add-ons): Content, Integrity Lite, Integrity Full, Insights, Scale.

---

## 8. Bottom line

As owner, I would **sell less fiction, harden the exam spine, then productize schools + integrity + parent trust**. That is the wedge competitors without real proctoring and org work cannot copy quickly — and it aligns engineering effort with revenue.
