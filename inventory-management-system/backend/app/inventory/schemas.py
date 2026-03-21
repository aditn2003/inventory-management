from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ProductBrief(BaseModel):
    id: UUID
    sku: str
    name: str
    category: str
    cost_per_unit: Decimal
    reorder_threshold: int
    status: str

    model_config = {"from_attributes": True}


class InventoryResponse(BaseModel):
    id: UUID
    product_id: UUID
    tenant_id: UUID
    current_stock: int
    unit: str
    product: Optional[ProductBrief] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InventoryStockUpdate(BaseModel):
    current_stock: int


class InventorySummary(BaseModel):
    below_reorder_count: int


class InventoryListResponse(BaseModel):
    data: list[InventoryResponse]
    meta: dict
    summary: InventorySummary
