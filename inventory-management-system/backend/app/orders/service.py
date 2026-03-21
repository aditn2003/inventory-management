from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.orders.repository import OrderRepository
from app.products.repository import ProductRepository


class OrderService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = OrderRepository(session)
        self.product_repo = ProductRepository(session)

    async def list_orders(
        self,
        tenant_id: UUID,
        page: int,
        page_size: int,
        q: Optional[str],
        sort_by: Optional[str] = None,
        sort_dir: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> dict:
        orders, total = await self.repo.list(
            tenant_id, page, page_size, q, sort_by, sort_dir, status_filter
        )
        pending = await self.repo.count_by_status(tenant_id, "pending")
        created = await self.repo.count_by_status(tenant_id, "created")
        confirmed = await self.repo.count_by_status(tenant_id, "confirmed")
        cancelled = await self.repo.count_by_status(tenant_id, "cancelled")
        all_count = pending + created + confirmed + cancelled
        return {
            "data": orders,
            "meta": {"total": total, "page": page, "page_size": page_size},
            "summary": {
                "total": all_count,
                "pending": pending,
                "created": created,
                "confirmed": confirmed,
                "cancelled": cancelled,
            },
        }

    async def get_order(self, order_id: UUID, tenant_id: UUID):
        order = await self.repo.get_by_id(order_id, tenant_id)
        if not order:
            raise ValueError("Order not found.")
        return order

    async def create_order(
        self,
        tenant_id: UUID,
        product_id: UUID,
        requested_qty: int,
        notes: Optional[str],
    ):
        product = await self.product_repo.get_by_id(product_id, tenant_id)
        if not product:
            raise ValueError("Product not found.")
        if product.status != "active":
            raise ValueError("Cannot create order for an inactive product.")

        inventory = await self.repo.get_inventory_for_update(product_id)
        if not inventory:
            raise ValueError("Inventory not found for this product.")

        display_id = await self.repo.get_next_display_id(tenant_id)
        order_date = date.today()

        if inventory.current_stock >= requested_qty:
            order_status = "created"
        else:
            order_status = "pending"

        order = await self.repo.create(
            display_id=display_id,
            tenant_id=tenant_id,
            product_id=product_id,
            requested_qty=requested_qty,
            status=order_status,
            notes=notes,
            order_date=order_date,
        )
        await self.session.commit()
        return await self.repo.get_by_id(order.id, tenant_id)

    async def update_order(self, order_id: UUID, tenant_id: UUID, requested_qty: Optional[int], notes: Optional[str]):
        order = await self.get_order(order_id, tenant_id)

        if order.status == "cancelled":
            raise ValueError("Cancelled orders cannot be edited.")

        if order.status == "confirmed" and requested_qty is not None and requested_qty != order.requested_qty:
            raise ValueError("Quantity cannot be changed on a confirmed order. Only notes can be updated.")

        updates = {}
        if notes is not None:
            updates["notes"] = notes
        if requested_qty is not None and order.status in ("pending", "created"):
            updates["requested_qty"] = requested_qty

        if updates:
            order = await self.repo.update(order, **updates)
            await self.session.commit()
        return await self.repo.get_by_id(order_id, tenant_id)

    async def confirm_order(self, order_id: UUID, tenant_id: UUID):
        order = await self.get_order(order_id, tenant_id)

        if order.status not in ("pending", "created"):
            raise ValueError(
                f"Only pending or created orders can be confirmed. Current status: {order.status}."
            )

        inventory = await self.repo.get_inventory_for_update(order.product_id)
        if not inventory:
            raise ValueError("Inventory not found.")

        if inventory.current_stock < order.requested_qty:
            raise ValueError(
                f"Insufficient stock (available: {inventory.current_stock}, requested: {order.requested_qty})."
            )

        inventory.current_stock -= order.requested_qty
        await self.repo.update(order, status="confirmed")
        await self.session.commit()
        return await self.repo.get_by_id(order_id, tenant_id)

    async def cancel_order(self, order_id: UUID, tenant_id: UUID):
        order = await self.get_order(order_id, tenant_id)

        if order.status == "cancelled":
            raise ValueError("Order is already cancelled.")

        if order.status == "confirmed":
            raise ValueError("Confirmed orders cannot be cancelled.")

        await self.repo.update(order, status="cancelled")
        await self.session.commit()
        return await self.repo.get_by_id(order_id, tenant_id)

    async def delete_order(self, order_id: UUID, tenant_id: UUID) -> None:
        order = await self.get_order(order_id, tenant_id)
        if order.status == "confirmed":
            inventory = await self.repo.get_inventory_for_update(order.product_id)
            if inventory:
                inventory.current_stock += order.requested_qty
        await self.repo.hard_delete(order)
        await self.session.commit()
