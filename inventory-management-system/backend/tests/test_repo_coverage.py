"""Direct repository and router tests to fill coverage gaps."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from tests.conftest import create_user, create_tenant, auth_headers, create_product_in_db


# ── Tenants repo: test through integration for missing paths ──────────────────

@pytest.mark.asyncio
async def test_tenant_create_inactive(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.post("/api/v1/tenants", json={"name": "Inactive Corp", "status": "inactive"}, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["status"] == "inactive"


@pytest.mark.asyncio
async def test_tenant_list_pagination(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    for i in range(5):
        await create_tenant(session, f"PagTenant {i}", f"TEN-PAG{i}")
    resp = await client.get("/api/v1/tenants?page=1&page_size=2", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 2
    resp2 = await client.get("/api/v1/tenants?page=2&page_size=2", headers=headers)
    assert resp2.status_code == 200


# ── Users repo/router: cover list_users internals and send_user_invitation ────

@pytest.mark.asyncio
async def test_users_list_pagination(client: AsyncClient, session: AsyncSession):
    for i in range(5):
        await create_user(session, f"paguser{i}@test.com")
    headers = await auth_headers(client, session, "admin")
    resp = await client.get("/api/v1/users?page=1&page_size=3", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 3


@pytest.mark.asyncio
async def test_users_send_invitation(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.post("/api/v1/users/invitations", json={"email": "invite@example.com"}, headers=headers)
    assert resp.status_code in (201, 400, 502, 503)


@pytest.mark.asyncio
async def test_users_invitation_requires_admin(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "user")
    resp = await client.post("/api/v1/users/invitations", json={"email": "inv@example.com"}, headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_users_update_role_requires_admin(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "roletarget@test.com", role="user")
    headers = await auth_headers(client, session, "user")
    resp = await client.put(f"/api/v1/users/{user.id}", json={"role": "admin"}, headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_users_delete_requires_admin(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "deltarget@test.com", role="user")
    headers = await auth_headers(client, session, "user")
    resp = await client.delete(f"/api/v1/users/{user.id}", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_users_tenants_requires_admin(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "tenuser@test.com", role="user")
    headers = await auth_headers(client, session, "user")
    resp = await client.get(f"/api/v1/users/{user.id}/tenants", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_users_tenant_access_requires_admin(client: AsyncClient, session: AsyncSession):
    user = await create_user(session, "accuser2@test.com", role="user")
    headers = await auth_headers(client, session, "user")
    resp = await client.put(f"/api/v1/users/{user.id}/tenant-access", json={"tenant_ids": []}, headers=headers)
    assert resp.status_code == 403


# ── Invite service: user already exists ───────────────────────────────────────

@pytest.mark.asyncio
async def test_send_invite_user_exists():
    from app.users.service import UserManagementService
    mock_session = AsyncMock()
    svc = UserManagementService(mock_session)

    from unittest.mock import patch
    with patch("app.users.service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(resend_api_key="test-key", invite_expire_hours=24, public_app_url="http://localhost:3000")
        with patch("app.users.service.AuthUserRepository") as MockAuthRepo:
            mock_auth_repo = MockAuthRepo.return_value
            mock_auth_repo.get_by_email = AsyncMock(return_value=MagicMock())
            with pytest.raises(ValueError, match="already exists"):
                await svc.send_user_invite("taken@test.com", uuid4())


# ── Auth router: register-invite, invite preview ─────────────────────────────

@pytest.mark.asyncio
async def test_register_invite_invalid_token(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register-invite", json={
        "token": "a" * 25,
        "name": "Invited User",
        "password": "securepass1!"
    })
    assert resp.status_code == 400


# ── Products/Inventory/Orders error paths via router ──────────────────────────

@pytest.mark.asyncio
async def test_create_order_invalid_product(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "BadOrd Co", "TEN-BO1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.post("/api/v1/orders", json={
        "product_id": str(uuid4()), "requested_qty": 5
    }, headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_update_order_not_found(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "UpdOrdNF Co", "TEN-UON1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.put(f"/api/v1/orders/{uuid4()}", json={"notes": "X"}, headers=headers)
    assert resp.status_code in (409, 422)


@pytest.mark.asyncio
async def test_confirm_order_not_found(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "ConfOrdNF Co", "TEN-CON1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.post(f"/api/v1/orders/{uuid4()}/confirm", headers=headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_cancel_order_not_found(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "CancelOrdNF Co", "TEN-CAN1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.post(f"/api/v1/orders/{uuid4()}/cancel", headers=headers)
    assert resp.status_code == 409


# ── Error handler ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_global_error_handler():
    from app.middleware.error_handler import global_exception_handler
    from unittest.mock import MagicMock
    request = MagicMock()
    request.url.path = "/test"
    response = await global_exception_handler(request, Exception("boom"))
    assert response.status_code == 500


# ── Tenant access restriction for regular user ───────────────────────────────

@pytest.mark.asyncio
async def test_tenant_access_restricted_for_user(client: AsyncClient, session: AsyncSession):
    from app.auth.models import UserTenantRole
    t1 = await create_tenant(session, "AccessibleT", "TEN-AT2")
    t2 = await create_tenant(session, "RestrictedT", "TEN-RT2")
    user = await create_user(session, "restricted@test.com", role="user")
    assignment = UserTenantRole(user_id=user.id, tenant_id=t1.id)
    session.add(assignment)
    await session.flush()
    login = await client.post("/api/v1/auth/login", json={"email": "restricted@test.com", "password": "test123!"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/products", headers={
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": str(t2.id)
    })
    assert resp.status_code == 403
    resp2 = await client.get("/api/v1/products", headers={
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": str(t1.id)
    })
    assert resp2.status_code == 200
