"""Tests for auth service OAuth methods, invite flows, and dependencies."""
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from uuid import uuid4

from tests.conftest import FakeRedis, create_user


# ── register_with_invite ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_with_invite_invalid_token():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    mock_session = AsyncMock()
    svc = AuthService(mock_session, fake_redis)

    with patch("app.auth.service.UserRepository") as MockRepo:
        mock_repo = MagicMock()
        MockRepo.return_value = mock_repo
        svc.repo = mock_repo

        with patch("app.auth.invite_repository.UserInviteRepository") as MockInvRepo:
            mock_inv_repo = MagicMock()
            mock_inv_repo.get_valid_by_token_hash = AsyncMock(return_value=None)
            MockInvRepo.return_value = mock_inv_repo

            with pytest.raises(ValueError, match="Invalid or expired"):
                await svc.register_with_invite("badtoken12345678901234", "User", "password123!")


@pytest.mark.asyncio
async def test_register_with_invite_email_taken():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    mock_session = AsyncMock()
    svc = AuthService(mock_session, fake_redis)

    inv = MagicMock()
    inv.email = "taken@test.com"

    with patch("app.auth.invite_repository.UserInviteRepository") as MockInvRepo:
        mock_inv_repo = MagicMock()
        mock_inv_repo.get_valid_by_token_hash = AsyncMock(return_value=inv)
        MockInvRepo.return_value = mock_inv_repo

        svc.repo = MagicMock()
        svc.repo.get_by_email = AsyncMock(return_value=MagicMock())

        with pytest.raises(ValueError, match="already registered"):
            await svc.register_with_invite("validtoken12345678901234", "User", "password123!")


@pytest.mark.asyncio
async def test_register_with_invite_success():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    mock_session = AsyncMock()
    svc = AuthService(mock_session, fake_redis)

    inv = MagicMock()
    inv.email = "invited@test.com"

    user = MagicMock(id=uuid4(), email="invited@test.com", role="user")

    with patch("app.auth.invite_repository.UserInviteRepository") as MockInvRepo:
        mock_inv_repo = MagicMock()
        mock_inv_repo.get_valid_by_token_hash = AsyncMock(return_value=inv)
        mock_inv_repo.consume = AsyncMock()
        MockInvRepo.return_value = mock_inv_repo

        svc.repo = MagicMock()
        svc.repo.get_by_email = AsyncMock(return_value=None)
        svc.repo.create = AsyncMock(return_value=user)

        result = await svc.register_with_invite("validtoken12345678901234", "Invited User", "password123!")
        assert result == user


# ── process_google_oauth_login ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_google_oauth_login_existing_by_sub():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    mock_session = AsyncMock()
    svc = AuthService(mock_session, fake_redis)
    svc.repo = MagicMock()

    existing = MagicMock(id=uuid4(), email="google@test.com")
    svc.repo.get_by_google_sub = AsyncMock(return_value=existing)

    result = await svc.process_google_oauth_login("sub123", "google@test.com", "Google User")
    assert result == existing


@pytest.mark.asyncio
async def test_google_oauth_login_existing_by_email_link():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    mock_session = AsyncMock()
    svc = AuthService(mock_session, fake_redis)
    svc.repo = MagicMock()

    svc.repo.get_by_google_sub = AsyncMock(return_value=None)

    by_email = MagicMock(id=uuid4(), email="user@test.com", google_sub=None)
    svc.repo.get_by_email = AsyncMock(return_value=by_email)

    result = await svc.process_google_oauth_login("sub_new", "user@test.com", "User")
    assert by_email.google_sub == "sub_new"
    mock_session.flush.assert_called()


@pytest.mark.asyncio
async def test_google_oauth_login_email_different_google_sub():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    svc = AuthService(AsyncMock(), fake_redis)
    svc.repo = MagicMock()

    svc.repo.get_by_google_sub = AsyncMock(return_value=None)
    by_email = MagicMock(google_sub="different_sub")
    svc.repo.get_by_email = AsyncMock(return_value=by_email)

    with pytest.raises(ValueError, match="different Google account"):
        await svc.process_google_oauth_login("new_sub", "user@test.com", "User")


