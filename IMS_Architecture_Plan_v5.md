# Inventory Management System — Architecture & Implementation Plan v5

> **Purpose**: Single source of truth for building the IMS. Built on v4, with targeted fixes from a full requirements + wireframe audit.
>
> **What changed from v4**:
> - Redux Toolkit (RTK) re-introduced for auth/tenant state — the requirements explicitly list Redux and RTK satisfies it with ~60 lines total (2 slices), no excessive boilerplate.
> - Tenant Detail page added — the action menu has "View" on tenant rows; a detail page satisfies this cleanly rather than a no-op.
> - Order edit business rule clarified — editing quantity on a `created` order would desync deducted stock; quantity is now only editable on `pending` orders. `created` orders allow notes-only edits.
> - Inventory delete behavior clarified — direct delete on an inventory row triggers confirmation and cascades to soft-delete the parent product (since product without inventory is invalid).
> - 12 phases → 13 phases: Auth API extracted to its own phase; backend test phase retained; Tenant + Product entity pages separated from Inventory + Order pages for more manageable handoffs.
> - Project structure updated to reflect RTK (`store/` replaces `contexts/`).

---

## 0. Decisions & Assumptions

This section documents every deliberate deviation from the stated preferences and every ambiguity resolved. Raise these at the interview.

| # | Decision | Reasoning |
|---|----------|-----------|
| 1 | **Backend: FastAPI (Python) instead of Node.js/Express** | Requirements allow own tech stack. FastAPI offers auto-generated OpenAPI docs (useful for demo), native async/await, Pydantic validation at the framework level, and Alembic for reproducible migrations — all with less boilerplate than Express + joi + Sequelize/Prisma. |
| 2 | **Redux Toolkit for UI state (auth + tenant)** | Requirements explicitly list Redux. RTK's `createSlice` produces only ~30 lines per slice. The app has exactly 2 global state concerns: current user + selected tenant. RTK satisfies the requirement and is the modern Redux standard. TanStack Query is still omitted — custom hooks remain for data fetching (sufficient at this scale). |
| 3 | **No authentication required in spec — added anyway** | Requirements do not mention login. A full JWT auth system is added because the evaluation criteria explicitly test "multi-tenant data isolation" and "how well is data scoped per tenant." Auth enables proper tenant scoping via X-Tenant-Id header + JWT claims. |
| 4 | **Tenant Detail page added** | The action menu has a "View" item on every tenant row. Wiring "View" to a no-op or back to the list creates a broken UX. A simple detail page (name, ID, status, created date) is minimal effort and correct. |
| 5 | **Product categories fixed as: Metals, Chemicals, Plastics** | Wireframes show these three. Requirements do not enumerate them. Assumption: these are the only supported categories. |
| 6 | **Order quantity editable only when status = pending** | Editing quantity on a `created` order (stock already deducted) would create a stock inconsistency without a compensating transaction. The safest rule: `created` orders allow notes edits only; `pending` orders allow qty + notes. |
| 7 | **Inventory delete cascades to parent product** | Inventory is 1:1 with a product. A product without inventory is an invalid state. Direct deletion from the inventory list shows a confirmation: "This will also delete [Product Name]. Are you sure?" and triggers the same soft-delete as product delete. |
| 8 | **Redis included for token blacklist** | Without a blacklist, logout is cosmetic (old tokens remain valid until expiry). Redis adds one container but gives real security. It also handles rate-limit counters and summary caching. |
| 9 | **Soft deletes on all entities** | Prevents accidental data loss, allows audit trail. `deleted_at IS NOT NULL` rows are excluded from all queries by default. |
| 10 | **ORD-XXXX display IDs are per-tenant sequential** | Each tenant's orders start from ORD-1001. This matches the wireframe example values. |
| 11 | **All users see all tenants by default** | Requirements do not specify any user-tenant restriction. A logged-in user sees all tenants in the dropdown unless an Admin has explicitly restricted them. This is the simplest faithful interpretation of the spec. Raise at the interview. |
| 12 | **Admin-managed user-tenant assignments (added feature)** | Requirements do not mention this. Added to demonstrate meaningful multi-tenancy access control. Admins can assign specific tenants to a user; once assigned, that user sees only their assigned tenants. A user with zero assignments retains the default all-access. Raise at the interview. |

---

## 1. Global UI Shell

Every page shares an identical outer shell. Build this FIRST as a reusable Layout component.

### Sidebar (left, fixed, w-64)
- White background, right border (gray-200)
- **Brand header** (h-16, border-bottom): Text "Inventory Management System" in blue-600, font-bold
- **Navigation links** (4 items, stacked vertically, px-4 py-4):
  1. Tenants — icon: `ph ph-buildings`
  2. Products — icon: `ph ph-package`
  3. Inventory — icon: `ph ph-stack`
  4. Orders — icon: `ph ph-shopping-cart`
  5. Users — icon: `ph ph-users-three` *(rendered only when `auth.user.role === 'admin'`)*
- **Active state**: blue-600 text + blue-50 background + rounded-lg
- **Inactive state**: gray-700 text + hover:bg-gray-100
- Icons use **Phosphor Icons** (`@phosphor-icons/react`, regular weight)

### Top header bar (full width of content area, h-16)
- White background, bottom border (gray-200)
- **Left side**: empty (no global search bar — removed per requirements)
- **Right side**: notification bell icon (`ph ph-bell`, gray-400) + user avatar circle

**User avatar (interactive)**:
- 32×32px circle, blue-500 background, white text, shows user initials (e.g. "JD"), font-bold
- Clicking the avatar toggles a dropdown menu (absolute, right-0, mt-2, w-48, white bg, shadow-lg, border border-gray-200, rounded-lg, z-50)
- Dropdown contents:
  1. **User info row** (px-4 py-3): user display name (text-sm font-medium, gray-900) + email (text-xs, gray-500) — read from Redux `auth.user`
  2. **Divider** (border-t border-gray-100)
  3. **Logout item** (px-4 py-2, flex items-center, text-sm text-red-600, hover:bg-gray-50, cursor-pointer): `ph-sign-out` icon (mr-2) + "Logout" text
