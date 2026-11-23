# API changelog for the mobile app

Newest first. Each entry: the date it reached beta, the PR, what changed, and what the app should do. Only additions; nothing here removes or renames a field (see [api.md](api.md) §10).

## 2026-11-23 — result codes and the IELTS true/false name (issues #351, #353)

- `GET /student/exams/:id/result`:
  - answers 403 `RESULT_NOT_PUBLISHED` while the teacher hasn't published results of a test with written answers;
  - answers 403 `EXAM_OUTSIDE_WORKSPACE` when the test belongs to another workspace than the one chosen.

  Other 403s keep their message only.
- IELTS True / False / Not Given in the academic wizard is `subType: "true-false-not-given"`, as the app already sends. The web was fixed to send the same (#353). The new IELTS builder (`/ielts/tests`) uses its own group type `TFNG`.

## 2026-11-18 — homework uploads work (issue #349)

- `POST /files/presign` now accepts `purpose: "HOMEWORK"`. It was missing from the upload rules, so homework files could not be uploaded from the web either.
- Accepted types: images (`image/jpeg`, `image/png`, `image/webp`, `image/gif`) and documents (`application/pdf`, Word `.doc` and `.docx`, `text/plain`), up to 20 MB each.
- Other types answer 400. The answer has the same shape as for other purposes (`file`, `upload`, `storage`).

## 2026-11-17 — error codes for sign-up, verification, reset and sign-in (issue #345)

Errors keep their English `message`, and now carry a `code`. See [api.md](api.md) §3.
- **Sign-up:** `PHONE_ALREADY_REGISTERED`, `EMAIL_ALREADY_REGISTERED`, `OTP_SEND_FAILED`.
- **Codes:** `ACCOUNT_NOT_FOUND`, `PHONE_ALREADY_VERIFIED`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED` (429).
- **Sign-in (401):** `INVALID_CREDENTIALS`, `ACCOUNT_NOT_VERIFIED`, `ACCOUNT_DISABLED`.
- There is no organisation-name clash check, so no `ORGANIZATION_ALREADY_EXISTS`.
- **Resending a code:** repeat the sign-up request. It is the intended way, within 3 SMS an hour.

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
