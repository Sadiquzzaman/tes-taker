# Instructor Academy (TestTaker) — AWS Production Hosting & Cost Estimation

| Field | Value |
|-------|--------|
| **Date** | 2026-09-22 |
| **Branch analyzed** | `develop` |
| **Commit** | `a166854` (`Add subscription pricing feature pack for founder planning.`) |
| **Product name in code** | TaskTaker / TestTaker (Instructor Academy) |
| **Primary user region** | Bangladesh |
| **Target launch load** | ~1,500–2,000 concurrent students in an exam |
| **Stress ceiling considered** | ~2,500–3,000 concurrent students |

---

## Assumptions

1. **One major exam cohort** can start and finish roughly together (worst-case stampede at start and end).
2. **Current frontend behavior is kept**: mid-exam answers stay in **browser `localStorage`**; the server receives a full answersheet **only on finalize** (not continuous server autosave). Backend `POST .../save-answer` exists but **is not called from the current exam UI**.
3. **Proctoring ML runs in the browser** (MediaPipe / TF.js). The server does **not** process webcam frames. Server load is Socket.IO sessions + flag events + occasional violation HTTP posts.
4. **Discussions are secondary** during exam windows (20s poll). MongoDB is not on the exam hot path unless students keep discussion tabs open.
5. **Prices are indicative USD list prices** for `ap-southeast-1` (Singapore), converted to BDT at **≈ 120 BDT / 1 USD**. They are **not** an AWS invoice. Real bills vary with usage, Savings Plans, support tier, and data transfer.
6. **No Bull/SQS workers and no Nest cron** exist today — no separate worker fleet is required for launch unless product changes.
7. Current production docs (`DEPLOYMENT.md`, `docker-compose.prod.yml`) describe a **single-host Docker** layout (historically Hetzner). This report designs a **real AWS multi-service** launch without pretending that single-VPS compose is enough for 2,000 concurrent Socket.IO exams.

## Important limitations (could not fully determine from code)

| Unknown | Impact |
|---------|--------|
| Average questions per exam | Size of each finalize transaction (1 answersheet + N answer rows) |
| Whether server autosave will be enabled later | Would multiply write RPS by orders of magnitude |
| How many teachers monitor one live exam | Extra Socket.IO clients + `monitor:state` fan-out |
| Exact peak socket memory per connection | Affects whether 1× vs 2× app instances fit RAM |
| Whether SMS OTP rate-limit stays disabled | BulkSMS cost during registration spikes |
| Live AWS negotiated discounts | Cost ±30% easily |

---

## 1. What the codebase actually is

### 1.1 Architecture (from `develop`)

```
┌─────────────────┐     HTTPS      ┌──────────────────┐
│ Next.js frontend│ ──────────────►│ NestJS API       │
│ (standalone)    │   Socket.IO    │ + Socket.IO GW   │
└─────────────────┘◄──────────────►│ (same HTTP port) │
                                   └────────┬─────────┘
              ┌──────────────┬──────────────┼──────────────┐
              ▼              ▼              ▼              ▼
        PostgreSQL      Redis (OTP)    MongoDB chat    S3 (+ proxy)
        (TypeORM)       ioredis        (Mongoose)      local|s3 driver
```

| Layer | Implementation | Key paths |
|-------|----------------|-----------|
| Frontend | Next.js 16 **`output: "standalone"`**, Docker `node server.js` | `frontend/next.config.ts`, `frontend/Dockerfile.prod` |
| Backend | NestJS 11, one Node process (`node dist/src/main.js`) | `backend/src/main.ts`, `backend/Dockerfile.prod` |
| Primary DB | PostgreSQL via TypeORM (~25 entities) | `backend/src/config/typeorm.config.ts` |
| Chat DB | MongoDB via Mongoose | `backend/src/chat-mongo/*`, `ClassDiscussions` |
| Cache / OTP | Redis via ioredis | `backend/src/config/redis.provider.ts`, SMS/org signup |
| Objects | S3 or local disk; private objects via API content proxy | `backend/src/storage/*`, `upload.controller.ts` |
| Realtime | Socket.IO on API process; **in-memory** session store | `proctoring.gateway.ts`, `proctoring-store.service.ts` |
| Queues / cron | **None** (no Bull, no `@nestjs/schedule`) | `package.json`, codebase search |
| Payments | SSLCommerz | `backend/src/modules/payment/*` |
| Email | Brevo API (SMTP fallback incomplete) | `backend/src/email/email.service.ts` |
| SMS | BulkSMS BD | `backend/src/sms/sms.service.ts` |
| Throttle | Global ~300 req/min per JWT user | `app.module.ts`, `AppThrottlerGuard` |
| Health | Postgres + Redis + Mongo must all pass | `health.controller.ts` |

