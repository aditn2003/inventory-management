from typing import Literal, Optional
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.inventory.models import Inventory
from app.orders.models import Order
from app.products.models import Product

ProductSortBy = Literal["sku", "name", "category", "cost_per_unit", "current_stock", "status", "created_at"]
ProductSortDir = Literal["asc", "desc"]


class ProductRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _default_order(self):
        """Newest first, stable tie-break."""
        return Product.created_at.desc(), Product.id.asc()

    def _order_by_clauses(self, sort_by: ProductSortBy, sort_dir: ProductSortDir):
        if sort_by == "name":
            ln = func.lower(Product.name)
            if sort_dir == "asc":
                return (ln.asc(), Product.name.asc(), Product.id.asc())
            return (ln.desc(), Product.name.desc(), Product.id.asc())
        if sort_by == "sku":
            ls = func.lower(Product.sku)
            if sort_dir == "asc":
                return (ls.asc(), Product.sku.asc(), Product.id.asc())
            return (ls.desc(), Product.sku.desc(), Product.id.asc())
        if sort_by == "category":
            lc = func.lower(Product.category)
            if sort_dir == "asc":
                return (lc.asc(), Product.category.asc(), Product.id.asc())
            return (lc.desc(), Product.category.desc(), Product.id.asc())
        if sort_by == "cost_per_unit":
            col = Product.cost_per_unit
            if sort_dir == "asc":
                return (col.asc(), Product.id.asc())
            return (col.desc(), Product.id.asc())
        if sort_by == "current_stock":
            stock = func.coalesce(Inventory.current_stock, 0)
            if sort_dir == "asc":
                return (stock.asc(), Product.id.asc())
            return (stock.desc(), Product.id.asc())
        if sort_by == "status":
            lst = func.lower(Product.status)
            if sort_dir == "asc":
                return (lst.asc(), Product.status.asc(), Product.id.asc())
            return (lst.desc(), Product.status.desc(), Product.id.asc())
        # created_at
        col = Product.created_at
        return (col.asc(), Product.id.asc()) if sort_dir == "asc" else (col.desc(), Product.id.asc())

    async def list(
        self,
        tenant_id: UUID,
        page: int,
        page_size: int,
        q: Optional[str],
        sort_by: Optional[ProductSortBy] = None,
        sort_dir: Optional[ProductSortDir] = None,
    ) -> tuple[list[Product], int]:
        base_filter = select(Product).where(Product.tenant_id == tenant_id)
        if q:
            base_filter = base_filter.where(Product.name.ilike(f"%{q}%"))

        count_result = await self.session.execute(
            select(func.count()).select_from(base_filter.subquery())
        )
        total = count_result.scalar_one()

        query = (
            select(Product)
            .options(selectinload(Product.inventory))
            .outerjoin(Inventory, Inventory.product_id == Product.id)
            .where(Product.tenant_id == tenant_id)
        )
        if q:
            query = query.where(Product.name.ilike(f"%{q}%"))

        if sort_by and sort_dir:
            query = query.order_by(*self._order_by_clauses(sort_by, sort_dir))
        else:
            query = query.order_by(*self._default_order())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(query)
        return result.unique().scalars().all(), total

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
