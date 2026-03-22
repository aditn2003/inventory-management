"""Direct repository-level tests to close coverage gaps for users and tenants repos."""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

from tests.conftest import create_user, create_tenant


# ── Users repository direct ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_user_mgmt_repo_list_users(session: AsyncSession):
    from app.users.repository import UserManagementRepository
    await create_user(session, "listrepo1@test.com", role="user")
    await create_user(session, "listrepo2@test.com", role="admin")
    repo = UserManagementRepository(session)
    users, total = await repo.list_users(1, 10)
    assert total >= 2
    assert len(users) >= 2
    assert all("assigned_tenant_count" in u for u in users)


@pytest.mark.asyncio
async def test_user_mgmt_repo_get_by_id(session: AsyncSession):
    from app.users.repository import UserManagementRepository
    user = await create_user(session, "getrepo@test.com")
    repo = UserManagementRepository(session)
    found = await repo.get_user_by_id(user.id)
    assert found is not None
    assert found.email == "getrepo@test.com"


@pytest.mark.asyncio
async def test_user_mgmt_repo_get_by_id_not_found(session: AsyncSession):
    from app.users.repository import UserManagementRepository
    repo = UserManagementRepository(session)
    found = await repo.get_user_by_id(uuid4())
    assert found is None


@pytest.mark.asyncio
async def test_user_mgmt_repo_get_user_tenants(session: AsyncSession):
    from app.users.repository import UserManagementRepository
    from app.auth.models import UserTenantRole
    user = await create_user(session, "tenantsrepo@test.com")
    t = await create_tenant(session, "RepoTenant", "TEN-REP1")
    assignment = UserTenantRole(user_id=user.id, tenant_id=t.id)
    session.add(assignment)
    await session.flush()
    repo = UserManagementRepository(session)
    tenants = await repo.get_user_tenants(user.id)
    assert len(tenants) == 1
    assert tenants[0].name == "RepoTenant"


@pytest.mark.asyncio
async def test_user_mgmt_repo_update_role(session: AsyncSession):
    from app.users.repository import UserManagementRepository
    user = await create_user(session, "rolerepo@test.com", role="user")
    repo = UserManagementRepository(session)
    updated = await repo.update_role(user, "admin")
    assert updated.role == "admin"


@pytest.mark.asyncio
async def test_user_mgmt_repo_hard_delete(session: AsyncSession):
    from app.users.repository import UserManagementRepository
    user = await create_user(session, "deleterepo@test.com")
    repo = UserManagementRepository(session)
    await repo.hard_delete_user(user)
    found = await repo.get_user_by_id(user.id)
    assert found is None


@pytest.mark.asyncio
async def test_user_mgmt_repo_create_delete_assignment(session: AsyncSession):
    from app.users.repository import UserManagementRepository
    user = await create_user(session, "assignrepo@test.com")
    t = await create_tenant(session, "AssignTenant", "TEN-ASR1")
    repo = UserManagementRepository(session)
    assignment = await repo.create_assignment(user.id, t.id)
    assert assignment is not None
    tenants = await repo.get_user_tenants(user.id)
    assert len(tenants) == 1
    await repo.delete_all_assignments_for_user(user.id)
    tenants2 = await repo.get_user_tenants(user.id)
    assert len(tenants2) == 0


# ── Tenants repository direct ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tenant_repo_count_all(session: AsyncSession):
    from app.tenants.repository import TenantRepository
    await create_tenant(session, "CountAll A", "TEN-CA1")
    await create_tenant(session, "CountAll B", "TEN-CA2")
    repo = TenantRepository(session)
    count = await repo.count_all()
    assert count >= 2


@pytest.mark.asyncio
async def test_tenant_repo_count_by_status(session: AsyncSession):
    from app.tenants.repository import TenantRepository
    await create_tenant(session, "CountStatus A", "TEN-CSS1")
    repo = TenantRepository(session)
    active = await repo.count_by_status("active")
    assert active >= 1
    inactive = await repo.count_by_status("inactive")
    assert isinstance(inactive, int)