- **Logout action** (in `Header.tsx`):
  1. Call `POST /api/v1/auth/logout` (fire-and-forget — don't block on failure)
  2. Dispatch `clearCredentials()` to Redux store
  3. Dispatch `setSelectedTenant(null)` to reset tenant selection
  4. Navigate to `/login` via React Router `useNavigate`
- Clicking outside the dropdown closes it (click-outside handler via `useEffect` + `ref`)
- Implemented with local `useState<boolean>` for open/close — no Redux involvement for the dropdown state itself

### Content area
- Background: gray-50
- Full height minus header, overflow-y: auto
- Padding: p-8
- Page content renders here via React Router `<Outlet />`

---

## 2. Functional Requirements — Page-by-Page Specification

### 2.1 Tenant List (`/tenants`)

**Header row**: Title "Tenants" (left) + `+ New Tenant` button (right, blue-600). NO tenant dropdown (tenants page shows ALL tenants).

**Summary tiles** (2 tiles, grid-cols-2):
| Tile | Dot color | Value | Subtitle |
|------|-----------|-------|----------|
| Total Tenants | red-500 | count | "tracked tenants" |
| Active / In-Active | green-500 | "24 / 10" format | "healthy status" |

**List table** columns: Tenant ID (TEN-001 format), Tenant Name, Status (badge), Actions
- **Status badges**: Active = green-100/green-700; Inactive = gray-100/gray-600
- **Row click** → `/tenants/:id` (tenant detail)
- **Action menu**: View → `/tenants/:id`, Edit → `/tenants/:id/edit`, Delete (red text)
- **Search**: placeholder "Search tenants..." *(wireframe incorrectly shows "Search products...")*
- **Sort**: Name (A-Z), Status
- **Pagination**: "Showing 1 to 10 of N results" + Previous / page numbers / Next

### 2.2 Tenant Detail (`/tenants/:id`) ← NEW in v5

**Back link**: "Back to Tenants" → `/tenants`
**Action buttons**: Edit → `/tenants/:id/edit`, Delete

**Header card**:
- Tenant initial avatar (48×48 circle, blue-100 bg, blue-600 text, first letter of tenant name)
- **Tenant Name**: text-2xl font-bold, gray-900
- **Status badge**: Active/Inactive pill
- **Subtitle**: "ID: TEN-001"

**Info cards** (2 cards, grid-cols-2): Status, Created Date

### 2.3 Tenant Create/Edit (`/tenants/new`, `/tenants/:id/edit`)

**Header**: Back arrow → `/tenants` + "Create Tenant" / "Edit Tenant" + Cancel & Save buttons

**Form fields** (max-w-3xl centered):
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Tenant Name | text | Yes | placeholder: "e.g. Stark Industries" |
| Status (edit only) | toggle switch | No | Not shown on create; defaults to Active |

**Business rule**: Duplicate tenant name → 409, inline error shown.

### 2.4 Product List (`/products`)

**Header row**: Title "Products" (left) + Tenant dropdown + `+ New Product` button (right)
- **Tenant dropdown**: "Select Tenant..." default. Selecting a tenant filters the entire page.

**No-tenant-selected state**: When `selectedTenantId` is null (no tenant chosen), the table body is replaced by `<EmptyState>` (icon: `ph-buildings`, heading: "No tenant selected", subtext: "Choose a tenant from the dropdown above to view products."). The `+ New Product` button is **disabled** (opacity-50, cursor-not-allowed). No API call is made.

**Summary tiles** (2 tiles, grid-cols-2):
| Tile | Dot color | Value | Subtitle |
|------|-----------|-------|----------|
| Total Products | blue-500 | count | "catalog items" |
| Active / In-Active | green-500 | "110 / 18" format | "product status" |

**List table** columns: Name, SKU, Category, Status (badge), Actions
- **Row click** → `/products/:id`
- **Action menu**: View, Edit, Delete
- Search (placeholder: "Search products..."), sort (Name A-Z, Status), pagination

### 2.5 Product Detail (`/products/:id`)

**Back link**: "Back to Products" → `/products`
**Action buttons**: Edit → `/products/:id/edit`, Delete

**Header card**:
- Tenant initial avatar (48×48, red-100 bg, red-600 text)
- Product name (text-2xl, gray-900, NOT a link)
- Status badge + subtitle "SKU: ADH-100  |  Tenant: Acme Corp"

**Info cards** (4 cards, grid-cols-4): Category, Cost per Unit, Current Stock (blue-600 text, shown as `{value} {unit}` e.g. "45 kg"), Reorder Point

**Additional Information** (card with gray-50 header):
- Description paragraph
- **Inventory Quick Update**: number input (prefilled with current stock) + "Update Stock" button

### 2.6 Product Create/Edit (`/products/new`, `/products/:id/edit`)

**Header**: Back arrow → `/products/:id` (or `/products` on create) + Edit/Create title + Cancel & Save

**Form fields** (max-w-3xl centered):
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| SKU | text | Yes | **Read-only on edit** (gray bg). Helper: "SKU cannot be changed after creation." |
| Product Name | text | Yes | |
| Description | textarea (3 rows) | No | |
| Category | dropdown | Yes | Options: Metals, Chemicals, Plastics |
| Reorder Threshold | number | Yes | |
| Cost per Unit | number (step 0.01) | Yes | Dollar sign prefix ($) |
| Unit of Measure | dropdown | No | Options: units, kg, sheets, litres. Defaults to "units". Stored on the auto-created inventory row. |
| Status | toggle switch | No | Defaults to Active. Label: "Active"/"Inactive" |

### 2.7 Inventory List (`/inventory`)

**Header row**: Title "Inventory" (left) + Tenant dropdown (right). **NO create button.**

**No-tenant-selected state**: When `selectedTenantId` is null, the table body is replaced by `<EmptyState>` (icon: `ph-buildings`, heading: "No tenant selected", subtext: "Choose a tenant from the dropdown above to view inventory."). No API call is made.

**Summary tiles** (1 tile, grid-cols-1):
| Tile | Dot color | Value | Subtitle |
|------|-----------|-------|----------|
| Below Reorder Threshold | red-500 | count (red-600 text) | "products require immediate purchasing" |

**List table** columns: Product Name, SKU, Cost per Unit, Current Stock, Reorder Threshold, Actions
- **CRITICAL COLOR RULE**: Stock ≥ threshold → blue-600 font-bold; Stock < threshold → red-600 font-bold
- **Row click** → `/inventory/:id`
- **Action menu**: View, Edit, **Reset Stock**, Delete (triggers cascade-delete confirmation — see Section 7, Rule #13)
  - *Reset Stock*: confirmation modal "Reset [Product Name] stock to 0?" → `PATCH /inventory/:id { "current_stock": 0 }`. No endpoint change needed — reuses the existing PATCH.
- Search (placeholder: "Search inventory..." — wireframe incorrectly shows "Search products..."), sort, pagination

### 2.8 Inventory Detail (`/inventory/:id`)

**Back link**: "Back to Inventory" → `/inventory`
**Action buttons**: Edit → `/inventory/:id/edit`, **Reset Stock** (orange/amber button — confirmation modal before zeroing stock), Delete (cascade confirmation)

*Reset Stock button*: amber-600 text + border, distinct from the red Delete button. Clicking opens ConfirmDialog: "Reset stock for [Product Name] to 0?" → on confirm calls `PATCH /inventory/:id { "current_stock": 0 }` → refetch on success.

**Header card**:
- Tenant initial avatar
- **Product name is a CLICKABLE LINK** (blue-600, hover:underline) → `/products/:id`
- Status badge + subtitle "SKU: ADH-100  |  Tenant: Acme Corp"

**Info cards** (4 cards, grid-cols-4): Category, Cost per Unit, Current Stock (blue-600, shown as `{value} {unit}` e.g. "45 kg"), Reorder Point

**Additional Information**: Description + **Inventory Quick Update** widget

### 2.9 Inventory Edit (`/inventory/:id/edit`)

**Header**: Back arrow → `/inventory/:id` + "Update Inventory" + Cancel & Save

**Form fields**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Product Name | text | — | Read-only (gray bg) |
| SKU | text | — | Read-only (gray bg) |
| Current Stock | number | Yes | Editable |

### 2.10 Order List (`/orders`)

**Header row**: Title "Orders" (left) + Tenant dropdown + `+ New Order` button (right)

**No-tenant-selected state**: When `selectedTenantId` is null, the table body is replaced by `<EmptyState>` (icon: `ph-buildings`, heading: "No tenant selected", subtext: "Choose a tenant from the dropdown above to view orders."). The `+ New Order` button is **disabled** (opacity-50, cursor-not-allowed). No API call is made.

**Summary tiles** (3 tiles, grid-cols-3):
| Tile | Dot color | Value | Subtitle |
|------|-----------|-------|----------|
| Total Orders | gray-700 | count | "all time orders" |
| Total Pending | yellow-500 | count | "awaiting inventory" |
| Total Created | green-500 | count | "successfully processed" |

**List table** columns: Order ID (ORD-1001 format), Product, Qty, Status (badge), Date (YYYY-MM-DD), Actions
- **Status badges**: Created = green-100/green-700; Pending = yellow-100/yellow-700; Cancelled = red-100/red-600
- **Row click** → `/orders/:id`
- **Action menu**: View, Edit, Delete
- Search (placeholder: "Search orders..." — wireframe incorrectly shows "Search products..."), sort, pagination

### 2.11 Order Detail (`/orders/:id`)

**Back link**: "Back to Orders" → `/orders`
**Action buttons**: Edit, Delete

**Header card**:
- Tenant initial avatar
- Title: "Order ORD-1001"
- Status badge: Created/Pending/Cancelled *(wireframe incorrectly shows "Active" — corrected)*
- Subtitle: "Product: [Product Name as LINK to `/products/:id`]  |  Tenant: Acme Corp"

**Info cards** (4 cards, grid-cols-4): Requested Quantity, Cost per Unit, Current Stock (blue-600, shown as `{value} {unit}`), Reorder Point

**Primary action buttons** (between info cards and Additional Information):
- **Confirm Order** (blue-600 bg) — `POST /api/v1/orders/:id/confirm`; `pending` → `created`. **Visible only when status = pending.**
- **Cancel Order** (red border, red text) — `POST /api/v1/orders/:id/cancel`; restores stock if was `created`. **Visible when status = created or pending.**
- **Both hidden** when order is `cancelled`.

**Additional Information**: Order Notes section.

### 2.12 Order Create/Edit (`/orders/new`, `/orders/:id/edit`)

**Header**: Back arrow + "Create Order" / "Edit Order" + Cancel & Save

**Form fields**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Select Product | dropdown | Yes | Shows active products only. Inactive shown but disabled (grayed). |
| Requested Quantity | number | Yes | Default: 1. **Editable on both create and pending orders. Read-only when order is `created`.** |
| Notes | textarea | No | Optional |

**Business rule**: Editing a `created` order — quantity field is disabled (read-only), only notes can be changed.

---

## 3. Cross-Entity Navigation Map

```
Inventory Detail  →  Product Detail     (product name = clickable blue Link)
Order Detail      →  Product Detail     (product name = clickable blue Link in subtitle)
All Detail pages  →  Edit pages         (Edit button top-right)
All List pages    →  Detail pages       (row click)
All List pages    →  Edit pages         (action menu → Edit)
Tenant List       →  Tenant Detail      (row click + View action)
```

---

## 4. Display ID Generation

| Entity | Format | Example | Rule |
|--------|--------|---------|------|
| Tenant | TEN-XXX | TEN-001 | Sequential, zero-padded, system-wide |
| Order | ORD-XXXX | ORD-1001 | Sequential, zero-padded, per-tenant |

Products and inventory use user-provided SKU as the display identifier.

**Implementation**: Store as `display_id` VARCHAR column. Use a DB sequence or application counter. UUID remains the PK for all joins and API references.

---

## 5. Data Model

### Entity-Relationship Summary

```
USERS ──┬── USER_TENANT_ROLES ──┬── TENANTS
        │                        │
        │                        ├── PRODUCTS ──── INVENTORY (1:1, auto-created)
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
| role | VARCHAR(20) | NOT NULL, DEFAULT 'user', CHECK IN ('admin', 'user') |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |
| deleted_at | TIMESTAMPTZ | NULL (soft delete) |

> **Global role** — `users.role` is the single source of truth for the Admin/User distinction. `require_admin()` in `auth/dependencies.py` checks `current_user.role == 'admin'`. The `user_tenant_roles` table is a pure assignment table (user ↔ tenant mapping) with no role column of its own.

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

**user_tenant_roles** (pure assignment table — no per-row role)
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users(id), NOT NULL |
| tenant_id | UUID | FK → tenants(id), NOT NULL |
| | | UNIQUE(user_id, tenant_id) |

> **Assignment semantics**: a user with **zero rows** in `user_tenant_roles` sees **all tenants** (default, open-access behaviour). A user with **one or more rows** sees **only their assigned tenants**. This lets Admins optionally restrict access for specific users without requiring every user to be explicitly configured. (See Assumption #11 and #12 in Section 0.)

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
| reorder_threshold | INTEGER | NOT NULL, CHECK ≥ 0 |
| status | VARCHAR(20) | DEFAULT 'active', CHECK IN ('active', 'inactive') |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |
| deleted_at | TIMESTAMPTZ | NULL |

**inventory** (1:1 with products, auto-created on product creation)
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| product_id | UUID | FK → products(id) ON DELETE CASCADE, UNIQUE, NOT NULL |
| tenant_id | UUID | FK → tenants(id), NOT NULL |
| current_stock | INTEGER | NOT NULL, DEFAULT 0, CHECK ≥ 0 |
| unit | VARCHAR(20) | DEFAULT 'units' (e.g., "kg", "sheets") |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |
| deleted_at | TIMESTAMPTZ | NULL (soft delete) |

**orders**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| display_id | VARCHAR(20) | UNIQUE per tenant (e.g., "ORD-1001") |
| tenant_id | UUID | FK → tenants(id), NOT NULL |
| product_id | UUID | FK → products(id), NOT NULL |
| requested_qty | INTEGER | NOT NULL, CHECK > 0 |
| status | VARCHAR(20) | DEFAULT 'created', CHECK IN ('created', 'pending', 'cancelled') |
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

The tenant middleware sets `app.current_tenant_id` on each DB session before any query runs.

---

## 6. Order Status Flow & Inventory Deduction

### Status definitions

| Status | Badge color | Meaning |
|--------|------------|---------|
| `created` | green-100/green-700 | Order fulfilled; stock deducted |
| `pending` | yellow-100/yellow-700 | Insufficient stock at order time; stock NOT deducted |
| `cancelled` | red-100/red-600 | Cancelled; deducted stock restored if was `created` |

### State machine

```
                ┌──────────────────────┐
                │     NEW ORDER        │
                │  POST /api/v1/orders │
                └──────────┬───────────┘
                           │
                ┌──────────▼───────────┐
                │  stock ≥ qty?        │
                └──────┬─────────┬─────┘
                  YES  │         │  NO
                       ▼         ▼
                ┌──────────┐  ┌──────────┐
                │ created  │  │ pending  │
                │(stock    │  │(stock    │
                │ deducted)│  │ unchanged│
                └────┬─────┘  └────┬─────┘
                     │             │
                ┌────▼─────┐  ┌────▼─────┐
                │  cancel  │  │ confirm  │
                │(restore  │  │(re-check │
                │ stock)   │  │ stock;   │
                └────┬─────┘  │ deduct)  │
                     │        └────┬─────┘
                     ▼             ▼
                ┌──────────┐  ┌──────────┐
                │cancelled │  │ created  │
                └──────────┘  └──────────┘
                     ▲             │
                     │    cancel   │
                     └─────────────┘
```

### Rules for each transition

**1. Create order (`POST /api/v1/orders`)**
- Validate product is active → 400 if inactive
- Check: `current_stock ≥ requested_qty`?
  - **YES**: status = `created`, deduct stock (DB transaction)
  - **NO**: status = `pending`, no stock change
- Auto-generate `ORD-XXXX` display ID

**2. Confirm order (`POST /api/v1/orders/:id/confirm`)**
- Only valid when status = `pending` → 409 if status is `created` or `cancelled`
- `SELECT ... FOR UPDATE` on inventory row
- Re-check: `current_stock ≥ requested_qty`?
  - **YES**: status = `created`, deduct stock (DB transaction)
  - **NO**: 409 "Insufficient stock (available: X, requested: Y)"

**3. Cancel order (`POST /api/v1/orders/:id/cancel`)**
- Valid when status = `created` or `pending` → 409 if already `cancelled`
- If was `created`: restore stock (`current_stock += requested_qty`)
- If was `pending`: no stock change
- Set status = `cancelled`

**4. Edit order (`PUT /api/v1/orders/:id`)**
- Rejects if status = `cancelled` → 409
- If status = `created`: **only notes can be updated** (quantity field rejected → 422)
- If status = `pending`: quantity + notes both updatable

**5. Cancelled order immutability**
- `cancelled` orders cannot be confirmed, quantity-edited, or un-cancelled
- `POST /orders/:id/confirm` → 409 if cancelled
- `PUT /orders/:id` → 409 if cancelled

**6. Concurrency safety**
- All stock-modifying operations use `SELECT ... FOR UPDATE` on inventory row within a DB transaction.

---

## 7. Business Rules (exhaustive)

| # | Rule | Enforced by |
|---|------|-------------|
| 1 | **Tenant isolation**: users see only their selected tenant's data | DB (RLS) + API middleware |
| 2 | **SKU immutability**: SKU cannot change after product creation | API validation (reject PUT if sku differs) |
| 3 | **Inventory auto-creation**: creating a product auto-creates inventory (stock=0) | API service layer (DB transaction) |
| 4 | **Inventory cascade delete**: deleting a product deletes its inventory row | DB FK ON DELETE CASCADE + soft-delete logic |
| 5 | **Inventory delete from list = product delete**: confirms "also deletes [Product Name]" | Frontend confirmation dialog + API cascades |
| 5a | **Reset Stock** ≠ Delete: "Reset Stock" zeroes `current_stock` via `PATCH /inventory/:id`; the inventory row and parent product are **not** deleted. Shown as a distinct amber button/action to prevent user confusion between zeroing stock and deleting the record. | Existing PATCH endpoint + distinct UI treatment |
| 6 | **Active product gate**: only active products selectable when creating orders | API validation + frontend disables inactive |
| 7 | **Reorder alert coloring**: stock < threshold → red-600; stock ≥ threshold → blue-600 | Frontend conditional class |
| 8 | **Reorder alert tile**: counts products below their reorder threshold | API computes server-side in summary response |
| 9 | **Order status values**: 'created' (green), 'pending' (yellow), 'cancelled' (red) | DB CHECK constraint + API validation |
| 10 | **Display ID generation**: TEN-XXX for tenants, ORD-XXXX per-tenant for orders | API service layer on create |
| 11 | **Tenant status default**: new tenants default to 'active' | DB DEFAULT + API |
| 12 | **Category enum**: Metals, Chemicals, Plastics | DB CHECK + frontend dropdown |
| 13 | **No inventory create button**: inventory only created via product creation | Frontend (no button) + API (no POST /inventory) |
| 14 | **Cross-entity links**: inventory/order detail → product detail via clickable Link | Frontend React Router Links |
| 15 | **Order auto-deduction**: stock deducted on create if sufficient; otherwise pending | API service layer |
| 16 | **Order confirm**: pending→created with stock deduction; 409 if insufficient | API service layer |
| 17 | **Order cancel with stock restoration**: restores stock only if was `created` | API service layer |
| 18 | **Order edit restriction**: `created` orders only allow notes edit (qty immutable) | API validation (422 if qty changes on created order) |
| 19 | **Cancelled order immutability**: no confirm, no edit, no un-cancel | API validation |
| 20 | **Concurrency safety**: SELECT FOR UPDATE on all stock-modifying operations | API + DB transaction |
| 21 | **Tenant detail page**: View action on tenant rows navigates to `/tenants/:id` | Frontend routing |

---

## 8. API Design

### Conventions
- RESTful, JSON, all routes under `/api/v1/`
- Tenant scoping via `X-Tenant-Id` header (validated against JWT claims)
- Standard HTTP codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500
- Pagination: `?page=1&page_size=10&sort=name&order=asc`
- Search: `?q=adhesive`
- Response envelope: `{ "data": [...], "meta": { "total": N, "page": 1, "page_size": 10 }, "summary": { ... } }`

### Layered Architecture (Routes → Controllers → Services → Repositories)

Each module follows a strict 4-layer separation matching the evaluation criterion:

```
router.py       ← HTTP layer (FastAPI router, path operations, request/response schemas)
    ↓
service.py      ← Business logic (rules, validation, display_id generation, status transitions)
    ↓
repository.py   ← Data access (all SQLAlchemy queries; zero ORM code in service layer)
    ↓
models.py       ← ORM model definitions (SQLAlchemy Table classes, relationships)
```

**router.py** responsibilities:
- Parse and validate HTTP request via Pydantic schemas
- Call the service layer with typed domain objects
- Return HTTP responses with correct status codes

**service.py** responsibilities:
- Enforce business rules (e.g. SKU immutability, active-product gate, stock deduction logic)
- Orchestrate multi-step operations (e.g. create product → create inventory in one transaction)
- Call repository methods — never call `session` directly

**repository.py** responsibilities:
- All `session.execute()`, `session.add()`, `session.delete()` calls live here
- Returns domain model instances or typed dicts — never raw SQLAlchemy Row objects to the service
- Accepts `AsyncSession` as a parameter (injected by FastAPI dependency)

**models.py** responsibilities:
- SQLAlchemy ORM class definitions, column types, constraints, relationships
- No business logic — pure data shape definitions

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
GET    /api/v1/tenants                → list (admin: all tenants; user: all tenants by default,
                                        or only assigned tenants if admin has restricted them)
POST   /api/v1/tenants                → create — requires admin role (auto-generates TEN-XXX)
GET    /api/v1/tenants/:id            → single tenant detail
PUT    /api/v1/tenants/:id            → update name, status — requires admin role
DELETE /api/v1/tenants/:id            → soft-delete — requires admin role
```

#### Users (admin only — all endpoints require `require_admin()`)
```
GET    /api/v1/users                         → list all users (id, email, role, assigned_tenant_count)
GET    /api/v1/users/:id                     → user detail (email, role, assigned tenants list)
PUT    /api/v1/users/:id                     → update role { "role": "admin" | "user" }
DELETE /api/v1/users/:id                     → soft-delete user

GET    /api/v1/users/:id/tenants             → list tenants assigned to user
POST   /api/v1/users/:id/tenants             → assign tenant to user { "tenant_id": "..." }
DELETE /api/v1/users/:id/tenants/:tenant_id  → remove tenant assignment from user
```

#### Products (require X-Tenant-Id)
```
GET    /api/v1/products               → list + summary (total, active, inactive)
POST   /api/v1/products               → create + auto-create inventory row (transaction); accepts optional `unit` field (default: 'units') passed through to the inventory row
GET    /api/v1/products/:id           → detail (includes inventory snapshot)
PUT    /api/v1/products/:id           → update (rejects SKU changes)
DELETE /api/v1/products/:id           → soft-delete product + cascade inventory
```

#### Inventory (require X-Tenant-Id)
```
GET    /api/v1/inventory              → list + summary (below_reorder_count)
GET    /api/v1/inventory/:id          → detail
PATCH  /api/v1/inventory/:id          → update stock { "current_stock": 50 }
DELETE /api/v1/inventory/:id          → soft-delete inventory + cascade parent product
```
**No POST endpoint** — inventory only created via product creation.

#### Orders (require X-Tenant-Id)
```
GET    /api/v1/orders                 → list + summary (total, pending, created, cancelled)
POST   /api/v1/orders                 → create (validates active product, auto-deducts or pends, ORD-XXXX)
GET    /api/v1/orders/:id             → detail (product info + inventory snapshot)
PUT    /api/v1/orders/:id             → update qty+notes (pending) or notes-only (created); 409 if cancelled
DELETE /api/v1/orders/:id             → soft-delete
POST   /api/v1/orders/:id/confirm     → pending→created (re-check stock, deduct; 409 if insufficient)
POST   /api/v1/orders/:id/cancel      → created/pending→cancelled (restore stock if was created)
```

### Summary Tile Payloads

```json
// GET /api/v1/tenants → summary:
{ "total": 34, "active": 24, "inactive": 10 }

// GET /api/v1/products → summary:
{ "total": 128, "active": 110, "inactive": 18 }

// GET /api/v1/inventory → summary:
{ "below_reorder_count": 12 }

// GET /api/v1/orders → summary:
{ "total": 1024, "pending": 12, "created": 1005, "cancelled": 7 }
```

*Note: The `cancelled` count in orders is returned in the API payload but does NOT get its own summary tile in the UI — the wireframe shows exactly 3 tiles and that layout is preserved.*

---

## 9. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite + TypeScript | Fast HMR builds, type safety across the stack |
| Styling | Tailwind CSS | Wireframes use Tailwind classes — match exactly |
| Icons | @phosphor-icons/react | Wireframes use Phosphor Icons |
| Routing | React Router v6 | Nested layout routes, list→detail→edit |
| State | **Redux Toolkit** (auth slice + tenant slice) | Required by assignment; RTK minimizes boilerplate (`createSlice`). Two slices (~60 lines each) manage auth + selected tenant. |
| Forms | react-hook-form + zod | Schema validation, inline errors, zodResolver |
| Toasts | sonner | Lightweight toast notifications |
| HTTP client | Axios | Interceptors for JWT refresh + X-Tenant-Id injection |
| Backend | Python 3.12 + FastAPI | Auto OpenAPI docs, Pydantic validation, native async/await |
| ORM | SQLAlchemy 2.0 (asyncio) | Typed queries, relationship mapping, async session |
| Migrations | Alembic | Versioned, reproducible schema changes |
| Database | PostgreSQL 16 | RLS for tenant isolation, ACID for inventory deductions |
| Cache | Redis 7 | Token blacklist (real logout), rate-limit counters |
| Auth | JWT (access 15min + refresh 7d) | Stateless; refresh rotation for security |
| Password hash | bcrypt (cost 12) | Industry standard |
| Proxy | Nginx | TLS termination, rate limiting, security headers |
| Containers | Docker + Docker Compose | One-command full stack |

### Why Redux Toolkit (v5 decision)

The requirements explicitly list Redux as the preferred state management library. RTK's `createSlice` API is the modern Redux standard and requires minimal boilerplate:

```typescript
// store/authSlice.ts — ~30 lines
const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, accessToken: null },
  reducers: {
    setCredentials: (state, action) => { /* ... */ },
    clearCredentials: (state) => { /* ... */ }
  }
});

// store/tenantSlice.ts — ~20 lines
const tenantSlice = createSlice({
  name: 'tenant',
  initialState: { selectedTenantId: null, tenants: [] },
  reducers: {
    setSelectedTenant: (state, action) => { /* ... */ },
    setTenants: (state, action) => { /* ... */ }
  }
});
```

Components use `useSelector` / `useDispatch` via thin wrapper hooks (`useAuth()`, `useTenant()`) — identical API to the Context approach. Swapping in Redux does not affect component code.

### Why custom hooks over TanStack Query

Data fetching uses custom hooks wrapping Axios calls with `useState` + `useEffect`. This is:
- Zero additional dependencies
- Predictable and easy to debug
- Sufficient for this app's scale (no background refetching, optimistic updates, or infinite scroll needed)

If the app grows to require cache invalidation across pages or background polling, TanStack Query is the correct upgrade path.

### Code Quality Conventions

These conventions are enforced across the entire codebase for readability and maintainability:

#### Frontend

| Convention | Rule |
|-----------|------|
| **No magic strings** | All domain values (status strings, category names, badge color classes) live in `src/utils/constants.ts`. Components import from there — no inline `"active"`, `"pending"`, `"Chemicals"` literals in JSX or logic. |
| **No `any` types** | All API responses, component props, and hook return values are typed through `src/types/`. TypeScript `strict` mode enabled in `tsconfig.json`. |
| **No inline API calls in components** | Components never call Axios directly. All data fetching goes through custom hooks in `src/hooks/`. Mutations go through the `src/api/` modules called inside handlers. |
| **No direct `dispatch` in JSX** | Redux dispatch calls are always wrapped in a hook (`useAuth()`, `useTenant()`). JSX never calls `useDispatch()` directly. |
| **Consistent error handling** | All Axios error catches call `getApiErrorMessage(err)` from `src/utils/apiError.ts`. This helper reads `err.response?.data?.error?.message` with a fallback to `err.message`. No raw `catch (e: any)` spread through component code. |
| **One Zod schema per form** | Every create/edit form has exactly one Zod schema in `src/schemas/`. The schema is imported by the page component only — never duplicated. |
| **Component single responsibility** | Each component does one thing. `DataTable` renders lists. `ConfirmDialog` confirms destructive actions. Pages compose these components — they do not contain table markup or dialog markup directly. |
| **Loading + empty + error states always handled** | Every data-fetching hook returns `{ data, loading, error, refetch }`. Every list page handles all three states using `<LoadingSkeleton>`, `<EmptyState>`, and an inline error message. |

#### Backend

| Convention | Rule |
|-----------|------|
| **Layered separation** | `router.py` handles HTTP only. `service.py` handles business logic only. `repository.py` handles all DB access. No cross-layer leakage. |
| **No raw SQL** | All queries go through SQLAlchemy ORM or `session.execute(select(...))`. Never `text()` with user input. |
| **Consistent response shape** | All list endpoints return `{ "data": [...], "meta": { "total", "page", "page_size" }, "summary": { ... } }`. All error responses return `{ "error": { "code": "...", "message": "..." } }`. No one-off shapes. |
| **Business rules in service, not router** | Validation like "SKU cannot change" or "product must be active" lives in `service.py`, not as a router dependency. This makes rules testable in isolation. |
| **Type annotations everywhere** | All function signatures have Python type hints. Pydantic schemas are the boundary between HTTP and domain logic — service layer never receives raw dicts. |

---

## 10. Authentication & Authorization

### JWT flow
```
Login → access_token (15 min, Authorization: Bearer) + refresh_token (7 days, HTTP-only cookie)
401 → frontend auto-calls /auth/refresh → new token pair
Logout → refresh token blacklisted in Redis
```

### RBAC matrix

The system has exactly 2 roles, matching the two actor labels used throughout the requirements:

| Role | Tenants | Products | Inventory | Orders |
|------|---------|----------|-----------|--------|
| **Admin** | Full CRUD — sees ALL tenants in the system | Full CRUD within any tenant | Full CRUD within any tenant | Full CRUD within any tenant |
| **User** | Read-only — sees all tenants by default; if restricted by an Admin (via user-tenant assignment), sees only assigned tenants. Cannot create, edit, or delete tenants. | Full CRUD within accessible tenant | Full CRUD within accessible tenant | Full CRUD within accessible tenant |

The key distinction: **only Admins can create, edit, or delete tenant records, and manage user-tenant assignments.** Users interact with products, inventory, and orders scoped to whichever tenants they can access.

### Tenant middleware (critical path)

On every request to a tenant-scoped endpoint:
1. Decode JWT → get user id + global role
2. Read `X-Tenant-Id` header
3. Verify user may access that tenant: **Admin = always allowed**; **User = allowed if they have zero assignments (all-access default) OR if the requested tenant_id is in their `user_tenant_roles` assignment list** → 403 if a restricted user accesses an unassigned tenant
4. `SET LOCAL app.current_tenant_id = '<uuid>'` on the DB session
5. RLS filters all queries automatically

---

## 11. Security Architecture

### Network (Nginx)
- TLS 1.3 (Let's Encrypt in prod)
- Rate limit: 100 req/min auth endpoints, 600 req/min data endpoints
- Request body limit: 1 MB
- Security headers: HSTS, X-Content-Type-Options, X-Frame-Options, CSP

### Application (FastAPI)
- Pydantic validation on every endpoint
- SQL injection: impossible via SQLAlchemy parameterized queries
- CORS: whitelist frontend origin only
- Refresh token cookie: HttpOnly, Secure, SameSite=Strict
- bcrypt password hashing (cost 12)
- All secrets in `.env` (never in code)

### Database (PostgreSQL)
- RLS on all tenant-scoped tables (defense in depth)
- API DB user: SELECT/INSERT/UPDATE/DELETE only (no DDL)
- Alembic migrations run under a separate elevated DB role
- Encrypted at rest in production

### Auth hardening
- Refresh tokens are single-use (reuse triggers full session revocation)
- Token blacklist in Redis with TTL matching token expiry
- Failed login throttle: 5 attempts per email per 15 minutes

---

## 12. Frontend Architecture

### Route table

```
/login                          → LoginPage (public, no auth required)
/                               → AuthGuard (reads Redux accessToken; redirects to /login if null)
                                    └── Layout (sidebar + header + Outlet)
  /tenants                      → TenantListPage
  /tenants/new                  → TenantEditPage (create mode)
  /tenants/:id                  → TenantDetailPage
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
  /users                        → UserListPage     (admin only — role guard inside AuthGuard; renders 403 if role ≠ 'admin')
  /users/:id                    → UserDetailPage   (admin only)
*                               → redirect to /tenants (catch-all for authenticated users)
```

**`AuthGuard` component** (`src/components/AuthGuard.tsx`):
- Reads `accessToken` from Redux with `useSelector`
- If `accessToken` is null → `<Navigate to="/login" replace />`
- If `accessToken` is present → `<Outlet />` (renders child routes)
- On app startup, if a token exists in Redux (rehydrated from localStorage via the store), it calls `GET /auth/me` once to validate the token is still live; if the call fails (401), dispatches `clearCredentials` and redirects to `/login`
- This is the single source of truth for auth-gating — `Layout.tsx` itself does NOT contain any redirect logic

### Redux store structure

```
store/
├── index.ts               # configureStore({ auth, tenant })
├── authSlice.ts           # { user, accessToken } + setCredentials/clearCredentials
└── tenantSlice.ts         # { selectedTenantId, tenants } + setSelectedTenant/setTenants
```

Thin wrapper hooks:
```typescript
// hooks/useAuth.ts
export const useAuth = () => useSelector((state) => state.auth);
// hooks/useTenant.ts
export const useTenant = () => useSelector((state) => state.tenant);
```

The Axios client reads `selectedTenantId` from the Redux store and injects it as `X-Tenant-Id` on every request. `selectedTenantId` is also persisted to `localStorage` and rehydrated on store initialization.

### Provider tree

```
<Provider store={store}>        ← Redux store wraps entire app
  <RouterProvider>
    Layout → Outlet
  </RouterProvider>
</Provider>
```

### Data fetching pattern

Custom hooks per entity — `useState` + `useEffect` wrapping Axios:

```typescript
// hooks/useProducts.ts
export function useProducts(params: ListParams) {
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedTenantId } = useTenant();

  useEffect(() => {
    if (!selectedTenantId) return;
    setLoading(true);
    productsApi.list(params)
      .then(res => setData(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedTenantId, params.page, params.sort, params.q]);

  return { data, loading, error, refetch: () => { /* re-trigger */ } };
}
```

### Form validation (react-hook-form + zod)

Zod schemas in `src/schemas/`:
- `tenantSchema.ts` — name required, min 2 chars
- `productSchema.ts` — sku, name, category enum, cost > 0, reorder ≥ 0
- `orderSchema.ts` — product_id required, requested_qty > 0

All forms use `useForm({ resolver: zodResolver(schema) })`. Inline errors render below each field.

### Toast notifications (sonner)

`<Toaster />` mounted once in `main.tsx`. Every mutation calls `toast.success()` or `toast.error()`. No `alert()` or `confirm()` dialogs.

### Shared components

| Component | Used on | Purpose |
|-----------|---------|---------|
| `<Layout>` | All pages | Sidebar + header + content Outlet |
| `<AuthGuard>` | All protected routes | Reads Redux `accessToken`; redirects to `/login` if null |
| `<DataTable>` | All 4 list pages | Search bar, sort dropdown, table, action menus, pagination |
| `<SummaryTiles>` | All 4 list pages | Configurable stat tile grid |
| `<DetailHeader>` | Tenant/Product/Inventory/Order detail | Avatar + title + badge + subtitle |
| `<InfoCardGrid>` | Product/Inventory/Order detail | 4-column info card grid |
| `<FormCard>` | All edit pages | Centered max-w-3xl form card |
| `<TenantSelector>` | Product, Inventory, Order list | Dropdown dispatching `setSelectedTenant` to Redux |
| `<StatusBadge>` | Lists and details | Green/yellow/red pill badges |
| `<InventoryQuickUpdate>` | Product detail + Inventory detail | Inline number input + Update Stock button |
| `<ActionMenu>` | All list rows | Three-dot dropdown with View/Edit/Delete |
| `<ConfirmDialog>` | All delete actions, inventory cascade delete | Modal with title, message, Confirm (red) + Cancel buttons. Accepts `title`, `message`, `onConfirm`, `onCancel`, `isOpen` props |
| `<LoadingSkeleton>` | All list pages during API load | Animated gray placeholder rows; accepts `rows` count prop |
| `<EmptyState>` | All list pages when data is empty | Centered icon + heading + subtext + optional action button |

---

## 13. Docker Compose

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

## 14. Project Structure

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
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 0001_initial_schema.py
│   ├── app/
│   │   ├── main.py                    # FastAPI app factory, CORS, middleware
│   │   ├── config.py                  # Pydantic BaseSettings from .env
│   │   ├── database.py                # Engine, async session, RLS session setup
│   │   ├── seed.py                    # Seed: admin user, 2 tenants, products, inventory, orders
│   │   │
│   │   ├── auth/
│   │   │   ├── router.py              # HTTP layer: login, register, refresh, logout, me
│   │   │   ├── service.py             # Business logic: token rotation, Redis blacklist, throttle
│   │   │   ├── repository.py          # DB layer: user lookup by email, user create, token operations
│   │   │   ├── dependencies.py        # get_current_user() reads JWT → fetches user row; require_admin() checks user.role == 'admin'
│   │   │   ├── models.py              # ORM: User and UserTenantRole table definitions (imported by users/ module — no duplicate model needed there)
│   │   │   └── schemas.py             # Pydantic: LoginRequest, TokenResponse, UserResponse
│   │   │
│   │   ├── tenants/
│   │   │   ├── router.py              # HTTP layer: CRUD endpoints
│   │   │   ├── service.py             # Business logic: TEN-XXX display_id generation, duplicate check
│   │   │   ├── repository.py          # DB layer: list, get_by_id, get_by_name, create, update, soft_delete
│   │   │   ├── models.py              # ORM: Tenant table definition
│   │   │   └── schemas.py             # Pydantic: TenantCreate, TenantUpdate, TenantResponse, TenantListResponse
│   │   │
│   │   ├── products/
│   │   │   ├── router.py              # HTTP layer: CRUD endpoints
│   │   │   ├── service.py             # Business logic: auto-create inventory on create (uses unit from ProductCreate), SKU immutability check
│   │   │   ├── repository.py          # DB layer: list (with inventory join), get_by_id, create, update, soft_delete
│   │   │   ├── models.py              # ORM: Product table definition
│   │   │   └── schemas.py             # Pydantic: ProductCreate (includes optional unit field), ProductUpdate, ProductResponse, ProductListResponse
│   │   │
│   │   ├── inventory/
│   │   │   ├── router.py              # HTTP layer: list, get, patch, delete (no POST)
│   │   │   ├── service.py             # Business logic: below_reorder_count, cascade delete to product
│   │   │   ├── repository.py          # DB layer: list (with product join), get_by_id, get_by_product_id, patch_stock, soft_delete (sets deleted_at)
│   │   │   ├── models.py              # ORM: Inventory table definition
│   │   │   └── schemas.py             # Pydantic: InventoryResponse, InventoryStockUpdate, InventoryListResponse
│   │   │
│   │   ├── orders/
│   │   │   ├── router.py              # HTTP layer: CRUD + /confirm + /cancel action endpoints
│   │   │   ├── service.py             # Business logic: ORD-XXXX, active-product gate, confirm/cancel with stock deduction, qty edit restrictions
│   │   │   ├── repository.py          # DB layer: list, get_by_id, create, update, soft_delete, get_inventory_for_update (SELECT FOR UPDATE)
│   │   │   ├── models.py              # ORM: Order table definition
│   │   │   └── schemas.py             # Pydantic: OrderCreate, OrderUpdate, OrderResponse, OrderListResponse
│   │   │
│   │   ├── users/
│   │   │   ├── router.py              # HTTP layer: user list/detail/update/delete; tenant assignment CRUD (all require_admin)
│   │   │   ├── service.py             # Business logic: assignment semantics (0 rows = all-access), role updates
│   │   │   ├── repository.py          # DB layer: user queries, user_tenant_roles CRUD
│   │   │   └── schemas.py             # Pydantic: UserResponse, UserListResponse, TenantAssignmentInput (just tenant_id), UserRoleUpdate
│   │   │   # Note: uses auth/models.py (User ORM model) — no separate models.py needed
│   │   │
│   │   └── middleware/
│   │       ├── tenant.py              # X-Tenant-Id extraction, role check, SET app.current_tenant_id
│   │       ├── logging.py             # structlog, correlation IDs
│   │       └── error_handler.py       # Global exception → JSON response
│   │
│   └── tests/
│       ├── conftest.py                # Test DB, tenant fixtures, user factories
│       ├── test_auth.py
│       ├── test_tenants.py
│       ├── test_products.py
│       ├── test_inventory.py
│       └── test_orders.py             # confirm/cancel/stock-deduction/qty-edit-restriction tests
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json                   # react, react-router-dom, @reduxjs/toolkit, react-redux,
│   │                                  # axios, react-hook-form, zod, sonner, @phosphor-icons/react
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx                   # Provider (Redux) + RouterProvider + Toaster
│       ├── App.tsx                    # Router setup with Layout wrapper + route guards
│       │
│       ├── store/
│       │   ├── index.ts               # configureStore
│       │   ├── authSlice.ts           # user + accessToken + setCredentials/clearCredentials
│       │   └── tenantSlice.ts         # selectedTenantId (localStorage sync) + tenants[]
│       │
│       ├── types/                     # Shared TypeScript interfaces — imported by api/, hooks/, components/
│       │   ├── api.ts                 # PaginatedResponse<T>, ListMeta, ApiError (standard error envelope)
│       │   ├── auth.ts                # User (id, email, role), LoginRequest, TokenResponse
│       │   ├── tenant.ts              # Tenant, TenantSummary, TenantListResponse, TenantCreateInput
│       │   ├── product.ts             # Product, ProductSummary, ProductListResponse, ProductCreateInput
│       │   ├── inventory.ts           # Inventory, InventorySummary, InventoryListResponse, StockUpdateInput
│       │   ├── order.ts               # Order, OrderSummary, OrderListResponse, OrderCreateInput, OrderStatus
│       │   └── user.ts                # UserListItem, UserDetail, TenantAssignment (user_id + tenant_id), UserRoleUpdate
│       │
│       ├── hooks/
│       │   ├── useAuth.ts             # useSelector(state.auth) wrapper
│       │   ├── useTenant.ts           # useSelector(state.tenant) wrapper
│       │   ├── useTenants.ts          # { data, loading, error, refetch }
│       │   ├── useProducts.ts
│       │   ├── useInventory.ts
│       │   ├── useOrders.ts
│       │   └── useUsers.ts            # { data, loading, error, refetch } for user list + detail
│       │
│       ├── schemas/
│       │   ├── tenantSchema.ts
│       │   ├── productSchema.ts
│       │   └── orderSchema.ts
│       │
│       ├── api/
│       │   ├── client.ts              # Axios: base URL, JWT interceptor, X-Tenant-Id from Redux store
│       │   ├── tenants.ts
│       │   ├── products.ts
│       │   ├── inventory.ts
│       │   ├── orders.ts              # Includes confirm() and cancel() methods
│       │   └── users.ts               # list(), get(), updateRole(), delete(), getTenants(), assignTenant(), removeTenant()
│       │
│       ├── components/
│       │   ├── Layout/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── Header.tsx         # User avatar with logout dropdown (useState for open/close)
│       │   │   └── Layout.tsx
│       │   ├── AuthGuard.tsx          # Reads Redux accessToken; redirects to /login if null
│       │   ├── DataTable.tsx          # Table with search, sort, pagination, ActionMenu per row
│       │   ├── SummaryTiles.tsx       # Configurable stat tile grid
│       │   ├── DetailHeader.tsx       # Avatar + title + StatusBadge + subtitle
│       │   ├── InfoCardGrid.tsx       # 4-column info card grid
│       │   ├── FormCard.tsx           # Centered max-w-3xl form wrapper card
│       │   ├── TenantSelector.tsx     # Dispatches setSelectedTenant to Redux
│       │   ├── StatusBadge.tsx        # Pill badges using STATUS_BADGE_COLORS from constants
│       │   ├── InventoryQuickUpdate.tsx
│       │   ├── ActionMenu.tsx         # Three-dot dropdown (View/Edit/Delete)
│       │   ├── ConfirmDialog.tsx      # Modal confirmation dialog (isOpen, title, message, onConfirm, onCancel)
│       │   ├── LoadingSkeleton.tsx    # Animated placeholder rows (rows prop)
│       │   └── EmptyState.tsx         # Centered empty-data state (icon, heading, subtext, action)
│       │
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── tenants/
│       │   │   ├── TenantListPage.tsx
│       │   │   ├── TenantDetailPage.tsx     ← NEW in v5
│       │   │   └── TenantEditPage.tsx
│       │   ├── products/
│       │   │   ├── ProductListPage.tsx
│       │   │   ├── ProductDetailPage.tsx
│       │   │   └── ProductEditPage.tsx
│       │   ├── inventory/
│       │   │   ├── InventoryListPage.tsx
│       │   │   ├── InventoryDetailPage.tsx
│       │   │   └── InventoryEditPage.tsx
│       │   └── orders/
│       │       ├── OrderListPage.tsx
│       │       ├── OrderDetailPage.tsx
│       │       └── OrderEditPage.tsx
│       │   └── users/                     # Admin-only; shown in sidebar only when role === 'admin'
│       │       ├── UserListPage.tsx        # DataTable: all users + assigned tenant count; role badge
│       │       └── UserDetailPage.tsx      # User info + tenant assignment manager (assign/remove tenants)
│       │
│       └── utils/
│           ├── formatters.ts          # Currency, date formatting helpers
│           ├── constants.ts           # Category enum values, status values, badge color maps, pagination defaults
│           └── apiError.ts            # Normalises Axios errors → readable message string (reads error.response.data.error.message)
│
└── docs/
    └── architecture.md
```

---

## 15. Migration & Seed Strategy

- Alembic manages all schema changes as versioned Python scripts
- `alembic upgrade head` runs on API container startup (entrypoint, before uvicorn)
- Seed script (`app/seed.py`) creates:
  - 1 admin user (email: `admin@ims.com`, password from `.env`, role: `admin`)
  - 1 regular user (email: `user@ims.com`, password from `.env`, role: `user` — zero assignments, so all-access by default; demonstrates the default behaviour)
  - 2 tenants: "Acme Corp" (TEN-001, active), "Global Tech" (TEN-002, inactive)
  - Sample products per tenant with varied categories and statuses
  - Corresponding inventory rows (some below reorder threshold)
  - Sample orders in `created`, `pending`, and `cancelled` status
- `SEED_ON_STARTUP=true` for dev, `false` for production

---

## 16. Implementation Phases (13 phases)

Follow these phases in order. Each phase must be fully working before proceeding. Each phase delivers a coherent, testable slice.

---

### Phase 1 — Infrastructure Foundation
**Goal**: All services boot with one command.

| Key files | `docker-compose.yml`, `.env.example`, `nginx/nginx.conf` |
|-----------|---|

**Build**:
- Docker Compose with 5 services: `nginx`, `api`, `frontend`, `db`, `redis`
- Nginx config: reverse proxy `api` at `/api/`, `frontend` at `/`
- `.env.example` with all required variables (DB creds, JWT secrets, Redis password, SEED_ON_STARTUP)
- Health check stubs (containers start and pass health checks)

**Acceptance criteria**:
- `docker compose up` starts all 5 services without errors
- `curl http://localhost/health` → nginx proxies to api → 200 (even if api returns a stub)
- DB and Redis containers are healthy per Docker healthchecks

---

### Phase 2 — Database Schema & Seed
**Goal**: Full schema exists in Postgres with RLS, indexes, and realistic demo data.

| Key files | `alembic/versions/0001_initial_schema.py`, `app/database.py`, `app/*/models.py`, `app/seed.py` |
|-----------|---|

**Build**:
- Alembic migration creating all 6 tables with all constraints (FK, CHECK, UNIQUE, DEFAULT)
- All indexes from Section 5
- RLS policies on `products`, `inventory`, `orders`
- SQLAlchemy models with relationships
- Seed script: admin user, 2 tenants (TEN-001 active, TEN-002 inactive), 5+ products per tenant, inventory rows (mix of above/below threshold), 5+ orders per tenant (mix of created/pending/cancelled)

**Acceptance criteria**:
- `alembic upgrade head` creates all tables with zero errors
- `SEED_ON_STARTUP=true` populates realistic data
- Verify RLS: `SET app.current_tenant_id = '<id>'` then `SELECT * FROM products` returns only that tenant's rows

---

### Phase 3 — API Foundation & Middleware
**Goal**: FastAPI app skeleton with all cross-cutting concerns wired up.

| Key files | `app/main.py`, `app/config.py`, `app/middleware/tenant.py`, `app/middleware/logging.py`, `app/middleware/error_handler.py` |
|-----------|---|

**Build**:
- FastAPI app factory with CORS (whitelist frontend origin)
- `GET /health` → `{ "status": "ok", "version": "1.0.0" }`
- Structured logging middleware (structlog) with correlation IDs per request
- Global exception handler: maps Python exceptions → JSON `{ "error": { "code": "...", "message": "..." } }` responses
- Tenant middleware skeleton (wired but not enforced until auth is built)
- Pydantic `BaseSettings` loading from `.env`

**Acceptance criteria**:
- `GET /health` → 200
- Unhandled exception → consistent JSON error (not HTML traceback)
- Request logs include `request_id`, `method`, `path`, `status_code`, `duration_ms`
- CORS blocks requests from disallowed origins

---

### Phase 4 — Auth System
**Goal**: Stateless JWT auth with real logout via Redis token blacklist.

| Key files | `app/auth/router.py`, `app/auth/service.py`, `app/auth/dependencies.py`, `app/auth/schemas.py`, `app/auth/models.py` |
|-----------|---|

**Build**:
- `POST /auth/register` → hashes password (bcrypt cost 12), creates user
- `POST /auth/login` → returns `access_token` (15min JWT) + `refresh_token` (7d, HTTP-only cookie)
- `POST /auth/refresh` → validates refresh token not blacklisted → issues new token pair + blacklists old refresh token
- `POST /auth/logout` → blacklists refresh token in Redis (TTL = remaining token lifetime)
- `GET /auth/me` → returns current user + their tenant roles
- Failed login throttle: 5 attempts per email per 15 min (Redis counter)
- `get_current_user()` FastAPI dependency — decodes JWT, returns current user object; used on all protected routes
- `require_admin()` FastAPI dependency — wraps `get_current_user()`; returns 403 if the user's role is not `admin`. Used exclusively on tenant POST/PUT/DELETE endpoints.
- All other authenticated endpoints (products, inventory, orders) only require `get_current_user()` + valid `X-Tenant-Id` — both Admin and User roles can access them.
- Full tenant middleware: extract `X-Tenant-Id` → verify user may access that tenant (admin = always; user = all-access if zero assignments, else must be in assignment list) → `SET LOCAL app.current_tenant_id`

**Acceptance criteria**:
- Register + login → returns valid JWT pair
- Access token decoded → correct user claims
- Refresh → new token pair, old refresh rejected on reuse
- Logout → refresh token rejected immediately
- 5 failed logins → 429 on 6th attempt
- Request to tenant-scoped endpoint without `X-Tenant-Id` → 400
- Request with a tenant the user is not assigned to → 403
- User role calling POST/PUT/DELETE on `/api/v1/tenants` → 403
- Admin role calling POST/PUT/DELETE on `/api/v1/tenants` → succeeds
- User with zero tenant assignments (all-access default) can use any `X-Tenant-Id` → 200
- User with assignments restricted to tenant A sending `X-Tenant-Id` of tenant B → 403

---

### Phase 5 — Tenant CRUD API + User Management API
**Goal**: Full tenant lifecycle with display IDs and duplicate detection, plus admin-only User Management endpoints.

| Key files | `app/tenants/router.py`, `app/tenants/service.py`, `app/tenants/models.py`, `app/tenants/schemas.py`, `app/users/router.py`, `app/users/service.py`, `app/users/repository.py`, `app/users/schemas.py` |
|-----------|---|

**Build**:
- `GET /api/v1/tenants` → paginated list + summary `{ total, active, inactive }` (admin sees all; user sees all by default, or only assigned tenants if restricted)
- `POST /api/v1/tenants` → requires `admin` role; creates tenant, auto-generates `TEN-XXX` display ID, status defaults to `active`
- `GET /api/v1/tenants/:id` → single tenant detail
- `PUT /api/v1/tenants/:id` → requires `admin` role; update name/status; duplicate name → 409
- `DELETE /api/v1/tenants/:id` → requires `admin` role; soft-delete
- **User Management** (all require `require_admin()`):
  - `GET /api/v1/users` → list all users with `assigned_tenant_count`
  - `GET /api/v1/users/:id` → user detail including assigned tenants
  - `PUT /api/v1/users/:id` → update role (`admin` | `user`)
  - `DELETE /api/v1/users/:id` → soft-delete user
  - `GET /api/v1/users/:id/tenants` → tenants assigned to user
  - `POST /api/v1/users/:id/tenants` → assign tenant `{ "tenant_id": "..." }`
  - `DELETE /api/v1/users/:id/tenants/:tenant_id` → remove assignment

**Acceptance criteria**:
- Tenant created with correct TEN-XXX format (TEN-001, TEN-002, etc.)
- Duplicate name → 409 with message "Tenant name already exists"
- Soft-deleted tenants excluded from list
- Summary counts reflect current state
- Admin sees all tenants; User with zero assignments sees all tenants; User with assignments sees only those
- User attempting POST/PUT/DELETE on tenants → 403
- Non-admin calling any `/users` endpoint → 403
- Assigning a tenant to a user → that user now sees only their assigned tenants (restriction kicks in)
- Removing all assignments from a user → user reverts to seeing all tenants

---

### Phase 6 — Product & Inventory CRUD API
**Goal**: Product lifecycle with automatic inventory creation and stock management.

| Key files | `app/products/*`, `app/inventory/*` |
|-----------|---|

**Build**:
- **Products**:
  - `GET /api/v1/products` → paginated list + summary `{ total, active, inactive }`, filtered by `X-Tenant-Id` via RLS
  - `POST /api/v1/products` → creates product + auto-creates inventory row (stock=0, unit from request body, default 'units') in one DB transaction
  - `GET /api/v1/products/:id` → detail including inventory snapshot (`current_stock`, `unit`)
  - `PUT /api/v1/products/:id` → update; reject if `sku` field changes → 422
  - `DELETE /api/v1/products/:id` → soft-delete product + soft-delete inventory row (cascade)
- **Inventory**:
  - `GET /api/v1/inventory` → paginated list + summary `{ below_reorder_count }`, RLS-filtered
  - `GET /api/v1/inventory/:id` → detail (includes product info)
  - `PATCH /api/v1/inventory/:id` → `{ "current_stock": N }` updates stock; `current_stock` cannot be negative
  - `DELETE /api/v1/inventory/:id` → soft-delete inventory + cascades to soft-delete parent product

**Acceptance criteria**:
- Product create → inventory row exists immediately (stock=0)
- SKU change attempt on edit → 422
- Inventory list `below_reorder_count` is accurate
- PATCH stock to negative → 422
- Deleting product → inventory row also soft-deleted
- Deleting inventory → parent product also soft-deleted
- Cross-tenant data access → RLS returns empty (not 403 — the RLS policy silently filters)

---

### Phase 7 — Order CRUD & Status Flow API
**Goal**: Complete order lifecycle with inventory deduction, concurrency safety, and all status transitions.

| Key files | `app/orders/router.py`, `app/orders/service.py`, `app/orders/models.py`, `app/orders/schemas.py` |
|-----------|---|

**Build**:
- `GET /api/v1/orders` → paginated list + summary `{ total, pending, created, cancelled }`, RLS-filtered
- `POST /api/v1/orders`:
  - Validate product is `active` → 400 if inactive
  - `SELECT ... FOR UPDATE` on inventory
  - If `stock ≥ qty`: status = `created`, deduct stock (transaction)
  - If `stock < qty`: status = `pending`, no deduction
  - Auto-generate `ORD-XXXX` display ID (per-tenant counter)
- `GET /api/v1/orders/:id` → detail with product info + inventory snapshot
- `PUT /api/v1/orders/:id`:
  - 409 if status = `cancelled`
  - If status = `created`: only `notes` updatable; reject qty change → 422
  - If status = `pending`: `requested_qty` + `notes` updatable
- `DELETE /api/v1/orders/:id` → soft-delete
- `POST /api/v1/orders/:id/confirm`:
  - 409 if status ≠ `pending`
  - `SELECT ... FOR UPDATE` on inventory
  - If `stock ≥ qty`: status = `created`, deduct stock (transaction)
  - If `stock < qty`: 409 "Insufficient stock (available: X, requested: Y)"
- `POST /api/v1/orders/:id/cancel`:
  - 409 if already `cancelled`
  - If was `created`: restore stock (transaction)
  - If was `pending`: no stock change
  - Set status = `cancelled`

**Acceptance criteria**:
- Create with sufficient stock → `created` + stock decremented
- Create with insufficient stock → `pending` + stock unchanged
- Confirm pending with sufficient stock → `created` + stock decremented
- Confirm pending with insufficient stock → 409
- Cancel created → `cancelled` + stock restored
- Cancel pending → `cancelled` + stock unchanged
- Confirm cancelled → 409
- Edit qty on created order → 422
- Edit qty on pending order → success
- Edit cancelled order → 409
- ORD-XXXX increments correctly per tenant

---

### Phase 8 — Backend Tests
**Goal**: Verified correctness of all business rules, tenant isolation, and concurrency.

| Key files | `tests/conftest.py`, `tests/test_auth.py`, `tests/test_tenants.py`, `tests/test_products.py`, `tests/test_inventory.py`, `tests/test_orders.py` |
|-----------|---|

**Build**:
- Test fixtures: isolated test DB, tenant factory, user factory (with roles), product/inventory/order factories
- Auth tests: register, login, refresh, logout, throttle, invalid tokens
- Tenant tests: CRUD, duplicate name, soft-delete, admin vs. user visibility
- Product tests: CRUD, SKU immutability, inventory auto-creation, cascade delete
- Inventory tests: PATCH stock, negative stock rejection, below-reorder-count accuracy
- Order tests: all 7 state-machine transitions, qty-edit restriction, concurrent confirm race condition test
- Cross-tenant RLS test: user A cannot access user B's data (explicit verification)

**Acceptance criteria**:
- `pytest` passes with >80% service layer coverage
- Cross-tenant test: user A's JWT + user B's tenant ID → empty results (not 403)
- Concurrent confirm test: 2 simultaneous confirms when only 1 unit available → exactly one succeeds, one fails with 409

---

### Phase 9 — Frontend Foundation
**Goal**: App boots with correct layout, routing, login/logout flow, and protected route guard.

| Key files | `frontend/package.json`, `vite.config.ts`, `tailwind.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/components/Layout/*`, `src/components/AuthGuard.tsx`, `src/store/*`, `src/api/client.ts`, `src/pages/LoginPage.tsx` |
|-----------|---|

**Build**:
- Vite + React 18 + TypeScript + Tailwind CSS configured
- `@phosphor-icons/react`, `@reduxjs/toolkit`, `react-redux`, `axios`, `react-router-dom`, `react-hook-form`, `zod`, `sonner` installed
- Redux store: `authSlice` (user, accessToken) + `tenantSlice` (selectedTenantId, tenants)
- `src/types/` directory populated with all entity type interfaces (see Section 14)
- Axios client (`src/api/client.ts`):
  - Base URL from `VITE_API_URL` env variable
  - Request interceptor: injects `Authorization: Bearer <token>` from Redux store
  - Request interceptor: injects `X-Tenant-Id` from Redux tenant store on every request
  - Response interceptor: on 401 → calls `POST /auth/refresh` → retries original request → on refresh failure → dispatches `clearCredentials` + navigates to `/login`
- All routes wired. `/login` is public. All other routes wrapped by `AuthGuard`
- **`AuthGuard`** (`src/components/AuthGuard.tsx`): reads Redux `accessToken`; if null → `<Navigate to="/login" replace />`; on mount validates token via `GET /auth/me`
- **`Layout`** (`src/components/Layout/Layout.tsx`): Sidebar + Header + `<Outlet />`. Contains NO auth logic.
- **`Sidebar`**: 4 nav links with active-state highlighting via `useLocation()`
- **`Header`** (`src/components/Layout/Header.tsx`):
  - Bell icon (static, gray-400)
  - User avatar circle (blue-500, initials from `auth.user`) with click-toggle dropdown
  - Dropdown: user name + email + divider + Logout button
  - Logout: calls `authApi.logout()` → dispatches `clearCredentials()` + `setSelectedTenant(null)` → navigates to `/login`
- **`LoginPage`** (`src/pages/LoginPage.tsx`):
  - Email + password form using `react-hook-form` + zod schema (`loginSchema`: email required, password required min 6 chars)
  - On submit: calls `POST /auth/login` → dispatches `setCredentials({ user, accessToken })` → navigates to `/tenants`
  - If already authenticated (token in Redux), redirects away from `/login` to `/tenants`
  - Shows inline field errors + toast on API failure
- `<Toaster />` mounted in `main.tsx`

**Acceptance criteria**:
- `npm run dev` boots without errors
- Unauthenticated visit to `/tenants` → redirects to `/login`
- Login with valid credentials → stores token in Redux → navigates to `/tenants`
- Visiting `/login` while already logged in → redirects to `/tenants`
- Logout from header dropdown → clears Redux state → navigates to `/login` → all routes protected again
- Axios auto-refreshes token on 401 silently; if refresh fails → user sent to `/login`
- Sidebar renders with correct icons; active link highlights on current route

---

### Phase 10 — Shared Component Library
**Goal**: All reusable UI components built and individually verified before pages consume them.

| Key files | `src/components/DataTable.tsx`, `src/components/SummaryTiles.tsx`, `src/components/DetailHeader.tsx`, `src/components/InfoCardGrid.tsx`, `src/components/FormCard.tsx`, `src/components/TenantSelector.tsx`, `src/components/StatusBadge.tsx`, `src/components/InventoryQuickUpdate.tsx`, `src/components/ActionMenu.tsx`, `src/components/ConfirmDialog.tsx`, `src/components/LoadingSkeleton.tsx`, `src/components/EmptyState.tsx`, `src/types/` |
|-----------|---|

**Build**:
- `<DataTable>`: renders a table from column definitions + row data; includes search input (configurable placeholder), sort dropdown, pagination ("Showing X to Y of Z results" + prev/page numbers/next), three-dot `<ActionMenu>` per row, row-click handler. Renders `<LoadingSkeleton>` when `loading=true`; renders `<EmptyState>` when `data.length === 0` and not loading.
- `<SummaryTiles>`: accepts array of tile configs `{ label, value, dotColor, subtitle }`; renders grid-cols-N
- `<DetailHeader>`: avatar circle + title + `<StatusBadge>` + subtitle line
- `<InfoCardGrid>`: 4-column card grid, each card has label + value + optional text color override
- `<FormCard>`: white rounded card with `<form>` wrapper, accepts children
- `<TenantSelector>`: dropdown that dispatches `setSelectedTenant` to Redux; reads current tenants from `tenantSlice`
- `<StatusBadge>`: maps `active`/`inactive`/`created`/`pending`/`cancelled` to correct pill color using `STATUS_BADGE_COLORS` from `constants.ts` — no hardcoded color strings in JSX
- `<InventoryQuickUpdate>`: number input (prefilled) + "Update Stock" button; calls `PATCH /inventory/:id` on submit; shows toast on success/error
- `<ActionMenu>`: three-dot button → dropdown with configurable items (View, Edit, Delete in red); stops row-click propagation
- `<ConfirmDialog>`: modal overlay (fixed inset-0 bg-black/50) with white card centered; props: `isOpen`, `title`, `message`, `confirmLabel` (default "Delete"), `onConfirm`, `onCancel`; Confirm button is red-600; ESC key closes dialog
- `<LoadingSkeleton>`: accepts `rows` prop (default 5); renders N animated `animate-pulse` gray rows that match the table row height
- `<EmptyState>`: accepts `icon` (Phosphor component), `heading`, `subtext`, optional `action` `{ label, onClick }`; centered layout with gray-400 icon, gray-900 heading, gray-500 subtext
- All component props defined using interfaces from `src/types/` — no `any` props
- All status/category values referenced from `utils/constants.ts` — no inline string literals for domain values

**Acceptance criteria**:
- All components render correctly with mock data
- `<StatusBadge>` shows correct color for all 5 status values
- `<TenantSelector>` change dispatches to Redux and updates `selectedTenantId`
- `<DataTable>` shows `<LoadingSkeleton>` when `loading=true`; shows `<EmptyState>` when empty
- `<ConfirmDialog>` opens and closes correctly; ESC closes it; Confirm fires `onConfirm` callback
- No TypeScript `any` types in any component

---

### Phase 11 — Tenant, Product & User Management Pages
**Goal**: Fully working Tenant, Product, and User Management modules end-to-end.

| Key files | `src/pages/tenants/*`, `src/pages/products/*`, `src/pages/users/*`, `src/hooks/useTenants.ts`, `src/hooks/useProducts.ts`, `src/hooks/useUsers.ts`, `src/schemas/tenantSchema.ts`, `src/schemas/productSchema.ts`, `src/api/tenants.ts`, `src/api/products.ts`, `src/api/users.ts` |
|-----------|---|

**Build**:
- **Tenant pages**:
  - `TenantListPage`: DataTable (TEN-XXX, Name, Status) + 2 summary tiles + search/sort/pagination; row click → `/tenants/:id`; action menu → view/edit/delete
  - `TenantDetailPage`: DetailHeader + 2 info cards (Status, Created Date) + Edit/Delete buttons
  - `TenantEditPage`: FormCard with Tenant Name field (+ Status toggle on edit); zod validation; duplicate name → inline error via toast; save → redirect to list/detail
- **Product pages**:
  - `ProductListPage`: DataTable + 2 summary tiles + TenantSelector; row click → `/products/:id`
  - `ProductDetailPage`: DetailHeader + 4 info cards + Additional Information (Description + InventoryQuickUpdate)
  - `ProductEditPage`: all fields from Section 2.6; SKU read-only on edit; status toggle; zod validation; toast on save
- **User Management pages** (admin-only — component redirects to `/tenants` if `auth.user.role !== 'admin'`):
  - `UserListPage`: DataTable (Email, Role badge, Assigned Tenants count) + search; action menu → View; no Create (users register themselves)
  - `UserDetailPage`: User info (email, role) + Assigned Tenants section: list of assigned tenants (empty = all-access message "This user can see all tenants by default") + Add Tenant button (opens a select dropdown of available tenants) + Remove button per row
- Zod schemas wired with `zodResolver`; inline field errors under each input
- After every mutation: call `refetch()` to reload list data

**Acceptance criteria**:
- Tenant list shows TEN-XXX format IDs, correct status badges
- Create tenant with duplicate name → inline error displayed
- Product list filters by selected tenant (switching tenant reloads table)
- Product detail shows Current Stock from inventory snapshot (blue-600 text)
- InventoryQuickUpdate on product detail updates stock without page reload
- SKU field shows gray background and is non-editable on product edit
- Toast notification on every create/update/delete
- User list visible only when logged in as Admin; navigating to `/users` as a User role redirects to `/tenants`
- UserDetailPage: user with zero assignments shows "This user can see all tenants" message
- Assigning a tenant and removing it updates the assignment list in real time
- Role badge correctly shows "Admin" or "User"

---

### Phase 12 — Inventory & Order Pages
**Goal**: Fully working Inventory and Order modules with all business logic visible in the UI.

| Key files | `src/pages/inventory/*`, `src/pages/orders/*`, `src/hooks/useInventory.ts`, `src/hooks/useOrders.ts`, `src/schemas/orderSchema.ts`, `src/api/inventory.ts`, `src/api/orders.ts` |
|-----------|---|

**Build**:
- **Inventory pages**:
  - `InventoryListPage`: DataTable + 1 summary tile (below-reorder count in red) + TenantSelector; **stock color rule**: blue-600 if ≥ threshold, red-600 if < threshold
  - `InventoryDetailPage`: DetailHeader (product name = clickable Link to `/products/:id`) + 4 info cards + Description + InventoryQuickUpdate + **Reset Stock button** (amber-600, opens ConfirmDialog before zeroing stock)
  - `InventoryEditPage`: FormCard with Product Name (read-only), SKU (read-only), Current Stock (editable); save → `/inventory/:id`
  - Delete on inventory → confirmation modal "This will also delete [Product Name]. Continue?" → `DELETE /inventory/:id`
  - **Reset Stock** in action menu (list + detail): ConfirmDialog "Reset [Product Name] stock to 0?" → `PATCH /inventory/:id { "current_stock": 0 }` → refetch; visually distinct from Delete (amber vs red)
- **Order pages**:
  - `OrderListPage`: DataTable + 3 summary tiles + TenantSelector; correct status badges (Created/Pending/Cancelled, not Active)
  - `OrderDetailPage`:
    - DetailHeader with correct status badge
    - Product name in subtitle is a clickable Link to `/products/:id`
    - 4 info cards
    - Confirm Order button (visible only when `pending`) + Cancel Order button (visible when `created` or `pending`); both hidden when `cancelled`
    - Confirm calls `POST /orders/:id/confirm`; Cancel calls `POST /orders/:id/cancel`; refetch on success
  - `OrderEditPage`: product dropdown (active products only; inactive shown but disabled); qty field disabled when order is `created`; notes always editable; zod validation

**Acceptance criteria**:
- Inventory list: stock in blue-600 when ≥ threshold, red-600 when < threshold
- Inventory below-reorder tile count is accurate
- Inventory detail: product name navigates to correct product detail page
- **Reset Stock** (list action + detail button): opens ConfirmDialog → on confirm, stock set to 0, row updates in place, record and product are NOT deleted
- Reset Stock amber button is visually distinct from the red Delete button
- Order list: 3 tiles (Total, Pending, Created) with correct values
- Order create: inactive products appear grayed out and cannot be selected
- Order detail: Confirm button only on `pending` orders; Cancel button on `created` or `pending`; neither on `cancelled`
- Confirming a pending order → status changes to `created` + stock updated
- Cancelling a created order → status changes to `cancelled` + stock restored
- Editing qty on a `created` order → qty field is disabled; only notes can be saved

---

### Phase 13 — Polish, Empty States & Security Verification
**Goal**: Production-quality UX and verified security posture.

| Key files | All pages + cross-cutting |
|-----------|---|

**Polish**:
- Loading skeleton on every list page during API calls (gray animated placeholder rows instead of blank)
- Empty state component for every list ("No tenants yet. Create your first one." with a + button) when `data.length === 0` and no search query active
- Error state when API call fails ("Failed to load data. Retry.")
- Search empty state when query returns 0 results ("No results for '[query]'")
- Correct search placeholders enforced everywhere:
  - Tenant list: "Search tenants..."
  - Product list: "Search products..."
  - Inventory list: "Search inventory..."
  - Order list: "Search orders..."
- All forms show inline zod errors below fields (not just toast)
- Double-submit prevention: Save buttons disabled + show spinner during API call
- Confirmation dialog before every Delete action

**Security verification**:
- CORS: verify non-whitelisted origin is blocked
- Rate limiting: verify auth endpoints throttle at 5 attempts
- RLS: switch tenants in UI → confirm zero cross-tenant data leakage
- JWT expiry: wait for access token to expire → verify silent refresh works (no logout)
- Soft deletes: verify deleted items never appear in any list

**Acceptance criteria**:
- Every list page shows loading skeleton during initial load
- Every empty list shows an empty state message
- Every form shows field-level errors for invalid input
- Save buttons cannot be clicked twice during submission
- Switching tenants → every list page reloads with correct data for the new tenant
- Deleting any entity → soft-delete confirmed, item disappears from list, accessible at detail URL still (for audit)

---

## 17. Wireframe Reference Files — Corrections Applied

| File | Page | Corrections in v5 |
|------|------|-------------------|
| `tenant_list.html` | Tenant list | Search placeholder → "Search tenants..." (was "Search products..."); row click + View → `/tenants/:id` |
| `tenant_edit.html` | Tenant create | Status toggle added to edit mode only |
| `product_list.html` | Product list | (No corrections needed) |
| `product_detail.html` | Product detail | (Matches plan exactly) |
| `product_edit.html` | Product edit | (Matches plan exactly) |
| `inventory_list.html` | Inventory list | Search placeholder → "Search inventory..." (was "Search products...") |
| `inventory_detail.html` | Inventory detail | (Product name as link confirmed from wireframe) |
| `inventory_edit.html` | Inventory edit | (Matches plan) |
| `order_list.html` | Order list | Search placeholder → "Search orders..." (was "Search products...") |
| `order_detail.html` | Order detail | Status badge "Active" → correct statuses; Confirm + Cancel buttons added (required by spec, missing from wireframe) |
| `order_edit.html` | Order create | Qty field disabled when editing a `created` order |

---

## 18. v5 Delta Summary (changes from v4)

| # | Change | Rationale |
|---|--------|-----------|
| 1 | Redux Toolkit re-introduced (replaces React Context) | Requirements explicitly list Redux. RTK has minimal boilerplate (~60 lines for 2 slices). Demonstrates Redux competency expected by evaluators. |
| 2 | Tenant Detail page added (`/tenants/:id`, `TenantDetailPage.tsx`) | "View" action in tenant action menu requires a destination; no-op creates broken UX. Simple detail page satisfies this cleanly. |
| 3 | Order edit business rule clarified | Editing quantity on a `created` order (stock already deducted) creates stock inconsistency. Rule: `created` orders → notes-only edit; `pending` orders → qty + notes edit. |
| 4 | Inventory delete cascades to parent product | Inventory is 1:1 with product. Deleting inventory directly creates an orphaned product in invalid state. Delete cascade with confirmation dialog is the correct behavior. |
| 5 | 12 phases → 13 phases | Auth API extracted to its own phase (Phase 4); Tenant + Product pages split from Inventory + Order pages (phases 11/12). Each phase is now a more manageable, coherent unit. |
| 6 | Project structure: `contexts/` → `store/` | Reflects RTK architecture. `authSlice.ts` + `tenantSlice.ts` replace `AuthContext.tsx` + `TenantContext.tsx`. |
| 7 | `inventory.current_stock` CHECK ≥ 0 added | Stock cannot go negative. API should also enforce this (`PATCH` with `current_stock < 0` → 422). |
| 8 | Explicit "Decisions & Assumptions" section added | Documents all tech stack choices and ambiguity resolutions for the interview discussion. |
| 9 | **Header logout dropdown added** | User avatar in header is now an interactive dropdown showing user name/email + Logout button. Logout dispatches `clearCredentials`, calls `POST /auth/logout`, and navigates to `/login`. |
| 10 | **`AuthGuard` component added** | Explicit route guard component wrapping all protected routes. Reads `accessToken` from Redux; redirects to `/login` if null. Validates token via `GET /auth/me` on app startup. Keeps `Layout.tsx` free of auth logic. |
| 11 | **Repository layer added to all backend modules** | Each module now has `router.py` → `service.py` → `repository.py` → `models.py`, satisfying the evaluation criterion "Routes → Controllers → Services → Repositories". Service layer contains zero SQLAlchemy code. |
| 12 | **`src/types/` directory added** | Centralises all TypeScript interfaces for API responses, entity shapes, and input types. Eliminates `any` types and ensures all hooks, API modules, and components share consistent type definitions. |
| 13 | **`ConfirmDialog`, `LoadingSkeleton`, `EmptyState` promoted to Phase 10** | These components were mentioned in Phase 13 polish but not formally defined. Moving them to the shared component library phase ensures they are available when entity pages are built in Phases 11/12. |
| 14 | **Code Quality Conventions section added** | Explicit list of enforced patterns (no magic strings, no `any`, layered separation, consistent error handling) so Cursor and developers follow the same standards throughout implementation. |
| 15 | **`utils/apiError.ts` added** | Single helper for extracting readable messages from Axios errors. Eliminates scattered `catch (e: any)` patterns with inconsistent error extraction. |
| 16 | **4-role RBAC → 2-role RBAC (Admin / User)** | Requirements user stories use exactly two actor labels: "Admin" (tenant management, User Stories 1.1–1.2) and "User" (products, inventory, orders, User Stories 2.x–4.x). The prior 4-role model (Superadmin, Admin, Manager, Viewer) was over-engineered. Simplified to Admin (full CRUD on all entities, sees all tenants) and User (full CRUD on products/inventory/orders within accessible tenants, cannot manage tenants). `is_superadmin` column removed from `users` table. `require_role(min_role)` replaced with `require_admin()` on tenant write endpoints. |
| 17 | **User Management + optional tenant assignment added** | Requirements do not specify any user-tenant restriction. Default behaviour: all users see all tenants. Added Admin-only User Management pages so Admins can optionally restrict specific users to specific tenants. A user with zero rows in `user_tenant_roles` retains all-access; a user with assignments sees only those tenants. `app/users/` module added (router, service, repository, schemas). `UserListPage` and `UserDetailPage` added (admin-only). `useUsers.ts`, `api/users.ts`, `types/user.ts` added. Documented as Assumptions #11 and #12. Raise at the interview. |
