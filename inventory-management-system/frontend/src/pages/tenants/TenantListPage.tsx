import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Buildings } from '@phosphor-icons/react';
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

export function TenantListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const { data, loading, error, refetch } = useTenants({ page_size: 50, q: search || undefined });

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
    { key: 'display_id', header: 'ID', className: 'w-28' },
    { key: 'name', header: 'Name' },
    {
      key: 'status',
      header: 'Status',
      render: (t: Tenant) => <StatusBadge status={t.status} />,
    },
    { key: 'created_at', header: 'Created', render: (t: Tenant) => new Date(t.created_at).toLocaleDateString() },
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
