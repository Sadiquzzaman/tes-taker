# Instructor — AWS Production Hosting & Cost Estimation

| Field | Value |
|-------|--------|
| **Date** | 2026-09-22 |
| **Branch analyzed** | `develop` |
| **Product name** | **Instructor** (formerly TestTaker / TaskTaker branding) |
| **Primary user region** | Bangladesh |
| **Target launch load** | ~1,500–2,000 concurrent students in an exam |
| **Stress ceiling** | ~2,500–3,000 concurrent students |
| **Report status** | Updated after Redis exam-paper cache + finalize batching + Socket.IO fan-out reductions |

---

## Assumptions

1. Mid-exam answers remain in browser **localStorage**; server receives a full answersheet **on finalize** (not continuous server autosave).
2. Proctoring ML is **client-side**; server holds Socket.IO sessions in **memory** on **one** API process (no Redis Socket.IO adapter yet).
3. Exam paper graphs are cached in Redis (`exam:paper:{examId}`) with invalidation on mutations — see `docs/EXAM-PAPER-REDIS-CACHE.md`.
4. Prices are **indicative** `ap-southeast-1` on-demand estimates (USD; BDT ≈ ×120). Not an invoice.
5. **No load test has been run** in this change set — capacity numbers are engineering estimates, not proven SLOs.

## Important limitations

| Unknown | Impact |
|---------|--------|
| Measured Socket.IO memory/conn | API instance size margin |
| Average questions per exam | Finalize write volume |
| Whether server autosave is enabled later | Would invalidate this model |
| Exact BS-ISP latency to Singapore vs Mumbai | Region pick |

---

## 1. Current architecture (from code)

```
Next.js (standalone)
        ↓ HTTPS / WSS
ALB
        ↓
NestJS API (HTTP + Socket.IO, prefer 1 process for proctoring)
   ├── PostgreSQL (TypeORM) — source of truth
   ├── Redis (ioredis) — OTP + org pending + exam:paper cache
   ├── MongoDB — discussions/chat
   └── S3 — media
```

| Concern | Implementation |
|---------|----------------|
| Exam paper reads | Cache-aside Redis → PostgreSQL fallback |
| Finalize answers | Batched upsert in one transaction; conditional status claim |
| Objective scoring | In-memory mark updates + **one** `save(answers[])` |
| Socket.IO | Monitors room only for join/flag/submit fan-out; **no answer broadcast** |
| Pool | `DATABASE_POOL_MAX` default **40** in production (per API process) |

---

## 2. How Redis caching changes DB load

| Path before | Path after |
|-------------|------------|
| Every `validateExamAccess` / paper / finalize graph load → heavy join | First miss loads PG; subsequent hits served from Redis |
| Start stampede × N identical exam graphs | Mostly Redis GET + live membership check |
| Class roster nested in access query | Roster **not** loaded; membership via `resolveStudentClassMembership` |

**Redis does not remove:**

- Submission inserts on start
- Finalize answer writes / scoring updates
- Connection pressure during synchronized finalize
- Need for a sensible TypeORM pool

---

## 3. Finalize path (optimized)

Per student (conceptually):

1. Load exam graph (cache hit preferred)
2. Sync answersheet: **1** submission update + **1** answers `find` + **1** batch `save`
3. Score objectives: load answers + **1** batch `save` + submission update
4. Conditional `UPDATE … WHERE status = IN_PROGRESS` for idempotent finalize

Synchronized 2,000 finalizes remain the **primary PG stress** event — caching helps start/paper, not write stampede.

---

## 4. Socket.IO

| Before | After |
|--------|-------|
| `session:joined` / `flag:update` / `exam:submitted` to entire exam room | Emit only to `exam:{id}:monitors` |
| `exam:submitted` included full answers map | Metadata only (no answers) — privacy + bandwidth |
| Orphan socket keys on reconnect | Cleared in `ProctoringStoreService` |

**Multi-instance API still unsafe** for live monitoring (in-memory store). Production should keep **desired API count = 1** for exams until a Redis adapter exists.

---

## 5. Recommended production sizing (post-optimization)

Region: **`ap-southeast-1` (Singapore)** for Bangladesh users.

### Minimum viable (≈1,000–1,500)

| Service | Config |
|---------|--------|
| API | **1× `t4g.large`** (2 vCPU / 8 GB) |
| Frontend | 1× `t4g.small` |
| ALB | 1 |
| RDS Postgres | `db.t4g.medium` Single-AZ, gp3 |
| ElastiCache Redis | `cache.t4g.micro` (OTP + paper cache) |
| MongoDB Atlas | M10 |
| S3 + CloudFront | modest |
| NAT | 0 (public tasks) or 1 |

### Recommended for 1,500–2,000 (safety margin)

| Service | Config | Why |
|---------|--------|-----|
| API | **1× `t4g.large`** | Sockets + finalize CPU; single process for proctoring |
| Frontend | 1× `t4g.small` | Next standalone |
| ALB | 1 | TLS + HTTP/WS |
| RDS | **`db.t4g.large`** Multi-AZ if revenue exams | Finalize write bursts |
| Redis | `cache.t4g.small` | Paper cache + OTP headroom |
| Atlas | M10 | Chat not on exam hot path |
| Pool | `DATABASE_POOL_MAX=40` | Documented in `typeorm.config.ts` |
| Secrets / CW / ECR / R53 / ACM | baseline | Ops |
| WAF | optional but recommended | Login/OTP abuse |

