from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_redis, require_admin
from app.auth.models import User
from app.auth.repository import UserRepository
from app.database import get_db
from app.tenants.schemas import TenantCreate, TenantListResponse, TenantResponse, TenantUpdate
from app.tenants.service import TenantService

router = APIRouter()


@router.get("", response_model=TenantListResponse)
async def list_tenants(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TenantListResponse:
    svc = TenantService(session)

    if current_user.role == "admin":
        accessible_ids = None
    else:
        repo = UserRepository(session)
        assigned = await repo.get_assigned_tenant_ids(current_user.id)
        accessible_ids = assigned if assigned else None  # None = all-access

    result = await svc.list_tenants(accessible_ids, page, page_size, q)
    return result


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    body: TenantCreate,
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TenantResponse:
    svc = TenantService(session)
    try:
        tenant = await svc.create_tenant(body.name, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return tenant


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    session: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> TenantResponse:
    svc = TenantService(session)
    try:
        tenant = await svc.get_tenant(tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return tenant


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: UUID,
    body: TenantUpdate,
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TenantResponse:
    svc = TenantService(session)
    try:
        tenant = await svc.update_tenant(tenant_id, body.name, body.status)
    except ValueError as exc:
        if "not found" in str(exc).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: UUID,
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    svc = TenantService(session)
    try:
        await svc.delete_tenant(tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
