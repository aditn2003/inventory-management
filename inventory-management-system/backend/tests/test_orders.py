import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from tests.conftest import create_user, create_tenant, auth_headers, create_product_in_db


# ── Integration tests ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_orders_requires_tenant_header(client: AsyncClient, session: AsyncSession):
    await create_user(session, "ord_user@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "ord_user@test.com", "password": "test123!"})
    token = login.json().get("access_token", "")
    response = await client.get("/api/v1/orders", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_orders_empty(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdEmpty Co", "TEN-OE1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.get("/api/v1/orders", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"] == []
    s = resp.json()["summary"]
    assert s["total"] == 0
    assert s["pending"] == 0


@pytest.mark.asyncio
async def test_create_order_success(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdCreate Co", "TEN-OC1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="OC-001", name="Order Product")
    resp = await client.post("/api/v1/orders", json={
        "product_id": str(p.id), "requested_qty": 5, "notes": "Test order"
    }, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "created"
    assert body["requested_qty"] == 5
    assert body["display_id"].startswith("ORD-")


@pytest.mark.asyncio
async def test_create_order_pending_low_stock(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdPend Co", "TEN-OP1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="OP-001")
    resp = await client.post("/api/v1/orders", json={
        "product_id": str(p.id), "requested_qty": 999
    }, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_get_order_success(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "GetOrd Co", "TEN-GO1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="GO-001")
    create_resp = await client.post("/api/v1/orders", json={
        "product_id": str(p.id), "requested_qty": 3
    }, headers=headers)
    order_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/orders/{order_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == order_id


@pytest.mark.asyncio
async def test_get_order_not_found(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "GetOrdNF Co", "TEN-GN2")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.get(f"/api/v1/orders/{uuid4()}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_order_notes(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "UpdOrd Co", "TEN-UO1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="UO-001")
    create_resp = await client.post("/api/v1/orders", json={
        "product_id": str(p.id), "requested_qty": 2
    }, headers=headers)
    order_id = create_resp.json()["id"]
    resp = await client.put(f"/api/v1/orders/{order_id}", json={"notes": "Updated notes"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["notes"] == "Updated notes"


@pytest.mark.asyncio
async def test_update_order_qty_on_created(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "UpdOrdQty Co", "TEN-UQ1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="UQ-001")
    create_resp = await client.post("/api/v1/orders", json={
        "product_id": str(p.id), "requested_qty": 2
    }, headers=headers)
    order_id = create_resp.json()["id"]
    resp = await client.put(f"/api/v1/orders/{order_id}", json={"requested_qty": 8}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["requested_qty"] == 8


@pytest.mark.asyncio
async def test_confirm_order_via_api(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "ConfOrd Co", "TEN-CO1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="CO-001")
    create_resp = await client.post("/api/v1/orders", json={
        "product_id": str(p.id), "requested_qty": 5
    }, headers=headers)
    order_id = create_resp.json()["id"]
    resp = await client.post(f"/api/v1/orders/{order_id}/confirm", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_confirm_already_confirmed_fails(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "ConfFail Co", "TEN-CF1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="CF-001")
    create_resp = await client.post("/api/v1/orders", json={
        "product_id": str(p.id), "requested_qty": 5
    }, headers=headers)
    order_id = create_resp.json()["id"]
    await client.post(f"/api/v1/orders/{order_id}/confirm", headers=headers)
    resp = await client.post(f"/api/v1/orders/{order_id}/confirm", headers=headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_cancel_order_via_api(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "CancelOrd Co", "TEN-CL1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="CL-001")
    create_resp = await client.post("/api/v1/orders", json={
        "product_id": str(p.id), "requested_qty": 2
    }, headers=headers)
    order_id = create_resp.json()["id"]
    resp = await client.post(f"/api/v1/orders/{order_id}/cancel", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_already_cancelled_fails(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "CancelFail Co", "TEN-CF2")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="CF2-001")
    create_resp = await client.post("/api/v1/orders", json={
        "product_id": str(p.id), "requested_qty": 2
    }, headers=headers)
    order_id = create_resp.json()["id"]
    await client.post(f"/api/v1/orders/{order_id}/cancel", headers=headers)
    resp = await client.post(f"/api/v1/orders/{order_id}/cancel", headers=headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_order_via_api(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "DelOrd Co", "TEN-DO1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="DO-001")
    create_resp = await client.post("/api/v1/orders", json={
        "product_id": str(p.id), "requested_qty": 3
    }, headers=headers)
    order_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/orders/{order_id}", headers=headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_order_not_found(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "DelOrdNF Co", "TEN-DN2")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.delete(f"/api/v1/orders/{uuid4()}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_orders_with_status_filter(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdFilter Co", "TEN-OF1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="OF-001")
    await client.post("/api/v1/orders", json={"product_id": str(p.id), "requested_qty": 2}, headers=headers)
    resp = await client.get("/api/v1/orders?status=created", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) >= 1


@pytest.mark.asyncio
async def test_list_orders_sort_mismatch(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdSortMis Co", "TEN-OSM1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.get("/api/v1/orders?sort_dir=asc", headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_orders_with_sort(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdSort Co", "TEN-OS1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="OS-001")
    await client.post("/api/v1/orders", json={"product_id": str(p.id), "requested_qty": 1}, headers=headers)
    resp = await client.get("/api/v1/orders?sort_by=created_at&sort_dir=desc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_list_orders_search_by_product_name(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "OrdSearch Co", "TEN-OSR1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="OSR-001", name="Unique Widget XYZ")
    await client.post("/api/v1/orders", json={"product_id": str(p.id), "requested_qty": 1}, headers=headers)
    resp = await client.get("/api/v1/orders?q=Unique", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) >= 1


# ── Service-level tests (unit) ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_order_inactive_product():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    svc.product_repo.get_by_id = AsyncMock(return_value=MagicMock(status="inactive"))
    with pytest.raises(ValueError, match="inactive"):
        await svc.create_order(uuid4(), uuid4(), 5, None)


@pytest.mark.asyncio
async def test_create_order_does_not_change_inventory():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    svc.product_repo.get_by_id = AsyncMock(return_value=MagicMock(status="active"))
    inv = MagicMock()
    inv.current_stock = 100
    svc.repo.get_inventory_for_update = AsyncMock(return_value=inv)
    svc.repo.get_next_display_id = AsyncMock(return_value="ORD-1001")
    saved = MagicMock()
    saved.id = uuid4()
    svc.repo.create = AsyncMock(return_value=saved)
    svc.repo.get_by_id = AsyncMock(return_value=saved)
    await svc.create_order(uuid4(), uuid4(), 10, None)
    assert inv.current_stock == 100
    assert svc.repo.create.call_args.kwargs["status"] == "created"


@pytest.mark.asyncio
async def test_create_order_pending_when_insufficient_stock():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    svc.product_repo.get_by_id = AsyncMock(return_value=MagicMock(status="active"))
    inv = MagicMock()
    inv.current_stock = 5
    svc.repo.get_inventory_for_update = AsyncMock(return_value=inv)
    svc.repo.get_next_display_id = AsyncMock(return_value="ORD-1001")
    saved = MagicMock()
    saved.id = uuid4()
    svc.repo.create = AsyncMock(return_value=saved)
    svc.repo.get_by_id = AsyncMock(return_value=saved)
    await svc.create_order(uuid4(), uuid4(), 10, None)
    assert svc.repo.create.call_args.kwargs["status"] == "pending"


@pytest.mark.asyncio
async def test_confirm_order_deducts_and_sets_confirmed():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    order = MagicMock(status="created", product_id=uuid4(), requested_qty=10, id=uuid4())
    svc.get_order = AsyncMock(return_value=order)
    inv = MagicMock()
    inv.current_stock = 50
    svc.repo.get_inventory_for_update = AsyncMock(return_value=inv)
    svc.repo.update = AsyncMock(return_value=order)
    svc.repo.get_by_id = AsyncMock(return_value=order)
    await svc.confirm_order(order.id, uuid4())
    assert inv.current_stock == 40
    assert svc.repo.update.call_args.kwargs["status"] == "confirmed"


@pytest.mark.asyncio
async def test_confirm_insufficient_stock_raises():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    order = MagicMock(status="created", product_id=uuid4(), requested_qty=100, id=uuid4())
    svc.get_order = AsyncMock(return_value=order)
    inv = MagicMock()
    inv.current_stock = 5
    svc.repo.get_inventory_for_update = AsyncMock(return_value=inv)
    with pytest.raises(ValueError, match="Insufficient stock"):
        await svc.confirm_order(order.id, uuid4())


@pytest.mark.asyncio
async def test_confirm_order_allowed_for_pending():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    order = MagicMock(status="pending", product_id=uuid4(), requested_qty=3, id=uuid4())
    svc.get_order = AsyncMock(return_value=order)
    inv = MagicMock()
    inv.current_stock = 10
    svc.repo.get_inventory_for_update = AsyncMock(return_value=inv)
    svc.repo.update = AsyncMock(return_value=order)
    svc.repo.get_by_id = AsyncMock(return_value=order)
    await svc.confirm_order(order.id, uuid4())
    assert inv.current_stock == 7


@pytest.mark.asyncio
async def test_cancel_confirmed_order_raises():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    order = MagicMock(status="confirmed", id=uuid4())
    svc.get_order = AsyncMock(return_value=order)
    with pytest.raises(ValueError, match="Confirmed orders cannot be cancelled"):
        await svc.cancel_order(order.id, uuid4())


@pytest.mark.asyncio
async def test_cancel_pending_does_not_touch_inventory():
    from app.orders.service import OrderService
    order = MagicMock(status="pending", id=uuid4())
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    mock_repo = MagicMock()
    mock_repo.get_inventory_for_update = AsyncMock()
    mock_repo.update = AsyncMock(return_value=order)
    mock_repo.get_by_id = AsyncMock()
    svc.repo = mock_repo
    svc.get_order = AsyncMock(return_value=order)
    await svc.cancel_order(order.id, uuid4())
    mock_repo.get_inventory_for_update.assert_not_called()
    assert mock_repo.update.call_args.kwargs["status"] == "cancelled"


@pytest.mark.asyncio
async def test_delete_confirmed_restores_inventory():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    order = MagicMock(status="confirmed", product_id=uuid4(), requested_qty=7, id=uuid4())
    svc.get_order = AsyncMock(return_value=order)
    inv = MagicMock()
    inv.current_stock = 20
    svc.repo.get_inventory_for_update = AsyncMock(return_value=inv)
    svc.repo.hard_delete = AsyncMock()
    await svc.delete_order(order.id, uuid4())
    assert inv.current_stock == 27


@pytest.mark.asyncio
async def test_delete_pending_no_inventory_restore():
    from app.orders.service import OrderService
    order = MagicMock(status="pending", id=uuid4())
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    mock_repo = MagicMock()
    mock_repo.get_inventory_for_update = AsyncMock()
    mock_repo.hard_delete = AsyncMock()
    svc.repo = mock_repo
    svc.get_order = AsyncMock(return_value=order)
    await svc.delete_order(order.id, uuid4())
    mock_repo.get_inventory_for_update.assert_not_called()


@pytest.mark.asyncio
async def test_update_cancelled_order_raises():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    order = MagicMock(status="cancelled", id=uuid4())
    svc.get_order = AsyncMock(return_value=order)
    with pytest.raises(ValueError, match="Cancelled orders cannot be edited"):
        await svc.update_order(order.id, uuid4(), 10, None)


@pytest.mark.asyncio
async def test_update_confirmed_qty_raises():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    order = MagicMock(status="confirmed", requested_qty=5, id=uuid4())
    svc.get_order = AsyncMock(return_value=order)
    with pytest.raises(ValueError, match="Quantity cannot be changed"):
        await svc.update_order(order.id, uuid4(), 10, None)


@pytest.mark.asyncio
async def test_create_order_product_not_found():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    svc.product_repo.get_by_id = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="Product not found"):
        await svc.create_order(uuid4(), uuid4(), 5, None)


@pytest.mark.asyncio
async def test_create_order_no_inventory():
    from app.orders.service import OrderService
    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    svc.product_repo.get_by_id = AsyncMock(return_value=MagicMock(status="active"))
    svc.repo.get_inventory_for_update = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="Inventory not found"):
        await svc.create_order(uuid4(), uuid4(), 5, None)
