# Inventory Management System — Architecture & Implementation Plan

> **Purpose**: This document is the single source of truth for building the IMS.
> Hand this to Cursor (or any AI coding agent) and follow it phase by phase.

---

## 1. Global UI Shell (applies to EVERY page)

This is the most important frontend requirement. Every single page in the app shares an identical outer shell. Build this FIRST as a reusable layout component.

### Sidebar (left, fixed, w-64)

- White background, right border (gray-200)
- **Brand header** (h-16, border-bottom): Text "Inventory Management System" in blue-600, font-bold
- **Navigation links** (4 items, stacked vertically, px-4 py-4 spacing):
  1. Tenants — icon: `ph ph-buildings`
  2. Products — icon: `ph ph-package`
  3. Inventory — icon: `ph ph-stack`
  4. Orders — icon: `ph ph-shopping-cart`
- **Active state**: blue-600 text + blue-50 background + rounded-lg
- **Inactive state**: gray-700 text + hover:bg-gray-100
- Icons use **Phosphor Icons** (`@phosphor-icons/web`, regular weight)

### Top header bar (full width of content area, h-16)

- White background, bottom border (gray-200)
- **Left side**: empty (no global search bar)
- **Right side**: notification bell icon (`ph ph-bell`, gray-400) + user avatar circle
- **User avatar**: 32×32px circle, blue-500 background, white text, shows user initials (e.g., "JD"), font-bold

### Content area

- Background: gray-50
- Full height minus header, overflow-y: auto (scrollable)
- Padding: p-8 (32px all sides)
- Page content renders here

### Technology for the shell

- **React 18** with a `<Layout>` wrapper component that renders sidebar + header + `<Outlet />` for page content
- **React Router v6**: nested routes under the layout
- **Tailwind CSS** for all styling (the wireframes already use Tailwind classes — match them exactly)
- **Phosphor Icons**: import from `@phosphor-icons/react` for the React build

---

## 2. Functional Requirements — Page-by-Page Audit

Below is an exhaustive inventory of what EVERY wireframe page requires. Nothing is omitted.

### 2.1 Tenant List (`/tenants`)

**Header row**: Title "Tenants" (left) + `+ New Tenant` button (right, blue-600). NO tenant dropdown selector (tenants page shows ALL tenants).

**Summary tiles** (2 tiles, grid-cols-2):
| Tile | Color dot | Value | Subtitle |
|------|-----------|-------|----------|
| Total Tenants | red-500 | count | "tracked tenants" |
| Active / In-Active | green-500 | "24 / 10" format | "healthy status" |

**List table** columns: Tenant ID (TEN-001 format), Tenant Name, Status (badge), Actions (three-dot menu).
- **Status badges**: Active = green-100/green-700 pill; Inactive = gray-100/gray-600 pill
- **Row click**: navigates to tenant list (NOTE: wireframes have NO tenant detail page — row click stays on list. Implement as a no-op or optionally build a detail page.)
- **Action menu** (three-dot, hover-reveal): View, Edit, Delete (red text)
- **Search**: text input with magnifying glass icon, placeholder "Search tenants..."
- **Sort**: dropdown — "Name (A-Z)", "Status"
- **Pagination**: "Showing 1 to 10 of N results" + Previous / page numbers / Next

### 2.2 Tenant Create/Edit (`/tenants/new`, `/tenants/:id/edit`)

**Header**: Back arrow → `/tenants` + title "Create Tenant" / subtitle "Add a new tenant to the system" + Cancel & Save buttons
- Cancel → `/tenants`
- Save → `/tenants`

**Form fields** (single form card, max-w-3xl centered):
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Tenant Name | text input | Yes | placeholder: "e.g. Stark Industries" |

**Business rule**: Status defaults to "Active" on creation. There is no status field on the create form. (If editing, consider adding a status toggle like the product edit form has.)

### 2.3 Product List (`/products`)

**Header row**: Title "Products" (left) + Tenant dropdown selector + `+ New Product` button (right)
- **Tenant dropdown**: "Select Tenant..." default, lists all tenants user has access to. Selecting a tenant filters the entire page.

**Summary tiles** (2 tiles, grid-cols-2):
| Tile | Color dot | Value | Subtitle |
|------|-----------|-------|----------|
| Total Products | blue-500 | count | "catalog items" |
| Active / In-Active | green-500 | "110 / 18" format | "product status" |

