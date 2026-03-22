"""Inventory rows joined with product metadata for list/detail and stock updates."""

from typing import Literal, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.inventory.models import Inventory
from app.products.models import Product

InventorySortBy = Literal[
    "product_name",
    "sku",
    "cost_per_unit",
    "current_stock",
    "reorder_threshold",
    "created_at",
]
InventorySortDir = Literal["asc", "desc"]


class InventoryRepository:
    """Tenant-scoped inventory queries and reorder/below-threshold aggregates."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _default_order(self):
        return Inventory.created_at.desc(), Inventory.id.asc()

    def _order_by_clauses(self, sort_by: InventorySortBy, sort_dir: InventorySortDir):
        if sort_by == "product_name":
            ln = func.lower(Product.name)
            if sort_dir == "asc":
                return (ln.asc(), Product.name.asc(), Inventory.id.asc())
            return (ln.desc(), Product.name.desc(), Inventory.id.asc())
        if sort_by == "sku":
            ls = func.lower(Product.sku)
            if sort_dir == "asc":
                return (ls.asc(), Product.sku.asc(), Inventory.id.asc())
            return (ls.desc(), Product.sku.desc(), Inventory.id.asc())
        if sort_by == "cost_per_unit":
            col = Product.cost_per_unit
            return (
                (col.asc(), Inventory.id.asc())
                if sort_dir == "asc"
                else (col.desc(), Inventory.id.asc())
            )
        if sort_by == "current_stock":
            col = Inventory.current_stock
            return (
                (col.asc(), Inventory.id.asc())
                if sort_dir == "asc"
                else (col.desc(), Inventory.id.asc())
            )
        if sort_by == "reorder_threshold":
            col = Product.reorder_threshold
            return (
                (col.asc(), Inventory.id.asc())
                if sort_dir == "asc"
                else (col.desc(), Inventory.id.asc())
            )
        col = Inventory.created_at
        return (
            (col.asc(), Inventory.id.asc())
            if sort_dir == "asc"
            else (col.desc(), Inventory.id.asc())
        )

    async def list(
        self,
        tenant_id: UUID,
        page: int,
        page_size: int,
        q: Optional[str],
        sort_by: Optional[InventorySortBy] = None,
        sort_dir: Optional[InventorySortDir] = None,
        below_reorder_only: bool = False,
    ) -> tuple[list[Inventory], int]:
        base = (
            select(Inventory)
            .join(Product, Product.id == Inventory.product_id)
            .where(Inventory.tenant_id == tenant_id)
        )
        if q:
            base = base.where(Product.name.ilike(f"%{q}%"))
        if below_reorder_only:
            base = base.where(Inventory.current_stock < Product.reorder_threshold)

        count_result = await self.session.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = count_result.scalar_one()

        query = (
            select(Inventory)
            .join(Product, Product.id == Inventory.product_id)
            .options(selectinload(Inventory.product))
            .where(Inventory.tenant_id == tenant_id)
        )
        if q:
            query = query.where(Product.name.ilike(f"%{q}%"))
        if below_reorder_only:
            query = query.where(Inventory.current_stock < Product.reorder_threshold)

        if sort_by and sort_dir:
            query = query.order_by(*self._order_by_clauses(sort_by, sort_dir))
        else:
            query = query.order_by(*self._default_order())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(query)
        return result.scalars().all(), total

    async def below_reorder_count(self, tenant_id: UUID) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Inventory)
            .join(Product, Product.id == Inventory.product_id)
            .where(
                Inventory.tenant_id == tenant_id,
                Inventory.current_stock < Product.reorder_threshold,
            )
        )
        return result.scalar_one()

    async def get_by_id(
        self, inventory_id: UUID, tenant_id: UUID
    ) -> Optional[Inventory]:
        result = await self.session.execute(
            select(Inventory)
            .options(selectinload(Inventory.product))
            .where(Inventory.id == inventory_id, Inventory.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def patch_stock(self, inventory: Inventory, current_stock: int) -> Inventory:
        inventory.current_stock = current_stock
        await self.session.flush()
        return inventory
