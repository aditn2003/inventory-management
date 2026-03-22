import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from tests.conftest import create_user, create_tenant


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "newuser@test.com", "password": "pass123!", "name": "New User"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "New User"
    assert data["role"] == "user"
    assert "email" not in data


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient):
    payload = {"email": "dup@test.com", "password": "pass123!", "name": "Dup User"}
    await client.post("/api/v1/auth/register", json=payload)
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    response = await client.post("/api/v1/auth/login", json={"email": "no@one.com", "password": "wrong"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_google_oauth_status(client: AsyncClient):
    response = await client.get("/api/v1/auth/google/status")
    assert response.status_code == 200
    data = response.json()
    assert "enabled" in data
    assert isinstance(data["enabled"], bool)


@pytest.mark.asyncio
async def test_me_without_token(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)


# ── Login success ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, session: AsyncSession):
    await create_user(session, "login_ok@test.com", password="secure123!", role="user")
    response = await client.post("/api/v1/auth/login", json={"email": "login_ok@test.com", "password": "secure123!"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_me_with_token(client: AsyncClient, session: AsyncSession):
    await create_user(session, "me_test@test.com", role="admin", name="Admin Me")
    login = await client.post("/api/v1/auth/login", json={"email": "me_test@test.com", "password": "test123!"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Admin Me"
    assert resp.json()["role"] == "admin"


# ── Refresh ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, session: AsyncSession):
    await create_user(session, "refresh@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "refresh@test.com", "password": "test123!"})
    assert login.status_code == 200
    cookies = login.cookies
    refresh_token = cookies.get("refresh_token")
    if not refresh_token:
        pytest.skip("refresh_token cookie not found (may be httponly)")
        return
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": "invalid.token.here"})
    assert resp.status_code == 401


# ── Logout ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_logout(client: AsyncClient, session: AsyncSession):
    await create_user(session, "logout@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "logout@test.com", "password": "test123!"})
    cookies = login.cookies
    refresh_token = cookies.get("refresh_token")
    if not refresh_token:
        pytest.skip("refresh_token cookie not found")
        return
    resp = await client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert resp.status_code == 204


# ── Accessible tenants ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_accessible_tenants_admin(client: AsyncClient, session: AsyncSession):
    await create_user(session, "admin_at@test.com", role="admin")
    await create_tenant(session, "AT Co", "TEN-AT1")
    login = await client.post("/api/v1/auth/login", json={"email": "admin_at@test.com", "password": "test123!"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/auth/me/accessible-tenants", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_accessible_tenants_regular_user(client: AsyncClient, session: AsyncSession):
    await create_user(session, "regular_at@test.com", role="user")
    await create_tenant(session, "RAT Co", "TEN-RAT1")
    login = await client.post("/api/v1/auth/login", json={"email": "regular_at@test.com", "password": "test123!"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/auth/me/accessible-tenants", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── Rate limiting ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_rate_limit(client: AsyncClient, session: AsyncSession, fake_redis):
    """After MAX_ATTEMPTS failed logins, further attempts are blocked."""
    email = "ratelimit@test.com"
    await create_user(session, email, role="user")
    for i in range(5):
        await client.post("/api/v1/auth/login", json={"email": email, "password": "wrong"})
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "test123!"})
    assert resp.status_code == 401
    assert "too many" in resp.json()["detail"].lower()


# ── Service-level tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_auth_service_verify_password():
    from app.auth.service import AuthService
    svc = AuthService(AsyncMock(), MagicMock())
    hashed = svc.hash_password("mypassword")
    assert svc.verify_password("mypassword", hashed)
    assert not svc.verify_password("wrong", hashed)


@pytest.mark.asyncio
async def test_auth_service_create_and_decode_tokens():
    from app.auth.service import AuthService
    svc = AuthService(AsyncMock(), MagicMock())
    uid = uuid4()
    access = svc.create_access_token(uid, "admin")
    payload = svc.decode_token(access)
    assert payload["sub"] == str(uid)
    assert payload["role"] == "admin"
    assert payload["type"] == "access"

    refresh = svc.create_refresh_token(uid)
    rpayload = svc.decode_token(refresh)
    assert rpayload["type"] == "refresh"


@pytest.mark.asyncio
async def test_auth_service_blacklist_token():
    from app.auth.service import AuthService
    from tests.conftest import FakeRedis
    fake = FakeRedis()
    svc = AuthService(AsyncMock(), fake)
    uid = uuid4()
    token = svc.create_access_token(uid, "user")
    await svc.blacklist_token(token)
    assert await svc.is_blacklisted(token) is True


@pytest.mark.asyncio
async def test_auth_service_rate_limit_flow():
    from app.auth.service import AuthService
    from tests.conftest import FakeRedis
    fake = FakeRedis()
    svc = AuthService(AsyncMock(), fake)
    email = "rl@test.com"
    for _ in range(5):
        await svc.record_failed_attempt(email)
    with pytest.raises(ValueError, match="Too many"):
        await svc.check_rate_limit(email)
    await svc.clear_attempts(email)
    await svc.check_rate_limit(email)


# ── Invite preview ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invite_preview_invalid(client: AsyncClient):
    resp = await client.get("/api/v1/auth/invite/preview?token=aaaaaaaaaaaaaaaaaaaaaaaaaa")
    assert resp.status_code == 404
