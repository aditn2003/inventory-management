# Branch: `admin-feature-enhancement` — feature changelog

## 1. High-level summary

The branch extends the IMS with **admin-focused user lifecycle and access control**, **invite-by-email onboarding**, **user display names** (with privacy-oriented UI), **richer tenant list UX** (sorting aligned with README assumptions), and **tenant access management** for users (checkbox grid + bulk API). Supporting pieces include **new DB migrations**, **Resend email integration**, **nginx route** for invite registration, and **frontend data-fetching tweaks** to avoid scroll jumps on refetch.

## 2. Feature list (what this branch adds)

### 2.1 User display name (`users.name`)

- DB column + model; registration and invite completion set **name**.
- **Emails hidden** in header/lists where applicable; UI shows **display name**.

### 2.2 Admin user management (beyond requirement doc admin stories)

- **User list** (admin): name, role, tenant access summary, joined date, actions (view/delete).
- **User detail** (admin): change **role**, **delete user**.
- **Tenant access** for a user:
  - Table mirrors **Tenants** list: **search**, **column sort**, **pagination**.
  - **Checkbox per tenant** — toggling calls **`PUT /api/v1/users/{id}/tenant-access`** with full replacement list.
  - **Allow all tenants** button (clears restrictions).
  - UX: refetch **without** remounting the whole page (scroll position preserved).

### 2.3 Email invite flow (admin → new user)

- Admin **`POST /users/invitations`** with `{ email }`:
  - Creates **`user_invites`** row, sends email via **Resend** with link  
    `{PUBLIC_APP_URL}/register/invite?token=…`
- **`RESEND_API_KEY` required** — missing key → **503** on invite (no “copy link” fallback).
- Public **`GET /auth/invite/preview?token=`** — shows invited email on registration form.
- **`POST /auth/register-invite`** — consumes invite, creates **`user`** role with chosen name/password.

### 2.4 Tenant module enhancements (admin tenant stories)

Requirement **1.1** asked for list with **pagination + search**. This branch adds:

- **Sortable columns** (ID, name, status, created) with asc/desc/clear cycle (shared header component).
- **Default list ordering** documented in README (active first, then created_at desc within status; case-insensitive name sort when sorting by name).

### 2.5 Infrastructure / quality

- Nginx rule for **invite deep link**.
- Auth router **syntax fix**: dependency parameters ordered so Python allows `Query(...)` after `Depends` (no “parameter without a default” error).

---

## 3. Quick API reference (new)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/users/invitations` | Admin invite (requires Resend config) |
| `PUT` | `/api/v1/users/{user_id}/tenant-access` | Body `{ "tenant_ids": [] }` = all tenants |
| `GET` | `/api/v1/auth/invite/preview` | Query `token` |
| `POST` | `/api/v1/auth/register-invite` | Complete invite signup |

> **Security** controls (nginx rate limits, invite tokens, JWT, RLS, etc.) are documented in the main **[README.md](./inventory-management-system/README.md#security)**.
