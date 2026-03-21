from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_tenant_id
from app.database import get_db
from app.orders.schemas import OrderCreate, OrderListResponse, OrderResponse, OrderUpdate
from app.orders.service import OrderService

router = APIRouter()


@router.get("", response_model=OrderListResponse)
async def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> OrderListResponse:
    svc = OrderService(session)
    return await svc.list_orders(tenant_id, page, page_size, q)


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: OrderCreate,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> OrderResponse:
    svc = OrderService(session)
    try:
        return await svc.create_order(
            tenant_id, body.product_id, body.requested_qty, body.notes, body.order_date
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: UUID,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> OrderResponse:
    svc = OrderService(session)
    try:
        return await svc.get_order(order_id, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: UUID,
    body: OrderUpdate,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> OrderResponse:
    svc = OrderService(session)
    try:
        return await svc.update_order(order_id, tenant_id, body.requested_qty, body.notes)
    except ValueError as exc:
        status_code = status.HTTP_409_CONFLICT if "cannot" in str(exc).lower() else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=status_code, detail=str(exc))


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: UUID,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    svc = OrderService(session)
    try:
        await svc.delete_order(order_id, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{order_id}/confirm", response_model=OrderResponse)
async def confirm_order(
    order_id: UUID,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> OrderResponse:
    svc = OrderService(session)
    try:
        return await svc.confirm_order(order_id, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: UUID,
    session: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_tenant_id),
) -> OrderResponse:
    svc = OrderService(session)
    try:
        return await svc.cancel_order(order_id, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
