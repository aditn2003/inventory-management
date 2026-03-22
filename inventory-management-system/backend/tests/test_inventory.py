import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from tests.conftest import create_user, create_tenant, auth_headers, create_product_in_db


@pytest.mark.asyncio
async def test_list_inventory_requires_tenant_header(client: AsyncClient, session: AsyncSession):
    await create_user(session, "inv_user@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "inv_user@test.com", "password": "test123!"})
    token = login.json().get("access_token", "")
    response = await client.get("/api/v1/inventory", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_inventory_empty(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvEmpty Co", "TEN-IE1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.get("/api/v1/inventory", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"] == []
    assert resp.json()["summary"]["below_reorder_count"] == 0


@pytest.mark.asyncio
async def test_list_inventory_with_data(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvData Co", "TEN-ID1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="INV-001", name="Inv Widget")
    resp = await client.get("/api/v1/inventory", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1
    assert resp.json()["data"][0]["product"]["name"] == "Inv Widget"


@pytest.mark.asyncio
async def test_list_inventory_with_search(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvSearch Co", "TEN-IS1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="IS-001", name="Searchable Item")
    await create_product_in_db(session, t.id, sku="IS-002", name="Hidden Item")
    resp = await client.get("/api/v1/inventory?q=Searchable", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


@pytest.mark.asyncio
async def test_list_inventory_below_reorder_only(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvBR Co", "TEN-IB1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="IB-001", name="Low Stock", reorder=200)
    await create_product_in_db(session, t.id, sku="IB-002", name="OK Stock", reorder=10)
    resp = await client.get("/api/v1/inventory?below_reorder_only=true", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1
    assert resp.json()["data"][0]["product"]["name"] == "Low Stock"


@pytest.mark.asyncio
async def test_list_inventory_sort(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvSort Co", "TEN-ISR1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="ISR-001", name="Zebra Inv")
    await create_product_in_db(session, t.id, sku="ISR-002", name="Alpha Inv")
    resp = await client.get("/api/v1/inventory?sort_by=product_name&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    names = [item["product"]["name"] for item in resp.json()["data"]]
    assert names == ["Alpha Inv", "Zebra Inv"]


@pytest.mark.asyncio
async def test_list_inventory_sort_mismatch(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "InvSortMis Co", "TEN-ISM1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.get("/api/v1/inventory?sort_by=current_stock", headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_inventory_success(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "GetInv Co", "TEN-GI1")
    headers = await auth_headers(client, session, "admin", t)
    _, inv = await create_product_in_db(session, t.id, sku="GI-001")
    resp = await client.get(f"/api/v1/inventory/{inv.id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["current_stock"] == 100


@pytest.mark.asyncio
async def test_get_inventory_not_found(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "GetInvNF Co", "TEN-GN1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.get(f"/api/v1/inventory/{uuid4()}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_patch_stock_success(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "PatchInv Co", "TEN-PI1")
    headers = await auth_headers(client, session, "admin", t)
    _, inv = await create_product_in_db(session, t.id, sku="PI-001")
    resp = await client.patch(f"/api/v1/inventory/{inv.id}", json={"current_stock": 42}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["current_stock"] == 42


@pytest.mark.asyncio
async def test_patch_stock_negative_rejected(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "PatchNeg Co", "TEN-PN1")
    headers = await auth_headers(client, session, "admin", t)
    _, inv = await create_product_in_db(session, t.id, sku="PN-001")
    resp = await client.patch(f"/api/v1/inventory/{inv.id}", json={"current_stock": -5}, headers=headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_delete_inventory_success(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "DelInv Co", "TEN-DI1")
    headers = await auth_headers(client, session, "admin", t)
    _, inv = await create_product_in_db(session, t.id, sku="DI-001")
    resp = await client.delete(f"/api/v1/inventory/{inv.id}", headers=headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_inventory_not_found(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "DelInvNF Co", "TEN-DIN1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.delete(f"/api/v1/inventory/{uuid4()}", headers=headers)
    assert resp.status_code == 404


# ── Service-level tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_inventory_service_patch_negative():
    from app.inventory.service import InventoryService
    svc = InventoryService(AsyncMock())
    with pytest.raises(ValueError, match="negative"):
        await svc.patch_stock(uuid4(), uuid4(), -1)
