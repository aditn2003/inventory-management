from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserListItem(BaseModel):
    id: UUID
    name: str
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
    name: str
    role: str
    assigned_tenants: list[TenantBrief]
    created_at: datetime

    model_config = {"from_attributes": True}


class UserRoleUpdate(BaseModel):
    role: str


class UserInviteCreate(BaseModel):
    email: EmailStr


class UserInviteResponse(BaseModel):
    message: str


class UserTenantAccessSet(BaseModel):
    """Replace this user's tenant access. Empty list = can access every tenant (no restriction rows)."""

    tenant_ids: list[UUID]


class UserListResponse(BaseModel):
    data: list[UserListItem]
    meta: dict
