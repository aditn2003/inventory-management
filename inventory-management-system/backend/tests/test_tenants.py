import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_user, create_tenant


async def get_admin_token(client: AsyncClient, session: AsyncSession) -> str:
    await create_user(session, "admin_t@test.com", role="admin")
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "admin_t@test.com", "password": "test123!", "name": "Admin T"},
    )
    # Override: create directly and login
    resp = await client.post("/api/v1/auth/login", json={"email": "admin_t@test.com", "password": "test123!"})
    return resp.json().get("access_token", "")


@pytest.mark.asyncio
async def test_list_tenants_requires_auth(client: AsyncClient):
    response = await client.get("/api/v1/tenants")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_create_tenant_requires_admin(client: AsyncClient, session: AsyncSession):
    await create_user(session, "regularuser@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "regularuser@test.com", "password": "test123!"})
    token = login.json().get("access_token", "")
    response = await client.post(
        "/api/v1/tenants",
        json={"name": "Test Tenant"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
