# Handoff — planning session → Claude Code (23 Oct 2026)

Read this first, then `CLAUDE.md`. It summarises what was decided in the planning conversation.

## Documents (source of truth)

These are already exported to Markdown in `docs/` (Claude Code cannot open claude.ai links). Links are for the owner:

| Document | Save as | Link |
| --- | --- | --- |
| Feature Specification v1 (stories with IDs, e.g. ATT-06, FND-19) | `docs/spec.md` | https://claude.ai/artifact/EBk4uCPJeGbyLZbFfLasze |
| System Design, DFD & Schema v1 | `docs/design.md` | https://claude.ai/artifact/CNHNafqHsNU3XVx5HyHoB8 |
| Development Plan v1 (one-week web beta in §0, design system in §3) | `docs/plan.md` | https://claude.ai/artifact/RRiPuk1QMmQN4NJGAuLKqh |
| Codebase review (loopholes, UI review) | `docs/review.md` | https://claude.ai/code/artifact/8e951aaa-1a0b-4e07-b7d5-85523b32d472 |
| Target schema (95 tables) | `docs/schema.dbml` | in repo |
| ER diagrams | `docs/erd/*.png` | in repo (16 PNGs) |

§3 of the Development Plan is also saved as `docs/ui/design-system.md`. The Development Plan's roadmap chart did not export; the one-week plan in §0 is complete.

## Key decisions

- Goal now: **beta-ready web release in one week** (Development Plan §0). Mobile (Flutter), ZKTeco, S3 move, question bank, plagiarism and IELTS come after the beta. Beta keeps local file storage.
- Architecture: NestJS modular monolith + a BullMQ worker; PostgreSQL main DB; MongoDB kept for chat; Redis for cache, queues, Socket.IO adapter and live proctoring state. AWS Singapore later.
- Every account is an organisation (solo teacher = SOLO org). Workspace types: ACADEMIC, IELTS; TERTIARY reserved, off.
- **Subject class (`course_offering`) = section + subject + session** is the core unit every feature links to (FND-19). Electives/religion use `offering_enrolments`.
- SMS credits: monthly plan allowance plus top-ups (allowance spent first).
- Locked feature message: owners/admins see "This feature is one upgrade away — unlock it today!"; others see "Ask your admin to unlock this."
- Performance score: live to date on the student page, frozen per term on report cards (versioned), every change traced in `audit_logs`.
- AI: Gemini 3.5 Flash-Lite (paid tier) behind an `AiProvider` interface; syllabus import uses the tested v2 prompt (+ rules 10–12) with two runs compared and mandatory human review.
- Guardians: no login; up to 2 per student; SMS + PDF links only.
- Time zone: Asia/Dhaka; store UTC.

## P0 security fixes still open in the code (do these first)

1. Payment amount comes from the browser; activate subscriptions only for the server-computed price; require login + ownership on `/payments/initiate` and `GET /payments/:transactionId`.
2. Matching questions are served in answer order — shuffle per student.
3. Final submit (`POST /:examId/answersheet`) has no deadline check; autosave allows edits after submit.
4. Rate limiter keys on an unverified JWT; reset OTP has no wrong-guess limit; use `crypto.randomInt`.
5. Proctoring ignores plan and teacher settings (`proctoringFeatures` never passed).
6. Swagger is public in production.

## Workflow files waiting to be moved

`ci.yml` and `deploy-beta.yml` are in `docs/handoff-workflows/` because they could not be written into `.github/` remotely. As part of next step 2, move them to `.github/workflows/` (`git mv` after adding) and delete the empty `docs/handoff-workflows/` folder.

## Repository state