**List table** columns: Name, SKU, Category, Status (badge), Actions
- **Status badges**: Active = green-100/green-700; Inactive = gray-100/gray-600
- **Row click** → `/products/:id` (product detail)
- **Action menu**: View, Edit, Delete

Standard search (placeholder: "Search products..."), sort (Name A-Z, Status), pagination.

### 2.4 Product Detail (`/products/:id`)

**Back link**: "Back to Products" → `/products`
**Action buttons** (top right): Edit (pencil icon → `/products/:id/edit`), Delete (trash icon)

**Header card**:
- **Tenant initial avatar**: 48×48 circle, red-100 bg, red-600 text, shows first letter of tenant name
- **Product name**: text-2xl font-bold, gray-900 (NOT a link)
- **Status badge**: Active/Inactive pill
- **Subtitle**: "SKU: ADH-100  |  Tenant: Acme Corp"

**Info cards** (4 cards, grid-cols-4):
| Card | Value format |
|------|-------------|
| Category | e.g. "Chemicals" |
| Cost per Unit | e.g. "$180.00" |
| Current Stock (Inventory) | e.g. "45 kg" in **blue-600** text |
| Reorder Point | e.g. "25 kg" |

**Additional Information section** (card with gray-50 header):
- **Description**: paragraph of product description text
- **Inventory Quick Update**: number input (prefilled with current stock) + "Update Stock" button. This allows inline stock changes without navigating to the inventory edit page.

### 2.5 Product Edit (`/products/:id/edit`, `/products/new`)

**Header**: Back arrow → `/products/:id` + "Edit Product" / "Update product details for [Tenant]" + Cancel & Save
- Cancel → `/products/:id`
- Save → `/products/:id`

**Form fields** (max-w-3xl centered):
| Field | Type | Required | Editable | Notes |
|-------|------|----------|----------|-------|
| SKU | text | Yes | **Read-only on edit** (gray bg) | Helper text: "SKU cannot be changed after creation." Editable on create. |
| Product Name | text | Yes | Yes | |
| Description | textarea (3 rows) | No | Yes | |
| Category | dropdown | Yes | Yes | Options: Metals, Chemicals, Plastics |
| Reorder Threshold | number | Yes | Yes | |
| Cost per Unit | number (step 0.01) | Yes | Yes | Dollar sign prefix ($) |
| Status | toggle switch | No | Yes | Defaults to Active. Label shows "Active"/"Inactive" |

### 2.6 Inventory List (`/inventory`)

**Header row**: Title "Inventory" (left) + Tenant dropdown selector (right). **NO create button** — inventory rows are auto-created when products are created.

**Summary tiles** (1 tile only, grid-cols-1):
| Tile | Color dot | Value | Subtitle |
|------|-----------|-------|----------|
| Below Reorder Threshold | red-500 | count (red-600 text) | "products require immediate purchasing" |

**List table** columns: Product Name, SKU, Cost per Unit, Current Stock, Reorder Threshold, Actions
- **CRITICAL COLOR RULE for Current Stock column**:
  - Stock **≥** reorder threshold → **blue-600 font-bold** (healthy)
  - Stock **<** reorder threshold → **red-600 font-bold** (alert)
- **Row click** → `/inventory/:id` (inventory detail)
- **Action menu**: View, Edit, Delete

Standard search, sort, pagination.

### 2.7 Inventory Detail (`/inventory/:id`)

**Back link**: "Back to Inventory" → `/inventory`
**Action buttons**: Edit → `/inventory/:id/edit`, Delete

**Header card**:
- Tenant initial avatar (same pattern as product detail)
- **Product name is a CLICKABLE LINK** (blue-600, hover:underline) → navigates to `/products/:id`. This is a cross-entity navigation.
- Status badge + subtitle "SKU: ADH-100  |  Tenant: Acme Corp"

**Info cards** (4 cards, grid-cols-4): Category, Cost per Unit, Current Stock (blue-600), Reorder Point

**Additional Information**: Description + **Inventory Quick Update** (same inline widget as product detail)

### 2.8 Inventory Edit (`/inventory/:id/edit`)

**Header**: Back arrow → `/inventory/:id` + "Update Inventory" / "Update stock levels for [Product Name]" + Cancel & Save
- Cancel → `/inventory/:id`
- Save → `/inventory/:id`

**Form fields**:
| Field | Type | Required | Editable |
|-------|------|----------|----------|
| Product Name | text | — | **Read-only** (gray bg) |
| SKU | text | — | **Read-only** (gray bg) |
| Current Stock | number | Yes | Yes |

