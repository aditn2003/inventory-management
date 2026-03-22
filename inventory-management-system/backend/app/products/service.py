from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.inventory.models import Inventory
from app.products.models import Product
from app.products.repository import ProductRepository, ProductSortBy, ProductSortDir


class ProductService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProductRepository(session)

    VALID_STATUSES = ("active", "inactive")

    async def list_products(
        self,
        tenant_id: UUID,
        page: int,
        page_size: int,
        q: Optional[str],
        sort_by: Optional[ProductSortBy] = None,
        sort_dir: Optional[ProductSortDir] = None,
    ) -> dict:
        products, total = await self.repo.list(tenant_id, page, page_size, q, sort_by, sort_dir)
        active = await self.repo.count_by_status(tenant_id, "active")
        inactive = await self.repo.count_by_status(tenant_id, "inactive")
        all_count = await self.repo.count_all(tenant_id)
        return {
            "data": products,
            "meta": {"total": total, "page": page, "page_size": page_size},
            "summary": {"total": all_count, "active": active, "inactive": inactive},
        }

    async def get_product(self, product_id: UUID, tenant_id: UUID) -> Product:
        product = await self.repo.get_by_id(product_id, tenant_id)
        if not product:
            raise ValueError("Product not found.")
        return product

    async def create_product(self, tenant_id: UUID, data: dict, unit: str = "units") -> Product:
        if not data.get("category", "").strip():
            raise ValueError("Category is required.")
        status = data.get("status", "active")
        if status not in self.VALID_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(self.VALID_STATUSES)}.")

        existing = await self.repo.get_by_sku(tenant_id, data["sku"])
        if existing:
            raise ValueError(f"SKU '{data['sku']}' already exists for this tenant.")

        product = await self.repo.create(tenant_id=tenant_id, **data)

        # Auto-create inventory row (business rule #3)
        inventory = Inventory(
            product_id=product.id,
            tenant_id=tenant_id,
            current_stock=0,
            unit=unit,
        )
        self.session.add(inventory)
        await self.session.commit()
        # Reload with inventory
        return await self.repo.get_by_id(product.id, tenant_id)

    async def update_product(self, product_id: UUID, tenant_id: UUID, data: dict) -> Product:
        product = await self.get_product(product_id, tenant_id)

        if "sku" in data and data["sku"] and data["sku"] != product.sku:
            raise ValueError("SKU cannot be changed after product creation.")

        category = data.get("category")
        if category is not None and not category.strip():
            raise ValueError("Category cannot be empty.")

        # Remove None values
        update_data = {k: v for k, v in data.items() if v is not None and k != "sku"}
        product = await self.repo.update(product, **update_data)
        await self.session.commit()
        return await self.repo.get_by_id(product_id, tenant_id)

    async def delete_product(self, product_id: UUID, tenant_id: UUID) -> None:
        product = await self.get_product(product_id, tenant_id)
        await self.repo.hard_delete(product)
        await self.session.commit()
