from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User, UserTenantRole


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create(
        self,
        email: str,
        password_hash: str,
        role: str = "user",
        name: str = "",
    ) -> User:
        user = User(email=email, password_hash=password_hash, role=role, name=name)
        self.session.add(user)
        await self.session.flush()
        return user

    async def get_assigned_tenant_ids(self, user_id: UUID) -> list[UUID]:
        result = await self.session.execute(
            select(UserTenantRole.tenant_id).where(UserTenantRole.user_id == user_id)
        )
        return [row[0] for row in result.all()]