### 2.9 Order List (`/orders`)

**Header row**: Title "Orders" (left) + Tenant dropdown + `+ New Order` button (right)

**Summary tiles** (3 tiles, grid-cols-3):
| Tile | Color dot | Value | Subtitle |
|------|-----------|-------|----------|
| Total Orders | gray-700 | count | "all time orders" |
| Total Pending | yellow-500 | count | "awaiting inventory" |
| Total Created | green-500 | count | "successfully processed" |

**List table** columns: Order ID (ORD-1001 format), Product, Qty, Status (badge), Date (YYYY-MM-DD), Actions
- **Status badges**: Created = green-100/green-700; Pending = yellow-100/yellow-700
- **Row click** → `/orders/:id`
- **Action menu**: View, Edit, Delete

Standard search, sort, pagination.

### 2.10 Order Detail (`/orders/:id`)

**Back link**: "Back to Orders" → `/orders`
**Action buttons**: Edit, Delete

**Header card**:
- Tenant initial avatar
- Title: "Order ORD-1001" (gray-900, NOT a link)
- Status badge: "Active" (green pill)
- Subtitle: "Product: [Product Name as LINK to product detail]  |  Tenant: Acme Corp"

**Info cards** (4 cards, grid-cols-4):
| Card | Notes |
|------|-------|
| Requested Quantity | e.g. "10" |
| Cost per Unit | from the product |
| Current Stock (Inventory) | from inventory, blue-600 |
| Reorder Point | from the product |

**Additional Information**: "Order Notes" section (e.g., "Please process ASAP."). No Inventory Quick Update on this page.

### 2.11 Order Create (`/orders/new`)

**Header**: Back arrow → `/orders` + "Create Order" / "Create a new order for [Tenant]" + Cancel & Save
- Cancel → `/orders`
- Save → `/orders`

**Form fields**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Select Product | dropdown | Yes | Shows "[Name] (Active)" for active products. **Inactive products shown but disabled** (grayed out, not selectable). |
| Requested Quantity | number | Yes | Default value: 1 |

**NOTE**: Wireframe has no notes field on create form, but order detail shows notes. Implementation should include an optional notes textarea on the create/edit form for completeness.

---

## 3. Cross-Entity Navigation Map

These links connect entities to each other. Cursor must implement them as React Router `<Link>` elements.

```
Inventory Detail  →  Product Detail     (product name is a clickable blue link)
Order Detail      →  Product Detail     (product name is a clickable blue link in subtitle)
Product Detail    →  Product Edit       (Edit button)
Inventory Detail  →  Inventory Edit     (Edit button)
Order Detail      →  Order Edit         (Edit button)
All List pages    →  Detail pages       (row click)
All List pages    →  Edit pages         (action menu → Edit)
```

---

## 4. Display ID Generation

The wireframes show human-readable IDs alongside database UUIDs:

| Entity | Format | Example | Generation rule |
|--------|--------|---------|----------------|
| Tenant | TEN-XXX | TEN-001 | Sequential, zero-padded, per-system |
| Order | ORD-XXXX | ORD-1001 | Sequential, zero-padded, per-tenant |

Products and inventory use SKU (user-provided) as the display identifier, not a generated ID.

**Implementation**: Store as a separate `display_id` VARCHAR column. Use a database sequence or application-level counter. The UUID remains the primary key for all joins and API references.

---

## 5. Data Model

### Entity-Relationship Summary

```
USERS ──┬── USER_TENANT_ROLES ──┬── TENANTS
        │                        │
        │                        ├── PRODUCTS ──── INVENTORY (1:1)
        │                        │
        │                        └── ORDERS ────── PRODUCTS (many:1)
```

### Table Definitions

**users**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| is_superadmin | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

**tenants**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| display_id | VARCHAR(20) | UNIQUE, NOT NULL (e.g., "TEN-001") |
| name | VARCHAR(255) | UNIQUE, NOT NULL |
| status | VARCHAR(20) | DEFAULT 'active', CHECK IN ('active', 'inactive') |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |
| deleted_at | TIMESTAMPTZ | NULL (soft delete) |

**user_tenant_roles**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users(id), NOT NULL |
| tenant_id | UUID | FK → tenants(id), NOT NULL |
| role | VARCHAR(20) | CHECK IN ('admin', 'manager', 'viewer'), NOT NULL |
| | | UNIQUE(user_id, tenant_id) |