### 1.2 Exam flow load profile (critical)

| Phase | What the code does | Infra impact |
|-------|--------------------|--------------|
| Start | `POST /student/exams/:id/start` + `GET` exam paper once | Short HTTP burst if cohort starts together |
| Mid-exam | Answers → **localStorage**; UI timer 1s **local**; Socket.IO connected | **~0 answer write RPS**; **N long-lived sockets** |
| Proctoring | Client ML every 1–7s; socket `flag:report` on events (~15s cooldown); some flags also `POST .../report-violation` | Socket + sparse PG updates |
| End | One heavy `POST .../answersheet` (+ socket `exam:submit`) per student | **Write stampede** on PostgreSQL + API CPU |
| Discussions | Poll every **20s** when tab open | Mongo GET load, not exam-critical |

**Implication:** For 1,500–2,000 concurrent examinees, size for:

1. **~1,500–2,000 concurrent WebSocket connections** (plus teacher monitors)  
2. **Synchronized finalize storm** (worst case ~same second when timer hits 0)  
3. **Not** continuous answer autosave RPS (unless product changes)

### 1.3 PostgreSQL vs MongoDB separation — does it make sense?

| Store | Used for (live code) | Verdict |
|-------|----------------------|---------|
| **PostgreSQL** | Users, orgs, classes, exams, questions, submissions, answers, subscriptions, payments, grading | Correct primary OLTP store |
| **MongoDB** | `discussion_posts`, `discussion_comments`, `private_conversations`, `private_messages` | Matches intent; chat docs with nested attachments fit document model |
| **Legacy PG discussion tables** | Entities still exist | Appear unused by live discussion API (Mongo path) — cleanup later |

**Recommendation:** Keep the split. Prefer **MongoDB Atlas** over self-hosted Mongo on EC2 for ops simplicity. **Amazon DocumentDB** is possible but not required and is often more expensive / less Mongo-compatible for this app size.

### 1.4 Redis — what it does and does not do

| Used today | Not used today |
|------------|----------------|
| OTP / SMS rate keys | HTTP response cache |
| Password-reset OTPs | JWT session store |
| Pending org registration | Socket.IO Redis adapter |
| Health check | Proctoring shared state |
| Admin flush tooling | Job queues |

**Launch blocker for multi-instance API:** `ProctoringStoreService` is an in-process `Map`. Horizontal scale **without** sticky sessions + shared store (or Redis adapter) **breaks live monitoring**.

---

## 2. Production AWS services needed (derived from code)

| Service | Needed? | Why (from code) |
|---------|---------|-----------------|
| **Compute (ECS Fargate or EC2)** | **Yes** | Nest API + Next standalone; Dockerfiles already exist |
| **Application Load Balancer** | **Yes** | HTTPS, WebSocket upgrade, health checks to `/api/health`, path routing FE/API |
| **Auto Scaling** | **Yes (cautious)** | Scale FE freely; scale API only after sticky sessions and/or Redis Socket.IO adapter |
| **RDS PostgreSQL** | **Yes** | Primary TypeORM database; Multi-AZ recommended for production |
| **Aurora PostgreSQL** | **Optional later** | Not required for launch; RDS Postgres is enough at this scale if sized for write bursts |
| **ElastiCache Redis** | **Yes** | OTP/signup already depend on Redis; required larger if you add Socket.IO adapter |
| **MongoDB Atlas (or DocumentDB)** | **Yes** | Discussions/chat are live features |
| **S3** | **Yes** | Exam/discussion media; `STORAGE_DRIVER=s3` |
| **CloudFront** | **Yes** | Next static assets + optional media; reduces origin bandwidth from BD |
| **Route 53** | **Yes** | DNS for app + API |
| **ACM** | **Yes** | TLS certificates |
| **Secrets Manager or SSM Parameter Store** | **Yes** | JWT, DB, Redis, S3, Brevo, BulkSMS, SSLCommerz secrets (many env vars in compose) |
| **CloudWatch** | **Yes** | Logs, alarms (CPU, 5xx, RDS connections, Redis memory) |
| **NAT Gateway** | **Maybe 1×** | If API tasks in private subnets need outbound (Brevo, BulkSMS, S3, SSLCommerz). Can reduce cost with public subnet + SG carefully, or VPC endpoints for S3 |
| **ECR** | **Yes** | Store Docker images from `Dockerfile.prod` |
| **WAF** | **Recommended** | Public exam login / OTP abuse protection (not in code, but launch hygiene) |
| **SQS / worker ASG** | **No (today)** | No queues/workers in code |
| **ElastiCache for sessions only** | N/A | Already covered by Redis need |
| **GPU instances** | **No** | Face/voice ML is client-side |
| **DocumentDB** | Optional alt to Atlas | Prefer Atlas M10 unless AWS-only procurement required |