@pytest.mark.asyncio
async def test_tenant_repo_get_by_name(session: AsyncSession):
    from app.tenants.repository import TenantRepository
    await create_tenant(session, "FindByName Co", "TEN-FBN1")
    repo = TenantRepository(session)
    found = await repo.get_by_name("FindByName Co")
    assert found is not None
    not_found = await repo.get_by_name("Nonexistent Co")
    assert not_found is None


@pytest.mark.asyncio
async def test_tenant_repo_get_next_display_id(session: AsyncSession):
    from app.tenants.repository import TenantRepository
    repo = TenantRepository(session)
    did = await repo.get_next_display_id()
    assert did.startswith("TEN-")


@pytest.mark.asyncio
async def test_tenant_repo_create(session: AsyncSession):
    from app.tenants.repository import TenantRepository
    repo = TenantRepository(session)
    t = await repo.create(name="Direct Create", status="active", display_id="TEN-DC1")
    assert t.name == "Direct Create"


@pytest.mark.asyncio
async def test_tenant_repo_update(session: AsyncSession):
    from app.tenants.repository import TenantRepository
    t = await create_tenant(session, "UpdateDirect Co", "TEN-UD1")
    repo = TenantRepository(session)
    updated = await repo.update(t, name="Updated Direct", status="inactive")
    assert updated.name == "Updated Direct"
    assert updated.status == "inactive"


@pytest.mark.asyncio
async def test_tenant_repo_hard_delete(session: AsyncSession):
    from app.tenants.repository import TenantRepository
    t = await create_tenant(session, "DeleteDirect Co", "TEN-DD1")
    repo = TenantRepository(session)
    await repo.hard_delete(t)
    found = await repo.get_by_id(t.id)
    assert found is None


@pytest.mark.asyncio
async def test_tenant_repo_list_default_order(session: AsyncSession):
    from app.tenants.repository import TenantRepository
    await create_tenant(session, "ListDO A", "TEN-LDA1")
    await create_tenant(session, "ListDO B", "TEN-LDB1")
    repo = TenantRepository(session)
    tenants, total = await repo.list(None, 1, 10, None)
    assert total >= 2


@pytest.mark.asyncio
async def test_tenant_repo_list_with_search(session: AsyncSession):
    from app.tenants.repository import TenantRepository
    await create_tenant(session, "Searchable Repo Co", "TEN-SRC1")
    repo = TenantRepository(session)
    tenants, total = await repo.list(None, 1, 10, "Searchable Repo")
    assert total >= 1


@pytest.mark.asyncio
async def test_tenant_repo_list_with_ids_filter(session: AsyncSession):
    from app.tenants.repository import TenantRepository
    t1 = await create_tenant(session, "FilterA Co", "TEN-FA1")
    t2 = await create_tenant(session, "FilterB Co", "TEN-FB1")
    await create_tenant(session, "FilterC Co", "TEN-FC1")
    repo = TenantRepository(session)
    tenants, total = await repo.list([t1.id, t2.id], 1, 10, None)
    assert total == 2


@pytest.mark.asyncio
async def test_tenant_repo_list_with_sort(session: AsyncSession):
    from app.tenants.repository import TenantRepository
    repo = TenantRepository(session)
    tenants, _ = await repo.list(None, 1, 10, None, sort_by="name", sort_dir="asc")
    assert isinstance(tenants, list)
    tenants2, _ = await repo.list(None, 1, 10, None, sort_by="created_at", sort_dir="desc")
    assert isinstance(tenants2, list)


# ── Auth repository direct ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_auth_repo_get_by_email(session: AsyncSession):
    from app.auth.repository import UserRepository
    await create_user(session, "authrepo@test.com")
    repo = UserRepository(session)
    found = await repo.get_by_email("authrepo@test.com")
    assert found is not None
    not_found = await repo.get_by_email("nosuchuser@test.com")
    assert not_found is None


