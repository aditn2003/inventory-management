"""Extended user tests covering service and repository layers."""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4


@pytest.mark.asyncio
async def test_user_service_list():
    from app.users.service import UserManagementService
    svc = UserManagementService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.list_users = AsyncMock(return_value=([{"id": uuid4(), "name": "A"}], 1))
    result = await svc.list_users(1, 10)
    assert result["meta"]["total"] == 1
    assert len(result["data"]) == 1


@pytest.mark.asyncio
async def test_user_service_get_not_found():
    from app.users.service import UserManagementService
    svc = UserManagementService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_user_by_id = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="not found"):
        await svc.get_user(uuid4())


@pytest.mark.asyncio
async def test_user_service_get_success():
    from app.users.service import UserManagementService
    svc = UserManagementService(AsyncMock())
    svc.repo = MagicMock()
    user = MagicMock(id=uuid4(), role="user", created_at="2025-01-01")
    user.name = "Test User"
    svc.repo.get_user_by_id = AsyncMock(return_value=user)
    svc.repo.get_user_tenants = AsyncMock(return_value=[])
    result = await svc.get_user(user.id)
    assert result["name"] == "Test User"
    assert result["assigned_tenants"] == []


@pytest.mark.asyncio
async def test_user_service_update_role_invalid():
    from app.users.service import UserManagementService
    svc = UserManagementService(AsyncMock())
    with pytest.raises(ValueError, match="Role must be"):
        await svc.update_role(uuid4(), "superadmin")


@pytest.mark.asyncio
async def test_user_service_update_role_not_found():
    from app.users.service import UserManagementService
    svc = UserManagementService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_user_by_id = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="not found"):
        await svc.update_role(uuid4(), "admin")


@pytest.mark.asyncio
async def test_user_service_update_role_success():
    from app.users.service import UserManagementService
    mock_session = AsyncMock()
    svc = UserManagementService(mock_session)
    svc.repo = MagicMock()
    user = MagicMock(id=uuid4(), role="user", created_at="2025-01-01")
    user.name = "X"
    svc.repo.get_user_by_id = AsyncMock(return_value=user)
    updated = MagicMock(id=user.id, role="admin", created_at="2025-01-01")
    updated.name = "X"
    svc.repo.update_role = AsyncMock(return_value=updated)
    svc.repo.get_user_tenants = AsyncMock(return_value=[])
    result = await svc.update_role(user.id, "admin")
    assert result["role"] == "admin"


@pytest.mark.asyncio
async def test_user_service_delete_not_found():
    from app.users.service import UserManagementService
    svc = UserManagementService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_user_by_id = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="not found"):
        await svc.delete_user(uuid4())


@pytest.mark.asyncio
async def test_user_service_delete_success():
    from app.users.service import UserManagementService
    mock_session = AsyncMock()
    svc = UserManagementService(mock_session)
    svc.repo = MagicMock()
    user = MagicMock()
    svc.repo.get_user_by_id = AsyncMock(return_value=user)
    svc.repo.hard_delete_user = AsyncMock()
    await svc.delete_user(uuid4())
    svc.repo.hard_delete_user.assert_called_once_with(user)
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_user_service_get_tenants_not_found():
    from app.users.service import UserManagementService
    svc = UserManagementService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_user_by_id = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="not found"):
        await svc.get_user_tenants(uuid4())


@pytest.mark.asyncio
async def test_user_service_get_tenants_success():
    from app.users.service import UserManagementService
    svc = UserManagementService(AsyncMock())
    svc.repo = MagicMock()
    user = MagicMock()
    svc.repo.get_user_by_id = AsyncMock(return_value=user)
    tenants = [MagicMock()]
    svc.repo.get_user_tenants = AsyncMock(return_value=tenants)
    result = await svc.get_user_tenants(uuid4())
    assert result == tenants


@pytest.mark.asyncio
async def test_user_service_set_tenant_access_not_found_user():
    from app.users.service import UserManagementService
    svc = UserManagementService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_user_by_id = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="not found"):
        await svc.set_user_tenant_access(uuid4(), [])


@pytest.mark.asyncio
async def test_user_service_set_tenant_access_success():
    from app.users.service import UserManagementService
    mock_session = AsyncMock()
    svc = UserManagementService(mock_session)
    svc.repo = MagicMock()
    user = MagicMock(id=uuid4(), role="user", created_at="2025-01-01")
    user.name = "X"
    svc.repo.get_user_by_id = AsyncMock(return_value=user)
    svc.repo.delete_all_assignments_for_user = AsyncMock()
    svc.repo.create_assignment = AsyncMock()
    svc.repo.get_user_tenants = AsyncMock(return_value=[])

    from app.tenants.repository import TenantRepository
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(TenantRepository, "get_by_id", AsyncMock(return_value=MagicMock()))
        tid = uuid4()
        result = await svc.set_user_tenant_access(user.id, [tid, tid])
        svc.repo.create_assignment.assert_called_once()


@pytest.mark.asyncio
async def test_user_service_set_tenant_access_bad_tenant():
    from app.users.service import UserManagementService
    mock_session = AsyncMock()
    svc = UserManagementService(mock_session)
    svc.repo = MagicMock()
    user = MagicMock(id=uuid4())
    svc.repo.get_user_by_id = AsyncMock(return_value=user)

    from app.tenants.repository import TenantRepository
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(TenantRepository, "get_by_id", AsyncMock(return_value=None))
        with pytest.raises(ValueError, match="not found"):
            await svc.set_user_tenant_access(user.id, [uuid4()])
