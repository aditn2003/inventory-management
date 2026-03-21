from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class TenantCreate(BaseModel):
    name: str
    status: str = "active"


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None


class TenantResponse(BaseModel):
    id: UUID
    display_id: str
    name: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantSummary(BaseModel):
    total: int
    active: int
    inactive: int


class TenantListResponse(BaseModel):
    data: list[TenantResponse]
    meta: dict
    summary: TenantSummary
