"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable required extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="user"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.CheckConstraint("role IN ('admin', 'user')", name="users_role_check"),
    )

    # ── tenants ────────────────────────────────────────────────────────────────
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("display_id", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("display_id", name="uq_tenants_display_id"),
        sa.UniqueConstraint("name", name="uq_tenants_name"),
        sa.CheckConstraint("status IN ('active', 'inactive')", name="tenants_status_check"),
    )

    # ── user_tenant_roles ──────────────────────────────────────────────────────
    op.create_table(
        "user_tenant_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.UniqueConstraint("user_id", "tenant_id", name="uq_user_tenant"),
    )

    # ── products ───────────────────────────────────────────────────────────────
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("sku", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("cost_per_unit", sa.Numeric(12, 2), nullable=False),
        sa.Column("reorder_threshold", sa.Integer, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("category IN ('Metals', 'Chemicals', 'Plastics')", name="products_category_check"),
        sa.CheckConstraint("status IN ('active', 'inactive')", name="products_status_check"),
        sa.CheckConstraint("reorder_threshold >= 0", name="products_reorder_threshold_check"),
        sa.CheckConstraint("cost_per_unit > 0", name="products_cost_per_unit_check"),
    )
    op.create_unique_constraint("uq_products_tenant_sku", "products", ["tenant_id", "sku"])
    op.create_index("idx_products_tenant", "products", ["tenant_id"])
    op.create_index("idx_products_name_trgm", "products", ["name"], postgresql_using="gin",
                    postgresql_ops={"name": "gin_trgm_ops"})

    # ── inventory ──────────────────────────────────────────────────────────────
    op.create_table(
        "inventory",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("current_stock", sa.Integer, nullable=False, server_default="0"),
        sa.Column("unit", sa.String(20), nullable=False, server_default="units"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("current_stock >= 0", name="inventory_current_stock_check"),
    )
    op.create_index("idx_inventory_tenant", "inventory", ["tenant_id"])
    op.create_index("idx_inventory_product", "inventory", ["product_id"])

    # ── orders ─────────────────────────────────────────────────────────────────
    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("display_id", sa.String(20), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("requested_qty", sa.Integer, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="created"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("order_date", sa.Date, server_default=sa.text("CURRENT_DATE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('created', 'pending', 'cancelled')", name="orders_status_check"),
        sa.CheckConstraint("requested_qty > 0", name="orders_requested_qty_check"),
    )
    op.create_index("idx_orders_tenant", "orders", ["tenant_id"])
    op.create_index("idx_orders_status", "orders", ["tenant_id", "status"])
    op.create_index("idx_orders_date", "orders", ["tenant_id", sa.text("order_date DESC")])
    op.create_index("idx_orders_product", "orders", ["product_id"])

    # ── Row-Level Security ─────────────────────────────────────────────────────
    for table in ("products", "inventory", "orders"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation_{table} ON {table} "
            f"USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)"
        )

    # Allow superuser / owner to bypass RLS for seed and migrations
    op.execute("ALTER TABLE products NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE inventory NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE orders NO FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in ("products", "inventory", "orders"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.drop_table("orders")
    op.drop_table("inventory")
    op.drop_table("products")
    op.drop_table("user_tenant_roles")
    op.drop_table("tenants")
    op.drop_table("users")
