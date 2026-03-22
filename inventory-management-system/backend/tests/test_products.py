import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from tests.conftest import create_user, create_tenant, auth_headers, create_product_in_db


@pytest.mark.asyncio
async def test_list_products_requires_tenant_header(client: AsyncClient, session: AsyncSession):
    await create_user(session, "prod_user@test.com", role="user")
    login = await client.post("/api/v1/auth/login", json={"email": "prod_user@test.com", "password": "test123!"})
    token = login.json().get("access_token", "")
    response = await client.get("/api/v1/products", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_products_empty(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "ProdList Co", "TEN-PL1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.get("/api/v1/products", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"] == []
    assert data["summary"]["total"] == 0


@pytest.mark.asyncio
async def test_create_product_success(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "ProdCreate Co", "TEN-PC1")
    headers = await auth_headers(client, session, "admin", t)
    payload = {
        "sku": "NEW-001",
        "name": "Widget",
        "category": "Metals",
        "cost_per_unit": 25.50,
        "reorder_threshold": 10,
        "status": "active",
        "unit": "units",
    }
    resp = await client.post("/api/v1/products", json=payload, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["sku"] == "NEW-001"
    assert body["name"] == "Widget"
    assert body["inventory"] is not None
    assert body["inventory"]["current_stock"] == 0


@pytest.mark.asyncio
async def test_create_product_custom_category(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "CustomCat Co", "TEN-CC1")
    headers = await auth_headers(client, session, "admin", t)
    payload = {
        "sku": "DEC-001",
        "name": "Decorative Vase",
        "category": "Decorations",
        "cost_per_unit": 15.00,
        "reorder_threshold": 5,
    }
    resp = await client.post("/api/v1/products", json=payload, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["category"] == "Decorations"


@pytest.mark.asyncio
async def test_create_product_duplicate_sku(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "DupSKU Co", "TEN-DS1")
    headers = await auth_headers(client, session, "admin", t)
    payload = {"sku": "DUP-001", "name": "Item A", "category": "Metals", "cost_per_unit": 10, "reorder_threshold": 5}
    await client.post("/api/v1/products", json=payload, headers=headers)
    resp = await client.post("/api/v1/products", json={**payload, "name": "Item B"}, headers=headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_get_product_success(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "GetProd Co", "TEN-GP1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="GET-001", name="Getter")
    resp = await client.get(f"/api/v1/products/{p.id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Getter"


@pytest.mark.asyncio
async def test_get_product_not_found(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "NotFound Co", "TEN-NF1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.get(f"/api/v1/products/{uuid4()}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_product_success(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "UpdateProd Co", "TEN-UP1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="UPD-001", name="Old Name")
    resp = await client.put(f"/api/v1/products/{p.id}", json={"name": "New Name"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_update_product_empty_category_rejected(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "EmptyCat Co", "TEN-EC1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="EC-001")
    resp = await client.put(f"/api/v1/products/{p.id}", json={"category": ""}, headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_product_success(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "DelProd Co", "TEN-DP1")
    headers = await auth_headers(client, session, "admin", t)
    p, _ = await create_product_in_db(session, t.id, sku="DEL-001")
    resp = await client.delete(f"/api/v1/products/{p.id}", headers=headers)
    assert resp.status_code == 204
    resp2 = await client.get(f"/api/v1/products/{p.id}", headers=headers)
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_delete_product_not_found(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "DelNF Co", "TEN-DN1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.delete(f"/api/v1/products/{uuid4()}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_products_with_search(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "SearchProd Co", "TEN-SP1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="SP-001", name="Aluminium Sheet")
    await create_product_in_db(session, t.id, sku="SP-002", name="Copper Wire")
    resp = await client.get("/api/v1/products?q=Aluminium", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


@pytest.mark.asyncio
async def test_list_products_with_sort(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "SortProd Co", "TEN-SRT1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="A-001", name="Zebra")
    await create_product_in_db(session, t.id, sku="A-002", name="Alpha")
    resp = await client.get("/api/v1/products?sort_by=name&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()["data"]]
    assert names == ["Alpha", "Zebra"]


@pytest.mark.asyncio
async def test_list_products_sort_by_mismatched(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "SortMis Co", "TEN-SM1")
    headers = await auth_headers(client, session, "admin", t)
    resp = await client.get("/api/v1/products?sort_by=name", headers=headers)
    assert resp.status_code == 422


# ── Service-level tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_product_service_create_missing_category():
    from app.products.service import ProductService
    svc = ProductService(AsyncMock())
    svc.repo = MagicMock()
    with pytest.raises(ValueError, match="Category is required"):
        await svc.create_product(uuid4(), {"sku": "X", "category": "", "cost_per_unit": 10, "reorder_threshold": 5})


@pytest.mark.asyncio
async def test_product_service_create_invalid_status():
    from app.products.service import ProductService
    svc = ProductService(AsyncMock())
    svc.repo = MagicMock()
    with pytest.raises(ValueError, match="Status"):
        await svc.create_product(uuid4(), {"sku": "X", "category": "Metals", "status": "bogus"})


@pytest.mark.asyncio
async def test_product_service_update_sku_change_rejected():
    from app.products.service import ProductService
    svc = ProductService(AsyncMock())
    product = MagicMock()
    product.sku = "OLD-001"
    svc.get_product = AsyncMock(return_value=product)
    with pytest.raises(ValueError, match="SKU cannot be changed"):
        await svc.update_product(uuid4(), uuid4(), {"sku": "NEW-001"})
