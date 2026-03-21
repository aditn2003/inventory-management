import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

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
    # This is a logic test; full integration requires a running DB.
    # Covered by service unit test semantics — validating the service raises ValueError.
    from app.orders.service import OrderService
    from unittest.mock import AsyncMock, MagicMock
    from uuid import uuid4
    import datetime

    mock_session = AsyncMock()
    svc = OrderService(mock_session)

    # Mock product repo to return an inactive product
    inactive_product = MagicMock()
    inactive_product.status = "inactive"
    svc.product_repo.get_by_id = AsyncMock(return_value=inactive_product)

    with pytest.raises(ValueError, match="inactive"):
        await svc.create_order(uuid4(), uuid4(), 5, None, datetime.date.today())
