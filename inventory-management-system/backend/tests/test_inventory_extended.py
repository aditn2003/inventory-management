"""Extended inventory tests covering repository sort branches and service edge cases."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from tests.conftest import create_tenant, auth_headers, create_product_in_db


# ── Sort branch coverage ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sort_by_product_name_desc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvNameD Co", "TEN-IND1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="IND-001", name="Alpha")
    await create_product_in_db(session, t.id, sku="IND-002", name="Zeta")
    resp = await client.get("/api/v1/inventory?sort_by=product_name&sort_dir=desc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_sku_asc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvSkuA Co", "TEN-ISA1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="ISA-001")
    resp = await client.get("/api/v1/inventory?sort_by=sku&sort_dir=asc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_sku_desc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvSkuD Co", "TEN-ISD1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="ISD-001")
    resp = await client.get("/api/v1/inventory?sort_by=sku&sort_dir=desc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_cost_per_unit(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvCost Co", "TEN-IC1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="IC-001")
    resp = await client.get("/api/v1/inventory?sort_by=cost_per_unit&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    resp2 = await client.get("/api/v1/inventory?sort_by=cost_per_unit&sort_dir=desc", headers=headers)
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_current_stock(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvStock Co", "TEN-ISTK1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="ISTK-001")
    resp = await client.get("/api/v1/inventory?sort_by=current_stock&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    resp2 = await client.get("/api/v1/inventory?sort_by=current_stock&sort_dir=desc", headers=headers)
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_reorder_threshold(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvReorder Co", "TEN-IR1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="IR-001")
    resp = await client.get("/api/v1/inventory?sort_by=reorder_threshold&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    resp2 = await client.get("/api/v1/inventory?sort_by=reorder_threshold&sort_dir=desc", headers=headers)
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_created_at(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvCreated Co", "TEN-ICR1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="ICR-001")
    resp = await client.get("/api/v1/inventory?sort_by=created_at&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    resp2 = await client.get("/api/v1/inventory?sort_by=created_at&sort_dir=desc", headers=headers)
    assert resp2.status_code == 200


# ── Service-level tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_inventory_service_list():
    from app.inventory.service import InventoryService
    svc = InventoryService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.list = AsyncMock(return_value=([], 0))
    svc.repo.below_reorder_count = AsyncMock(return_value=3)
    result = await svc.list_inventory(uuid4(), 1, 10, None)
    assert result["summary"]["below_reorder_count"] == 3
    assert result["meta"]["total"] == 0


@pytest.mark.asyncio
async def test_inventory_service_get_not_found():
    from app.inventory.service import InventoryService
    svc = InventoryService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="not found"):
        await svc.get_inventory(uuid4(), uuid4())


@pytest.mark.asyncio
async def test_inventory_service_patch_stock_success():
    from app.inventory.service import InventoryService
    mock_session = AsyncMock()
    svc = InventoryService(mock_session)
    item = MagicMock(id=uuid4())
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=item)
    svc.repo.patch_stock = AsyncMock(return_value=item)
    result = await svc.patch_stock(item.id, uuid4(), 42)
    assert result == item
    svc.repo.patch_stock.assert_called_once()


@pytest.mark.asyncio
async def test_inventory_service_delete():
    from app.inventory.service import InventoryService
    from app.products.repository import ProductRepository
    mock_session = AsyncMock()
    svc = InventoryService(mock_session)
    item = MagicMock(id=uuid4(), product_id=uuid4())
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=item)
    product = MagicMock()
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(ProductRepository, "get_by_id", AsyncMock(return_value=product))
        mp.setattr(ProductRepository, "hard_delete", AsyncMock())
        await svc.delete_inventory(item.id, uuid4())
        mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_inventory_service_delete_product_missing():
    from app.inventory.service import InventoryService
    from app.products.repository import ProductRepository
    mock_session = AsyncMock()
    svc = InventoryService(mock_session)
    item = MagicMock(id=uuid4(), product_id=uuid4())
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=item)
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(ProductRepository, "get_by_id", AsyncMock(return_value=None))
        with pytest.raises(ValueError, match="not found"):
            await svc.delete_inventory(item.id, uuid4())
