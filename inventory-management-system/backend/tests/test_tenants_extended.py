"""Extended tenant tests covering service layer and repository sort branches."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from tests.conftest import create_tenant, auth_headers


# ── Sort branch coverage ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sort_by_display_id_asc(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    await create_tenant(session, "DIA Co", "TEN-DIA1")
    resp = await client.get("/api/v1/tenants?sort_by=display_id&sort_dir=asc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_display_id_desc(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    await create_tenant(session, "DID Co", "TEN-DID1")
    resp = await client.get("/api/v1/tenants?sort_by=display_id&sort_dir=desc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_name_desc(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    await create_tenant(session, "NameDescA Co", "TEN-NDA1")
    await create_tenant(session, "NameDescZ Co", "TEN-NDZ1")
    resp = await client.get("/api/v1/tenants?sort_by=name&sort_dir=desc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_status_asc(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.get("/api/v1/tenants?sort_by=status&sort_dir=asc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_status_desc(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.get("/api/v1/tenants?sort_by=status&sort_dir=desc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_created_at_asc(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.get("/api/v1/tenants?sort_by=created_at&sort_dir=asc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_created_at_desc(client: AsyncClient, session: AsyncSession):
    headers = await auth_headers(client, session, "admin")
    resp = await client.get("/api/v1/tenants?sort_by=created_at&sort_dir=desc", headers=headers)
    assert resp.status_code == 200


# ── Service-level unit tests ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tenant_service_list():
    from app.tenants.service import TenantService
    svc = TenantService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.list = AsyncMock(return_value=([], 0))
    svc.repo.count_all = AsyncMock(return_value=5)
    svc.repo.count_by_status = AsyncMock(side_effect=[3, 2])
    result = await svc.list_tenants(None, 1, 10, None)
    assert result["summary"]["total"] == 5
    assert result["summary"]["active"] == 3
    assert result["summary"]["inactive"] == 2


@pytest.mark.asyncio
async def test_tenant_service_get_not_found():
    from app.tenants.service import TenantService
    svc = TenantService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="not found"):
        await svc.get_tenant(uuid4())


@pytest.mark.asyncio
async def test_tenant_service_create_success():
    from app.tenants.service import TenantService
    mock_session = AsyncMock()
    svc = TenantService(mock_session)
    svc.repo = MagicMock()
    svc.repo.get_by_name = AsyncMock(return_value=None)
    svc.repo.get_next_display_id = AsyncMock(return_value="TEN-001")
    tenant = MagicMock()
    svc.repo.create = AsyncMock(return_value=tenant)
    result = await svc.create_tenant("New Tenant", "active")
    assert result == tenant
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_tenant_service_create_duplicate():
    from app.tenants.service import TenantService
    svc = TenantService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_by_name = AsyncMock(return_value=MagicMock())
    with pytest.raises(ValueError, match="already exists"):
        await svc.create_tenant("Existing")


@pytest.mark.asyncio
async def test_tenant_service_create_invalid_status():
    from app.tenants.service import TenantService
    svc = TenantService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_by_name = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="Status"):
        await svc.create_tenant("X", status="invalid")


@pytest.mark.asyncio
async def test_tenant_service_update_success():
    from app.tenants.service import TenantService
    mock_session = AsyncMock()
    svc = TenantService(mock_session)
    tenant = MagicMock(name="Old Name")
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=tenant)
    svc.repo.get_by_name = AsyncMock(return_value=None)
    svc.repo.update = AsyncMock(return_value=tenant)
    result = await svc.update_tenant(uuid4(), "New Name", "active")
    assert result == tenant


@pytest.mark.asyncio
async def test_tenant_service_update_duplicate_name():
    from app.tenants.service import TenantService
    svc = TenantService(AsyncMock())
    tenant = MagicMock(name="Old Name")
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=tenant)
    svc.repo.get_by_name = AsyncMock(return_value=MagicMock())
    with pytest.raises(ValueError, match="already exists"):
        await svc.update_tenant(uuid4(), "Taken Name", None)


@pytest.mark.asyncio
async def test_tenant_service_update_invalid_status():
    from app.tenants.service import TenantService
    svc = TenantService(AsyncMock())
    tenant = MagicMock(name="X")
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=tenant)
    with pytest.raises(ValueError, match="Status"):
        await svc.update_tenant(uuid4(), None, "invalid")


@pytest.mark.asyncio
async def test_tenant_service_delete():
    from app.tenants.service import TenantService
    mock_session = AsyncMock()
    svc = TenantService(mock_session)
    tenant = MagicMock(id=uuid4())
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=tenant)
    svc.repo.hard_delete = AsyncMock()
    await svc.delete_tenant(tenant.id)
    svc.repo.hard_delete.assert_called_once_with(tenant)
    mock_session.commit.assert_called_once()
