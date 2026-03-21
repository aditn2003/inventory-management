import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from tests.conftest import create_user


@pytest.mark.asyncio
async def test_list_orders_requires_tenant_header(client: AsyncClient, session: AsyncSession):
    await create_user(session, "ord_user@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "ord_user@test.com", "password": "test123!"})
    token = login.json().get("access_token", "")
    response = await client.get("/api/v1/orders", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_order_inactive_product(client: AsyncClient, session: AsyncSession):
    """Orders cannot be created for inactive products."""
    from app.orders.service import OrderService

    mock_session = AsyncMock()
    svc = OrderService(mock_session)

    inactive_product = MagicMock()
    inactive_product.status = "inactive"
    svc.product_repo.get_by_id = AsyncMock(return_value=inactive_product)

    with pytest.raises(ValueError, match="inactive"):
        await svc.create_order(uuid4(), uuid4(), 5, None)


@pytest.mark.asyncio
async def test_create_order_does_not_change_inventory():
    """Stock is only reduced after Confirm — not when the order row is created."""
    from app.orders.service import OrderService

    mock_session = AsyncMock()
    svc = OrderService(mock_session)

    active_product = MagicMock()
    active_product.status = "active"
    svc.product_repo.get_by_id = AsyncMock(return_value=active_product)

    inv = MagicMock()
    inv.current_stock = 100
    svc.repo.get_inventory_for_update = AsyncMock(return_value=inv)

    svc.repo.get_next_display_id = AsyncMock(return_value="ORD-1001")

    saved = MagicMock()
    saved.id = uuid4()
    svc.repo.create = AsyncMock(return_value=saved)
    svc.repo.get_by_id = AsyncMock(return_value=saved)

    tenant_id = uuid4()
    product_id = uuid4()
    await svc.create_order(tenant_id, product_id, 10, None)

    assert inv.current_stock == 100
    kwargs = svc.repo.create.call_args.kwargs
    assert kwargs["status"] == "created"


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

    order = MagicMock()
    order.status = "created"
    order.product_id = uuid4()
    order.requested_qty = 10
    order.id = uuid4()

    svc.get_order = AsyncMock(return_value=order)

    inv = MagicMock()
    inv.current_stock = 50
    svc.repo.get_inventory_for_update = AsyncMock(return_value=inv)
    svc.repo.update = AsyncMock(return_value=order)
    svc.repo.get_by_id = AsyncMock(return_value=order)

    await svc.confirm_order(order.id, uuid4())

    assert inv.current_stock == 40
    svc.repo.update.assert_called_once()
    assert svc.repo.update.call_args.kwargs["status"] == "confirmed"


@pytest.mark.asyncio
async def test_confirm_order_allowed_for_pending():
    from app.orders.service import OrderService

    mock_session = AsyncMock()
    svc = OrderService(mock_session)

    order = MagicMock()
    order.status = "pending"
    order.product_id = uuid4()
    order.requested_qty = 3
    order.id = uuid4()

    svc.get_order = AsyncMock(return_value=order)
    inv = MagicMock()
    inv.current_stock = 10
    svc.repo.get_inventory_for_update = AsyncMock(return_value=inv)
    svc.repo.update = AsyncMock(return_value=order)
    svc.repo.get_by_id = AsyncMock(return_value=order)

    await svc.confirm_order(order.id, uuid4())

    assert inv.current_stock == 7
    assert svc.repo.update.call_args.kwargs["status"] == "confirmed"


@pytest.mark.asyncio
async def test_cancel_confirmed_order_raises():
    from app.orders.service import OrderService

    mock_session = AsyncMock()
    svc = OrderService(mock_session)

    order = MagicMock()
    order.status = "confirmed"
    order.id = uuid4()
    svc.get_order = AsyncMock(return_value=order)

    with pytest.raises(ValueError, match="Confirmed orders cannot be cancelled"):
        await svc.cancel_order(order.id, uuid4())


@pytest.mark.asyncio
async def test_cancel_pending_does_not_touch_inventory():
    from app.orders.service import OrderService

    order = MagicMock()
    order.status = "pending"
    order.id = uuid4()

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
    mock_repo.update.assert_called_once()
    assert mock_repo.update.call_args.kwargs["status"] == "cancelled"


@pytest.mark.asyncio
async def test_delete_confirmed_restores_inventory():
    from app.orders.service import OrderService

    mock_session = AsyncMock()
    svc = OrderService(mock_session)

    order = MagicMock()
    order.status = "confirmed"
    order.product_id = uuid4()
    order.requested_qty = 7
    order.id = uuid4()
    svc.get_order = AsyncMock(return_value=order)

    inv = MagicMock()
    inv.current_stock = 20
    svc.repo.get_inventory_for_update = AsyncMock(return_value=inv)
    svc.repo.hard_delete = AsyncMock()

    await svc.delete_order(order.id, uuid4())

    assert inv.current_stock == 27
    svc.repo.hard_delete.assert_called_once_with(order)


@pytest.mark.asyncio
async def test_delete_pending_no_inventory_restore():
    from app.orders.service import OrderService

    order = MagicMock()
    order.status = "pending"
    order.id = uuid4()

    mock_session = AsyncMock()
    svc = OrderService(mock_session)
    mock_repo = MagicMock()
    mock_repo.get_inventory_for_update = AsyncMock()
    mock_repo.hard_delete = AsyncMock()
    svc.repo = mock_repo
    svc.get_order = AsyncMock(return_value=order)

    await svc.delete_order(order.id, uuid4())

    mock_repo.get_inventory_for_update.assert_not_called()
    mock_repo.hard_delete.assert_called_once_with(order)
