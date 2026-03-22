"""Extended product tests covering repository sort branches, service edge cases,
and additional integration paths for higher coverage."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from decimal import Decimal

from tests.conftest import create_user, create_tenant, auth_headers, create_product_in_db


# ── Sort branch coverage ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sort_by_sku_asc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "SkuSortA Co", "TEN-SSA1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="Z-001", name="Z Item")
    await create_product_in_db(session, t.id, sku="A-001", name="A Item")
    resp = await client.get("/api/v1/products?sort_by=sku&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    skus = [p["sku"] for p in resp.json()["data"]]
    assert skus[0] == "A-001"


@pytest.mark.asyncio
async def test_sort_by_sku_desc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "SkuSortD Co", "TEN-SSD1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="A-002", name="A2")
    await create_product_in_db(session, t.id, sku="Z-002", name="Z2")
    resp = await client.get("/api/v1/products?sort_by=sku&sort_dir=desc", headers=headers)
    assert resp.status_code == 200
    skus = [p["sku"] for p in resp.json()["data"]]
    assert skus[0] == "Z-002"


@pytest.mark.asyncio
async def test_sort_by_category_asc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "CatSortA Co", "TEN-CSA1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="CS-001", name="Zinc", category="Metals")
    await create_product_in_db(session, t.id, sku="CS-002", name="Acid", category="Chemicals")
    resp = await client.get("/api/v1/products?sort_by=category&sort_dir=asc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_category_desc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "CatSortD Co", "TEN-CSD1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="CSD-001", category="Metals")
    await create_product_in_db(session, t.id, sku="CSD-002", category="Chemicals")
    resp = await client.get("/api/v1/products?sort_by=category&sort_dir=desc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_cost_per_unit_asc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "CostSortA Co", "TEN-COA1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="COA-001", cost=5.0)
    await create_product_in_db(session, t.id, sku="COA-002", cost=50.0)
    resp = await client.get("/api/v1/products?sort_by=cost_per_unit&sort_dir=asc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_cost_per_unit_desc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "CostSortD Co", "TEN-COD1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="COD-001", cost=5.0)
    await create_product_in_db(session, t.id, sku="COD-002", cost=50.0)
    resp = await client.get("/api/v1/products?sort_by=cost_per_unit&sort_dir=desc", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_current_stock(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "StockSort Co", "TEN-SS1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="SS-001")
    resp = await client.get("/api/v1/products?sort_by=current_stock&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    resp2 = await client.get("/api/v1/products?sort_by=current_stock&sort_dir=desc", headers=headers)
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_status(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "StatusSort Co", "TEN-STS1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="STS-001")
    resp = await client.get("/api/v1/products?sort_by=status&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    resp2 = await client.get("/api/v1/products?sort_by=status&sort_dir=desc", headers=headers)
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_created_at(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "CreatedSort Co", "TEN-CAS1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="CAS-001")
    resp = await client.get("/api/v1/products?sort_by=created_at&sort_dir=asc", headers=headers)
    assert resp.status_code == 200
    resp2 = await client.get("/api/v1/products?sort_by=created_at&sort_dir=desc", headers=headers)
    assert resp2.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_name_desc(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "NameSortD Co", "TEN-NSD1")
    headers = await auth_headers(client, session, "admin", t)
    await create_product_in_db(session, t.id, sku="NSD-001", name="Alpha")
    await create_product_in_db(session, t.id, sku="NSD-002", name="Zeta")
    resp = await client.get("/api/v1/products?sort_by=name&sort_dir=desc", headers=headers)
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()["data"]]
    assert names[0] == "Zeta"


# ── Product pagination ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_products_pagination(client: AsyncClient, session: AsyncSession):
    t = await create_tenant(session, "Paginate Co", "TEN-PAG1")
    headers = await auth_headers(client, session, "admin", t)
    for i in range(5):
        await create_product_in_db(session, t.id, sku=f"PG-{i:03d}", name=f"Product {i}")
    resp = await client.get("/api/v1/products?page=1&page_size=2", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 2
    assert resp.json()["meta"]["total"] == 5
    resp2 = await client.get("/api/v1/products?page=3&page_size=2", headers=headers)
    assert resp2.status_code == 200
    assert len(resp2.json()["data"]) == 1


# ── Service direct tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_service_get_product_not_found():
    from app.products.service import ProductService
    svc = ProductService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="Product not found"):
        await svc.get_product(uuid4(), uuid4())


@pytest.mark.asyncio
async def test_service_delete_product_not_found():
    from app.products.service import ProductService
    svc = ProductService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.get_by_id = AsyncMock(return_value=None)
    with pytest.raises(ValueError, match="Product not found"):
        await svc.delete_product(uuid4(), uuid4())


@pytest.mark.asyncio
async def test_service_update_empty_category_rejected():
    from app.products.service import ProductService
    svc = ProductService(AsyncMock())
    product = MagicMock(sku="X-001")
    svc.get_product = AsyncMock(return_value=product)
    with pytest.raises(ValueError, match="Category cannot be empty"):
        await svc.update_product(uuid4(), uuid4(), {"category": "  "})


@pytest.mark.asyncio
async def test_service_list_products():
    from app.products.service import ProductService
    svc = ProductService(AsyncMock())
    svc.repo = MagicMock()
    svc.repo.list = AsyncMock(return_value=([], 0))
    svc.repo.count_by_status = AsyncMock(return_value=0)
    svc.repo.count_all = AsyncMock(return_value=0)
    result = await svc.list_products(uuid4(), 1, 10, None)
    assert result["meta"]["total"] == 0
    assert result["summary"]["total"] == 0


@pytest.mark.asyncio
async def test_service_create_product_full():
    from app.products.service import ProductService
    mock_session = AsyncMock()
    svc = ProductService(mock_session)
    svc.repo = MagicMock()
    svc.repo.get_by_sku = AsyncMock(return_value=None)
    product = MagicMock(id=uuid4())
    svc.repo.create = AsyncMock(return_value=product)
    svc.repo.get_by_id = AsyncMock(return_value=product)
    result = await svc.create_product(
        uuid4(),
        {"sku": "NEW-1", "category": "Metals", "status": "active", "cost_per_unit": 10, "reorder_threshold": 5},
        unit="kg",
    )
    assert result == product
    mock_session.add.assert_called_once()
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_service_update_product_full():
    from app.products.service import ProductService
    mock_session = AsyncMock()
    svc = ProductService(mock_session)
    product = MagicMock(sku="X-001", id=uuid4())
    svc.get_product = AsyncMock(return_value=product)
    svc.repo = MagicMock()
    svc.repo.update = AsyncMock(return_value=product)
    svc.repo.get_by_id = AsyncMock(return_value=product)
    result = await svc.update_product(product.id, uuid4(), {"name": "Updated", "category": "Electronics"})
    assert result == product


@pytest.mark.asyncio
async def test_service_delete_product_full():
    from app.products.service import ProductService
    mock_session = AsyncMock()
    svc = ProductService(mock_session)
    product = MagicMock(id=uuid4())
    svc.get_product = AsyncMock(return_value=product)
    svc.repo = MagicMock()
    svc.repo.hard_delete = AsyncMock()
    await svc.delete_product(product.id, uuid4())
    svc.repo.hard_delete.assert_called_once_with(product)