@pytest.mark.asyncio
async def test_auth_repo_get_by_id(session: AsyncSession):
    from app.auth.repository import UserRepository
    user = await create_user(session, "authidrepo@test.com")
    repo = UserRepository(session)
    found = await repo.get_by_id(user.id)
    assert found is not None
    not_found = await repo.get_by_id(uuid4())
    assert not_found is None


@pytest.mark.asyncio
async def test_auth_repo_get_by_google_sub(session: AsyncSession):
    from app.auth.repository import UserRepository
    repo = UserRepository(session)
    found = await repo.get_by_google_sub("nonexistent_sub_12345")
    assert found is None


@pytest.mark.asyncio
async def test_auth_repo_create(session: AsyncSession):
    from app.auth.repository import UserRepository
    repo = UserRepository(session)
    user = await repo.create(email="created@test.com", password_hash="hash123", name="Created")
    assert user.email == "created@test.com"


@pytest.mark.asyncio
async def test_auth_repo_get_assigned_tenant_ids(session: AsyncSession):
    from app.auth.repository import UserRepository
    from app.auth.models import UserTenantRole
    user = await create_user(session, "assigned_repo@test.com")
    t = await create_tenant(session, "AssignedTenant", "TEN-AST1")
    assignment = UserTenantRole(user_id=user.id, tenant_id=t.id)
    session.add(assignment)
    await session.flush()
    repo = UserRepository(session)
    ids = await repo.get_assigned_tenant_ids(user.id)
    assert t.id in ids


# ── Invite repository direct ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invite_repo_create_and_get(session: AsyncSession):
    from app.auth.invite_repository import UserInviteRepository, hash_invite_token
    from datetime import datetime, timedelta, timezone
    admin = await create_user(session, "invadmin@test.com", role="admin")
    repo = UserInviteRepository(session)
    token_hash = hash_invite_token("test_invite_token_123")
    inv = await repo.create(
        email="invitee@test.com",
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        invited_by_id=admin.id,
    )
    assert inv is not None
    found = await repo.get_valid_by_token_hash(token_hash)
    assert found is not None
    assert found.email == "invitee@test.com"


@pytest.mark.asyncio
async def test_invite_repo_revoke_pending(session: AsyncSession):
    from app.auth.invite_repository import UserInviteRepository, hash_invite_token
    from datetime import datetime, timedelta, timezone
    admin = await create_user(session, "invadmin2@test.com", role="admin")
    repo = UserInviteRepository(session)
    await repo.create(
        email="revoke@test.com",
        token_hash=hash_invite_token("token_to_revoke"),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        invited_by_id=admin.id,
    )
    await repo.revoke_pending_for_email("revoke@test.com")
    found = await repo.get_valid_by_token_hash(hash_invite_token("token_to_revoke"))
    assert found is None


@pytest.mark.asyncio
async def test_invite_repo_consume(session: AsyncSession):
    from app.auth.invite_repository import UserInviteRepository, hash_invite_token
    from datetime import datetime, timedelta, timezone
    admin = await create_user(session, "invadmin3@test.com", role="admin")
    repo = UserInviteRepository(session)
    inv = await repo.create(
        email="consume@test.com",
        token_hash=hash_invite_token("token_to_consume"),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        invited_by_id=admin.id,
    )
    await repo.consume(inv)
    assert inv.consumed_at is not None
    found = await repo.get_valid_by_token_hash(hash_invite_token("token_to_consume"))
    assert found is None


@pytest.mark.asyncio
async def test_invite_repo_get_any_valid_pending(session: AsyncSession):
    from app.auth.invite_repository import UserInviteRepository, hash_invite_token
    from datetime import datetime, timedelta, timezone
    admin = await create_user(session, "invadmin4@test.com", role="admin")
    repo = UserInviteRepository(session)
    await repo.create(
        email="pending@test.com",
        token_hash=hash_invite_token("pending_token"),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        invited_by_id=admin.id,
    )
    found = await repo.get_any_valid_pending_for_email("pending@test.com")
    assert found is not None
    found_none = await repo.get_any_valid_pending_for_email("nonexistent@test.com")
    assert found_none is None