---

## 3. Load scenarios

### 3.1 Qualitative

| Scenario | Concurrent examinees | Steady mid-exam | Peak risk |
|----------|---------------------:|-----------------|-----------|
| A Normal | Tens–low hundreds | Low | Negligible |
| B Peak | **1,500** | ~1,500 sockets | Start + finalize storms |
| C Higher peak | **2,000** | ~2,000 sockets | Same, tighter PG connections |
| D Stress | **2,500–3,000** | ~3,000 sockets | Needs proven sticky/Redis + larger RDS |

### 3.2 Quantitative sketch (assumptions stated)

Assume **2,000 concurrent students**, one exam, **50 questions** average (assumption), finalize window **30–60 seconds** if timers align.

| Metric | Mid-exam estimate | End-of-exam estimate | Notes |
|--------|-------------------|----------------------|-------|
| Long-lived sockets | ~2,000 | ~2,000 dropping | Plus teachers monitoring |
| Answer HTTP writes/sec | **~0** | — | localStorage-only today |
| Finalize POSTs | — | ~30–70/s over 30–60s if staggered poorly → **briefly hundreds/s** if fully synced | Treat as worst case |
| PG writes per finalize | — | 1 submission update + ~50 answer upserts (assumption) | Transactional |
| Redis ops | Low (OTP only) | Low | Until Socket adapter added |
| Mongo ops | Low | Low | Unless discussion open |
| S3 | Low mid-exam | Low | Uploads are authoring/discussion, not webcam |
| Network | Socket heartbeats + FE assets | Answersheet JSON payloads | Payload size unknown; assume tens–hundreds KB each |

**Default TypeORM pool is unset** → pg driver default (~10 connections per process). **A single Nest instance with default pool cannot absorb 2,000 concurrent finalize transactions.** Raise pool (e.g. 50–100) and RDS `max_connections`, and/or add **RDS Proxy**.

---

## 4. Recommended starting configurations

### Region

**Primary: `ap-southeast-1` (Singapore)**

| Factor | Rationale |
|--------|-----------|
| Latency to Bangladesh | Best common AWS region for BD (no AWS region in BD) |
| Feature completeness | Full service set |
| Existing code/docs | S3 region already used as `ap-southeast-1` in project history |
| Cost | Mid-tier Asia pricing; still cheaper than US for BD users on egress patterns |

Mumbai (`ap-south-1`) can be slightly closer for some BD ISPs — validate with a quick latency test from Dhaka. Either is fine; pick one and keep S3/RDS/ECS co-located.

### Option summary

| Option | Goal | Concurrent exam comfort |
|--------|------|-------------------------|
| **1 — Budget** | Lowest sensible prod | ~1,000–1,500 if sticky single API; risky at 2,000 |
| **2 — Balanced (recommended)** | Reliable 1,500–2,000 | Designed for target |
| **3 — Higher HA** | Stress toward 2,500–3,000 + Multi-AZ resilience | After Redis Socket adapter |

---

## 5. Cost estimation (monthly, approximate)

**Disclaimer:** Figures are **order-of-magnitude planning numbers** for `ap-southeast-1`, on-demand, lightly used outside exam windows. Actual invoices differ. BDT ≈ USD × 120.

### Option 1 — Budget / Cost Optimized (~$280–380 / mo ≈ ৳34k–46k)

