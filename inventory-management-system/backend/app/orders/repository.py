from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.inventory.models import Inventory
from app.orders.models import Order
from app.products.models import Product


class OrderRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(
        self,
        tenant_id: UUID,
        page: int,
        page_size: int,
        q: Optional[str],
    ) -> tuple[list[Order], int]:
        query = (
            select(Order)
            .options(selectinload(Order.product))
            .where(Order.tenant_id == tenant_id)
        )
        if q:
            query = query.join(Product, Product.id == Order.product_id).where(
                Product.name.ilike(f"%{q}%")
            )

        count_result = await self.session.execute(
            select(func.count()).select_from(
                select(Order).where(Order.tenant_id == tenant_id).subquery()
            )
        )
        total = count_result.scalar_one()

        query = query.order_by(Order.order_date.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(query)
        return result.scalars().all(), total

    async def count_by_status(self, tenant_id: UUID, status: str) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(Order).where(
                Order.tenant_id == tenant_id, Order.status == status
            )
        )
        return result.scalar_one()

    async def get_by_id(self, order_id: UUID, tenant_id: UUID) -> Optional[Order]:
        result = await self.session.execute(
            select(Order)
            .options(selectinload(Order.product))
            .where(Order.id == order_id, Order.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def get_next_display_id(self, tenant_id: UUID) -> str:
        result = await self.session.execute(
            select(func.count()).select_from(Order).where(Order.tenant_id == tenant_id)
        )
        total = result.scalar_one()
        return f"ORD-{total + 1001}"

    async def create(self, **kwargs) -> Order:
        order = Order(**kwargs)
        self.session.add(order)
        await self.session.flush()
        return order

    async def update(self, order: Order, **kwargs) -> Order:
        for key, value in kwargs.items():
            setattr(order, key, value)
        await self.session.flush()
        return order

    async def hard_delete(self, order: Order) -> None:
        await self.session.delete(order)
        await self.session.flush()

    async def get_inventory_for_update(self, product_id: UUID) -> Optional[Inventory]:
        """Acquire SELECT FOR UPDATE lock on inventory row."""
        result = await self.session.execute(
            select(Inventory).where(Inventory.product_id == product_id).with_for_update()
        )
        return result.scalar_one_or_none()
