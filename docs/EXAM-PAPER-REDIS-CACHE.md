# Instructor — Exam Paper Redis Cache

**Date:** 2026-09-22  
**Branch:** `develop`  
**Product:** Instructor

## Purpose

Reduce PostgreSQL load when many students start an exam and fetch the same question paper simultaneously.

PostgreSQL remains the **source of truth**. Redis is a **cache-aside** optimization only.

## Cache key

| Key | Example |
|-----|---------|
| `exam:paper:{examId}` | `exam:paper:a1b2c3d4-...` |

Constants: `backend/src/exams/exam-paper-cache.constants.ts`

## Cached payload

Serialized exam graph used by student take/finalize flows:

- Exam metadata (schedule, duration, audience, active flag, workspace fields)
- `questions` / `questionSections` (+ nested questions & subject)
- `target_students` / `excluded_students` (for audience checks)
- `class` (lightweight relation; **not** the full class roster)
- `primary_subject`

**Not cached as answers / submissions.** Student answers stay in PostgreSQL only.

**Not an authorization grant.** Callers must still run `validateExamAccess` / membership checks.

## TTL

**6 hours** (`EXAM_PAPER_CACHE_TTL_SECONDS`).

Correctness is driven primarily by **explicit invalidation** after mutations. TTL is a safety net if invalidation is missed.

## Cache-aside flow

```
Request (start / get paper / finalize graph load)
        ↓
Redis GET exam:paper:{examId}
        ↓
HIT  → hydrate ExamEntity → continue auth / DTO build
MISS → PostgreSQL load (EXAM_PAPER_RELATIONS)
        ↓
     Redis SET (best-effort)
        ↓
     continue
```

## Redis failure behavior

If Redis GET/SET/DEL fails:

1. Log a warning
2. Fall back to PostgreSQL
3. Exam taking continues normally

Caching is never a hard dependency for exams.

## Authorization

`ExamPaperCacheService.getExamGraph()` only loads data.

`StudentExamService.validateExamAccess()` still:

- Enforces workspace match
- Enforces active/schedule windows
- Enforces submission status
- Enforces target/excluded lists
- Resolves **class membership live** via `ClassService.resolveStudentClassMembership` (not from a cached roster)

## Invalidation (after successful DB mutation)

| Operation | Service method | Action |
|-----------|----------------|--------|
| Wizard create | `ExamService.createFromWizard` | `invalidate(examId)` |
| Wizard update (replaces questions/sections) | `ExamService.updateFromWizard` | `invalidate(examId)` |
| Legacy objective create | `createObjectiveExam` | `invalidate` |
| Legacy subjective create | `createSubjectiveExam` | `invalidate` |
| Activate / deactivate | `setExamActive` | `invalidate` |
| Excluded students change | `updateExcludedStudents` | `invalidate` |
| Delete exam | `delete` | `invalidate` |

Invalidation runs **after** the PostgreSQL write succeeds.

Questions belong to a single exam in this model (wizard replace / cascade). No multi-exam question sharing path requires fan-out invalidation today.

## What Redis does **not** solve

- Finalize / answersheet **writes**
- Objective / subjective **scoring** persistence
- Socket.IO proctoring session state (still in-memory on one API process)
- OTP / org-registration keys (separate prefixes: `sms_*`, `org_reg:`)

## Related code

- `backend/src/exams/exam-paper-cache.service.ts`
- `backend/src/exams/student-exam.service.ts` (`validateExamAccess`, `finalizeAnswerSheet`)
- `backend/src/config/redis.service.ts`
