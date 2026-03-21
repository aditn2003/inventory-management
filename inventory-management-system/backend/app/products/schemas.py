from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ProductCreate(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    category: str
    cost_per_unit: Decimal
    reorder_threshold: int
    status: str = "active"
    unit: str = "units"  # Passed to the auto-created inventory row


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    cost_per_unit: Optional[Decimal] = None
    reorder_threshold: Optional[int] = None
    status: Optional[str] = None


class InventorySnapshot(BaseModel):
    id: UUID
    current_stock: int
    unit: str

    model_config = {"from_attributes": True}


class ProductResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    sku: str
    name: str
    description: Optional[str]
    category: str
    cost_per_unit: Decimal
    reorder_threshold: int
    status: str
    inventory: Optional[InventorySnapshot] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductSummary(BaseModel):
    total: int
    active: int
    inactive: int


class ProductListResponse(BaseModel):
    data: list[ProductResponse]
    meta: dict
    summary: ProductSummary
