from typing import Optional
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.orders.models import Order
from app.products.models import Product


class ProductRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(
        self,
        tenant_id: UUID,
        page: int,
        page_size: int,
        q: Optional[str],
    ) -> tuple[list[Product], int]:
        query = (
            select(Product)
            .options(selectinload(Product.inventory))
            .where(Product.tenant_id == tenant_id)
        )
        if q:
            query = query.where(Product.name.ilike(f"%{q}%"))

        count_result = await self.session.execute(
            select(func.count()).select_from(
                select(Product).where(Product.tenant_id == tenant_id).subquery()
            )
        )
        total = count_result.scalar_one()

        query = query.order_by(Product.name).offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(query)
        return result.scalars().all(), total

    async def count_by_status(self, tenant_id: UUID, status: str) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(Product).where(
                Product.tenant_id == tenant_id, Product.status == status
            )
        )
        return result.scalar_one()

    async def count_all(self, tenant_id: UUID) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(Product).where(Product.tenant_id == tenant_id)
        )
        return result.scalar_one()

    async def get_by_id(self, product_id: UUID, tenant_id: UUID) -> Optional[Product]:
        result = await self.session.execute(
            select(Product)
            .options(selectinload(Product.inventory))
            .where(Product.id == product_id, Product.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def get_by_sku(self, tenant_id: UUID, sku: str) -> Optional[Product]:
        result = await self.session.execute(
            select(Product).where(Product.tenant_id == tenant_id, Product.sku == sku)
        )
        return result.scalar_one_or_none()

    async def create(self, tenant_id: UUID, **kwargs) -> Product:
        product = Product(tenant_id=tenant_id, **kwargs)
        self.session.add(product)
        await self.session.flush()
        return product

    async def update(self, product: Product, **kwargs) -> Product:
        for key, value in kwargs.items():
            if value is not None:
                setattr(product, key, value)
        await self.session.flush()
        return product

    async def hard_delete(self, product: Product) -> None:
        """Remove product; orders referencing it first, then inventory cascades from product FK."""
        await self.session.execute(delete(Order).where(Order.product_id == product.id))
        await self.session.delete(product)
        await self.session.flush()
