from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin
from app.auth.models import User
from app.database import get_db
from app.users.schemas import (
    TenantAssignmentInput,
    TenantBrief,
    UserDetail,
    UserListItem,
    UserListResponse,
    UserRoleUpdate,
)
from app.users.service import UserManagementService

router = APIRouter()


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserListResponse:
    svc = UserManagementService(session)
    return await svc.list_users(page, page_size)


@router.get("/{user_id}", response_model=UserDetail)
async def get_user(
    user_id: UUID,
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserDetail:
    svc = UserManagementService(session)
    try:
        return await svc.get_user(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{user_id}", response_model=UserDetail)
async def update_user_role(
    user_id: UUID,
    body: UserRoleUpdate,
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserDetail:
    svc = UserManagementService(session)
    try:
        return await svc.update_role(user_id, body.role)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    svc = UserManagementService(session)
    try:
        await svc.delete_user(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get("/{user_id}/tenants", response_model=list[TenantBrief])
async def get_user_tenants(
    user_id: UUID,
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[TenantBrief]:
    svc = UserManagementService(session)
    try:
        return await svc.get_user_tenants(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{user_id}/tenants", status_code=status.HTTP_201_CREATED)
async def assign_tenant(
    user_id: UUID,
    body: TenantAssignmentInput,
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict:
    svc = UserManagementService(session)
    try:
        return await svc.assign_tenant(user_id, body.tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.delete("/{user_id}/tenants/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tenant(
    user_id: UUID,
    tenant_id: UUID,
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    svc = UserManagementService(session)
    try:
        await svc.remove_tenant(user_id, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
