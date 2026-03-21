# Inventory Management System (IMS)

A full-stack multi-tenant Inventory Management System built with FastAPI + React.

## Quick Start

```bash
# 1. Copy and configure environment variables
cp .env.example .env
# Edit .env if needed (defaults work out of the box)

# 2. Start all services
docker compose up --build

# 3. Open the app
http://localhost
```

The seed script runs automatically on first startup when `SEED_ON_STARTUP=true` (see `.env.example`).

## Default Credentials

| Role  | Email (login only) | Display name         | Password  |
| ----- | ------------------ | -------------------- | --------- |
| Admin | admin@ims.com      | System Administrator | admin123! |
| User  | user@ims.com       | Demo User            | user123!  |

Emails are **not** shown in the UI after login; the header and user lists use **display names** only.

After pulling changes, run **`alembic upgrade head`** inside the API container (or locally from `backend/`) so migrations apply — including order status **`confirmed`** and related constraints.

### Inviting users (admin)

Admins use **Users → Invite user**: enter an email. The API creates a **user invite** and sends a **Resend** email with a link to `/register/invite?token=…` where the person sets their **name** and **password**. They are created with the **user** role.

Configure in `.env`:

- **`RESEND_API_KEY`** — from [Resend](https://resend.com); **required** — invitations fail with **503** if unset.
- **`RESEND_FROM_EMAIL`** — verified sender (e.g. `IMS <onboarding@resend.dev>` for quick tests).
- **`PUBLIC_APP_URL`** — where the SPA is reachable (e.g. `http://localhost` behind nginx); used in the email link.

## Architecture

```
inventory-management-system/
├── backend/          FastAPI 3.12 — REST API
│   ├── app/
│   │   ├── auth/     JWT auth, bcrypt, Redis blacklist
│   │   ├── tenants/  Multi-tenant CRUD (TEN-XXX IDs)
│   │   ├── products/ Product CRUD (SKU immutable)
│   │   ├── inventory/Inventory + stock management
│   │   ├── orders/   Orders + state machine (pending / created / confirmed / cancelled)
│   │   └── users/    Admin-only user management + tenant assignments
│   └── tests/        pytest test suite
└── frontend/         React 18 + Vite + TypeScript + Tailwind
    └── src/
        ├── store/    Redux Toolkit (auth + tenant slices)
        ├── api/      Axios client + per-entity API modules
        ├── hooks/    Custom data-fetching hooks
        ├── components/ Shared UI components
        └── pages/    Feature pages
```

## Stack

| Layer       | Technology                                |
| ----------- | ----------------------------------------- |
| Frontend    | React 18, Vite, TypeScript, Tailwind CSS  |
| State       | Redux Toolkit                             |
| Forms       | react-hook-form + zod                     |
| HTTP client | Axios (JWT + X-Tenant-Id interceptors)    |
| Backend     | Python 3.12 + FastAPI                     |
| ORM         | SQLAlchemy 2.0 (asyncio)                  |
| DB          | PostgreSQL 16 with RLS                    |
| Cache       | Redis 7 (token blacklist + rate limiting) |
| Auth        | JWT (access 15m + refresh 7d)             |
| Proxy       | Nginx                                     |
| Containers  | Docker Compose                            |

## Assumptions

- **Tenant list default sort**: With no column sort active, the tenant table is ordered with **active** tenants first, then **inactive**; within each status group, rows are sorted by **created_at descending** (newest first). Column headers cycle sort: **asc → desc → default**; only one column sort applies at a time. **Name** sorting is **case-insensitive** (A–Z by letter, ignoring capitalization).

## Key Features

- **Multi-tenancy**: Row-Level Security enforced at DB level; tenant selected via header dropdown
- **RBAC**: Admin (full access) vs User (CRUD on tenant-scoped data)
- **Order state machine**: See [Orders & inventory](#orders--inventory) below
- **Inventory management**: Auto-created on product creation; inline current-inventory updates on list and detail
- **Display IDs**: TEN-001 (tenants), ORD-1001 (per-tenant orders)
- **JWT rotation**: Refresh token rotated on every refresh; Redis blacklist for real logout

## Security

Defense-in-depth controls in this stack. **Configurable** items show **defaults** from code / `.env.example`.

### Nginx (edge proxy)

| Control            | Detail                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Rate limiting**  | **`auth`** zone: **5 requests/minute** per client IP; **`api`** zone: **600 requests/minute** per IP (`nginx/nginx.conf`). |
| **Auth routes**    | **`/api/v1/auth/login`**, **`register`**, **`register-invite`**: `limit_req zone=auth burst=5 nodelay`.                    |
| **Invite preview** | **`/api/v1/auth/invite/`**: `auth` zone with **`burst=10`**.                                                               |
| **General API**    | **`/api/`**: `limit_req zone=api burst=20 nodelay`.                                                                        |
| **HTTP headers**   | **`X-Content-Type-Options: nosniff`**, **`X-Frame-Options: DENY`**, **`X-XSS-Protection: 1; mode=block`**.                 |
| **Body size**      | **`client_max_body_size 1m`**.                                                                                             |
| **Forwarding**     | **`X-Real-IP`**, **`X-Forwarded-For`**, **`X-Forwarded-Proto`** to the API.                                                |

Brute-force and abuse against login, registration, and invite flows are throttled at the edge before FastAPI.

### Invitation links (token handling & expiry)

| Control                | Detail                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No raw token in DB** | Only **SHA-256** of the token is stored; the **raw token** is only in the **email link** and in transit.                                                                   |
| **Time-limited**       | **`expires_at`** enforced in code. TTL = **`INVITE_EXPIRE_HOURS`** (default **`168`** = 7 days). Use **`INVITE_EXPIRE_HOURS=24`** for 24-hour links.                       |
| **Single use**         | **`register-invite`** sets **`consumed_at`**; token cannot be reused.                                                                                                      |
| **Invalid / expired**  | No matching valid invite → **404** (or equivalent) for bad links.                                                                                                          |
| **Re-invite**          | Pending invites for the same email are **revoked** before a new one is created.                                                                                            |
| **API validation**     | Preview: **`min_length`** on `token` query; register-invite: **min token length** in Pydantic.                                                                             |
| **Verification**       | **`GET /auth/invite/preview`** and **`POST /auth/register-invite`** both **hash the token** and run **expiry / consumed** checks before returning data or creating a user. |

### Authentication & session (backend)

| Control              | Detail                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ |
| **Passwords**        | **bcrypt** (Passlib), **`bcrypt__rounds=12`**.                                             |
| **JWT**              | **HS256**; secret from **`JWT_SECRET`**.                                                   |
| **Access / refresh** | Defaults: **`ACCESS_TOKEN_EXPIRE_MINUTES=15`**, **`REFRESH_TOKEN_EXPIRE_DAYS=7`**.         |
| **Refresh rotation** | Old refresh token **blacklisted** when issuing a new pair.                                 |
| **Logout**           | **Redis** blacklist (`blacklist:` prefix) so logged-out / rotated tokens are not reusable. |
| **Login errors**     | Generic **“Invalid email or password”** (no user enumeration).                             |

### Privacy (email vs display name)

| Control                    | Detail                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| **`/me` / `UserResponse`** | **Email omitted**; UI uses **display name**.                                                   |
| **Admin user list**        | **Name**, role, tenant access — **not** login email.                                           |
| **Invite preview**         | Invited **email** shown only to callers who have the **secret token** (UX for the registrant). |

### Multi-tenancy & authorization

| Control               | Detail                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| **`X-Tenant-Id`**     | Required for tenant-scoped APIs; validated as **UUID**.                                                        |
| **Tenant allow-list** | Users with **assignment rows** may only use those tenants; **no rows** = all tenants (`auth/dependencies.py`). |
| **PostgreSQL RLS**    | Tenant isolation at the database layer.                                                                        |
| **Admin APIs**        | User management & invitations require **`require_admin`**.                                                     |

### Invite email delivery

| Control              | Detail                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| **`RESEND_API_KEY`** | **Required** — missing key → **503** on invite; **no** invite URL returned in JSON as a fallback. |

### CORS & secrets

| Control            | Detail                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------- |
| **`CORS_ORIGINS`** | Comma-separated allowlist.                                                                    |
| **Secrets**        | DB, Redis, JWT, Resend — via **`.env`** (see **`.env.example`**); do not commit real secrets. |

## Orders & inventory

Orders use four **statuses** (`created`, `pending`, `confirmed`, `cancelled`):

| Status          | Meaning                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **`pending`**   | Placed when **current stock is below the requested quantity** at creation time. No stock reserved.              |
| **`created`**   | Placed when **stock was sufficient** at creation time. Still **no deduction** until someone clicks **Confirm**. |
| **`confirmed`** | User confirmed the order; **stock is reduced** by the requested quantity.                                       |
| **`cancelled`** | Cancelled before confirmation; **inventory unchanged**.                                                         |

**Rules:**

- **Create order** — Never changes inventory. Status is `pending` or `created` only.
- **Confirm** — Allowed for `pending` and `created`. If current stock ≥ requested quantity, stock is deducted and status becomes **`confirmed`**. If not enough stock, the API returns an error.
- **Cancel** — Only for `pending` or **`created`**. **Confirmed** orders **cannot** be cancelled (no “Cancel order” in the UI; API returns 409).
- **Delete** — If the order is **`confirmed`**, its quantity is **added back** to inventory before the row is removed. Unconfirmed orders are deleted without inventory changes.

Existing databases created before this flow should run migrations: legacy rows in status `created` that had already been treated as “fulfilled” are migrated to **`confirmed`** so inventory stays consistent.

## Resetting the database (Docker)

Remove volumes so PostgreSQL and Redis start empty. On the next `docker compose up --build`, **`alembic upgrade head`** runs when the API starts, and if **`SEED_ON_STARTUP=true`**, the seed runs on an empty database.

```bash
docker compose down -v
docker compose up --build
```

## Running Tests

```bash
docker compose exec api pytest
```

From `backend/` with test extras installed: `pip install -e ".[test]"` then `pytest tests/test_orders.py -v` (order lifecycle tests use mocks and do not require Postgres).

## API Docs

`http://localhost/api/docs`
