# Organization / School model

## Overview

Organizations (schools) are first-class workspaces separate from the global `users.role`. Platform roles remain `SUPER_ADMIN | ADMIN | TEACHER | STUDENT`. Org power lives on `organization_members.role` (`OWNER | ADMIN | TEACHER | STUDENT`).

There is **no** global `ORG_ADMIN` role and **no** `users.organization_id`. Existing users are **not** given a default/personal organization.

Each organization has a public **`organization_number`** starting at **100001** (then 100002, …).

## Registration

| Path | Result |
|------|--------|
| `/signup` → Student | `users.role = STUDENT` after OTP |
| `/signup/organization` | Unverified `TEACHER` user + Redis pending org name → after OTP: `Organization` **PENDING** + member **OWNER** + assigned `organization_number` + free teacher subscription |
| Individual teacher signup | **Not offered**. Students use **Become a Teacher** (`teacher_role_requests`) |

Until a SUPER_ADMIN approves the organization, organization login is blocked.

## Split login

| Login | Fields | Session | Dashboard |
|-------|--------|---------|-----------|
| Individual | email/phone + password | `session_mode=individual`, no org JWT claim | Platform sidebar only |
| Organization | organization number + phone + password | `session_mode=organization`, JWT includes `organization_id` | Organization sidebar only |

Owners and invited teachers both use **Organization Login**. There is no workspace switcher; mode is fixed at login.

- Axios sends `X-Organization-Id` only for organization sessions.
- `OrganizationContextGuard` locks context to the JWT `organization_id` (client cannot switch orgs via header).

## Classes & exams

- `classes.organization_id` nullable; `class_kind` = `ORGANIZATION | PERSONAL` (legacy rows default PERSONAL).
- `exams.organization_id` nullable; ownership stays on `created_by`.
- Multi-teacher via `class_teachers`.
- Joining an org class upserts `organization_members` STUDENT when missing.

### Exam permissions (org exams)

| Actor | Monitor / view | Edit / delete / grade |
|-------|----------------|------------------------|
| Creator teacher | yes | yes |
| Org OWNER / ADMIN | yes (monitor) | **no** (unless creator) |
| Other org teachers | no | no |
| Cross-org | deny | deny |

## Members

OWNER/ADMIN can add teachers via `POST /organizations/:id/members` (existing verified users only). Org must be approved.

## Admin

`GET/PATCH /api/v1/organizations/admin/...` — **SUPER_ADMIN** only for approve/reject pending organizations.
