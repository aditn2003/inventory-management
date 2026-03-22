"""Persistence for ``User`` rows and ``UserTenantRole`` assignments."""

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User, UserTenantRole


class UserRepository:
    """CRUD-style access for users used by auth and tenant checks."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_google_sub(self, google_sub: str) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(User.google_sub == google_sub)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create(
        self,
        email: str,
        password_hash: Optional[str],
        role: str = "user",
        name: str = "",
        google_sub: Optional[str] = None,
    ) -> User:
        user = User(
            email=email,
            password_hash=password_hash,
            role=role,
            name=name,
            google_sub=google_sub,
        )
        self.session.add(user)
        await self.session.flush()
        return user

    async def get_assigned_tenant_ids(self, user_id: UUID) -> list[UUID]:
        result = await self.session.execute(
            select(UserTenantRole.tenant_id).where(UserTenantRole.user_id == user_id)
        )
        return [row[0] for row in result.all()]
