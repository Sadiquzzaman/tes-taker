# Technical Position & Improvement Report

**Project:** TaskTaker (TestTaker)  
**Scope:** Current `develop` codebase  
**Date:** 2026-08-29  
**Purpose:** Engineering assessment of where the platform is weak technically and what to improve next.

---

## 1. Executive snapshot

TaskTaker is a real product stack, not a prototype:

- **Frontend:** Next.js App Router (React 19), Redux Toolkit, TipTap, client-side proctoring ML
- **Backend:** NestJS 11, JWT/Passport, Socket.IO
- **Data:** PostgreSQL (core domain), Redis (OTP/cache), MongoDB (class discussions / DMs)
- **Payments:** SSLCommerz + teacher subscription plans

Major domains that exist today: auth, organizations/schools, classes, exam authoring & taking, proctoring, grading, billing, admin, discussions.

Maturity is uneven. Core exam + organization CRUD are relatively strong. Monetization enforcement, realtime scale, data-model cleanup, and automated quality gates are behind.

---

## 2. Architecture at a glance

```text
Browser (Next.js)
  → session cookies (/session/*)
  → REST Axios → Nest /api/v1 (+ X-Organization-Id in org sessions)
  → Socket.IO → ProctoringGateway
  → Postgres | Redis | Mongo
```

Notable patterns:

- Split individual vs organization login/session (`frontend/proxy.ts`, org guards)
- Workspace provider only on dashboard-style `Layout` — not global root layout
- Entitlements catalog in `feature-catalog.ts` with teacher-scoped subscriptions
- Dual stores for discussions (Mongo runtime + legacy Postgres tables kept for synchronize safety)

---

## 3. Where we are technically down

### 3.1 Almost no automated tests (critical)

| Layer | Reality |
|-------|---------|
| Backend | A handful of specs (discussion/Mongo-related) |
| Frontend | No meaningful `*.test` / `*.spec` suite; no `test` script |

Impact: regressions such as `/test` calling `useWorkspace` without `WorkspaceProvider` reach production builds before discovery.

### 3.2 Subscription catalog vs enforcement

Many plan feature flags (analytics, notifications, large parts of proctoring) are seeded in the catalog but weakly or not enforced in runtime paths.

Impact: tiers can be marketed that the product does not actually control.

Evidence baseline: `docs/subscription-features-inventory-develop.md` §7 gap analysis.

### 3.3 Organization product vs teacher-only billing

Organizations are first-class (members, subjects, classes, assignments). Billing remains teacher-scoped (`teacher_subscriptions`). Frontend blocks `/billing` for organization session mode.

Impact: schools cannot buy as schools; B2B monetization is incomplete.

### 3.4 Proctoring state is not production-scale

Proctoring store is in-memory (`Map`). State is lost on process restart and is unsafe for multi-instance deploys without sticky sessions / shared store.

Impact: live monitoring and integrity evidence will not survive normal production ops.

### 3.5 Dual / legacy data models

- Class discussions: Mongo at runtime; Postgres discussion tables still registered/migrated
- Assignments: legacy `class_teachers` alongside newer class-subject-teacher / org assignment models (see assignment audit)

Impact: drift, harder migrations, subtle bugs when one path updates and the other does not.

### 3.6 Storage incomplete for multi-server

Local storage driver works; S3 driver is a stub (`NotImplemented`).

Impact: uploads/media will not behave correctly across multiple app instances.

### 3.7 Provider / layout coupling risks

`WorkspaceClientProvider` lives under dashboard `Layout`. Standalone routes (`/test`, `/test/permissions`) must not pull hooks that require workspace context.

Impact: already caused a production Next.js prerender failure; similar traps remain possible wherever Create/exam/shared UI import graphs intertwine.

### 3.8 DX and ops friction

- Backend uses pnpm; frontend uses npm
- Env typo baked in: `DATABASE_SYNCRONIZE`
- Admin Redis flush uses `KEYS *` (dangerous at scale)
- Helmet CSP allows `unsafe-eval` (needed for some ML, but broad)
- Some docs lag the merged org module

Impact: slower team velocity and sharper production footguns.

---

## 4. What should be improved (technical roadmap)

### P0 — Stop shipping blind

1. Critical-path automated tests: auth, org context header, exam start/submit, entitlements, eligibility.
2. CI gate: `frontend` production `npm run build` + backend build/migrations check on every PR.
3. Provider hygiene: shared UI must not drag workspace/create-test hooks into exam routes.

### P1 — Make money and ops honest

4. Entitlements as a hard gate: one guard/middleware path; every catalog flag either enforced or removed from marketing.
5. Org billing entity: seats + plan on organization, not only personal teacher.
6. Persist proctoring state (Redis/DB) for multi-node and restart safety.

### P2 — Clean the domain model

7. Finish one store for discussions; migrate or drop legacy Postgres discussion tables.
8. Collapse assignment dual-tables per `docs/organization-assignment-system-audit.md`.
9. Implement real S3 (or equivalent object storage) for production media.

### P3 — Platform hygiene

10. Unify package manager and fix env naming (`DATABASE_SYNCHRONIZE` or keep typo but document consistently).
11. Keep `synchronize` off in production; migrations only.
12. Refresh docs so subscription/org inventories match current `develop`.

---

## 5. Suggested 90-day engineering sequence

1. **Weeks 1–2:** CI build + smoke tests for `/test`, login, org switch, create exam.
2. **Weeks 3–5:** Entitlement enforcement pass (honest Free/Basic/Premium/Pro).
3. **Weeks 6–8:** Proctoring persistence + basic live monitor reliability.
4. **Weeks 9–12:** Org billing/seats design + start dual-model cleanup.

---

## 6. Bottom line

Technically, TaskTaker is a **capable exam + school platform with a billing skeleton and scale debt**. The highest leverage engineering work is not more UI surfaces — it is **tests/CI, entitlement truth, org billing, and durable proctoring/state**.
