# API changelog for the mobile app

Newest first. Each entry: the date it reached beta, the PR, what changed, and what the app should do. Only additions; nothing here removes or renames a field (see [api.md](api.md) §10).

## 2026-11-17 — IELTS courses, branch managers, solo IELTS (P12-01 to P12-05)

[openapi.json](openapi.json) is refreshed. New or changed for the app:
- `GET /ielts/courses`, `GET /ielts/courses/:id` (and `POST`, `PATCH`, `DELETE` for staff): IELTS courses with branch, dates, status (UPCOMING, RUNNING, ENDED), modules, seats and teachers. Students get their own courses.
- **New role** `BRANCH_MANAGER` in `member_role`. Branch managers are refused (403 `NOT_FOR_BRANCH_MANAGERS`) everywhere except the plan, the workspace type and labels, and IELTS courses of their branch. Show them only what answers.
- **Sign-in:** the sign-in and refresh answers carry `workspace_type` (ACADEMIC or IELTS), also for personal sessions (solo IELTS trainers and their students). Use it for the menu.
- **IELTS workspaces:** the guardian endpoints answer 403 `GUARDIANS_OFF` unless the organisation switched guardians on; leave requests answer 403 `NOT_IN_IELTS`.
- **Enrolment:** it can answer 409 `SECTION_FULL` when a course is full.

## 2026-11-17 — version check and API description (PM-03, PM-05)

- `GET /app/version?platform=ANDROID|IOS&current=<version>` (no sign-in). Call it at start-up: `update: REQUIRED` means show an "Update the app" screen and stop; `OPTIONAL` means suggest it. Nothing is set on beta yet, so every version is fine.
- [openapi.json](openapi.json): every endpoint, request and answer as OpenAPI 3. It is refreshed with every release.

## 2026-11-17 — answers to the app's first questions

No API change. [api.md](api.md) now states:
- the access token lasts 30 minutes;
- the organisation is in the token, and the header must match it;
- students may call `/me/entitlements`;
- proctoring uses the default namespace;
- check-in is one endpoint, with no selfie and no offline check-in (§6a).

design.md marks its older plan lines as superseded.

## 2026-11-17 — signed-in devices (PM-01)

- Every login is its own device: the web and the app no longer sign each other out.
- `POST /auth/login`, `/auth/login/organization` and `/auth/refresh` accept `device: { platform, name, app_version }`. Send it from the app (`platform` ANDROID or IOS).
- The refresh token **rotates** on every refresh and workspace switch. Store the new one each time. A replaced token works for 60 s; used later, it signs the device out.
- New: `POST /auth/logout`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/sessions/revoke-others`. See [api.md](api.md) §3.
- Changing the password signs out the other devices; a password reset signs out all of them.
- The access token has a new claim `sid` (this device's id).

## 2026-11-16 — the guide

- First version of [api.md](api.md): base URLs, envelope and error codes, sign-in and workspaces, entitlements, labels, language, files, Socket.IO, rules, and the planned mobile server work (§9).
