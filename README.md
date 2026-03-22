# Inventory Management System (IMS)

Full-stack **multi-tenant** inventory app: **FastAPI** + **PostgreSQL** (RLS) + **Redis** (auth/session helpers) + **React** (Vite, Tailwind) behind **Nginx**.

---

## Table of contents

- [Quick start](#quick-start)
- [What the app does](#what-the-app-does)
- [Default credentials](#default-credentials)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Frontend application](#frontend-application)
- [Backend domain rules](#backend-domain-rules)
- [REST API reference](#rest-api-reference)
- [Authentication & multi-tenancy](#authentication--multi-tenancy)
- [Environment variables](#environment-variables)
- [Security (summary)](#security-summary)
- [Orders & inventory lifecycle](#orders--inventory-lifecycle)
- [Database & seed data](#database--seed-data)
- [Testing, lint & CI](#testing-lint--ci)
- [API documentation (OpenAPI)](#api-documentation-openapi)
- [Resetting the database](#resetting-the-database-docker)

---

## Quick start

```bash
# 1. Copy and configure environment variables
cp .env.example .env
# Edit .env if needed (defaults work for local Docker)

# 2. Start all services
docker compose up --build

# 3. Open the app
http://localhost
```

- **API (via Nginx):** `http://localhost/api/...`
- **OpenAPI UI:** `http://localhost/api/docs` (ReDoc: `/api/redoc`, JSON: `/api/openapi.json`)

The seed script runs when `SEED_ON_STARTUP=true` (see `.env.example`) and the DB is ready.

After schema changes: run **`alembic upgrade head`** in the API container or from `backend/` locally.

---

## What the app does

| Area              | Capabilities                                                                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenants**       | Admin CRUD; each tenant has a display id (e.g. `TEN-001`), name, active/inactive status.                                                                                                                                                     |
| **Products**      | SKU, name, category, unit, cost, reorder threshold, active/inactive; **inventory row auto-created** with product. Categories/units support **creatable combobox** on edit (add new values from UI when allowed).                             |
| **Inventory**     | Per-product stock; list/detail; **quick update** of current quantity; attention summary when below reorder.                                                                                                                                  |
| **Orders**        | Create with product + quantity; statuses `created` \| `pending` \| `confirmed` \| `cancelled`; **confirm** deducts stock; **cancel** before confirm; **delete** restores stock if was confirmed. Filters, search, sort, pagination on lists. |
| **Users (admin)** | List users, invite by email (Resend), change role, **tenant access** checkboxes, delete user.                                                                                                                                                |
| **Auth**          | Email/password login, JWT access + refresh, logout (Redis blacklist), optional **Google OAuth**, invite registration.                                                                                                                        |

---

## Default credentials

| Role  | Email (login only) | Display name         | Password  |
| ----- | ------------------ | -------------------- | --------- |
| Admin | admin@ims.com      | System Administrator | admin123! |
| User  | user@ims.com       | Demo User            | user123!  |

Emails are **not** shown in the UI after login; the header and user lists use **display names** only.

### Inviting users (admin)

**Users → Invite user:** enter an email. The API creates an invite and sends a **Resend** email with a link to `/register/invite?token=…` where the user sets **name** and **password** (role **user**).

Configure in `.env`:

- **`RESEND_API_KEY`** — required; invitations return **503** if unset.
- **`RESEND_FROM_EMAIL`** — verified sender.
- **`PUBLIC_APP_URL`** — SPA base URL for links (e.g. `http://localhost`).

---

## Architecture

CI workflows: **`<repo-root>/.github/workflows/`** (repository root, not inside `inventory-management-system/`).

```
inventory-management-system/
├── backend/                 # FastAPI — REST API under /api/v1
│   ├── app/
│   │   ├── auth/            # JWT, bcrypt, invites, Google OAuth, Redis deps
│   │   ├── tenants/       # Multi-tenant CRUD (TEN-XXX display ids)
│   │   ├── products/      # Product CRUD; SKU immutable after create
│   │   ├── inventory/     # Stock per product; PATCH for quantity
│   │   ├── orders/        # Orders + confirm/cancel/delete semantics
│   │   ├── users/         # Admin user management + tenant assignments
│   │   ├── email/         # Resend integration (invite emails)
│   │   ├── seed.py        # Optional startup seed (see below)
│   │   └── main.py        # App factory, router registration, /health
│   ├── alembic/           # Migrations
│   ├── tests/             # pytest (integration + unit)
│   └── pyproject.toml
├── frontend/               # React 18 + Vite + TypeScript
│   └── src/
│       ├── api/             # Axios client + per-resource modules
│       ├── store/           # Redux Toolkit (auth slice)
│       ├── contexts/        # Theme (light/dark)
│       ├── hooks/           # Data fetching, tenant, auth
│       ├── components/      # Layout, tables, forms, UI primitives
│       └── pages/         # Route-level screens
├── nginx/                   # Reverse proxy; rate limits; /api → API, / → Vite
└── docker-compose.yml       # nginx, api, frontend, db, redis
```

**Backend source layout:** Each domain under `app/<name>/` usually has `router.py` (HTTP), `service.py` (business rules), `repository.py` (SQLAlchemy), `schemas.py` (request/response models), and `models.py` (ORM). File-level docstrings describe what belongs in that module.

---

## Technology stack

| Layer      | Technology                                                                               |
| ---------- | ---------------------------------------------------------------------------------------- |
| Frontend   | React 18, Vite 5, TypeScript, Tailwind CSS                                               |
| UI         | `@phosphor-icons/react`, `sonner` (toasts), `recharts` (dashboard charts)                |
| State      | Redux Toolkit (`auth`; tenant context via hooks + `localStorage`)                        |
| Forms      | `react-hook-form` + `zod` + `@hookform/resolvers`                                        |
| HTTP       | Axios (JWT + `X-Tenant-Id` interceptors)                                                 |
| Backend    | Python 3.12, FastAPI                                                                     |
| ORM        | SQLAlchemy 2.0 (async)                                                                   |
| DB         | PostgreSQL 16 (RLS for tenant isolation)                                                 |
| Redis      | **Not used for application caching** — token blacklist, OAuth state, login rate limiting |
| Auth       | JWT (access + refresh), optional Google OAuth                                            |
| Proxy      | Nginx                                                                                    |
| Containers | Docker Compose                                                                           |

---

## Frontend application

### Routing (authenticated)

| Path                                                                | Role      | Description                                                                |
| ------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------- |
| `/`                                                                 | All       | Dashboard (tenant-scoped KPIs, charts, recent orders when tenant selected) |
| `/tenants`, `/tenants/new`, `/tenants/:id`, `/tenants/:id/edit`     | **Admin** | Tenants                                                                    |
| `/products`, `/products/new`, `/products/:id`, `/products/:id/edit` | All       | Products                                                                   |
| `/inventory`, `/inventory/:id`                                      | All       | Inventory                                                                  |
| `/orders`, `/orders/new`, `/orders/:id`, `/orders/:id/edit`         | All       | Orders                                                                     |
| `/users`, `/users/new`, `/users/:id`                                | **Admin** | Users & invites                                                            |

Public routes: `/login`, `/auth/oauth-callback`, `/register/invite`.

### Key UX behaviors

- **Theme:** Light/dark toggle (persisted); Tailwind `class` dark mode; orange primary palette.
- **Tenant selection:** Searchable header dropdown; **`X-Tenant-Id`** sent on tenant-scoped API calls. Without a tenant, dashboard shows a **select tenant** prompt (no tenant-scoped KPIs).
- **Sidebar:** Collapsible; **IMS** / logo expands when collapsed.
- **Lists:** Sortable columns where implemented; **pagination** only when total pages > 1.
- **Products:** Pagination; category/unit **creatable combobox** on edit.
- **Orders:** Summary tiles (totals by status); **status filter pills**; **Created** status uses **sky blue** styling consistently with dashboard (badges, tiles, bar chart).
- **Order detail:** Requested quantity **white** when stock covers the request; **red** when insufficient; **muted** when cancelled; **Confirm** / **Delete** styled as secondary outline buttons.
- **Users detail:** User **name** in header only; info cards show **Role**, **Tenant access**, **Joined** (no duplicate name card or role subtitle).

---

## Backend domain rules

### Order creation (business rule)

When an order is **created**, stock is **not** reserved or deducted. Initial status:

- **`current_stock >= requested_qty`** → **`created`**
- **`current_stock < requested_qty`** → **`pending`**

Seed data uses the same rule. Full status semantics: [Orders & inventory lifecycle](#orders--inventory-lifecycle).

---

## REST API reference

Base path (behind Nginx): **`/api/v1`**. Tenant-scoped routes need **`Authorization`** and **`X-Tenant-Id`** as described in [Authentication & multi-tenancy](#authentication--multi-tenancy).

### Auth — `/api/v1/auth`

| Method | Path                     | Auth | Description                                                     |
| ------ | ------------------------ | ---- | --------------------------------------------------------------- |
| GET    | `/google/status`         | No   | Returns whether Google OAuth is configured.                     |
| GET    | `/google/start`          | No   | Starts Google OAuth (optional `invite_token`).                  |
| GET    | `/google/callback`       | No   | OAuth redirect handler.                                         |
| POST   | `/google/complete`       | No   | Exchanges code for app tokens (body).                           |
| POST   | `/register`              | No   | Register new user (open registration if enabled by app policy). |
| GET    | `/invite/preview`        | No   | Preview invite by `token` query.                                |
| POST   | `/register-invite`       | No   | Complete registration with invite token.                        |
| POST   | `/login`                 | No   | Login; returns tokens + user.                                   |
| POST   | `/refresh`               | No   | Refresh access token (rotation).                                |
| POST   | `/logout`                | Yes  | Logout; blacklist refresh token.                                |
| GET    | `/me`                    | Yes  | Current user (no email in response for privacy).                |
| GET    | `/me/accessible-tenants` | Yes  | Tenants the user may access.                                    |

### Tenants — `/api/v1/tenants` (typically **admin**)

| Method | Path           | Description                              |
| ------ | -------------- | ---------------------------------------- |
| GET    | ``             | List tenants (pagination, sort, search). |
| POST   | ``             | Create tenant.                           |
| GET    | `/{tenant_id}` | Get tenant.                              |
| PUT    | `/{tenant_id}` | Update tenant.                           |
| DELETE | `/{tenant_id}` | Delete tenant.                           |

### Products — `/api/v1/products`

| Method | Path            | Description                    |
| ------ | --------------- | ------------------------------ |
| GET    | ``              | List products (`X-Tenant-Id`). |
| POST   | ``              | Create product (+ inventory).  |
| GET    | `/{product_id}` | Get product.                   |
| PUT    | `/{product_id}` | Update product.                |
| DELETE | `/{product_id}` | Delete product.                |

### Inventory — `/api/v1/inventory`

| Method | Path              | Description                                      |
| ------ | ----------------- | ------------------------------------------------ |
| GET    | ``                | List inventory rows.                             |
| GET    | `/{inventory_id}` | Get one row.                                     |
| PATCH  | `/{inventory_id}` | Update quantity (and related fields per schema). |
| DELETE | `/{inventory_id}` | Delete inventory row.                            |

### Orders — `/api/v1/orders`

| Method | Path                  | Description                                                                                                                             |
| ------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | ``                    | List orders; query params: `page`, `page_size`, `q`, `sort_by`, `sort_dir`, `status`. Response includes **`summary`** counts by status. |
| POST   | ``                    | Create order (body: product_id, requested_qty, notes).                                                                                  |
| GET    | `/{order_id}`         | Get order with product + inventory.                                                                                                     |
| PUT    | `/{order_id}`         | Update unconfirmed order (qty/notes per rules).                                                                                         |
| DELETE | `/{order_id}`         | Delete order (restores stock if was confirmed).                                                                                         |
| POST   | `/{order_id}/confirm` | Confirm order (deducts stock).                                                                                                          |
| POST   | `/{order_id}/cancel`  | Cancel if pending/created.                                                                                                              |

### Users — `/api/v1/users` (**admin**)

| Method | Path                       | Description                              |
| ------ | -------------------------- | ---------------------------------------- |
| GET    | ``                         | List users.                              |
| POST   | `/invitations`             | Create invite (email).                   |
| GET    | `/{user_id}`               | User detail + assignments.               |
| PUT    | `/{user_id}`               | Update user **role** (`UserRoleUpdate`). |
| DELETE | `/{user_id}`               | Delete user.                             |
| GET    | `/{user_id}/tenants`       | Tenant briefs for assignments.           |
| PUT    | `/{user_id}/tenant-access` | Set `tenant_ids` (empty = all tenants).  |

### Health

| Method | Path      | Description                                                                        |
| ------ | --------- | ---------------------------------------------------------------------------------- |
| GET    | `/health` | Liveness: `{ "status": "ok" }` (no `/api` prefix on backend; exposed via service). |

---

## Authentication & multi-tenancy

Protected routes use **`Authorization: Bearer <access_token>`**. Tenant-scoped routes (products, inventory, orders) also require **`X-Tenant-Id: <uuid>`**. The server validates access against **RLS** and the user’s **tenant assignments** (no rows = all tenants; otherwise allow-list only).

---

## Environment variables

See **`.env.example`** for the full list. Important keys:

| Variable                          | Purpose                                         |
| --------------------------------- | ----------------------------------------------- |
| `DATABASE_URL`                    | Async SQLAlchemy URL (Postgres in Docker).      |
| `REDIS_URL`                       | Redis with password.                            |
| `JWT_SECRET`                      | Signing key for JWTs (use a long random value). |
| `SEED_ON_STARTUP`                 | If `true`, run seed when DB is empty.           |
| `CORS_ORIGINS`                    | Allowed browser origins (comma-separated).      |
| `PUBLIC_APP_URL`                  | Public SPA URL (emails, OAuth redirects).       |
| `RESEND_*`, `INVITE_EXPIRE_HOURS` | Email invites.                                  |
| `GOOGLE_OAUTH_*`                  | Optional Google sign-in.                        |

---

## Security (summary)

**Nginx:** rate limits (stricter on `/api/v1/auth/*` and OAuth), security headers, client IP forwarding — see **`nginx/nginx.conf`**. **Backend:** bcrypt passwords; JWT access + refresh with rotation; **Redis** blacklist on logout; generic login errors; **hashed invite tokens**; **PostgreSQL RLS** — see **`app/auth/`**.

---

## Orders & inventory lifecycle

Orders use statuses **`created`**, **`pending`**, **`confirmed`**, **`cancelled`**:

| Status      | Meaning                                                            |
| ----------- | ------------------------------------------------------------------ |
| `pending`   | At creation, **insufficient** stock for requested quantity.        |
| `created`   | At creation, **sufficient** stock; nothing deducted until confirm. |
| `confirmed` | Stock **deducted** by requested quantity.                          |
| `cancelled` | Cancelled before confirmation; inventory unchanged.                |

- **Confirm:** Allowed for `pending` and `created` if current stock ≥ requested quantity.
- **Cancel:** Not allowed for `confirmed` (API/UI).
- **Delete:** If `confirmed`, quantity is **returned** to inventory before delete.

Legacy DBs may have been migrated so old “fulfilled” semantics align with **`confirmed`** (see Alembic history).

---

## Database & seed data

- **Migrations:** Alembic (`backend/alembic/`).
- **Seed:** `app/seed.py` — demo users, tenants, products, inventory, orders (statuses follow the same stock rule as the API).

Full reset: [Resetting the database](#resetting-the-database-docker), then start with `SEED_ON_STARTUP=true` if you want seed data.

---

## Testing, lint & CI

### Local

From **`inventory-management-system/backend`** (install test extras once):

```bash
pip install -e ".[test]"

ruff check app
# optional: ruff check app --fix

pytest --cov=app --cov-config=.coveragerc --cov-report=term-missing
```

Pytest from the API container (image installs runtime deps only; **Ruff** is not in that image — use local `pip install -e ".[test]"` for lint):

```bash
docker compose exec api pytest
```

**Coverage:** **`backend/.coveragerc`** omits **`seed.py`**, **`app/email/*`**, and **`app/auth/oauth_google.py`** (non-deterministic / external). The suite focuses on routers, services, and repositories.

### GitHub Actions

Workflow: **`<repo-root>/.github/workflows/tests.yml`**, `working-directory: inventory-management-system/backend`. The Git repository root should contain both **`.github/`** and **`inventory-management-system/`**.

On push/PR to `main` or `master`: Python 3.12 → `pip install -e ".[test]"` → `ruff check app` → `pytest --cov=app --cov-fail-under=75` → upload `coverage.xml` as an artifact.

---

## API documentation (OpenAPI)

When the stack is up, same URLs as [Quick start](#quick-start): **`/api/docs`**, **`/api/redoc`**, **`/api/openapi.json`** (via Nginx on port 80).

---

## Resetting the database (Docker)

Remove volumes so PostgreSQL and Redis start empty. On the next `docker compose up --build`, migrations run and, if **`SEED_ON_STARTUP=true`**, seed runs on an empty database.

```bash
docker compose down -v
docker compose up --build
```

---

## License / assignment

Built as an interview / portfolio project. The original brief and wireframe references are in **`Assignment-Requirement-Document.md`** (this implementation uses FastAPI/React instead of Node where noted). Adjust the license section per your repository policy.
