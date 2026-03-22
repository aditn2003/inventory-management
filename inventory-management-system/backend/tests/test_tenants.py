import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

from tests.conftest import create_user, create_tenant, auth_headers


async def get_admin_token(client: AsyncClient, session: AsyncSession) -> str:
    await create_user(session, "admin_t@test.com", role="admin")
    resp = await client.post("/api/v1/auth/login", json={"email": "admin_t@test.com", "password": "test123!"})
    return resp.json().get("access_token", "")


@pytest.mark.asyncio
async def test_list_tenants_requires_auth(client: AsyncClient):
    response = await client.get("/api/v1/tenants")
    assert response.status_code in (401, 403)


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


# ── Additional CRUD tests ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_tenant_success(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.post("/api/v1/tenants", json={"name": "New Tenant Corp"}, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "New Tenant Corp"
    assert body["status"] == "active"
    assert body["display_id"].startswith("TEN-")


@pytest.mark.asyncio
async def test_create_tenant_duplicate_name(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    await create_tenant(session, "Duplicate Co", "TEN-DUP1")
    resp = await client.post("/api/v1/tenants", json={"name": "Duplicate Co"}, headers=headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_get_tenant_success(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    t = await create_tenant(session, "Get Tenant Co", "TEN-GTC1")
    resp = await client.get(f"/api/v1/tenants/{t.id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Get Tenant Co"


@pytest.mark.asyncio
async def test_get_tenant_not_found(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.get(f"/api/v1/tenants/{uuid4()}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_tenant_success(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    t = await create_tenant(session, "Update Tenant Co", "TEN-UTC1")
    resp = await client.put(f"/api/v1/tenants/{t.id}", json={"name": "Updated Tenant Co"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Tenant Co"


@pytest.mark.asyncio
async def test_update_tenant_status(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    t = await create_tenant(session, "StatusChange Co", "TEN-SC1")
    resp = await client.put(f"/api/v1/tenants/{t.id}", json={"status": "inactive"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "inactive"


@pytest.mark.asyncio
async def test_update_tenant_not_found(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.put(f"/api/v1/tenants/{uuid4()}", json={"name": "X"}, headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_tenant_duplicate_name(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    await create_tenant(session, "Existing Name", "TEN-EN1")
    t2 = await create_tenant(session, "Other Name", "TEN-ON1")
    resp = await client.put(f"/api/v1/tenants/{t2.id}", json={"name": "Existing Name"}, headers=headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_tenant_success(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    t = await create_tenant(session, "Delete Tenant Co", "TEN-DTC1")
    resp = await client.delete(f"/api/v1/tenants/{t.id}", headers=headers)
    assert resp.status_code == 204
    resp2 = await client.get(f"/api/v1/tenants/{t.id}", headers=headers)
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_delete_tenant_not_found(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.delete(f"/api/v1/tenants/{uuid4()}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_tenants_with_search(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    await create_tenant(session, "UniqueSearchable Corp", "TEN-US1")
    resp = await client.get("/api/v1/tenants?q=UniqueSearchable", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) >= 1


@pytest.mark.asyncio
async def test_list_tenants_with_sort(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.get("/api/v1/tenants?sort_by=name&sort_dir=asc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_list_tenants_sort_mismatch(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.get("/api/v1/tenants?sort_by=name", headers=headers)
    assert resp.status_code == 422
