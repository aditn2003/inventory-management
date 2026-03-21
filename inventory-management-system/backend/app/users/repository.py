from typing import Optional
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User, UserTenantRole
from app.tenants.models import Tenant


class UserManagementRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_users(self, page: int, page_size: int) -> tuple[list, int]:
        count_result = await self.session.execute(select(func.count()).select_from(User))
        total = count_result.scalar_one()

        result = await self.session.execute(
            select(User)
            .order_by(User.created_at)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        users = result.scalars().all()

        user_items = []
        for user in users:
            count_res = await self.session.execute(
                select(func.count()).select_from(UserTenantRole).where(UserTenantRole.user_id == user.id)
            )
            assigned_count = count_res.scalar_one()
            user_items.append({
                "id": user.id,
                "name": (user.name or "").strip(),
                "role": user.role,
                "assigned_tenant_count": assigned_count,
                "created_at": user.created_at,
            })
        return user_items, total

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_tenants(self, user_id: UUID) -> list[Tenant]:
        result = await self.session.execute(
            select(Tenant)
            .join(UserTenantRole, UserTenantRole.tenant_id == Tenant.id)
            .where(UserTenantRole.user_id == user_id)
        )
        return result.scalars().all()

    async def update_role(self, user: User, role: str) -> User:
        user.role = role
        await self.session.flush()
        return user

    async def hard_delete_user(self, user: User) -> None:
        await self.session.execute(delete(UserTenantRole).where(UserTenantRole.user_id == user.id))
        await self.session.delete(user)
        await self.session.flush()

    async def create_assignment(self, user_id: UUID, tenant_id: UUID) -> UserTenantRole:
        assignment = UserTenantRole(user_id=user_id, tenant_id=tenant_id)
        self.session.add(assignment)
        await self.session.flush()
        return assignment

    async def delete_all_assignments_for_user(self, user_id: UUID) -> None:
        await self.session.execute(delete(UserTenantRole).where(UserTenantRole.user_id == user_id))
        await self.session.flush()
