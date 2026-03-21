"""
Seed script — run once on startup if SEED_ON_STARTUP=true.
Creates: 1 admin user, 1 regular user, 2 tenants, 5 products per tenant,
         inventory rows, and sample orders.
"""

import asyncio
import os
import uuid
from datetime import date
from decimal import Decimal

from passlib.context import CryptContext
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.auth.models import User, UserTenantRole
from app.tenants.models import Tenant
from app.products.models import Product
from app.inventory.models import Inventory
from app.orders.models import Order

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_EMAIL = "admin@ims.com"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123!")
USER_EMAIL = "user@ims.com"
USER_PASSWORD = os.getenv("USER_PASSWORD", "user123!")

TENANTS = [
    {"display_id": "TEN-001", "name": "Alpha Manufacturing", "status": "active"},
    {"display_id": "TEN-002", "name": "Beta Chemicals Ltd", "status": "active"},
]

PRODUCTS_PER_TENANT = [
    [
        {"sku": "ALU-001", "name": "Aluminium Sheet 2mm", "category": "Metals", "cost_per_unit": Decimal("45.50"),
         "reorder_threshold": 50, "unit": "sheets", "description": "High-grade aluminium sheet"},
        {"sku": "STL-002", "name": "Steel Rod 10mm", "category": "Metals", "cost_per_unit": Decimal("12.00"),
         "reorder_threshold": 100, "unit": "units", "description": "Mild steel rod"},
        {"sku": "COP-003", "name": "Copper Wire 1mm", "category": "Metals", "cost_per_unit": Decimal("8.75"),
         "reorder_threshold": 200, "unit": "kg", "description": "99.9% copper wire"},
        {"sku": "RUB-004", "name": "Rubber Seal Kit", "category": "Plastics", "cost_per_unit": Decimal("3.20"),
         "reorder_threshold": 30, "unit": "units", "description": "Industrial rubber seals"},
        {"sku": "PLX-005", "name": "Polyethylene Film", "category": "Plastics", "cost_per_unit": Decimal("22.00"),
         "reorder_threshold": 15, "unit": "kg", "description": "Clear PE film"},
    ],
    [
        {"sku": "ACE-001", "name": "Acetone Solvent", "category": "Chemicals", "cost_per_unit": Decimal("18.00"),
         "reorder_threshold": 40, "unit": "litres", "description": "Industrial acetone"},
        {"sku": "HCL-002", "name": "Hydrochloric Acid 30%", "category": "Chemicals", "cost_per_unit": Decimal("25.50"),
         "reorder_threshold": 20, "unit": "litres", "description": "Technical grade HCl"},
        {"sku": "ETH-003", "name": "Ethanol 99%", "category": "Chemicals", "cost_per_unit": Decimal("14.80"),
         "reorder_threshold": 60, "unit": "litres", "description": "High-purity ethanol"},
        {"sku": "NIT-004", "name": "Nitrogen Gas Cylinder", "category": "Chemicals", "cost_per_unit": Decimal("95.00"),
         "reorder_threshold": 5, "unit": "units", "description": "Industrial N2"},
        {"sku": "PVC-005", "name": "PVC Pellets", "category": "Plastics", "cost_per_unit": Decimal("6.40"),
         "reorder_threshold": 80, "unit": "kg", "description": "Virgin PVC pellets"},
    ],
]

STOCK_LEVELS = [120, 8, 350, 25, 5, 80, 15, 200, 3, 150]


async def seed(session: AsyncSession) -> None:
    # Check if already seeded
    result = await session.execute(select(func.count()).select_from(User))
    if result.scalar_one() > 0:
        print("[seed] DB already seeded — skipping.")
        return

    print("[seed] Seeding database...")

    # ── Users ────────────────────────────────────────────────────────────────
    admin = User(
        email=ADMIN_EMAIL,
        name="System Administrator",
        password_hash=pwd_context.hash(ADMIN_PASSWORD),
        role="admin",
    )
    regular_user = User(
        email=USER_EMAIL,
        name="Demo User",
        password_hash=pwd_context.hash(USER_PASSWORD),
        role="user",
    )
    session.add_all([admin, regular_user])
    await session.flush()

    # ── Tenants ──────────────────────────────────────────────────────────────
    tenant_objs = []
    for t in TENANTS:
        tenant = Tenant(**t)
        session.add(tenant)
        tenant_objs.append(tenant)
    await session.flush()

    # ── Products + Inventory + Orders ────────────────────────────────────────
    order_counter = {t.id: 1000 for t in tenant_objs}

    for i, tenant in enumerate(tenant_objs):
        products_data = PRODUCTS_PER_TENANT[i]
        product_objs = []
        for j, pd in enumerate(products_data):
            unit = pd.pop("unit")
            product = Product(tenant_id=tenant.id, status="active", **pd)
            session.add(product)
            product_objs.append((product, unit))

        await session.flush()

        for j, (product, unit) in enumerate(product_objs):
            stock = STOCK_LEVELS[i * 5 + j]
            inv = Inventory(
                product_id=product.id,
                tenant_id=tenant.id,
                current_stock=stock,
                unit=unit,
            )
            session.add(inv)

        await session.flush()

        # Sample orders (2 per tenant)
        for j, (product, _) in enumerate(product_objs[:2]):
            order_counter[tenant.id] += 1
            order_num = order_counter[tenant.id]
            display_id = f"ORD-{order_num}"
            status = "created" if j == 0 else "pending"
            order = Order(
                display_id=display_id,
                tenant_id=tenant.id,
                product_id=product.id,
                requested_qty=10,
                status=status,
                order_date=date.today(),
                notes=f"Sample order {j + 1}",
            )
            session.add(order)

    await session.commit()
    print("[seed] Done. Admin:", ADMIN_EMAIL, "| User:", USER_EMAIL)


async def run_seed() -> None:
    async with async_session_factory() as session:
        await seed(session)


if __name__ == "__main__":
    asyncio.run(run_seed())
