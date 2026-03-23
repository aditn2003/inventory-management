"""User admin API: list, invite, role, tenant access. Mounted at ``/api/v1/users``."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin
from app.auth.models import User
from app.database import get_db
from app.users.schemas import (
    TenantBrief,
    UserDetail,
    UserInviteCreate,
    UserInviteResponse,
    UserListResponse,
    UserRoleUpdate,
    UserTenantAccessSet,
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


@router.post(
    "/invitations",
    response_model=UserInviteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_user_invitation(
    body: UserInviteCreate,
    session: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UserInviteResponse:
    svc = UserManagementService(session)
    try:
        result = await svc.send_user_invite(str(body.email), admin.id)
        return UserInviteResponse(**result)
    except ValueError as exc:
        detail = str(exc)
        if "already exists" in detail.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
        if "RESEND_API_KEY is not configured" in detail:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail
            )
        if "Could not send" in detail or "send invitation email" in detail.lower():
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


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
    if user_id == _admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own role.",
        )
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


@router.put("/{user_id}/tenant-access", response_model=UserDetail)
async def set_user_tenant_access(
    user_id: UUID,
    body: UserTenantAccessSet,
    session: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserDetail:
    svc = UserManagementService(session)
    try:
        return await svc.set_user_tenant_access(user_id, body.tenant_ids)
    except ValueError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
