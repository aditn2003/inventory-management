"""Admin user management: invites (email), roles, tenant access."""

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.invite_repository import UserInviteRepository, hash_invite_token
from app.auth.repository import UserRepository as AuthUserRepository
from app.config import get_settings
from app.email.resend_mailer import send_invitation_email
from app.users.repository import UserManagementRepository
from app.tenants.repository import TenantRepository


class UserManagementService:
    """Orchestrates user list/detail, invitations, and tenant access updates."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserManagementRepository(session)

    async def list_users(self, page: int, page_size: int) -> dict:
        users, total = await self.repo.list_users(page, page_size)
        return {
            "data": users,
            "meta": {"total": total, "page": page, "page_size": page_size},
        }

    async def send_user_invite(self, email: str, admin_id: UUID) -> dict:
        """Create invite row and email a registration link (role will be *user* when they register)."""
        settings = get_settings()
        if not (settings.resend_api_key or "").strip():
            raise ValueError(
                "RESEND_API_KEY is not configured. Set it in the environment to send invitation emails."
            )

        email_norm = email.strip().lower()
        auth_repo = AuthUserRepository(self.session)
        if await auth_repo.get_by_email(email_norm):
            raise ValueError("A user with this email already exists.")

        invite_repo = UserInviteRepository(self.session)
        await invite_repo.revoke_pending_for_email(email_norm)

        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_invite_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.invite_expire_hours
        )

        await invite_repo.create(
            email=email_norm,
            token_hash=token_hash,
            expires_at=expires_at,
            invited_by_id=admin_id,
        )

        base = settings.public_app_url.rstrip("/")
        invite_url = f"{base}/register/invite?token={raw_token}"

        try:
            await send_invitation_email(to_email=email_norm, invite_url=invite_url)
        except Exception as exc:
            await self.session.rollback()
            raise ValueError(
                f"Could not send invitation email ({exc!s}). Check RESEND_API_KEY and RESEND_FROM_EMAIL."
            ) from exc

        await self.session.commit()
        return {"message": "Invitation email sent."}

    async def get_user(self, user_id: UUID) -> dict:
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found.")
        tenants = await self.repo.get_user_tenants(user_id)
        return {
            "id": user.id,
            "name": (user.name or "").strip(),
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
        return {
            "id": user.id,
            "name": (user.name or "").strip(),
            "role": user.role,
            "assigned_tenants": tenants,
            "created_at": user.created_at,
        }

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

    async def set_user_tenant_access(
        self, user_id: UUID, tenant_ids: list[UUID]
    ) -> dict:
        """Replace assignments. Empty list clears rows → user can access all tenants (same as seed default)."""
        user = await self.repo.get_user_by_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found.")

        seen: set[UUID] = set()
        unique_ids: list[UUID] = []
        for tid in tenant_ids:
            if tid not in seen:
                seen.add(tid)
                unique_ids.append(tid)

        tenant_repo = TenantRepository(self.session)
        for tid in unique_ids:
            tenant = await tenant_repo.get_by_id(tid)
            if not tenant:
                raise ValueError(f"Tenant {tid} not found.")

        await self.repo.delete_all_assignments_for_user(user_id)
        for tid in unique_ids:
            await self.repo.create_assignment(user_id, tid)
        await self.session.commit()
        tenants = await self.repo.get_user_tenants(user_id)
        return {
            "id": user.id,
            "name": (user.name or "").strip(),
            "role": user.role,
            "assigned_tenants": tenants,
            "created_at": user.created_at,
        }