**products**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants(id), NOT NULL |
| sku | VARCHAR(50) | NOT NULL, UNIQUE(tenant_id, sku) |
| name | VARCHAR(255) | NOT NULL |
| description | TEXT | NULL |
| category | VARCHAR(50) | NOT NULL, CHECK IN ('Metals', 'Chemicals', 'Plastics') |
| cost_per_unit | DECIMAL(12,2) | NOT NULL |
| reorder_threshold | INTEGER | NOT NULL |
| status | VARCHAR(20) | DEFAULT 'active', CHECK IN ('active', 'inactive') |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |
| deleted_at | TIMESTAMPTZ | NULL |

**inventory** (1:1 with products, auto-created)
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| product_id | UUID | FK → products(id), UNIQUE, NOT NULL |
| tenant_id | UUID | FK → tenants(id), NOT NULL |
| current_stock | INTEGER | NOT NULL, DEFAULT 0 |
| unit | VARCHAR(20) | DEFAULT 'units' (e.g., "kg", "sheets") |
| last_updated | TIMESTAMPTZ | DEFAULT now() |

**orders**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| display_id | VARCHAR(20) | UNIQUE per tenant (e.g., "ORD-1001") |
| tenant_id | UUID | FK → tenants(id), NOT NULL |
| product_id | UUID | FK → products(id), NOT NULL |
| requested_qty | INTEGER | NOT NULL, CHECK > 0 |
| status | VARCHAR(20) | DEFAULT 'created', CHECK IN ('created', 'pending') |
| notes | TEXT | NULL |
| order_date | DATE | DEFAULT CURRENT_DATE |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |
| deleted_at | TIMESTAMPTZ | NULL |

### Key Indexes

```sql
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE UNIQUE INDEX idx_products_tenant_sku ON products(tenant_id, sku);
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

CREATE INDEX idx_inventory_tenant ON inventory(tenant_id);
CREATE INDEX idx_inventory_product ON inventory(product_id);

CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_date ON orders(tenant_id, order_date DESC);
CREATE INDEX idx_orders_product ON orders(product_id);
```

### Row-Level Security (RLS)

Apply to all tenant-scoped tables (products, inventory, orders):

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_products ON products
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_inventory ON inventory
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_orders ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

The API sets `app.current_tenant_id` on each DB session via middleware BEFORE any query runs.

### Soft Deletes

All entities except user_tenant_roles use `deleted_at TIMESTAMPTZ NULL`. A SQLAlchemy default filter excludes rows where `deleted_at IS NOT NULL`. Delete endpoints set `deleted_at = now()` instead of removing the row.

---

## 6. Business Rules (exhaustive)

| # | Rule | Where enforced |
|---|------|----------------|
| 1 | **Tenant isolation**: users see only data for their selected tenant | DB (RLS) + API middleware |
| 2 | **SKU immutability**: SKU cannot be changed after product creation | API validation (reject PUT if SKU differs) |
| 3 | **Inventory auto-creation**: creating a product auto-creates an inventory row with stock = 0 | API service layer (DB transaction) |
| 4 | **Inventory cascade delete**: deleting a product deletes its inventory row | DB foreign key ON DELETE CASCADE + soft-delete logic |
| 5 | **Active product gate**: only active products selectable when creating an order | API validation + frontend dropdown disables inactive |
| 6 | **Reorder alert coloring**: inventory list shows stock in red when below threshold, blue when at/above | Frontend conditional class |
| 7 | **Reorder alert tile**: inventory list summary tile counts products below their reorder threshold | API computes server-side in summary response |
| 8 | **Order status values**: 'created' (green) or 'pending' (yellow) | DB CHECK constraint + API validation |
| 9 | **Display ID generation**: tenants get TEN-XXX, orders get ORD-XXXX auto-generated IDs | API service layer on create |
| 10 | **Tenant status default**: new tenants default to 'active' status | DB DEFAULT + API |
| 11 | **Category enum**: product categories are fixed: Metals, Chemicals, Plastics | DB CHECK + frontend dropdown |
| 12 | **Inventory Quick Update**: product detail AND inventory detail both allow inline stock update | Two frontend components hitting same PATCH /inventory/:id |
| 13 | **No inventory create button**: inventory list has no "New" button; inventory is only created via product creation | Frontend (omit button) + API (no POST /inventory) |
| 14 | **Cross-entity links**: inventory detail links product name to product detail; order detail links product name to product detail | Frontend React Router Links |

---

## 7. API Design

### Conventions

