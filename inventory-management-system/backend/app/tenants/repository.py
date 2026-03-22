"""Tenant rows: CRUD, search, sort, admin visibility rules."""

from typing import Literal, Optional
from uuid import UUID

from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import UserTenantRole
from app.orders.models import Order
from app.products.models import Product
from app.tenants.models import Tenant

TenantSortBy = Literal["display_id", "name", "status", "created_at"]
TenantSortDir = Literal["asc", "desc"]


class TenantRepository:
    """Persistence for ``Tenant`` and related list queries."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def count_all(self) -> int:
        result = await self.session.execute(select(func.count()).select_from(Tenant))
        return result.scalar_one()

    async def count_by_status(self, status: str) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(Tenant).where(Tenant.status == status)
        )
        return result.scalar_one()

    def _default_order(self):
        """Active tenants first, then by created_at descending (newest first)."""
        status_rank = case((Tenant.status == "active", 0), else_=1)
        return status_rank.asc(), Tenant.created_at.desc()

    def _order_by_clauses(self, sort_by: TenantSortBy, sort_dir: TenantSortDir):
        # Names: case-insensitive A→Z (LOWER); tie-break on stored name for stability.
        if sort_by == "name":
            ln = func.lower(Tenant.name)
            if sort_dir == "asc":
                return (ln.asc(), Tenant.name.asc())
            return (ln.desc(), Tenant.name.desc())
        col = {
            "display_id": Tenant.display_id,
            "status": Tenant.status,
            "created_at": Tenant.created_at,
        }[sort_by]
        return (col.asc(),) if sort_dir == "asc" else (col.desc(),)

    async def list(
        self,
        tenant_ids: Optional[list[UUID]],
        page: int,
        page_size: int,
        q: Optional[str],
        sort_by: Optional[TenantSortBy] = None,
        sort_dir: Optional[TenantSortDir] = None,
    ) -> tuple[list[Tenant], int]:
        query = select(Tenant)
        if tenant_ids is not None:
            query = query.where(Tenant.id.in_(tenant_ids))
        if q:
            query = query.where(Tenant.name.ilike(f"%{q}%"))

        count_result = await self.session.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar_one()

        if sort_by and sort_dir:
            query = query.order_by(*self._order_by_clauses(sort_by, sort_dir))
        else:
            query = query.order_by(*self._default_order())
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.session.execute(query)
        return result.scalars().all(), total

    async def get_by_id(self, tenant_id: UUID) -> Optional[Tenant]:
        result = await self.session.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Optional[Tenant]:
        result = await self.session.execute(select(Tenant).where(Tenant.name == name))
        return result.scalar_one_or_none()

    async def get_next_display_id(self) -> str:
        result = await self.session.execute(select(func.count()).select_from(Tenant))
        total = result.scalar_one()
        return f"TEN-{total + 1:03d}"

    async def create(self, name: str, status: str, display_id: str) -> Tenant:
        tenant = Tenant(name=name, status=status, display_id=display_id)
        self.session.add(tenant)
        await self.session.flush()
        return tenant

    async def update(self, tenant: Tenant, **kwargs) -> Tenant:
        for key, value in kwargs.items():
            if value is not None:
                setattr(tenant, key, value)
        await self.session.flush()
        return tenant

    async def hard_delete(self, tenant: Tenant) -> None:
        """Permanently remove tenant and all dependent rows (orders, products+inventory, assignments)."""
        tid = tenant.id
        await self.session.execute(delete(Order).where(Order.tenant_id == tid))
        await self.session.execute(delete(Product).where(Product.tenant_id == tid))
        await self.session.execute(
            delete(UserTenantRole).where(UserTenantRole.tenant_id == tid)
        )
        await self.session.delete(tenant)
        await self.session.flush()
