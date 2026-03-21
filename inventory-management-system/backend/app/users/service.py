from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.users.repository import UserManagementRepository
from app.tenants.repository import TenantRepository


class UserManagementService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserManagementRepository(session)

    async def list_users(self, page: int, page_size: int) -> dict:
        users, total = await self.repo.list_users(page, page_size)
        return {
            "data": users,
            "meta": {"total": total, "page": page, "page_size": page_size},
        }

    async def get_user(self, user_id: UUID) -> dict:
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found.")
        tenants = await self.repo.get_user_tenants(user_id)
        return {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "assigned_tenants": tenants,
            "created_at": user.created_at,
        }

    async def update_role(self, user_id: UUID, role: str) -> dict:
        if role not in ("admin", "user"):
            raise ValueError("Role must be 'admin' or 'user'.")
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found.")
        user = await self.repo.update_role(user, role)
        await self.session.commit()
        tenants = await self.repo.get_user_tenants(user_id)
        return {"id": user.id, "email": user.email, "role": user.role,
                "assigned_tenants": tenants, "created_at": user.created_at}

    async def delete_user(self, user_id: UUID) -> None:
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found.")
        await self.repo.hard_delete_user(user)
        await self.session.commit()

    async def get_user_tenants(self, user_id: UUID) -> list:
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found.")
        return await self.repo.get_user_tenants(user_id)

    async def assign_tenant(self, user_id: UUID, tenant_id: UUID) -> dict:
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found.")

        tenant_repo = TenantRepository(self.session)
        tenant = await tenant_repo.get_by_id(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found.")

        existing = await self.repo.get_assignment(user_id, tenant_id)
        if existing:
            raise ValueError("Tenant is already assigned to this user.")

        await self.repo.create_assignment(user_id, tenant_id)
        await self.session.commit()
        return {"user_id": user_id, "tenant_id": tenant_id}

    async def remove_tenant(self, user_id: UUID, tenant_id: UUID) -> None:
        assignment = await self.repo.get_assignment(user_id, tenant_id)
        if not assignment:
            raise ValueError("Assignment not found.")
        await self.repo.delete_assignment(assignment)
        await self.session.commit()
