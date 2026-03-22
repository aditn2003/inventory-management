"""Orders with product/inventory joins, status counts, and stock checks."""

from typing import Literal, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.inventory.models import Inventory
from app.orders.models import Order
from app.products.models import Product

OrderSortBy = Literal[
    "created_at",
    "order_date",
    "status",
    "requested_qty",
    "display_id",
    "product_name",
]
OrderSortDir = Literal["asc", "desc"]


class OrderRepository:
    """Tenant-scoped orders and locked inventory reads for confirm flows."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _needs_product_join(
        self, q: Optional[str], sort_by: Optional[OrderSortBy]
    ) -> bool:
        return bool(q) or sort_by == "product_name"

    def _default_order(self):
        return Order.created_at.desc(), Order.id.asc()

    def _order_by_clauses(self, sort_by: OrderSortBy, sort_dir: OrderSortDir):
        id_tie = (Order.id.asc(),)
        if sort_by == "product_name":
            ln = func.lower(Product.name)
            if sort_dir == "asc":
                return (ln.asc(), Product.name.asc()) + id_tie
            return (ln.desc(), Product.name.desc()) + id_tie
        if sort_by == "display_id":
            col = Order.display_id
            return (
                (col.asc(),) + id_tie if sort_dir == "asc" else (col.desc(),) + id_tie
            )
        if sort_by == "requested_qty":
            col = Order.requested_qty
            return (
                (col.asc(),) + id_tie if sort_dir == "asc" else (col.desc(),) + id_tie
            )
        if sort_by == "status":
            col = Order.status
            return (
                (col.asc(),) + id_tie if sort_dir == "asc" else (col.desc(),) + id_tie
            )
        if sort_by == "order_date":
            col = Order.order_date
            return (
                (col.asc(),) + id_tie if sort_dir == "asc" else (col.desc(),) + id_tie
            )
        col = Order.created_at
        return (col.asc(),) + id_tie if sort_dir == "asc" else (col.desc(),) + id_tie

    async def list(
        self,
        tenant_id: UUID,
        page: int,
        page_size: int,
        q: Optional[str],
        sort_by: Optional[OrderSortBy] = None,
        sort_dir: Optional[OrderSortDir] = None,
        status_filter: Optional[str] = None,
    ) -> tuple[list[Order], int]:
        needs_join = self._needs_product_join(q, sort_by)

        count_q = (
            select(func.count(Order.id))
            .select_from(Order)
            .where(Order.tenant_id == tenant_id)
        )
        if needs_join:
            count_q = count_q.join(Product, Product.id == Order.product_id)
        if q:
            count_q = count_q.where(Product.name.ilike(f"%{q}%"))
        if status_filter:
            count_q = count_q.where(Order.status == status_filter)

        total = (await self.session.execute(count_q)).scalar_one()

        query = (
            select(Order)
            .options(selectinload(Order.product).selectinload(Product.inventory))
            .where(Order.tenant_id == tenant_id)
        )
        if needs_join:
            query = query.join(Product, Product.id == Order.product_id)
        if q:
            query = query.where(Product.name.ilike(f"%{q}%"))
        if status_filter:
            query = query.where(Order.status == status_filter)

        if sort_by and sort_dir:
            query = query.order_by(*self._order_by_clauses(sort_by, sort_dir))
        else:
            query = query.order_by(*self._default_order())

        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(query)
        return result.scalars().all(), total

    async def count_by_status(self, tenant_id: UUID, status: str) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Order)
            .where(Order.tenant_id == tenant_id, Order.status == status)
        )
        return result.scalar_one()

    async def get_by_id(self, order_id: UUID, tenant_id: UUID) -> Optional[Order]:
        result = await self.session.execute(
            select(Order)
            .options(selectinload(Order.product).selectinload(Product.inventory))
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
            select(Inventory)
            .where(Inventory.product_id == product_id)
            .with_for_update()
        )
        return result.scalar_one_or_none()
