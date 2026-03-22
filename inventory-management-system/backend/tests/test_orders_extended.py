"""Extended order tests covering repository sort branches and additional service paths."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from tests.conftest import create_tenant, auth_headers, create_product_in_db


# ── Sort branch coverage ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sort_by_display_id_asc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdDIdA Co", "TEN-ODA1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="ODA-001")
    await client.post("/api/v1/orders", json={"product_id": str(p.id), "requested_qty": 1}, headers=headers)
    resp = await client.get("/api/v1/orders?sort_by=display_id&sort_dir=asc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_display_id_desc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdDIdD Co", "TEN-ODD1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="ODD-001")
    await client.post("/api/v1/orders", json={"product_id": str(p.id), "requested_qty": 1}, headers=headers)
    resp = await client.get("/api/v1/orders?sort_by=display_id&sort_dir=desc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_requested_qty(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdQtySort Co", "TEN-OQS1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="OQS-001")
    await client.post("/api/v1/orders", json={"product_id": str(p.id), "requested_qty": 1}, headers=headers)
    resp = await client.get("/api/v1/orders?sort_by=requested_qty&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    resp2 = await client.get("/api/v1/orders?sort_by=requested_qty&sort_dir=desc", headers=headers)
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_status(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdStatSort Co", "TEN-OSS1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="OSS-001")
    await client.post("/api/v1/orders", json={"product_id": str(p.id), "requested_qty": 1}, headers=headers)
    resp = await client.get("/api/v1/orders?sort_by=status&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    resp2 = await client.get("/api/v1/orders?sort_by=status&sort_dir=desc", headers=headers)
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_order_date(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdDateSort Co", "TEN-ODS1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="ODS-001")
    await client.post("/api/v1/orders", json={"product_id": str(p.id), "requested_qty": 1}, headers=headers)
    resp = await client.get("/api/v1/orders?sort_by=order_date&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    resp2 = await client.get("/api/v1/orders?sort_by=order_date&sort_dir=desc", headers=headers)
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_product_name(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdProdSort Co", "TEN-OPS1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="OPS-001", name="Alpha Product")
    await client.post("/api/v1/orders", json={"product_id": str(p.id), "requested_qty": 1}, headers=headers)
    resp = await client.get("/api/v1/orders?sort_by=product_name&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    resp2 = await client.get("/api/v1/orders?sort_by=product_name&sort_dir=desc", headers=headers)
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_created_at_asc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdCrtSort Co", "TEN-OCS1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="OCS-001")
    await client.post("/api/v1/orders", json={"product_id": str(p.id), "requested_qty": 1}, headers=headers)
    resp = await client.get("/api/v1/orders?sort_by=created_at&sort_dir=asc", headers=headers)
    assert resp.status_code == 200


# ── Service-level additional tests ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_order_service_list():
    from app.orders.service import OrderService
    svc = OrderService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.list = AsyncMock(return_value=([], 0))
    svc.repo.count_by_status = AsyncMock(return_value=0)
    result = await svc.list_orders(uuid4(), 1, 10, None)
    assert result["summary"]["total"] == 0
    assert result["meta"]["page"] == 1


@pytest.mark.asyncio
async def test_order_service_get_not_found():
    from app.orders.service import OrderService
    svc = OrderService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="Order not found"):
        await svc.get_order(uuid4(), uuid4())


@pytest.mark.asyncio
async def test_order_service_update_notes_only_on_confirmed():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    order = MagicMock(status="confirmed", requested_qty=5, id=uuid4())
    svc.get_order = AsyncMock(return_value=order)
    svc.repo = MagicMock()
    svc.repo.update = AsyncMock(return_value=order)
    svc.repo.get_by_id = AsyncMock(return_value=order)
    result = await svc.update_order(order.id, uuid4(), None, "Updated notes")
    svc.repo.update.assert_called_once()
    assert svc.repo.update.call_args.kwargs["notes"] == "Updated notes"


@pytest.mark.asyncio
async def test_order_service_confirm_no_inventory():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    order = MagicMock(status="created", product_id=uuid4(), requested_qty=5, id=uuid4())
    svc.get_order = AsyncMock(return_value=order)
    svc.repo = MagicMock()
    svc.repo.get_inventory_for_update = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="Inventory not found"):
        await svc.confirm_order(order.id, uuid4())


@pytest.mark.asyncio
async def test_order_service_cancel_already_cancelled():
    from app.orders.service import OrderService
    svc = OrderService(AsyncMock())
    order = MagicMock(status="cancelled", id=uuid4())
    svc.get_order = AsyncMock(return_value=order)
    with pytest.raises(ValueError, match="already cancelled"):
        await svc.cancel_order(order.id, uuid4())


@pytest.mark.asyncio
async def test_order_service_delete_confirmed_no_inventory():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    order = MagicMock(status="confirmed", product_id=uuid4(), requested_qty=5, id=uuid4())
    svc.get_order = AsyncMock(return_value=order)
    svc.repo = MagicMock()
    svc.repo.get_inventory_for_update = AsyncMock(return_value=None)
    svc.repo.hard_delete = AsyncMock()
    await svc.delete_order(order.id, uuid4())
    svc.repo.hard_delete.assert_called_once()
