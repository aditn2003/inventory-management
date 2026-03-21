from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class UserListItem(BaseModel):
    id: UUID
    email: str
    role: str
    assigned_tenant_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantBrief(BaseModel):
    id: UUID
    display_id: str
    name: str

    model_config = {"from_attributes": True}


class UserDetail(BaseModel):
    id: UUID
    email: str
    role: str
    assigned_tenants: list[TenantBrief]
    created_at: datetime

    model_config = {"from_attributes": True}


class UserRoleUpdate(BaseModel):
    role: str


class TenantAssignmentInput(BaseModel):
    tenant_id: UUID


class UserListResponse(BaseModel):
    data: list[UserListItem]
    meta: dict