- RESTful, JSON, all routes under `/api/v1/`
- Tenant scoping via `X-Tenant-Id` header (validated against JWT claims)
- Standard HTTP codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500
- Pagination: `?page=1&page_size=10&sort=name&order=asc`
- Search: `?q=adhesive`
- Response envelope: `{ "data": [...], "meta": { "total": N, "page": 1, "page_size": 10 }, "summary": { ... } }`

### Endpoints

#### Auth (no tenant scoping)
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login            → { access_token, refresh_token }
POST   /api/v1/auth/refresh           → rotates both tokens
POST   /api/v1/auth/logout            → blacklists refresh token
GET    /api/v1/auth/me                → current user + tenant roles
```

#### Tenants
```
GET    /api/v1/tenants                → list (superadmin: all, user: assigned only)
POST   /api/v1/tenants                → create (auto-generates display_id TEN-XXX)
GET    /api/v1/tenants/:id            → single tenant detail
PUT    /api/v1/tenants/:id            → update name, status
DELETE /api/v1/tenants/:id            → soft-delete
```

#### Products (require X-Tenant-Id)
```
GET    /api/v1/products               → list + summary (total, active/inactive counts)
POST   /api/v1/products               → create product + auto-create inventory row (transaction)
GET    /api/v1/products/:id           → detail (includes inventory snapshot: current_stock, unit)
PUT    /api/v1/products/:id           → update (reject SKU changes)
DELETE /api/v1/products/:id           → soft-delete product + cascade inventory
```

#### Inventory (require X-Tenant-Id)
```
GET    /api/v1/inventory              → list + summary (below_reorder_count)
GET    /api/v1/inventory/:id          → detail
PATCH  /api/v1/inventory/:id          → update stock { "current_stock": 50 }
```
**No POST endpoint** — inventory is only created via product creation.

#### Orders (require X-Tenant-Id)
```
GET    /api/v1/orders                 → list + summary (total, pending_count, created_count)
POST   /api/v1/orders                 → create (validates product is active, auto-generates ORD-XXXX)
GET    /api/v1/orders/:id             → detail (includes product info + inventory snapshot)
PUT    /api/v1/orders/:id             → update qty, notes, status
DELETE /api/v1/orders/:id             → soft-delete
```

### Summary Tile Payloads (returned alongside list data)

```json
// GET /api/v1/tenants → summary:
{ "total": 34, "active": 24, "inactive": 10 }

// GET /api/v1/products → summary:
{ "total": 128, "active": 110, "inactive": 18 }

// GET /api/v1/inventory → summary:
{ "below_reorder_count": 12 }

