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


@pytest.mark.asyncio
async def test_list_tenants_requires_admin(client: AsyncClient, session: AsyncSession):
    await create_user(session, "listuser@test.com", role="user")
    await create_tenant(session, "Acme")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "listuser@test.com", "password": "test123!"},
    )
    token = login.json()["access_token"]
    response = await client.get(
        "/api/v1/tenants",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_tenant_requires_admin(client: AsyncClient, session: AsyncSession):
    await create_user(session, "getuser@test.com", role="user")
    t = await create_tenant(session, "Globex")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "getuser@test.com", "password": "test123!"},
    )
    token = login.json()["access_token"]
    response = await client.get(
        f"/api/v1/tenants/{t.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_accessible_tenants_for_non_admin(client: AsyncClient, session: AsyncSession):
    await create_user(session, "accuser@test.com", role="user")
    await create_tenant(session, "Widget Co")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "accuser@test.com", "password": "test123!"},
    )
    token = login.json()["access_token"]
    response = await client.get(
        "/api/v1/auth/me/accessible-tenants",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    assert body[0]["name"] == "Widget Co"


@pytest.mark.asyncio
async def test_list_tenants_succeeds_for_admin(client: AsyncClient, session: AsyncSession):
    token = await get_admin_token(client, session)
    await create_tenant(session, "AdminListCo", display_id="TEN-ADM")
    response = await client.get(
        "/api/v1/tenants",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert any(t["name"] == "AdminListCo" for t in data)
