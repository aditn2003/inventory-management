from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.inventory.repository import InventoryRepository
from app.products.repository import ProductRepository


class InventoryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = InventoryRepository(session)

    async def list_inventory(self, tenant_id: UUID, page: int, page_size: int, q: Optional[str]) -> dict:
        items, total = await self.repo.list(tenant_id, page, page_size, q)
        below_reorder = await self.repo.below_reorder_count(tenant_id)
        return {
            "data": items,
            "meta": {"total": total, "page": page, "page_size": page_size},
            "summary": {"below_reorder_count": below_reorder},
        }

    async def get_inventory(self, inventory_id: UUID, tenant_id: UUID):
        item = await self.repo.get_by_id(inventory_id, tenant_id)
        if not item:
            raise ValueError("Inventory item not found.")
        return item

    async def patch_stock(self, inventory_id: UUID, tenant_id: UUID, current_stock: int):
        if current_stock < 0:
            raise ValueError("Stock cannot be negative.")
        item = await self.get_inventory(inventory_id, tenant_id)
        item = await self.repo.patch_stock(item, current_stock)
        await self.session.commit()
        return await self.repo.get_by_id(inventory_id, tenant_id)

    async def delete_inventory(self, inventory_id: UUID, tenant_id: UUID) -> None:
        """Permanently remove parent product (orders first); inventory row cascades on product delete."""
        item = await self.get_inventory(inventory_id, tenant_id)
        product_repo = ProductRepository(self.session)
        product = await product_repo.get_by_id(item.product_id, tenant_id)
        if not product:
            raise ValueError("Inventory item not found.")
        await product_repo.hard_delete(product)
        await self.session.commit()