| Service | Configuration | Est. USD/mo | Reason |
|---------|---------------|------------:|--------|
| ECS Fargate or EC2 | 1× API `t4g.large` (2 vCPU/8 GB) + 1× FE `t4g.small` | 55–80 | One sticky API holds sockets; FE lighter |
| ALB | 1 ALB + light LCU | 20–30 | TLS + WebSocket |
| RDS PostgreSQL | `db.t4g.medium` 100 GB gp3, **Single-AZ** | 60–90 | Enough for launch; backup snapshots |
| ElastiCache Redis | `cache.t4g.micro` | 12–18 | OTP only |
| MongoDB Atlas | **M10** (shared) | 60 | Discussions |
| S3 | 50–100 GB + requests | 5–15 | Media |
| CloudFront | Modest transfer | 10–25 | Static + API edge optional |
| NAT | **0** (public tasks + SG) or 1× small | 0–35 | Avoid dual NAT |
| Secrets Manager | ~10 secrets | 4–6 | Credentials |
| CloudWatch | Logs 10–20 GB ingest | 10–20 | Ops |
| ECR | Images | 1–3 | Docker |
| Route 53 + ACM | Hosted zone + certs | 1–2 | DNS/TLS |
| **Total** | | **~$280–380** | **≈ ৳34,000–46,000** |

**Tradeoffs:** Single-AZ RDS; single API instance (no true HA for proctoring); exam end may need queueing/retries under fully synced 2k submits.

### Option 2 — Balanced / Recommended (~$520–700 / mo ≈ ৳62k–84k)

| Service | Configuration | Est. USD/mo | Reason |
|---------|---------------|------------:|--------|
| ECS Fargate / EC2 | API **2× `t4g.xlarge`** (sticky ASG min1/des2/max4) + FE **2× `t4g.small`** | 150–220 | Socket headroom + FE HA |
| ALB | 1 ALB, sticky sessions for API target group | 25–40 | WebSocket affinity until Redis adapter |
| RDS PostgreSQL | `db.t4g.large` or `db.r6g.large`, **Multi-AZ**, 200 GB gp3, boosted IOPS | 180–250 | Finalize stampede + HA |
| RDS Proxy | Optional | 15–25 | Connection multiplexing |
| ElastiCache Redis | `cache.t4g.small` | 25–35 | OTP + room for Socket adapter soon |
| MongoDB Atlas | **M20** | 120 | Headroom for org discussions |
| S3 + CloudFront | 100–300 GB transfer | 25–50 | Assets + media |
| NAT Gateway | **1×** AZ | 35–45 | Private subnets outbound |
| Secrets + CloudWatch + ECR + R53 | | 25–40 | Ops baseline |
| **Total** | | **~$520–700** | **≈ ৳62,000–84,000** |

**This is the recommended launch posture** for marketing “1,500–2,000 concurrent exam students,” **if** you:

1. Enable ALB stickiness for Socket.IO, **or** implement Redis adapter + shared proctoring store before raising API desired count above 1 during exams.  
2. Raise TypeORM pool and RDS `max_connections`.  
3. Load-test finalize storms before the first big exam.

### Option 3 — Higher Availability / Higher Traffic (~$950–1,350 / mo ≈ ৳114k–162k)

| Service | Configuration | Est. USD/mo | Reason |
|---------|---------------|------------:|--------|
| ECS | API 3–6× `t4g.xlarge` (after Redis Socket adapter) + FE 3× | 280–400 | 2.5k–3k sockets distributed |
| ALB | Multi-AZ | 35–55 | |
| RDS | `db.r6g.xlarge` Multi-AZ + Proxy | 350–450 | Heavy write bursts |
| ElastiCache | `cache.r6g.large` (or Redis cluster) | 120–180 | Socket adapter + store |
| MongoDB Atlas | **M30** | 240 | Org chat growth |
| S3/CF/NAT×2/WAF/CW | | 120–200 | HA networking + WAF |
| **Total** | | **~$950–1,350** | **≈ ৳114,000–162,000** |

**Prerequisite:** Engineering work to make proctoring **horizontally scalable** (Redis adapter + shared store). Without that, buying more API boxes **does not safely help**.

---

## 6. Cost optimization (specific to this codebase)

