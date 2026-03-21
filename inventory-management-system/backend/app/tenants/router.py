from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin
from app.auth.models import User
from app.database import get_db
from app.tenants.schemas import TenantCreate, TenantListResponse, TenantResponse, TenantUpdate
from app.tenants.service import TenantService

router = APIRouter()

TenantSortBy = Literal["display_id", "name", "status", "created_at"]
TenantSortDir = Literal["asc", "desc"]


@router.get("", response_model=TenantListResponse)
async def list_tenants(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: Optional[str] = Query(None),
    sort_by: Optional[TenantSortBy] = Query(
        None,
        description="When set with sort_dir, sort by this column. Omit both for default order.",
    ),
    sort_dir: Optional[TenantSortDir] = Query(
        None,
        description="asc or desc; must be used together with sort_by.",
    ),
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> TenantListResponse:
    svc = TenantService(session)

    if (sort_by is None) != (sort_dir is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="sort_by and sort_dir must both be provided or both omitted.",
        )

    result = await svc.list_tenants(None, page, page_size, q, sort_by, sort_dir)
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
    _admin: User = Depends(require_admin),
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