// GET /api/v1/orders → summary:
{ "total": 1024, "pending": 12, "created": 1012 }
```

---

## 8. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite + TypeScript | Fast builds, type safety |
| Styling | Tailwind CSS | Wireframes already use Tailwind classes — match exactly |
| Icons | @phosphor-icons/react | Wireframes use Phosphor Icons |
| Routing | React Router v6 | Nested layout routes, list→detail→edit pattern |
| HTTP client | Axios | Interceptors for JWT refresh, tenant header injection |
| Backend | Python 3.12 + FastAPI | Auto OpenAPI docs, Pydantic validation, async |
| ORM | SQLAlchemy 2.0 | Typed queries, relationship mapping |
| Migrations | Alembic | Versioned, reproducible schema changes |
| Database | PostgreSQL 16 | RLS for tenant isolation, ACID for inventory |
| Cache | Redis 7 | Token blacklist, rate-limit counters, summary cache |
| Auth | JWT (access 15min + refresh 7d) | Stateless, refresh rotation for security |
| Password hash | bcrypt (cost 12) | Industry standard |
| Proxy | Nginx | TLS termination, rate limiting, security headers |
| Containers | Docker + Docker Compose | One command to run full stack |

---

## 9. Authentication & Authorization

### JWT flow
```
Login → access_token (15 min, Authorization header) + refresh_token (7 days, HTTP-only cookie)
401 → frontend auto-calls /auth/refresh → new token pair (old refresh is single-use)
Logout → refresh token added to Redis blacklist
```

### RBAC matrix

| Role | Tenants | Products | Inventory | Orders |
|------|---------|----------|-----------|--------|
| Superadmin | Full CRUD all | Full CRUD all | Full CRUD all | Full CRUD all |
| Admin | View assigned | Full CRUD own tenant | Full CRUD | Full CRUD |
| Manager | View assigned | View + Edit | Update stock | Full CRUD |
| Viewer | View assigned | View only | View only | View only |

### Tenant middleware (critical path)

On every request to a tenant-scoped endpoint:
1. Decode JWT → get user's tenant list + roles
2. Read `X-Tenant-Id` header
3. Verify user has a role for that tenant → 403 if not
4. Execute `SET LOCAL app.current_tenant_id = '<tenant-uuid>'` on the DB session
5. RLS now automatically filters all queries

---

## 10. Security Architecture

### Network (Nginx)
- TLS 1.3 (Let's Encrypt in prod)
- Rate limit: 100 req/min auth endpoints, 600 req/min data endpoints
- Request body limit: 1 MB
- Security headers: HSTS, X-Content-Type-Options, X-Frame-Options, CSP

### Application (FastAPI)
- Pydantic validation on every endpoint (type, length, format, enum values)
- SQL injection: impossible via SQLAlchemy parameterized queries (never raw SQL)
- CORS: whitelist frontend origin only
- Refresh token cookie: HttpOnly, Secure, SameSite=Strict
- bcrypt password hashing (cost 12)
- All secrets in `.env` (never in code)

### Database (PostgreSQL)
- RLS on all tenant-scoped tables (defense in depth)
- API DB user has SELECT/INSERT/UPDATE/DELETE only — no DDL privileges
- Alembic migrations use a separate elevated DB role
- Encrypted at rest in production

### Auth hardening
- Refresh tokens are single-use: reuse triggers full session revocation
- Token blacklist in Redis (TTL matches token expiry)
- Failed login throttle: 5 attempts per email per 15 minutes

---

## 11. Frontend Architecture

### Route table

```
/login                          → LoginPage
/                               → Layout (sidebar + header + Outlet)
  /tenants                      → TenantListPage
  /tenants/new                  → TenantEditPage (create mode)
  /tenants/:id/edit             → TenantEditPage (edit mode)
  /products                     → ProductListPage
  /products/new                 → ProductEditPage (create mode)
  /products/:id                 → ProductDetailPage
  /products/:id/edit            → ProductEditPage (edit mode)
  /inventory                    → InventoryListPage
  /inventory/:id                → InventoryDetailPage
  /inventory/:id/edit           → InventoryEditPage
  /orders                       → OrderListPage
  /orders/new                   → OrderEditPage (create mode)
  /orders/:id                   → OrderDetailPage
  /orders/:id/edit              → OrderEditPage (edit mode)
```

**Note**: No `/tenants/:id` detail route — wireframes have no tenant detail page.

### Shared components to build

| Component | Used on | Purpose |
|-----------|---------|---------|
| `<Layout>` | All pages | Sidebar + header + content outlet |
| `<DataTable>` | All 4 list pages | Search bar, sort dropdown, table, action menus, pagination |
| `<SummaryTiles>` | All 4 list pages | Configurable grid of stat tiles |
| `<DetailHeader>` | Product/Inventory/Order detail | Avatar circle + title + badge + subtitle |
| `<InfoCardGrid>` | Product/Inventory/Order detail | 4-column card grid |
| `<FormCard>` | All edit pages | White card with form fields, centered max-w-3xl |
| `<TenantSelector>` | Product, Inventory, Order list pages | Dropdown that sets current tenant in context |
| `<StatusBadge>` | Lists and details | Green/yellow/gray pill badges |
| `<InventoryQuickUpdate>` | Product detail + Inventory detail | Inline number input + Update Stock button |
| `<ActionMenu>` | All list rows | Three-dot dropdown with View/Edit/Delete |

### State management

- `AuthContext` — current user, tokens, login/logout methods
- `TenantContext` — currently selected tenant ID, tenant list, setter. Persisted to localStorage so it survives page refresh. The `X-Tenant-Id` header is injected by the Axios instance from this context.

---

## 12. Docker Compose

```yaml
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: ["./nginx/nginx.conf:/etc/nginx/nginx.conf:ro"]
    depends_on: [api, frontend]
    restart: unless-stopped

  api:
    build: ./backend
    env_file: .env
    expose: ["8000"]
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      retries: 3

  frontend:
    build: ./frontend
    expose: ["3000"]
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes: ["redisdata:/data"]
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

---

## 13. Project Structure

