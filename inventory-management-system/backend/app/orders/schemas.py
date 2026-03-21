from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class OrderCreate(BaseModel):
    product_id: UUID
    requested_qty: int
    notes: Optional[str] = None
    order_date: Optional[date] = None


class OrderUpdate(BaseModel):
    requested_qty: Optional[int] = None
    notes: Optional[str] = None


class ProductBrief(BaseModel):
    id: UUID
    sku: str
    name: str
    category: str
    cost_per_unit: Decimal
    reorder_threshold: int
    status: str

    model_config = {"from_attributes": True}


class InventoryBrief(BaseModel):
    id: UUID
    current_stock: int
    unit: str

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: UUID
    display_id: str
    tenant_id: UUID
    product_id: UUID
    requested_qty: int
    status: str
    notes: Optional[str]
    order_date: date
    product: Optional[ProductBrief] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrderSummary(BaseModel):
    total: int
    pending: int
    created: int
    cancelled: int


class OrderListResponse(BaseModel):
    data: list[OrderResponse]
    meta: dict
    summary: OrderSummary
