"""Extended auth tests covering service methods (register, login, refresh, logout, etc.)."""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from tests.conftest import FakeRedis


@pytest.mark.asyncio
async def test_auth_service_register_success():
    from app.auth.service import AuthService
    mock_session = AsyncMock()
    svc = AuthService(mock_session, FakeRedis())
    svc.repo = MagicMock()
    svc.repo.get_by_email = AsyncMock(return_value=None)
    user = MagicMock(id=uuid4(), email="new@test.com", role="user")
    svc.repo.create = AsyncMock(return_value=user)
    result = await svc.register("new@test.com", "pass123!", "New User")
    assert result == user
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_auth_service_register_duplicate():
    from app.auth.service import AuthService
    svc = AuthService(AsyncMock(), FakeRedis())
    svc.repo = MagicMock()
    svc.repo.get_by_email = AsyncMock(return_value=MagicMock())
    with pytest.raises(ValueError, match="already registered"):
        await svc.register("dup@test.com", "pass123!", "Dup")


@pytest.mark.asyncio
async def test_auth_service_login_success():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    svc = AuthService(AsyncMock(), fake_redis)
    svc.repo = MagicMock()
    password = "secure123!"
    hashed = svc.hash_password(password)
    user = MagicMock(id=uuid4(), email="login@test.com", role="user", password_hash=hashed)
    svc.repo.get_by_email = AsyncMock(return_value=user)
    access, refresh = await svc.login("login@test.com", password)
    assert access
    assert refresh
    payload = svc.decode_token(access)
    assert payload["role"] == "user"


@pytest.mark.asyncio
async def test_auth_service_login_wrong_password():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    svc = AuthService(AsyncMock(), fake_redis)
    svc.repo = MagicMock()
    hashed = svc.hash_password("correct")
    user = MagicMock(id=uuid4(), email="login@test.com", password_hash=hashed)
    svc.repo.get_by_email = AsyncMock(return_value=user)
    with pytest.raises(ValueError, match="Invalid email"):
        await svc.login("login@test.com", "wrong")


@pytest.mark.asyncio
async def test_auth_service_login_no_user():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    svc = AuthService(AsyncMock(), fake_redis)
    svc.repo = MagicMock()
    svc.repo.get_by_email = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="Invalid email"):
        await svc.login("no@one.com", "pass")


@pytest.mark.asyncio
async def test_auth_service_login_no_password_hash():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    svc = AuthService(AsyncMock(), fake_redis)
    svc.repo = MagicMock()
    user = MagicMock(id=uuid4(), email="oauth@test.com", password_hash=None)
    svc.repo.get_by_email = AsyncMock(return_value=user)
    with pytest.raises(ValueError, match="Invalid email"):
        await svc.login("oauth@test.com", "pass")


@pytest.mark.asyncio
async def test_auth_service_refresh_success():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    mock_session = AsyncMock()
    svc = AuthService(mock_session, fake_redis)
    svc.repo = MagicMock()
    uid = uuid4()
    user = MagicMock(id=uid, role="user")
    svc.repo.get_by_id = AsyncMock(return_value=user)
    refresh_token = svc.create_refresh_token(uid)
    new_access, new_refresh = await svc.refresh(refresh_token)
    assert new_access
    assert new_refresh
    assert await svc.is_blacklisted(refresh_token)


@pytest.mark.asyncio
async def test_auth_service_refresh_blacklisted():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    svc = AuthService(AsyncMock(), fake_redis)
    uid = uuid4()
    token = svc.create_refresh_token(uid)
    await svc.blacklist_token(token)
    with pytest.raises(ValueError, match="revoked"):
        await svc.refresh(token)


@pytest.mark.asyncio
async def test_auth_service_refresh_invalid():
    from app.auth.service import AuthService
    svc = AuthService(AsyncMock(), FakeRedis())
    with pytest.raises(ValueError, match="Invalid refresh"):
        await svc.refresh("not.a.valid.token")


@pytest.mark.asyncio
async def test_auth_service_refresh_wrong_type():
    from app.auth.service import AuthService
    svc = AuthService(AsyncMock(), FakeRedis())
    uid = uuid4()
    access_token = svc.create_access_token(uid, "user")
    with pytest.raises(ValueError, match="Invalid token type"):
        await svc.refresh(access_token)


@pytest.mark.asyncio
async def test_auth_service_refresh_user_not_found():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    svc = AuthService(AsyncMock(), fake_redis)
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=None)
    uid = uuid4()
    token = svc.create_refresh_token(uid)
    with pytest.raises(ValueError, match="User not found"):
        await svc.refresh(token)


@pytest.mark.asyncio
async def test_auth_service_logout():
    from app.auth.service import AuthService
    fake_redis = FakeRedis()
    svc = AuthService(AsyncMock(), fake_redis)
    uid = uuid4()
    token = svc.create_refresh_token(uid)
    await svc.logout(token)
    assert await svc.is_blacklisted(token)


@pytest.mark.asyncio
async def test_auth_service_issue_token_pair():
    from app.auth.service import AuthService
    svc = AuthService(AsyncMock(), FakeRedis())
    user = MagicMock(id=uuid4(), role="admin")
    access, refresh = svc.issue_token_pair(user)
    assert access
    assert refresh
    a_payload = svc.decode_token(access)
    assert a_payload["type"] == "access"
    r_payload = svc.decode_token(refresh)
    assert r_payload["type"] == "refresh"


@pytest.mark.asyncio
async def test_auth_service_blacklist_invalid_token():
    from app.auth.service import AuthService
    svc = AuthService(AsyncMock(), FakeRedis())
    await svc.blacklist_token("invalid.garbage.token")
