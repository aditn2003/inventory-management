"""Invite token storage — hash-only in DB; raw token only in email link."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import UserInvite


def hash_invite_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class UserInviteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def invite_still_valid(inv: UserInvite) -> bool:
        if inv.consumed_at is not None:
            return False
        now = datetime.now(timezone.utc)
        exp = inv.expires_at
        if exp is None:
            return False
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp >= now

    async def revoke_pending_for_email(self, email: str) -> None:
        await self.session.execute(
            delete(UserInvite).where(
                UserInvite.email == email,
                UserInvite.consumed_at.is_(None),
            )
        )

    async def create(
        self,
        *,
        email: str,
        token_hash: str,
        expires_at: datetime,
        invited_by_id: UUID,
    ) -> UserInvite:
        inv = UserInvite(
            email=email,
            token_hash=token_hash,
            expires_at=expires_at,
            invited_by_id=invited_by_id,
        )
        self.session.add(inv)
        await self.session.flush()
        return inv

    async def get_valid_by_token_hash(self, token_hash: str) -> UserInvite | None:
        result = await self.session.execute(
            select(UserInvite).where(UserInvite.token_hash == token_hash)
        )
        inv = result.scalar_one_or_none()
        if not inv or not self.invite_still_valid(inv):
            return None
        return inv

    async def get_any_valid_pending_for_email(self, email: str) -> UserInvite | None:
        """Any non-expired, unconsumed invite for this email (case-insensitive)."""
        email_norm = email.strip().lower()
        result = await self.session.execute(
            select(UserInvite).where(
                func.lower(UserInvite.email) == email_norm,
                UserInvite.consumed_at.is_(None),
            )
        )
        for inv in result.scalars().all():
            if self.invite_still_valid(inv):
                return inv
        return None

    async def consume(self, inv: UserInvite) -> None:
        inv.consumed_at = datetime.now(timezone.utc)
        await self.session.flush()