@pytest.mark.asyncio
async def test_google_oauth_login_no_invite():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    svc = AuthService(AsyncMock(), fake_redis)
    svc.repo = MagicMock()

    svc.repo.get_by_google_sub = AsyncMock(return_value=None)
    svc.repo.get_by_email = AsyncMock(return_value=None)

    with patch("app.auth.invite_repository.UserInviteRepository") as MockInvRepo:
        mock_inv_repo = MagicMock()
        mock_inv_repo.get_any_valid_pending_for_email = AsyncMock(return_value=None)
        MockInvRepo.return_value = mock_inv_repo

        with pytest.raises(ValueError, match="login_not_allowed"):
            await svc.process_google_oauth_login("sub123", "no_invite@test.com", "User")


@pytest.mark.asyncio
async def test_google_oauth_login_with_invite():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    mock_session = AsyncMock()
    svc = AuthService(mock_session, fake_redis)
    svc.repo = MagicMock()

    svc.repo.get_by_google_sub = AsyncMock(return_value=None)
    svc.repo.get_by_email = AsyncMock(return_value=None)

    inv = MagicMock()
    inv.email = "newinvite@test.com"
    user = MagicMock(id=uuid4(), email="newinvite@test.com")

    with patch("app.auth.invite_repository.UserInviteRepository") as MockInvRepo:
        mock_inv_repo = MagicMock()
        mock_inv_repo.get_any_valid_pending_for_email = AsyncMock(return_value=inv)
        mock_inv_repo.consume = AsyncMock()
        MockInvRepo.return_value = mock_inv_repo

        svc.repo.create = AsyncMock(return_value=user)

        result = await svc.process_google_oauth_login("sub123", "newinvite@test.com", "")
        assert result == user


# ── process_google_oauth_invite ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_google_oauth_invite_email_mismatch():
    from app.auth.service import AuthService
    svc = AuthService(AsyncMock(), FakeRedis())
    svc.repo = MagicMock()

    inv = MagicMock()
    inv.email = "invited@test.com"

    with pytest.raises(ValueError, match="invite_email_mismatch"):
        await svc.process_google_oauth_invite("sub", "other@test.com", "User", inv)


@pytest.mark.asyncio
async def test_google_oauth_invite_expired():
    from app.auth.service import AuthService
    svc = AuthService(AsyncMock(), FakeRedis())
    svc.repo = MagicMock()

    inv = MagicMock()
    inv.email = "invited@test.com"

    with patch("app.auth.invite_repository.UserInviteRepository") as MockInvRepo:
        mock_inv_repo = MagicMock()
        mock_inv_repo.invite_still_valid = MagicMock(return_value=False)
        MockInvRepo.return_value = mock_inv_repo

        with pytest.raises(ValueError, match="expired"):
            await svc.process_google_oauth_invite("sub", "invited@test.com", "User", inv)


@pytest.mark.asyncio
async def test_google_oauth_invite_existing_sub_match():
    from app.auth.service import AuthService
    mock_session = AsyncMock()
    svc = AuthService(mock_session, FakeRedis())
    svc.repo = MagicMock()

    inv = MagicMock()
    inv.email = "invited@test.com"

    existing = MagicMock(id=uuid4(), email="invited@test.com")
    svc.repo.get_by_google_sub = AsyncMock(return_value=existing)

    with patch("app.auth.invite_repository.UserInviteRepository") as MockInvRepo:
        mock_inv_repo = MagicMock()
        mock_inv_repo.invite_still_valid = MagicMock(return_value=True)
        mock_inv_repo.consume = AsyncMock()
        MockInvRepo.return_value = mock_inv_repo

        result = await svc.process_google_oauth_invite("sub", "invited@test.com", "User", inv)
        assert result == existing


@pytest.mark.asyncio
async def test_google_oauth_invite_existing_sub_email_mismatch():
    from app.auth.service import AuthService
    svc = AuthService(AsyncMock(), FakeRedis())
    svc.repo = MagicMock()

    inv = MagicMock()
    inv.email = "invited@test.com"

    existing = MagicMock(id=uuid4(), email="different@test.com")
    svc.repo.get_by_google_sub = AsyncMock(return_value=existing)

    with patch("app.auth.invite_repository.UserInviteRepository") as MockInvRepo:
        mock_inv_repo = MagicMock()
        mock_inv_repo.invite_still_valid = MagicMock(return_value=True)
        MockInvRepo.return_value = mock_inv_repo

        with pytest.raises(ValueError, match="invite_email_mismatch"):
            await svc.process_google_oauth_invite("sub", "invited@test.com", "User", inv)