```
inventory-management-system/
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── nginx.conf
│
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic/
│   │   ├── alembic.ini
│   │   └── versions/
│   ├── app/
│   │   ├── main.py                    # FastAPI app factory, CORS, middleware registration
│   │   ├── config.py                  # Pydantic BaseSettings from .env
│   │   ├── database.py                # Engine, async session, RLS session setup
│   │   │
│   │   ├── auth/
│   │   │   ├── router.py              # /auth/* endpoints
│   │   │   ├── service.py             # Login, register, token rotation logic
│   │   │   ├── dependencies.py        # get_current_user(), require_role()
│   │   │   └── schemas.py             # LoginRequest, TokenResponse, etc.
│   │   │
│   │   ├── tenants/
│   │   │   ├── router.py
│   │   │   ├── service.py             # Includes display_id generation (TEN-XXX)
│   │   │   ├── models.py
│   │   │   └── schemas.py
│   │   │
│   │   ├── products/
│   │   │   ├── router.py
│   │   │   ├── service.py             # Includes auto-create inventory on product create
│   │   │   ├── models.py
│   │   │   └── schemas.py
│   │   │
│   │   ├── inventory/
│   │   │   ├── router.py              # No POST endpoint
│   │   │   ├── service.py             # Includes below_reorder_count computation
│   │   │   ├── models.py
│   │   │   └── schemas.py
│   │   │
│   │   ├── orders/
│   │   │   ├── router.py
│   │   │   ├── service.py             # Includes display_id generation (ORD-XXXX), active product validation
│   │   │   ├── models.py
│   │   │   └── schemas.py
│   │   │
│   │   └── middleware/
│   │       ├── tenant.py              # X-Tenant-Id extraction, role check, SET app.current_tenant_id
│   │       ├── logging.py             # structlog, correlation IDs
│   │       └── error_handler.py       # Global exception → JSON response mapping
│   │
│   └── tests/
│       ├── conftest.py                # Test DB, tenant fixtures, user factories
│       ├── test_auth.py
│       ├── test_tenants.py
│       ├── test_products.py
│       ├── test_inventory.py
│       └── test_orders.py
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                    # Router setup with Layout wrapper
│   │   │
│   │   ├── api/
│   │   │   ├── client.ts             # Axios: base URL, JWT interceptor, X-Tenant-Id injection
│   │   │   ├── auth.ts
│   │   │   ├── tenants.ts
│   │   │   ├── products.ts
│   │   │   ├── inventory.ts
│   │   │   └── orders.ts
│   │   │
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx         # User, tokens, login/logout
│   │   │   └── TenantContext.tsx       # Selected tenant, persist to localStorage
│   │   │
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── Sidebar.tsx        # Nav links, active highlight, brand logo
│   │   │   │   ├── Header.tsx         # Bell icon, user avatar
│   │   │   │   └── Layout.tsx         # Sidebar + Header + <Outlet />
│   │   │   ├── DataTable.tsx          # Search, sort, table, action menus, pagination
│   │   │   ├── SummaryTiles.tsx       # Configurable stat tile grid
│   │   │   ├── DetailHeader.tsx       # Avatar + title + badge + subtitle
│   │   │   ├── InfoCardGrid.tsx       # 4-column info cards
│   │   │   ├── FormCard.tsx           # Centered form container
│   │   │   ├── TenantSelector.tsx     # Dropdown, updates TenantContext
│   │   │   ├── StatusBadge.tsx        # Green/yellow/gray pills
│   │   │   ├── InventoryQuickUpdate.tsx  # Inline stock update widget
│   │   │   └── ActionMenu.tsx         # Three-dot dropdown
│   │   │
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── tenants/
│   │   │   │   ├── TenantListPage.tsx
│   │   │   │   └── TenantEditPage.tsx
│   │   │   ├── products/
│   │   │   │   ├── ProductListPage.tsx
│   │   │   │   ├── ProductDetailPage.tsx
│   │   │   │   └── ProductEditPage.tsx
│   │   │   ├── inventory/
│   │   │   │   ├── InventoryListPage.tsx
│   │   │   │   ├── InventoryDetailPage.tsx
│   │   │   │   └── InventoryEditPage.tsx
│   │   │   └── orders/
│   │   │       ├── OrderListPage.tsx
│   │   │       ├── OrderDetailPage.tsx
│   │   │       └── OrderEditPage.tsx
│   │   │
│   │   └── utils/
│   │       ├── formatters.ts          # Currency, date formatting
│   │       └── constants.ts           # Category enum, status values
│   │
│   └── tests/
│
└── docs/
    └── architecture.md
```

---

## 14. Migration & Seed Strategy

