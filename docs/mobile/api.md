# Instructor API — guide for the mobile app

For the Flutter app in [Sadiquzzaman/instructor-app](https://github.com/Sadiquzzaman/instructor-app). This file is the contract between the two repositories: the backend keeps it true, and every change is listed in [api-changelog.md](api-changelog.md). Story IDs (ATT-03, IEL-07, …) refer to [docs/spec.md](../spec.md); the architecture is in [docs/design.md](../design.md). **Where design.md and this guide differ, this guide follows the code.**

## 1. Where the API is

| Environment | Base URL | Notes |
| --- | --- | --- |
| Beta | `https://api-beta.instructor.academy/api/v1` | Deployed from `develop`. Test accounts are created by `backend/src/user/test-users.seed.ts`. Use them only; never real people's data |
| Production | not live yet | Comes with P11 |
| Local | `http://localhost:<PORT>/api/v1` | Run the backend from this repository; Swagger UI is at `/apidoc` there (it is off on beta and production) |

**Every endpoint** is described in [`openapi.json`](openapi.json) (OpenAPI 3, exported from the code's Swagger decorators with `pnpm openapi:export` in `backend/`, refreshed with every release). The controllers are in `backend/src/**/**.controller.ts` with their request DTOs in the module's `dto/` folder; the web app's use of an endpoint (`frontend/`) is a working example.

## 2. Requests and answers

- JSON in and out (`Content-Type: application/json`), except file uploads (§6).
- **Success:** `{ "statusCode": 200, "message": "…", "payload": …, "meta": …, "error": false }`. The data is always in `payload`; lists that page carry `meta: { page, limit, total, total_pages }` and take `?page=&limit=`.
- **Error:** `{ "statusCode": 4xx, "error": true, "timestamp": "…", "path": "…", "message": "…" | ["…"], "code"?: "…", "feature"?: "…", "limit"?: "…", "details"?: … }`.
  - `message` is English and meant for logs; it is an array for validation errors.
  - **Act on `code`, not on `message`.** Codes are stable (for example `FEATURE_NOT_IN_PLAN`, `PLAN_LIMIT_REACHED`, `IELTS_NOT_OPEN`, `COURSE_FULL`); the app shows its own Bangla or English text for each.
- **Times** are ISO 8601 in UTC (`timestamptz`). **School days** are plain dates (`YYYY-MM-DD`) in the organisation's time zone (default `Asia/Dhaka`). Show times in the organisation's time zone, not the phone's.
- **IDs** are UUIDs.

## 3. Signing in

1. **Sign up** (students and teachers): `POST /auth/register`, then `POST /auth/register/verify-otp` with the SMS code. Organisations: `POST /auth/register/organization`, then the same OTP step.
   - **Error codes** (issue #345): `PHONE_ALREADY_REGISTERED`, `EMAIL_ALREADY_REGISTERED`, `OTP_SEND_FAILED` (the SMS limit is 3 an hour, or the provider failed) on sign-up; `ACCOUNT_NOT_FOUND`, `PHONE_ALREADY_VERIFIED`, `OTP_INVALID`, `OTP_EXPIRED` and `OTP_LOCKED` (429; locked for 15 minutes after 5 wrong codes) on verification.
   - **Resending a code:** send the same sign-up request again. For a phone that isn't verified yet, the server discards the earlier attempt and sends a new code (within the SMS limit).
2. **Log in:** `POST /auth/login` with `{ phone | email, password, device }`, where `device` is `{ platform: "ANDROID" | "IOS", name: "Pixel 8", app_version: "1.0.0" }` (the web leaves it out). The answer's `payload` is the user with `access_token` (a JWT, **30 minutes**) and `refresh_token` (**30 days**). Each login is a new **signed-in device** with its own refresh token; signing in on the phone never signs the web out. Organisation login (`POST /auth/login/organization`) takes `device` too.
3. **Choose a workspace:** `GET /auth/contexts` lists where the user can work (organisations they belong to, their own teaching workspace, the teachers they learn from). `POST /auth/select-context` with `{ type: "organization", organization_id }` (or `personal_teacher`, or `individual_teacher` with `teacher_id`) returns new tokens for that workspace; the JWT then carries `organization_id`, `member_role` and `session_mode`. The web's `/select-context` page is the model.
4. **Every request:** `Authorization: Bearer <access_token>`, and in an organisation workspace also `X-Organization-Id: <organization id>` (the web does both; see `frontend/lib/axios.ts`). The organisation is **in the token** after select-context; the header must match it, or the API answers 403 "Organization context does not match this session". Personal (non-organisation) sessions ignore the header.
5. **Refresh:** on a 401, call `POST /auth/refresh` with `{ refreshToken, organization_id?, device? }` once (pass `organization_id` to stay in the organisation workspace; `device.app_version` updates the version shown), store the new pair, and retry. If refresh fails, sign out.
   - **The refresh token changes every time** (refresh and workspace switch). Always store the new one.
   - The token it replaced still works for **60 seconds** (two requests refreshing at once). After that, using it again is treated as a stolen token: the device is signed out and the user must log in again. So refresh once, from one place in the app, and never keep old tokens.
   - **Sign-in errors** (401): `INVALID_CREDENTIALS`, `ACCOUNT_NOT_VERIFIED` (offer to verify the phone), `ACCOUNT_DISABLED`.
6. **Sign out and devices** (built in PM-01):
   - `POST /auth/logout` with `{ refreshToken }` signs out this device (always 200). Call it when the user logs out, then delete the tokens. The access token still works until it expires (at most 30 minutes).
   - `GET /auth/sessions` (signed in) lists the user's signed-in devices: `id`, `platform` (WEB, ANDROID, IOS), `device_name`, `app_version`, `created_at`, `last_used_at`, `current` (this device).
   - `DELETE /auth/sessions/:id` signs out one of them (404 if it is not the user's or already signed out); `POST /auth/sessions/revoke-others` signs out all but this one (`{ signed_out: n }`).
   - Changing the password signs out every other device; resetting a forgotten password signs out all of them.
   - The access token carries `sid`, the id of this device.
7. **Deleting the account** (issue #358; both stores require it):
   1. `GET /me/account-deletion` answers `{ canDelete: true }`, or `{ canDelete: false, code: "OWNER_MUST_TRANSFER", organizations: [{ id, name }] }` for someone who owns an organisation. Show that before asking for the password. An owner can't be changed in the app yet, so tell them to contact support.
   2. To confirm, either:
      - use the password; or
      - call `POST /me/account-deletion/otp`, which sends a 5-minute code to the account's phone and answers `{ maskedPhone }` (429 `OTP_SEND_FAILED` after 3 codes in an hour).
   3. `POST /me/account-deletion` with `{ password }` or `{ otp }`, plus an optional `reason` (up to 500 characters):
      - `200 { deleted: true }`: every device is signed out. Clear the tokens and cached workspaces and go back to sign-in.
      - `400` with `INVALID_PASSWORD`, `OTP_INVALID` or `OTP_EXPIRED`.
      - `409 OWNER_MUST_TRANSFER`, with `details.organizations`.
      - `429 OTP_LOCKED` after 5 wrong passwords or codes (15 minutes).

   **What deletion does:**
   - The account stays in the database but is deactivated. Its name becomes "Deleted user", and its email and phone are removed.
   - It leaves its classes and organisations, and its own solo workspace closes.
   - Marks, attendance, hand-ins and messages stay with the school under "Deleted user".
   - The phone and email can sign up again as a new, empty account.
   - The current access token keeps working until it expires (at most 30 minutes), as after a sign-out.
8. **Other:** `POST /auth/forgot-password` → `reset-password/verify-otp` → `reset-password`; `POST /auth/change-password`; `GET /auth/profile`. Forgot and reset answer `ACCOUNT_NOT_FOUND`, `OTP_INVALID`, `OTP_EXPIRED` and `OTP_LOCKED` like sign-up.

**Store tokens in secure storage** (Keychain / Keystore), never in plain preferences or logs.

**Known limits until the mobile server work ships (see §9):**

- **Google sign-in** works only as the web redirect flow; the app needs a native flow (an ID-token endpoint).
- There is no push and no app version check yet.

## 4. Workspace, plan and labels

- `GET /workspace/type` → `kind` (SCHOOL, COACHING, IELTS_CENTRE, SOLO) and `workspace_type` (ACADEMIC or IELTS). Build the menu from it: IELTS workspaces never show academic pages (spec Epic 11, IEL-12).
- `GET /workspace/level-labels` → the organisation's words for class and section (for example Course / Batch) in Bangla and English (FND-03). Use them wherever the web does.
- `GET /me/entitlements` → the plan's features and limits for this workspace. Any signed-in user may call it, students included, once a workspace is chosen (403 without one); the web only calls it for teachers because only their menus have locked items. Hide what is switched off. When an action still answers 403 with `code: FEATURE_NOT_IN_PLAN` or `PLAN_LIMIT_REACHED`, show the locked-feature message: owners and admins "This feature is one upgrade away — unlock it today!", everyone else "Ask your admin to unlock this." (design §8.3).
- **Roles:** the user's `role` (STUDENT, TEACHER, ADMIN, SUPER_ADMIN) and, in an organisation, `member_role` (OWNER, ADMIN, ASSISTANT, TEACHER, STUDENT; BRANCH_MANAGER comes with P12). The web's side menu (`frontend/utils/sidebarList.tsx`) lists which role sees which page.

## 5. Language

All user-facing text is in Bangla and English, chosen by the user. The web's wording is in `frontend/messages/en.json` and `bn.json`; reuse it so both apps say the same thing. Server-made text (SMS, PDFs) follows the organisation's settings, not the app.

## 6. Files

1. `POST /files/presign` with `{ purpose, mime, size, name?, scope_id? }` (`backend/src/files/dto`). Purposes: `IMAGE`, `DISCUSSION`, `HOMEWORK`, `RESOURCE`, `LEAVE`, `IELTS`, `EXAM` (`backend/src/files/file-rules.ts` lists the types and sizes; up to 20 MB). The answer has the file `id`, the link to `PUT` the bytes to, and `storage.warning` (true from 90% of the quota).
2. `PUT` the file there with its `Content-Type`.
3. `POST /files/:id/complete`. Then send the file `id` to the feature that uses it (homework hand-in, chat message, leave request…).
4. **Showing a file:** `GET /files/:id/content` redirects to a link valid for 1 hour. Do not cache the redirect target.

Over the storage quota answers 403 `PLAN_LIMIT_REACHED` (`limit: max_storage_mb`).

## 6a. Attendance check-in

The same endpoint and rules on the web and in the app (spec ATT-15, ATT-16; redesigned 5 Nov 2026):

- `GET /attendance/me/today`: the caller's classes today with each check-in window and their own record.
- `POST /attendance/check-in`: for an in-person class, `latitude`, `longitude` and `accuracy_m` (100 m or better, inside the branch radius); for an online class, nothing.
- Check-in is open from 15 minutes before the start to the end. It counts as late after the start plus the grace minutes. Once per class.
- **No selfie** and **no offline check-in**: a check-in must happen at the class time and place. `GET /attendance/me/calendar?month=YYYY-MM` gives the student's month.

## 7. Real time

Socket.IO on the API host:

- `/chat`: group and private chat (P9).
- The default namespace: live proctoring of tests (P8). (design.md's `/proctoring` namespace was the plan; the built one is the default namespace.)

Authenticate in the handshake with `auth: { token: <access_token> }`. Reconnect with a fresh token after a refresh. The web's `frontend/component/Chat` shows the events.

## 8. Rules the app must keep

- Never trust or invent an organisation id: use only ids the API gave you, and send `X-Organization-Id` only in an organisation workspace.
- Never cache another workspace's data after switching; clear it.
- Never log tokens, passwords, OTPs or phone numbers.
- Do not call endpoints the web does not use without asking first (§10). Some are old and are being removed.

## 9. Server work planned for the app (Mobile support, plan.md)

| Item | What the app gets |
| --- | --- |
| Device sign-in | **Built (PM-01, §3).** A refresh token per device (30 days, rotating), sign out this device, sign out the others |
| Google sign-in for apps | `POST /auth/google/token` with the Google ID token from the native sign-in |
| Push notifications | `POST /me/devices` (FCM token, platform, app version) and `DELETE /me/devices/:id`; the notification outbox sends push as a channel |
| App version check | **Built (PM-03).** `GET /app/version?platform=ANDROID\|IOS&current=1.0.0` (no sign-in) → `minimum`, `latest`, `update_url` and `update`: NONE, OPTIONAL or REQUIRED (below the minimum: the app must update first). Set on the server per platform; unset = every version is fine |
| API description | **Built (PM-05).** [`openapi.json`](openapi.json), exported with every release |

Each item is listed in [api-changelog.md](api-changelog.md) when it reaches beta.

## 10. Asking for a change

The mobile app never changes this repository. When it needs something the API does not have, or finds a server bug:

1. Open an issue in [Sadiquzzaman/tes-taker](https://github.com/Sadiquzzaman/tes-taker/issues) with the label **`mobile-api`**.
2. Say which screen needs it, what the app sends, what it expects back (field names and types), and any error codes it must handle.
3. The backend builds it as a normal PR into `develop`, comments on the issue with the PR and the changelog entry, and closes the issue once it is on beta.

**Changes never break the app:** fields are added, not renamed or removed. A breaking change would need a new path (`/api/v2/…`) and a deprecation period, agreed with the owner first.
