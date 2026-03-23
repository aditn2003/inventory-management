"""Async SQLAlchemy engine, session factory, ``get_db`` dependency, and RLS helpers."""

from collections.abc import AsyncGenerator
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a DB session."""
    async with async_session_factory() as session:
        yield session


async def set_rls_context(session: AsyncSession, tenant_id: UUID) -> None:
    """Switch to the non-owner ``ims_app`` role and pin the tenant GUC for this transaction.

    ``SET LOCAL`` is transaction-scoped: role and GUC revert automatically on
    commit / rollback, keeping the connection pool safe.
    """
    if settings.environment == "test":
        return
    await session.execute(text("SET LOCAL ROLE ims_app"))
    await session.execute(
        text("SELECT set_config('app.current_tenant_id', :tid, true)"),
        {"tid": str(tenant_id)},
    )
