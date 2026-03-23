import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Buildings, CaretLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useTenants } from '@/hooks/useTenants';
import { tenantsApi } from '@/api/tenants';
import { useAuth } from '@/hooks/useAuth';
import { DataTable } from '@/components/ui/DataTable';
import { SummaryTiles } from '@/components/ui/SummaryTiles';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { getErrorMessage } from '@/types/api';
import type { Tenant } from '@/types/tenant';
import {
  TenantSortHeader,
  type TenantSortField,
  type TenantSortState,
} from '@/components/tenants/TenantSortHeader';

const PAGE_SIZE = 10;

export function TenantListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [sort, setSort] = useState<TenantSortState>(null);

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

  const { data, loading, error, refetch } = useTenants({
    page,
    page_size: PAGE_SIZE,
    q: search || undefined,
    ...(sort ? { sort_by: sort.field, sort_dir: sort.dir } : {}),
  });

  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (loading || !data?.meta) return;
    const maxPage = Math.max(1, Math.ceil(data.meta.total / data.meta.page_size));
    if (page > maxPage) setPage(maxPage);
  }, [data?.meta?.total, data?.meta?.page_size, loading, page]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await tenantsApi.delete(deleteTarget.id);
      toast.success(`Tenant "${deleteTarget.name}" deleted.`);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = [
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
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (t: Tenant) => (
        <ActionMenu
          items={[
            { label: 'View', onClick: () => navigate(`/tenants/${t.id}`) },
            ...(user?.role === 'admin'
              ? [
                  { label: 'Edit', onClick: () => navigate(`/tenants/${t.id}/edit`) },
                  { label: 'Delete', onClick: () => setDeleteTarget(t), variant: 'danger' as const },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  if (error) return <p className="text-rose-600">{error}</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">Tenants</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">Manage organizations and tenant accounts</p>
        </div>
        {user?.role === 'admin' && (
          <button onClick={() => navigate('/tenants/new')} className="btn-primary">
            <Plus size={16} />
            New Tenant
          </button>
        )}
      </div>

      {data?.summary && (
        <SummaryTiles
          tiles={[
            { label: 'Total Tenants', value: data.summary.total,
              icon: <Buildings size={20} className="text-sky-600 dark:text-sky-400" />, iconBg: 'bg-sky-50 dark:bg-sky-950/30' },
            { label: 'Active', value: data.summary.active, colorClass: 'text-emerald-700',
              icon: <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />, iconBg: 'bg-emerald-50' },
            { label: 'Inactive', value: data.summary.inactive, colorClass: 'text-slate-500 dark:text-neutral-400',
              icon: <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-neutral-500" />, iconBg: 'bg-slate-100 dark:bg-neutral-800' },
          ]}
        />
      )}

      <div className="flex items-center gap-3">
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
          <input
            type="search"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 w-72"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={loading}
        onRowClick={(t) => navigate(`/tenants/${t.id}`)}
        emptyState={
          <EmptyState
            icon={<Buildings size={40} />}
            heading="No tenants found"
            subtext="Create your first tenant to get started."
          />
        }
      />

      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Showing{' '}
            <span className="font-medium text-slate-700 dark:text-neutral-300">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
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
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pg = i + 1;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200
                      ${page === pg
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                      }`}
                  >
                    {pg}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <span className="text-sm text-slate-400 dark:text-neutral-500 px-1">... {totalPages}</span>
              )}
            </div>
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Tenant"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
