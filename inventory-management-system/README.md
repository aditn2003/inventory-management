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

The seed script runs automatically on first startup.

## Default Credentials

| Role  | Email            | Password   |
|-------|------------------|------------|
| Admin | admin@ims.com    | admin123!  |
| User  | user@ims.com     | user123!   |

## Architecture

```
inventory-management-system/
├── backend/          FastAPI 3.12 — REST API
│   ├── app/
│   │   ├── auth/     JWT auth, bcrypt, Redis blacklist
│   │   ├── tenants/  Multi-tenant CRUD (TEN-XXX IDs)
│   │   ├── products/ Product CRUD (SKU immutable)
│   │   ├── inventory/Inventory + stock management
│   │   ├── orders/   Orders + state machine (created/pending/cancelled)
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

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 18, Vite, TypeScript, Tailwind CSS |
| State       | Redux Toolkit                     |
| Forms       | react-hook-form + zod             |
| HTTP client | Axios (JWT + X-Tenant-Id interceptors) |
| Backend     | Python 3.12 + FastAPI             |
| ORM         | SQLAlchemy 2.0 (asyncio)          |
| DB          | PostgreSQL 16 with RLS            |
| Cache       | Redis 7 (token blacklist + rate limiting) |
| Auth        | JWT (access 15m + refresh 7d)     |
| Proxy       | Nginx                             |
| Containers  | Docker Compose                    |

## Key Features

- **Multi-tenancy**: Row-Level Security enforced at DB level; tenant selected via header dropdown
- **RBAC**: Admin (full access) vs User (CRUD on tenant-scoped data)
- **Order state machine**: created / pending / cancelled with automatic stock deduction/restoration
- **Inventory management**: Auto-created on product creation; Reset Stock action (distinct from delete)
- **Display IDs**: TEN-001 (tenants), ORD-1001 (per-tenant orders)
- **JWT rotation**: Refresh token rotated on every refresh; Redis blacklist for real logout

## Running Tests

```bash
docker compose exec api pytest
```

## API Docs

```
http://localhost/api/docs
```