- Release branch is `main` ("master"); `develop` deploys to beta. `develop` was merged into `main` on 22 Oct 2026 (PR #67); the two branches now hold the same code.
- Beta server: `/opt/instructor/apps/tasktaker` (`develop` checked out). Deployed by `.github/workflows/deploy-beta.yml` on every merge to `develop`; see DEPLOYMENT.md "Automatic beta deploys".
- Claude GitHub App is installed; pushes from cloud sessions work.

## Next steps (approved plan pending the owner's "go")

1. Open PR `develop → main` to align the branches (owner approves manually; ask before anything goes to `main`).
2. From `main`, create `task/claude-md-and-ci-cd` with: `CLAUDE.md`, `.github/workflows/ci.yml`, `.github/workflows/deploy-beta.yml`, `scripts/deploy/deploy-beta.sh`, and the `docs/` files above. Commit, open PR into `develop`.
3. Owner adds GitHub environment `beta` secrets: `BETA_SSH_HOST`, `BETA_SSH_PORT`, `BETA_SSH_USER`, `BETA_SSH_KEY`, `BETA_SSH_KNOWN_HOSTS` (dedicated deploy user recommended).
4. Then start Day 1 of the one-week beta (Development Plan §0): P0-01 … P0-08 and P1-01.

## Open questions for the owner

- Confirm `/opt/instructor/apps/tasktaker` is the beta server with `develop` checked out.
- CI was not run in the planning environment (no npm registry access); the frontend lint step may fail on existing code — report, don't hide.
- SMS: confirm the proposals that unused monthly allowance expires and top-ups carry over.
- Who installs the ZKTeco agent at each institution (after beta).

## Attendance: owner decisions (2 and 5 Nov 2026, during P3-01)

Read spec Epic 1 ("Design") and plan §P3 first; they hold the result. In short:

- **Class-based, nobody wastes time.** Attendance is per class session, from each section's fixed schedule. Students (and teachers) check themselves in on the website; the system marks Late (after start + grace, default 10 minutes) and Absent (when check-in closes). Teachers only correct mistakes and cancel a class for a day. There is no roll call.
- **Radius per organisation and per branch.** Organisations with branches (e.g. Udvash: Motijheel, Farmgate, Badda) set a pin and radius per branch; others set one (stored on a hidden default branch). A section belongs to a branch.
- **Per section:** in person or online (online = check in from anywhere; the teacher can correct by hand), self check-in or paper register, grace period, schedule.
- **Schedules must be quick to create:** a grid, copy from another section, apply to a whole class or shift, CSV import. Stored as routine slots so the calendar epic (P5) builds on them.
- **Paper register (khata-kolom):** organisations that don't want self check-in keep paper and import it per section and month from CSV (preview, then apply; re-import updates).
- **Location (my call, owner agreed):** browser location must be allowed with 100 m accuracy or better; distance and accuracy are stored; odd check-ins are flagged, not blocked.
- **Colours:** grey upcoming, green present on time, yellow late, red absent; plus blue leave, light grey/striped holiday or cancelled, empty = no class. Always with a letter, not colour alone.
- **SMS:** Late at once; Absent once a day, only if the student missed every class that day.
- **Later:** ZKTeco (gate presence), mobile-app check-in (same rules), selfie, class photos.
- **P3-01's settings** (presence method, entry times, class attendance mode, selfie) are replaced in P3-02; nobody has used them yet. Dropping those columns needs the owner's approval in P3-02's plan.

**P3-02 is built** (#163, #164, #165): branches, section setup, schedules as `routine_slots`, schedule CSV import. P3-01's unused `org_settings` columns are dropped after the release (expand → contract, `docs/TODO.md`). Not decided yet: none. The feature-request "Mark handled" gap (it does not switch the feature on) is parked in `docs/TODO.md`; the owner will look at it later.

**P3-03 is built** (#172–#175): web self check-in, "My attendance", and the class view with corrections.

**P3-04 is built** (#179, #180, #181):
- The closing job saves Absent when check-in closes. It runs every 5 minutes and catches up on the last 7 days.
- A class can be cancelled for one day, and restored.
- Guardians get a Late SMS at once and an Absent SMS once a day, only if every class that day was missed. The day's SMS goes out from 23:59, or until 08:00 the next morning after an outage.
- The class teacher gets an in-app alert when a student is absent several days in a row.
- Teachers can correct up to 7 days back.
- Decisions taken on the owner's behalf are listed in the PRs; open items are in `docs/TODO.md`.
- Next: P3-05 (paper register) and P3-06 (leave). P3-06 must write LEAVE records before the closing job, or make it skip people on approved leave.

**P3-06 part 1 is built:** leave requests and approvals for students and teachers (`/attendance/leave`). The closing job saves Leave instead of Absent for anyone on approved leave, and approving leave for days already closed turns their Absent into Leave with a correction each. The guardian gets an SMS when a student's leave is applied for (if switched on). Part 2 adds the Leave page (`/leave`): apply, "My leave" and "To approve".
