"""
pytest configuration and fixtures for backend tests.
Uses an isolated in-memory SQLite DB and a fake Redis stub.
"""
import asyncio
from typing import AsyncGenerator
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth.models import Base
from app.database import get_db
from app.auth.dependencies import get_redis
from app.main import create_app

# Import all models so Base.metadata is populated
import app.tenants.models  # noqa: F401
import app.products.models  # noqa: F401
import app.inventory.models  # noqa: F401
import app.orders.models  # noqa: F401

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


class FakeRedis:
    """Minimal in-memory Redis stub for tests (rate-limit, blacklist, etc.)."""

    def __init__(self):
        self._store: dict[str, str] = {}

    async def get(self, key: str):
        return self._store.get(key)

    async def setex(self, key: str, ttl: int, value: str):
        self._store[key] = value

    async def set(self, key: str, value: str, **kwargs):
        self._store[key] = value

    async def delete(self, *keys: str):
        for k in keys:
            self._store.pop(k, None)

    async def exists(self, key: str) -> int:
        return 1 if key in self._store else 0

    async def incr(self, key: str):
        val = int(self._store.get(key, 0)) + 1
        self._store[key] = str(val)
        return val

    async def expire(self, key: str, ttl: int):
        pass

    def pipeline(self):
        return FakeRedisPipeline(self)


class FakeRedisPipeline:
    def __init__(self, redis: FakeRedis):
        self._redis = redis
        self._ops: list[tuple] = []

    def incr(self, key: str):
        self._ops.append(("incr", key))
        return self

    def expire(self, key: str, ttl: int):
        self._ops.append(("expire", key, ttl))
        return self

    async def execute(self):
        results = []
        for op in self._ops:
            if op[0] == "incr":
                results.append(await self._redis.incr(op[1]))
            elif op[0] == "expire":
                results.append(await self._redis.expire(op[1], op[2]))
        return results


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
async def fake_redis() -> FakeRedis:
    return FakeRedis()


@pytest_asyncio.fixture
async def client(session: AsyncSession, fake_redis: FakeRedis) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def override_get_db():
        yield session

    def override_get_redis():
        return fake_redis

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


# ── Helpers ───────────────────────────────────────────────────────────────────

async def create_user(
    session: AsyncSession,
    email: str,
    password: str = "test123!",
    role: str = "user",
    name: str = "Test User",
):
    from passlib.context import CryptContext
    from app.auth.models import User
    ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user = User(email=email, name=name, password_hash=ctx.hash(password), role=role)
    session.add(user)
    await session.flush()
    return user


async def create_tenant(session: AsyncSession, name: str, display_id: str = "TEN-001") -> object:
    from app.tenants.models import Tenant
    t = Tenant(name=name, display_id=display_id, status="active")
    session.add(t)
    await session.flush()
    return t


async def login_user(client: AsyncClient, email: str, password: str = "test123!") -> str:
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json().get("access_token", "")


async def auth_headers(client: AsyncClient, session: AsyncSession, role: str = "admin", tenant=None):
    """Create a user, login, return headers dict with auth + optional tenant."""
    import uuid as _uuid
    unique = str(_uuid.uuid4())[:8]
    email = f"{role}_{unique}@test.com"
    await create_user(session, email, role=role)
    token = await login_user(client, email)
    headers = {"Authorization": f"Bearer {token}"}
    if tenant:
        headers["X-Tenant-Id"] = str(tenant.id)
    return headers


async def create_product_in_db(session: AsyncSession, tenant_id, sku: str = "TST-001", name: str = "Test Product",
                                category: str = "Metals", cost=10.00, reorder=50):
    from app.products.models import Product
    from app.inventory.models import Inventory
    from decimal import Decimal
    p = Product(tenant_id=tenant_id, sku=sku, name=name, category=category,
                cost_per_unit=Decimal(str(cost)), reorder_threshold=reorder, status="active")
    session.add(p)
    await session.flush()
    inv = Inventory(product_id=p.id, tenant_id=tenant_id, current_stock=100, unit="units")
    session.add(inv)
    await session.flush()
    return p, inv
