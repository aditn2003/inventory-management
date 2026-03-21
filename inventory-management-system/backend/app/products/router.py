from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_tenant_id
from app.database import get_db
from app.products.schemas import (
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
)
from app.products.service import ProductService

router = APIRouter()

ProductSortBy = Literal["sku", "name", "category", "cost_per_unit", "current_stock", "status", "created_at"]
ProductSortDir = Literal["asc", "desc"]


@router.get("", response_model=ProductListResponse)
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: Optional[str] = Query(None),
    sort_by: Optional[ProductSortBy] = Query(
        None,
        description="When set with sort_dir, sort by this column. Omit both for default order (newest first).",
    ),
    sort_dir: Optional[ProductSortDir] = Query(
        None,
        description="asc or desc; must be used together with sort_by.",
    ),
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> ProductListResponse:
    if (sort_by is None) != (sort_dir is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="sort_by and sort_dir must both be provided or both omitted.",
        )
    svc = ProductService(session)
    return await svc.list_products(tenant_id, page, page_size, q, sort_by, sort_dir)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    body: ProductCreate,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> ProductResponse:
    svc = ProductService(session)
    data = body.model_dump(exclude={"unit"})
    try:
        product = await svc.create_product(tenant_id, data, unit=body.unit)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return product


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> ProductResponse:
    svc = ProductService(session)
    try:
        return await svc.get_product(product_id, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    body: ProductUpdate,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> ProductResponse:
    svc = ProductService(session)
    try:
        return await svc.update_product(product_id, tenant_id, body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    svc = ProductService(session)
    try:
        await svc.delete_product(product_id, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
