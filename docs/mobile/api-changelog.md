# API changelog for the mobile app

Newest first. Each entry: the date it reached beta, the PR, what changed, and what the app should do. Only additions; nothing here removes or renames a field (see [api.md](api.md) §10).

## 2026-11-17 — signed-in devices (PM-01)

- Every login is its own device: the web and the app no longer sign each other out.
- `POST /auth/login`, `/auth/login/organization` and `/auth/refresh` accept `device: { platform, name, app_version }`. Send it from the app (`platform` ANDROID or IOS).
- The refresh token **rotates** on every refresh and workspace switch. Store the new one each time. A replaced token works for 60 s; used later, it signs the device out.
- New: `POST /auth/logout`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/sessions/revoke-others`. See [api.md](api.md) §3.
- Changing the password signs out the other devices; a password reset signs out all of them.
- The access token has a new claim `sid` (this device's id).

## 2026-11-16 — the guide

- First version of [api.md](api.md): base URLs, envelope and error codes, sign-in and workspaces, entitlements, labels, language, files, Socket.IO, rules, and the planned mobile server work (§9).