1. **Do not buy Aurora yet** — RDS Postgres Multi-AZ matches TypeORM usage.  
2. **Use Graviton (`t4g` / `r6g`)** — Node + Postgres friendly and cheaper.  
3. **One NAT Gateway** (Option 2) instead of one-per-AZ until needed.  
4. **S3 Gateway VPC endpoint** — cut NAT data charges for uploads/downloads.  
5. **CloudFront for `/_next/static`** — Next standalone still benefits hugely.  
6. **Prefer API content proxy + CloudFront signed URLs later** — today Nest can stream S3; offload when bandwidth grows.  
7. **Keep mid-exam localStorage** until Redis/PG sized for autosave — enabling server autosave is a **cost and reliability event**.  
8. **Atlas M10→M20 only when discussion metrics demand** — not for exam day.  
9. **Scale FE independently of API** — FE is not holding exam sockets.  
10. **After 3–6 months**, consider Compute Savings Plans / RI for baseline ECS+RDS (not for exam spikes).  
11. **Non-prod shutdown** — staging EC2/ECS schedules overnight.  
12. **Image sharp on upload only** — already bounded; no GPU.

---

## 7. Things we may have missed

Items **relevant from this codebase** or clearly needed for production ops:

| Item | Relevance |
|------|-----------|
| **Brevo email costs** | Invites, OTP email paths — usage-based, not AWS |
| **BulkSMS BD OTP costs** | Auth/org signup — can spike; rate-limit currently weak in places |
| **SSLCommerz fees** | Payments — merchant fees outside AWS |
| **Socket.IO sticky sessions / Redis adapter** | Hard requirement for multi-API; missing adapter is a **scale bug**, not just a cost item |
| **Default DB pool ~10** | Silent production failure under finalize stampede |
| **Health check couples Mongo** | Chat outage can mark whole API unhealthy for ALB — split readiness vs liveness later |
| **Double submit path** | REST answersheet + socket `exam:submit` at end — idempotency needed |
| **No CI/CD in repo** | Need CodePipeline/GitHub Actions + ECR; labor cost |
| **No application APM** | Add Sentry/Datadog later — not in code today |
| **Log retention** | CloudWatch retention 7–30 days to control cost |
| **Backup / PITR** | RDS automated backups + Atlas backups + S3 versioning |
| **DR region** | Not required day-1; document RPO/RTO |
| **WAF / Shield Standard** | OTP and login abuse from BD + global bots |
| **Domain / DNS** | Route 53 + existing domain registrar |
| **TRUST_PROXY / cookies** | Behind ALB — already coded; must configure correctly |
| **Next `images.unoptimized`** | More bytes from origin unless CloudFront caches aggressively |
| **Teacher live monitor fan-out** | Undocumented N monitors × M students memory |
| **Legacy PG discussion tables** | Dead weight; ignore for sizing |
| **Org + IELTS product ungated** | Product/billing risk, not AWS — but drives unexpected traffic |
| **Future server autosave** | Would invalidate this cost model — flag explicitly |
| **Data transfer out to Bangladesh ISPs** | Often underestimated; CloudFront helps |
| **EBS snapshot / RDS snapshot storage** | Grows with retention |
| **Support plan (Developer/Business)** | AWS Support is extra |

---

## 8. Load testing plan (before first 1,500+ exam)

### 8.1 Critical workflows / endpoints (from code)

| Priority | Workflow | Endpoints / events |
|----------|----------|--------------------|
| P0 | Exam start stampede | `POST /api/v1/student/exams/:id/start`, `GET /api/v1/exams/:id` |
| P0 | Socket join | Socket.IO `exam:join` → `session:ready` |
| P0 | Finalize stampede | `POST /api/v1/student/exams/:id/answersheet` (+ `exam:submit`) |
| P1 | Flag / violation | Socket `flag:report`, `POST .../report-violation` |
| P1 | Auth login / OTP | Throttled paths — ensure not blocking exam day |
| P2 | Discussion poll | Class discussion GETs every 20s |
| P2 | Upload | `POST /uploads/media` (authoring, not mid-exam) |
| P2 | Health | `GET /api/health` under load (Mongo dependency) |

### 8.2 Suggested staged tests

