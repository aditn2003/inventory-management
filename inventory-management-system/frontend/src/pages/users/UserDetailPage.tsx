import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Buildings, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useUserDetail } from '@/hooks/useUsers';
import { useTenants } from '@/hooks/useTenants';
import { usersApi } from '@/api/users';
import { fetchAllTenantIds } from '@/api/tenants';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { InfoCardGrid } from '@/components/ui/InfoCardGrid';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { getErrorMessage } from '@/utils/apiError';
import type { UserDetail } from '@/types/user';
import type { Tenant } from '@/types/tenant';
import {
  TenantSortHeader,
  type TenantSortField,
  type TenantSortState,
} from '@/components/tenants/TenantSortHeader';

const PAGE_SIZE = 10;

/** No assignment rows in DB → user may access every tenant. */
function hasTenantAccess(user: UserDetail, tenantId: string): boolean {
  if (user.assigned_tenants.length === 0) return true;
  return user.assigned_tenants.some((t) => t.id === tenantId);
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user, loading, refetch } = useUserDetail(id);
  const [roleValue, setRoleValue] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<TenantSortState>(null);
  const allTenantIdsCache = useRef<string[] | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, sort?.field, sort?.dir]);

  const handleSortClick = useCallback((field: TenantSortField) => {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, dir: 'asc' };
      if (prev.dir === 'asc') return { field, dir: 'desc' };
      return null;
    });
  }, []);

  const { data: tenantsData, loading: tenantsLoading, error: tenantsError } = useTenants({
      page,
      page_size: PAGE_SIZE,
      q: search || undefined,
      ...(sort ? { sort_by: sort.field, sort_dir: sort.dir } : {}),
    });

  const total = tenantsData?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (tenantsLoading || !tenantsData?.meta) return;
    const maxPage = Math.max(1, Math.ceil(tenantsData.meta.total / tenantsData.meta.page_size));
    if (page > maxPage) setPage(maxPage);
  }, [tenantsData?.meta?.total, tenantsData?.meta?.page_size, tenantsLoading, page]);

  const handleRoleUpdate = async () => {
    if (!id || !roleValue) return;
    setSaving(true);
    try {
      await usersApi.updateRole(id, { role: roleValue as 'admin' | 'user' });
      toast.success('Role updated.');
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAccessChange = async (tenantId: string, checked: boolean) => {
    if (!id || !user) return;
    setAccessSaving(true);
    try {
      const allIds =
        allTenantIdsCache.current ??
        (await fetchAllTenantIds());
      allTenantIdsCache.current = allIds;

      const assignedIds = user.assigned_tenants.map((t) => t.id);
      const allAccess = assignedIds.length === 0;

      let tenant_ids: string[];

      if (checked) {
        if (allAccess) {
          return;
        }
        const next = [...new Set([...assignedIds, tenantId])];
        tenant_ids = next.length === allIds.length ? [] : next;
      } else {
        tenant_ids = allAccess
          ? allIds.filter((x) => x !== tenantId)
          : assignedIds.filter((x) => x !== tenantId);
      }

      await usersApi.setTenantAccess(id, { tenant_ids });
      allTenantIdsCache.current = null;
      await refetch();
      toast.success('Tenant access updated.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAccessSaving(false);
    }
  };

  const handleAllowAllTenants = async () => {
    if (!id || !user || user.assigned_tenants.length === 0) return;
    setAccessSaving(true);
    try {
      await usersApi.setTenantAccess(id, { tenant_ids: [] });
      allTenantIdsCache.current = null;
      await refetch();
      toast.success('User can access all tenants.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAccessSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await usersApi.delete(id);
      toast.success('User deleted.');
      navigate('/users');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading && !user) return <div className="animate-pulse h-8 w-48 bg-gray-200 rounded" />;
  if (!user) return null;

  const tenantColumns = [
    {
      key: 'access',
      header: 'Access',
      className: 'w-24',
      render: (t: Tenant) => (
        <span onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={hasTenantAccess(user, t.id)}
            disabled={accessSaving}
            onChange={(e) => {
              e.stopPropagation();
              void handleAccessChange(t.id, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Access to ${t.name}`}
          />
        </span>
      ),
    },
    {
      key: 'display_id',
      header: <TenantSortHeader label="ID" field="display_id" sort={sort} onSortClick={handleSortClick} />,
      className: 'w-28',
    },
    {
      key: 'name',
      header: <TenantSortHeader label="Name" field="name" sort={sort} onSortClick={handleSortClick} />,
    },
    {
      key: 'status',
      header: <TenantSortHeader label="Status" field="status" sort={sort} onSortClick={handleSortClick} />,
      render: (t: Tenant) => <StatusBadge status={t.status} />,
    },
    {
      key: 'created_at',
      header: <TenantSortHeader label="Created" field="created_at" sort={sort} onSortClick={handleSortClick} />,
      render: (t: Tenant) => new Date(t.created_at).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <DetailHeader
        title={user.name}
        subtitle={`Role: ${user.role}`}
        backTo="/users"
        backLabel="Users"
        actions={
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        }
      />

      <InfoCardGrid
        cards={[
          { label: 'Name', value: user.name },
          { label: 'Role', value: <span className="capitalize">{user.role}</span> },
          {
            label: 'Tenant access',
            value:
              user.assigned_tenants.length === 0
                ? 'All tenants'
                : `${user.assigned_tenants.length} tenant(s) only`,
          },
          { label: 'Joined', value: new Date(user.created_at).toLocaleDateString() },
        ]}
      />

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Change role</h2>
        <div className="flex items-center gap-3">
          <select
            value={roleValue || user.role}
            onChange={(e) => setRoleValue(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="button"
            onClick={handleRoleUpdate}
            disabled={saving || !roleValue}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Update role
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-gray-900">Tenant access</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Use the checkboxes to match the Tenants list (search and column headers sort the same way).
            Checked means this user may work in that tenant. When all tenants are allowed, the API stores
            no rows — same default as a new user (access to every tenant).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
          <button
            type="button"
            disabled={accessSaving || user.assigned_tenants.length === 0}
            title={
              user.assigned_tenants.length === 0
                ? 'This user already has access to every tenant'
                : 'Clear restrictions so this user can use any tenant'
            }
            onClick={() => void handleAllowAllTenants()}
            className="border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Allow all tenants
          </button>
        </div>

        {tenantsError ? (
          <p className="text-red-600 text-sm">{tenantsError}</p>
        ) : (
          <>
            <DataTable
              columns={tenantColumns}
              data={tenantsData?.data ?? []}
              loading={tenantsLoading}
              onRowClick={(t) => navigate(`/tenants/${t.id}`)}
              emptyState={
                <EmptyState
                  icon={<Buildings size={48} />}
                  heading="No tenants found"
                  subtext="Create tenants under Tenants in the sidebar."
                />
              }
            />

            {!tenantsLoading && total > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <p className="text-sm text-gray-600">
                  Showing{' '}
                  <span className="font-medium text-gray-900">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
                  </span>{' '}
                  of <span className="font-medium text-gray-900">{total}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    <CaretLeft size={16} />
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 px-2 tabular-nums">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Next
                    <CaretRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Delete User"
        message={`Delete user "${user.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