@pytest.mark.asyncio
async def test_google_oauth_invite_by_email_link_sub():
    from app.auth.service import AuthService
    mock_session = AsyncMock()
    svc = AuthService(mock_session, FakeRedis())
    svc.repo = MagicMock()

    inv = MagicMock()
    inv.email = "invited@test.com"

    svc.repo.get_by_google_sub = AsyncMock(return_value=None)
    by_email = MagicMock(id=uuid4(), email="invited@test.com", google_sub=None)
    svc.repo.get_by_email = AsyncMock(return_value=by_email)

    with patch("app.auth.invite_repository.UserInviteRepository") as MockInvRepo:
        mock_inv_repo = MagicMock()
        mock_inv_repo.invite_still_valid = MagicMock(return_value=True)
        mock_inv_repo.consume = AsyncMock()
        MockInvRepo.return_value = mock_inv_repo

        result = await svc.process_google_oauth_invite("newsub", "invited@test.com", "User", inv)
        assert by_email.google_sub == "newsub"


@pytest.mark.asyncio
async def test_google_oauth_invite_new_user():
    from app.auth.service import AuthService
    mock_session = AsyncMock()
    svc = AuthService(mock_session, FakeRedis())
    svc.repo = MagicMock()

    inv = MagicMock()
    inv.email = "brand_new@test.com"

    svc.repo.get_by_google_sub = AsyncMock(return_value=None)
    svc.repo.get_by_email = AsyncMock(return_value=None)
    user = MagicMock(id=uuid4(), email="brand_new@test.com")
    svc.repo.create = AsyncMock(return_value=user)

    with patch("app.auth.invite_repository.UserInviteRepository") as MockInvRepo:
        mock_inv_repo = MagicMock()
        mock_inv_repo.invite_still_valid = MagicMock(return_value=True)
        mock_inv_repo.consume = AsyncMock()
        MockInvRepo.return_value = mock_inv_repo

        result = await svc.process_google_oauth_invite("sub", "brand_new@test.com", "Brand New", inv)
        assert result == user


# ── invite_repository unit tests ─────────────────────────────────────────────

def test_hash_invite_token():
    from app.auth.invite_repository import hash_invite_token
    h1 = hash_invite_token("test_token_123")
    h2 = hash_invite_token("test_token_123")
    assert h1 == h2
    assert len(h1) == 64


def test_invite_still_valid_consumed():
    from app.auth.invite_repository import UserInviteRepository
    inv = MagicMock()
    inv.consumed_at = datetime.now(timezone.utc)
    assert UserInviteRepository.invite_still_valid(inv) is False


def test_invite_still_valid_no_expiry():
    from app.auth.invite_repository import UserInviteRepository
    inv = MagicMock()
    inv.consumed_at = None
    inv.expires_at = None
    assert UserInviteRepository.invite_still_valid(inv) is False


def test_invite_still_valid_expired():
    from app.auth.invite_repository import UserInviteRepository
    inv = MagicMock()
    inv.consumed_at = None
    inv.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    assert UserInviteRepository.invite_still_valid(inv) is False


def test_invite_still_valid_ok():
    from app.auth.invite_repository import UserInviteRepository
    inv = MagicMock()
    inv.consumed_at = None
    inv.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    assert UserInviteRepository.invite_still_valid(inv) is True


def test_invite_still_valid_naive_expiry():
    from app.auth.invite_repository import UserInviteRepository
    inv = MagicMock()
    inv.consumed_at = None
    inv.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    inv.expires_at = inv.expires_at.replace(tzinfo=None)
    assert UserInviteRepository.invite_still_valid(inv) is True


# ── Dependencies tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_tenant_id_missing_header(client, session):
    from httpx import AsyncClient
    await create_user(session, "dep_user@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "dep_user@test.com", "password": "test123!"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/products", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 400
    assert "X-Tenant-Id" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_tenant_id_invalid_format(client, session):
    await create_user(session, "dep_user2@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "dep_user2@test.com", "password": "test123!"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/products", headers={
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": "not-a-uuid"
    })
    assert resp.status_code == 400
    assert "Invalid" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_user_blacklisted_token(client, session, fake_redis):
    await create_user(session, "bl_user@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "bl_user@test.com", "password": "test123!"})
    token = login.json()["access_token"]
    fake_redis._store[f"blacklist:{token}"] = "1"
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    assert "revoked" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_current_user_expired_token(client, session):
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.value"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_refresh_type_rejected(client, session):
    from app.auth.service import AuthService
    await create_user(session, "ref_user@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "ref_user@test.com", "password": "test123!"})
    cookies = login.cookies
    refresh_token = cookies.get("refresh_token")
    if refresh_token:
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh_token}"})
        assert resp.status_code == 401
