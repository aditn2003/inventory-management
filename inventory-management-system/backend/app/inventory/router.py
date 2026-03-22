"""Inventory API (tenant-scoped). Mounted at ``/api/v1/inventory``."""

from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_tenant_id
from app.database import get_db
from app.inventory.schemas import (
    InventoryListResponse,
    InventoryResponse,
    InventoryStockUpdate,
)
from app.inventory.service import InventoryService

router = APIRouter()

InventorySortBy = Literal[
    "product_name",
    "sku",
    "cost_per_unit",
    "current_stock",
    "reorder_threshold",
    "created_at",
]
InventorySortDir = Literal["asc", "desc"]


@router.get("", response_model=InventoryListResponse)
async def list_inventory(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: Optional[str] = Query(None),
    sort_by: Optional[InventorySortBy] = Query(
        None,
        description="When set with sort_dir, sort by this column. Omit both for default (newest inventory first).",
    ),
    sort_dir: Optional[InventorySortDir] = Query(
        None,
        description="asc or desc; must be used together with sort_by.",
    ),
    below_reorder_only: bool = Query(
        False,
        description="If true, only rows where current_stock < reorder_threshold (paginated).",
    ),
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> InventoryListResponse:
    if (sort_by is None) != (sort_dir is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="sort_by and sort_dir must both be provided or both omitted.",
        )
    svc = InventoryService(session)
    return await svc.list_inventory(
        tenant_id, page, page_size, q, sort_by, sort_dir, below_reorder_only
    )


@router.get("/{inventory_id}", response_model=InventoryResponse)
async def get_inventory(
    inventory_id: UUID,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> InventoryResponse:
    svc = InventoryService(session)
    try:
        return await svc.get_inventory(inventory_id, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.patch("/{inventory_id}", response_model=InventoryResponse)
async def patch_stock(
    inventory_id: UUID,
    body: InventoryStockUpdate,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> InventoryResponse:
    svc = InventoryService(session)
    try:
        return await svc.patch_stock(inventory_id, tenant_id, body.current_stock)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{inventory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory(
    inventory_id: UUID,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    svc = InventoryService(session)
    try:
        await svc.delete_inventory(inventory_id, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