| Concurrent virtual users | Pass criteria (starting point) |
|-------------------------:|--------------------------------|
| 500 | p95 start & finalize &lt; 2s; error rate &lt; 0.1%; sockets stable |
| 1,000 | Same; RDS CPU &lt; 60%; connections &lt; 70% max |
| **1,500** | Target launch bar; finalize p95 &lt; 3s; no 5xx storm |
| **2,000** | Same; sticky affinity verified; no socket room split brain |
| 2,500 | Only after Redis adapter; document breaking point |
| 3,000 | Stress / capacity planning for Option 3 |

Tools: k6 or Locust for HTTP; separate Socket.IO load tool (e.g. `artillery` with socket.io engine, or custom).

### 8.3 Metrics to watch

| Layer | Metrics |
|-------|---------|
| App | p50/p95/p99 latency, RPS, 4xx/5xx, Node event-loop lag, heap, open handles |
| ALB | Target response time, 5xx, active connections, rejected connections |
| PostgreSQL | CPU, freeable memory, connections, write IOPS, queue depth, deadlocks, slow queries |
| Redis | CPU, memory, evictions, connections |
| MongoDB | CPU, connections, ops/sec, replication lag |
| Network | Bytes in/out, NAT bytes |
| Socket | Connected clients, disconnect rate, room sizes |

---

## 9. Final recommendation

### If you launch Instructor Academy today for **1,500–2,000 concurrent exam students**:

**Start with Option 2 (Balanced) in `ap-southeast-1`:**

1. **Next.js** on 2 small tasks behind CloudFront + ALB.  
2. **Nest API** on 1–2 larger tasks with **ALB stickiness** for Socket.IO (until Redis adapter ships).  
3. **RDS PostgreSQL Multi-AZ** (`db.t4g.large` / `db.r6g.large` class), raised connection limits, tuned TypeORM pool; consider **RDS Proxy**.  
4. **ElastiCache Redis** (OTP now; Socket adapter soon).  
5. **MongoDB Atlas M20** for discussions/chat.  
6. **S3 + CloudFront** for media and static assets.  
7. **Secrets Manager + CloudWatch + ECR + Route 53 + ACM**.  
8. **Budget ~$520–700/month (≈ ৳62k–84k)** as a planning band, plus Brevo/BulkSMS/SSLCommerz outside AWS.

**Do this engineering before the first big exam (more important than buying Option 3):**

1. Load-test **start + socket join + finalize** at 1,500 and 2,000.  
2. Implement **idempotent finalize** and back-pressure if timer sync causes stampede.  
3. Plan **Redis Socket.IO adapter + shared proctoring store** before scaling API desired count during exams.  
4. Split **liveness** (process up) from **readiness** (optional Mongo) so chat outages don’t take exams offline.  
5. Confirm you will **not** turn on server autosave without a new capacity plan.

**Do not:**

- Assume multi-API horizontal scale works today (in-memory proctoring store).  
- Assume mid-exam DB write load from autosave (it isn’t in the current UI).  
- Deploy DocumentDB/Aurora/GPU “just in case.”  
- Rely on single-host `docker-compose.prod.yml` for a 2,000-student national exam.

### One-sentence answer

> For a Bangladesh-focused launch of Instructor Academy on current `develop`, plan on **Singapore-region ECS + ALB (sticky) + Multi-AZ RDS Postgres + Redis + MongoDB Atlas + S3/CloudFront**, sized like **Option 2 (~$520–700/mo)**, engineered around **~2,000 Socket.IO connections and a finalize write stampede** — not around continuous answer autosave — and treat **Redis-backed proctoring scale-out** as a near-term prerequisite before spending on a larger API fleet.

---

## 10. Source references (inspect list)

```
backend/package.json
backend/src/main.ts
backend/src/app.module.ts
backend/src/config/typeorm.config.ts
backend/src/config/redis.provider.ts
backend/src/config/mongodb.config.ts
backend/src/proctoring/proctoring.gateway.ts
backend/src/proctoring/proctoring-store.service.ts
backend/src/storage/*
backend/src/health/health.controller.ts
backend/src/chat-mongo/*
backend/Dockerfile.prod
frontend/next.config.ts
frontend/Dockerfile.prod
frontend/app/test/page.tsx
frontend/utils/tests/examAnswerStorage.ts
frontend/hooks/tests/proctoring/*
frontend/component/Classes/ClassDiscussions.tsx
docker-compose.prod.yml
DEPLOYMENT.md
```

---

*End of report. Revisit costs after the first load test with measured finalize RPS and socket memory.*
