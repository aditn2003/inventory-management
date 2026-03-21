from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.inventory.models import Inventory
from app.products.models import Product


class InventoryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(
        self,
        tenant_id: UUID,
        page: int,
        page_size: int,
        q: Optional[str],
    ) -> tuple[list[Inventory], int]:
        query = (
            select(Inventory)
            .join(Product, Product.id == Inventory.product_id)
            .options(selectinload(Inventory.product))
            .where(Inventory.tenant_id == tenant_id)
        )
        if q:
            query = query.where(Product.name.ilike(f"%{q}%"))

        count_result = await self.session.execute(
            select(func.count()).select_from(
                select(Inventory)
                .join(Product, Product.id == Inventory.product_id)
                .where(Inventory.tenant_id == tenant_id)
                .subquery()
            )
        )
        total = count_result.scalar_one()

        query = query.order_by(Product.name).offset((page - 1) * page_size).limit(page_size)
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

    async def get_by_id(self, inventory_id: UUID, tenant_id: UUID) -> Optional[Inventory]:
        result = await self.session.execute(
            select(Inventory)
            .options(selectinload(Inventory.product))
            .where(Inventory.id == inventory_id, Inventory.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def get_by_product_id(self, product_id: UUID, tenant_id: UUID) -> Optional[Inventory]:
        result = await self.session.execute(
            select(Inventory).where(
                Inventory.product_id == product_id,
                Inventory.tenant_id == tenant_id,
            )
        )
        return result.scalar_one_or_none()

    async def patch_stock(self, inventory: Inventory, current_stock: int) -> Inventory:
        inventory.current_stock = current_stock
        await self.session.flush()
        return inventory
