"""Tenant CRUD and list filtering (admin)."""

from typing import Literal, Optional
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.tenants.models import Tenant
from app.tenants.repository import TenantRepository

TenantSortBy = Literal["display_id", "name", "status", "created_at"]
TenantSortDir = Literal["asc", "desc"]


class TenantService:
    """Create, update, delete tenants and paginated listing."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TenantRepository(session)

    async def list_tenants(
        self,
        accessible_tenant_ids: Optional[list[UUID]],
        page: int,
        page_size: int,
        q: Optional[str],
        sort_by: Optional[TenantSortBy] = None,
        sort_dir: Optional[TenantSortDir] = None,
    ) -> dict:
        tenants, total = await self.repo.list(
            accessible_tenant_ids,
            page,
            page_size,
            q,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        total_count = await self.repo.count_all()
        active_count = await self.repo.count_by_status("active")
        inactive_count = await self.repo.count_by_status("inactive")
        return {
            "data": tenants,
            "meta": {"total": total, "page": page, "page_size": page_size},
            "summary": {
                "total": total_count,
                "active": active_count,
                "inactive": inactive_count,
            },
        }

    async def get_tenant(self, tenant_id: UUID) -> Tenant:
        tenant = await self.repo.get_by_id(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found.")
        return tenant

    async def create_tenant(self, name: str, status: str = "active") -> Tenant:
        existing = await self.repo.get_by_name(name)
        if existing:
            raise ValueError(f"A tenant with name '{name}' already exists.")
        if status not in ("active", "inactive"):
            raise ValueError("Status must be 'active' or 'inactive'.")
        display_id = await self.repo.get_next_display_id()
        try:
            tenant = await self.repo.create(
                name=name, status=status, display_id=display_id
            )
            await self.session.commit()
            await self.session.refresh(tenant)
        except IntegrityError:
            await self.session.rollback()
            raise ValueError(f"A tenant with name '{name}' already exists.")
        return tenant

    async def update_tenant(
        self, tenant_id: UUID, name: Optional[str], status: Optional[str]
    ) -> Tenant:
        tenant = await self.get_tenant(tenant_id)
        if name and name != tenant.name:
            existing = await self.repo.get_by_name(name)
            if existing:
                raise ValueError(f"A tenant with name '{name}' already exists.")
        if status and status not in ("active", "inactive"):
            raise ValueError("Status must be 'active' or 'inactive'.")
        try:
            tenant = await self.repo.update(tenant, name=name, status=status)
            await self.session.commit()
            await self.session.refresh(tenant)
        except IntegrityError:
            await self.session.rollback()
            raise ValueError(f"A tenant with name '{name}' already exists.")
        return tenant

    async def delete_tenant(self, tenant_id: UUID) -> None:
        tenant = await self.get_tenant(tenant_id)
        await self.repo.hard_delete(tenant)
        await self.session.commit()
