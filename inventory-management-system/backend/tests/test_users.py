import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

from tests.conftest import create_user, create_tenant, auth_headers


@pytest.mark.asyncio
async def test_list_users_requires_admin(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "user")
    resp = await client.get("/api/v1/users", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_users_success(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.get("/api/v1/users", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert "meta" in data
    assert data["meta"]["total"] >= 1


@pytest.mark.asyncio
async def test_get_user_success(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "viewable@test.com", role="user", name="Viewable")
    headers = await auth_headers(client, session, "admin")
    resp = await client.get(f"/api/v1/users/{user.id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Viewable"
    assert resp.json()["role"] == "user"


@pytest.mark.asyncio
async def test_get_user_not_found(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.get(f"/api/v1/users/{uuid4()}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_user_requires_admin(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "otheruser@test.com")
    headers = await auth_headers(client, session, "user")
    resp = await client.get(f"/api/v1/users/{user.id}", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_update_user_role(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "rolechange@test.com", role="user")
    headers = await auth_headers(client, session, "admin")
    resp = await client.put(f"/api/v1/users/{user.id}", json={"role": "admin"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_update_user_invalid_role(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "badrole@test.com", role="user")
    headers = await auth_headers(client, session, "admin")
    resp = await client.put(f"/api/v1/users/{user.id}", json={"role": "superadmin"}, headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_delete_user_success(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "deletable@test.com", role="user")
    headers = await auth_headers(client, session, "admin")
    resp = await client.delete(f"/api/v1/users/{user.id}", headers=headers)
    assert resp.status_code == 204
    resp2 = await client.get(f"/api/v1/users/{user.id}", headers=headers)
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_delete_user_not_found(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.delete(f"/api/v1/users/{uuid4()}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_user_tenants(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "tenanted@test.com", role="user")
    headers = await auth_headers(client, session, "admin")
    resp = await client.get(f"/api/v1/users/{user.id}/tenants", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_get_user_tenants_not_found(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.get(f"/api/v1/users/{uuid4()}/tenants", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_set_user_tenant_access(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "access@test.com", role="user")
    t = await create_tenant(session, "AccessCo", "TEN-AC1")
    headers = await auth_headers(client, session, "admin")
    resp = await client.put(
        f"/api/v1/users/{user.id}/tenant-access",
        json={"tenant_ids": [str(t.id)]},
        headers=headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["assigned_tenants"]) == 1
    assert resp.json()["assigned_tenants"][0]["name"] == "AccessCo"


@pytest.mark.asyncio
async def test_set_user_tenant_access_clear(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "clearaccess@test.com", role="user")
    headers = await auth_headers(client, session, "admin")
    resp = await client.put(
        f"/api/v1/users/{user.id}/tenant-access",
        json={"tenant_ids": []},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["assigned_tenants"] == []


@pytest.mark.asyncio
async def test_set_user_tenant_access_not_found_user(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.put(
        f"/api/v1/users/{uuid4()}/tenant-access",
        json={"tenant_ids": []},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_set_user_tenant_access_bad_tenant(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "badtenant@test.com", role="user")
    headers = await auth_headers(client, session, "admin")
    resp = await client.put(
        f"/api/v1/users/{user.id}/tenant-access",
        json={"tenant_ids": [str(uuid4())]},
        headers=headers,
    )
    assert resp.status_code == 404
