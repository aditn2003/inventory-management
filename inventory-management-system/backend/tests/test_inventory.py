import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_user


@pytest.mark.asyncio
async def test_list_inventory_requires_tenant_header(client: AsyncClient, session: AsyncSession):
    await create_user(session, "inv_user@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "inv_user@test.com", "password": "test123!"})
    token = login.json().get("access_token", "")
    response = await client.get("/api/v1/inventory", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 400
