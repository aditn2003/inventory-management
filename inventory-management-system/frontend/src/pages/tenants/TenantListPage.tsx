import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Buildings, CaretLeft, CaretRight } from '@phosphor-icons/react';
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
import { getErrorMessage } from '@/utils/apiError';
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

  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Tenants</h1>
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/tenants/new')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Tenant
          </button>
        )}
      </div>

      {data?.summary && (
        <SummaryTiles
          tiles={[
            { label: 'Total Tenants', value: data.summary.total },
            { label: 'Active', value: data.summary.active, colorClass: 'text-green-700' },
            { label: 'Inactive', value: data.summary.inactive, colorClass: 'text-gray-500' },
          ]}
        />
      )}

      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={loading}
        onRowClick={(t) => navigate(`/tenants/${t.id}`)}
        emptyState={
          <EmptyState
            icon={<Buildings size={48} />}
            heading="No tenants found"
            subtext="Create your first tenant to get started."
          />
        }
      />

      {!loading && total > 0 && (
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
