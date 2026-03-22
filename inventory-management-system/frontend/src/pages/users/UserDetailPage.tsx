import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Buildings, CaretLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
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
import { getErrorMessage } from '@/types/api';
import type { UserDetail } from '@/types/user';
import type { Tenant } from '@/types/tenant';
import {
  TenantSortHeader,
  type TenantSortField,
  type TenantSortState,
} from '@/components/tenants/TenantSortHeader';

const PAGE_SIZE = 10;

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
      const allIds = allTenantIdsCache.current ?? (await fetchAllTenantIds());
      allTenantIdsCache.current = allIds;

      const assignedIds = user.assigned_tenants.map((t) => t.id);
      const allAccess = assignedIds.length === 0;

      let tenant_ids: string[];

      if (checked) {
        if (allAccess) return;
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

  if (loading && !user) return <div className="shimmer-line h-8 w-48" />;
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
            className="h-4 w-4 rounded border-slate-300 dark:border-neutral-700 text-primary-600 focus:ring-primary-500"
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
        backTo="/users"
        backLabel="Users"
        actions={
          <button type="button" onClick={() => setShowDelete(true)} className="btn-danger">
            Delete
          </button>
        }
      />

      <InfoCardGrid
        columns={3}
        cards={[
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

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200 mb-3">Change role</h2>
        <div className="flex items-center gap-3">
          <select
            value={roleValue || user.role}
            onChange={(e) => setRoleValue(e.target.value)}
            className="input-field w-auto min-w-[120px]"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="button"
            onClick={handleRoleUpdate}
            disabled={saving || !roleValue}
            className="btn-primary"
          >
            Update role
          </button>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">Tenant access</h2>
          <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1 max-w-2xl">
            Use the checkboxes to control which tenants this user can access.
            When all tenants are allowed, the API stores no rows â€” same default as a new user.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <input
              type="search"
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 w-64"
            />
          </div>
          <button
            type="button"
            disabled={accessSaving || user.assigned_tenants.length === 0}
            title={
              user.assigned_tenants.length === 0
                ? 'This user already has access to every tenant'
                : 'Clear restrictions so this user can use any tenant'
            }
            onClick={() => void handleAllowAllTenants()}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Allow all tenants
          </button>
        </div>

        {tenantsError ? (
          <p className="text-rose-600 text-sm">{tenantsError}</p>
        ) : (
          <>
            <DataTable
              columns={tenantColumns}
              data={tenantsData?.data ?? []}
              loading={tenantsLoading}
              onRowClick={(t) => navigate(`/tenants/${t.id}`)}
              emptyState={
                <EmptyState
                  icon={<Buildings size={40} />}
                  heading="No tenants found"
                  subtext="Create tenants under Tenants in the sidebar."
                />
              }
            />

            {!tenantsLoading && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <p className="text-sm text-slate-500 dark:text-neutral-400">
                  Showing{' '}
                  <span className="font-medium text-slate-700 dark:text-neutral-300">
                    {(page - 1) * PAGE_SIZE + 1}â€“{Math.min(page * PAGE_SIZE, total)}
                  </span>{' '}
                  of <span className="font-medium text-slate-700 dark:text-neutral-300">{total}</span>
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-secondary py-1.5 px-3 text-sm disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <CaretLeft size={14} /> Previous
                  </button>
                  <span className="text-sm text-slate-500 dark:text-neutral-400 px-2 tabular-nums">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="btn-secondary py-1.5 px-3 text-sm disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Next <CaretRight size={14} />
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
