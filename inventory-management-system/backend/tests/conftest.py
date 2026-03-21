"""
pytest configuration and fixtures for backend tests.
Uses an isolated in-memory SQLite-compatible test DB (or a separate postgres test DB).
"""
import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth.models import Base
from app.database import get_db
from app.main import create_app

# Import all models so Base.metadata is populated
import app.tenants.models  # noqa: F401
import app.products.models  # noqa: F401
import app.inventory.models  # noqa: F401
import app.orders.models  # noqa: F401

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with session_factory() as s:
        yield s
        await s.rollback()


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


# ── Helpers ───────────────────────────────────────────────────────────────────

async def create_user(session: AsyncSession, email: str, password: str = "test123!", role: str = "user"):
    from passlib.context import CryptContext
    from app.auth.models import User
    ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user = User(email=email, password_hash=ctx.hash(password), role=role)
    session.add(user)
    await session.flush()
    return user


async def create_tenant(session: AsyncSession, name: str, display_id: str = "TEN-001") -> object:
    from app.tenants.models import Tenant
    t = Tenant(name=name, display_id=display_id, status="active")
    session.add(t)
    await session.flush()
    return t