### Stress 2,500–3,000

Prove with load test first. Likely: API → `t4g.xlarge` **or** Redis Socket adapter + 2 API processes; RDS → `db.r6g.large`. **Do not** add a second API without shared proctoring state.

---

## 6. Monthly cost estimate (optimized recommendation)

Indicative `ap-southeast-1` on-demand. BDT ≈ USD × 120.

| Service | Configuration | Est. USD/mo | Notes |
|---------|---------------|------------:|-------|
| API compute | 1× `t4g.large` | ~62 | Graviton |
| Frontend | 1× `t4g.small` | ~16 | |
| ALB | 1 + light LCU | ~25–35 | |
| RDS PostgreSQL | `db.t4g.large` Single-AZ + storage | ~110–140 | Multi-AZ ≈ +90–110 |
| ElastiCache Redis | `cache.t4g.small` | ~25–35 | Paper cache matters |
| MongoDB Atlas | M10 | ~60 | Outside AWS bill |
| S3 + CloudFront | modest | ~15–30 | |
| Secrets + CloudWatch + ECR + R53 | | ~20–30 | |
| NAT | 0–1 | 0–40 | Prefer S3 gateway endpoint |
| WAF | light | 0–25 | optional |
| **AWS-ish total (Single-AZ RDS, no NAT)** | | **~$330–430** | **≈ ৳40k–52k** |
| **With Multi-AZ RDS** | | **~$420–540** | **≈ ৳50k–65k** |

### External (not AWS)

| Provider | Use |
|----------|-----|
| Brevo | Email |
| BulkSMS BD | OTP SMS |
| SSLCommerz | Payments |
| MongoDB Atlas | Already listed |

### Compared to prior Option 2 (~$520–700)

Prior recommendation assumed **2× `t4g.xlarge`**. That is **no longer justified** given:

- Redis paper cache cutting start/paper PG load
- Batched finalize reducing SQL round-trips
- Single-API proctoring constraint (extra API boxes do not help without Redis adapter)

---

## 7. Cost optimization checklist

1. Keep **one** API during exams until Socket.IO Redis adapter + shared proctoring store.
2. Graviton (`t4g` / `r6g`) everywhere compatible.
3. Rely on **exam paper cache** + raised pool — not Aurora “just in case.”
4. Avoid dual NAT; use S3 VPC gateway endpoint.
5. CloudFront for Next static assets.
6. Do not enable server autosave without a new capacity plan.
7. After 3+ months, consider Savings Plans on baseline RDS/ECS.

---

## 8. Things we may have missed

| Item | Notes |
|------|-------|
| Health check requires Mongo up | Chat outage can mark API unhealthy — split readiness later |
| In-memory proctoring | No HA across API restart mid-exam |
| Admin Redis flush `*` | Can wipe exam paper + OTP keys — use carefully |
| SMS/email costs | Usage spikes at registration |
| Data transfer to BD ISPs | CloudFront helps |
| CI/CD | Still needed (ECR + pipeline) |
| No proven load-test numbers | Required before marketing 2,000 concurrent |

---

## 9. Load-test plan (required before claiming capacity)

### Scenario

```
2,000 virtual students
  → simultaneous POST /start + GET exam paper
  → Socket.IO connect + exam:join
  → hold 30–60 minutes (heartbeats + sparse flags)
  → simultaneous POST /answersheet (+ socket exam:submit)
```

Also run at 500 / 1,000 / 1,500 / 2,500 / 3,000.

### Metrics

| Layer | Watch |
|-------|-------|
| API | CPU, RSS, event-loop lag, p50/p95/p99, 5xx |
| Redis | Hit/miss for `exam:paper:*`, latency, memory |
| PostgreSQL | CPU, connections, IOPS, query latency, deadlocks |
| Finalize | Latency distribution, claim conflicts (`already_finalized`) |
| Socket.IO | Connects, disconnects, event volume to monitors room |
| ALB | Target 5xx, connection count |

**Do not treat any concurrent-user number in this document as proven until this test passes.**

---

## 10. Final recommendation

> Launch Instructor for Bangladesh on **`ap-southeast-1`** with **1× `t4g.large` API**, small FE, ALB, **`db.t4g.large` Postgres**, **`cache.t4g.small` Redis** (OTP + exam paper cache), Atlas M10, S3/CloudFront — about **$330–430/mo** (Single-AZ) or **$420–540/mo** (Multi-AZ), then **load-test 2,000 start + finalize** before the first national exam.

---

## 11. Source references

```
docs/EXAM-PAPER-REDIS-CACHE.md
backend/src/exams/exam-paper-cache.service.ts
backend/src/exams/student-exam.service.ts
backend/src/exams/exam.service.ts
backend/src/proctoring/proctoring.gateway.ts
backend/src/config/typeorm.config.ts
backend/src/config/redis.service.ts
```

*End of report.*