- Alembic manages all schema changes as versioned Python scripts
- `alembic upgrade head` runs on API container startup (entrypoint script, before uvicorn)
- Seed script (`app/seed.py`) creates:
  - 1 superadmin user (email: admin@ims.com, password: from .env)
  - 2 tenants: "Acme Corp" (TEN-001, active), "Global Tech" (TEN-002, inactive)
  - Sample products per tenant with varied categories
  - Corresponding inventory rows
  - Sample orders in both "created" and "pending" status
- Environment flag: `SEED_ON_STARTUP=true` for dev, `false` for production

---

## 15. Implementation Phases (for Cursor)

Follow these phases in order. Each phase should be fully working before moving to the next.

| Phase | What to build | Key files | Acceptance criteria |
|-------|--------------|-----------|-------------------|
| **1** | Docker Compose + PostgreSQL + Redis + .env | `docker-compose.yml`, `.env.example` | `docker compose up` starts all containers, DB is reachable |
| **2** | Alembic setup + all table migrations + RLS policies | `alembic/`, `app/database.py`, `app/*/models.py` | `alembic upgrade head` creates all tables with correct constraints, RLS active |
| **3** | FastAPI skeleton + health endpoint + middleware | `app/main.py`, `app/middleware/*` | `/health` returns 200, CORS configured, error handler catches exceptions |
| **4** | Auth module (register, login, JWT, refresh, logout) | `app/auth/*` | Can register, login, get tokens, refresh, logout. Redis blacklist works. |
| **5** | Tenant CRUD + display ID generation + seed data | `app/tenants/*`, `app/seed.py` | Full tenant CRUD works. TEN-XXX IDs auto-generated. Seed creates demo data. |
| **6** | Product CRUD + auto inventory creation | `app/products/*`, `app/inventory/models.py` | Creating product auto-creates inventory row. SKU immutable on update. Summary tiles computed. |
| **7** | Inventory endpoints + reorder alert logic | `app/inventory/*` | GET list returns `is_below_reorder` per item + `below_reorder_count` in summary. PATCH updates stock. No POST endpoint. |
| **8** | Order CRUD + active product validation + display IDs | `app/orders/*` | Create order rejects inactive products. ORD-XXXX auto-generated. Summary tiles (total/pending/created) computed. |
| **9** | React scaffolding + Layout + Auth + Routing | `frontend/src/App.tsx`, `Layout/*`, `contexts/*`, `api/client.ts` | App boots, sidebar renders, login/logout works, routes navigate correctly. Axios injects JWT + X-Tenant-Id. |
| **10** | Tenant list + edit pages | `pages/tenants/*` | List with search/sort/pagination/tiles works. Create form creates tenant. |
| **11** | Product list + detail + edit pages | `pages/products/*`, shared components | List filtered by tenant. Detail shows all info cards + Inventory Quick Update. Edit form with all fields. SKU readonly on edit. |
| **12** | Inventory list + detail + edit pages | `pages/inventory/*` | List with red/blue stock coloring. Detail links product name to product detail. Quick Update works. No create button. |
| **13** | Order list + detail + create pages | `pages/orders/*` | List with 3 summary tiles. Create form disables inactive products. Detail links product name. |
| **14** | Polish: search placeholder text, loading states, error toasts, empty states | All pages | Search placeholders match entity name. Loading spinners during API calls. Error messages display. Empty state shown when no data. |
| **15** | Testing + security review | `tests/*` | Backend: >80% coverage on services. Frontend: key flows tested. No SQL injection vectors. RLS verified with cross-tenant test. |

---

## 16. Wireframe Reference Files

These HTML files are the visual specification. Every pixel-level decision should reference these:

| File | Page |
|------|------|
| `tenant_list.html` | Tenant list |
| `tenant_edit.html` | Tenant create (single field: name) |
| `product_list.html` | Product list |
| `product_detail.html` | Product detail (with inventory quick update) |
| `product_edit.html` | Product edit (all fields, SKU readonly) |
| `inventory_list.html` | Inventory list (red/blue stock coloring) |
| `inventory_detail.html` | Inventory detail (product name is a LINK) |
| `inventory_edit.html` | Inventory edit (stock only) |
| `order_list.html` | Order list (3 summary tiles) |
| `order_detail.html` | Order detail (product link in subtitle) |
| `order_edit.html` | Order create (product dropdown + qty) |

**No tenant detail wireframe exists.** The tenant entity only has list and create/edit pages.
