import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Buildings } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useProducts } from '@/hooks/useProducts';
import { productsApi } from '@/api/products';
import { useTenant } from '@/hooks/useTenant';
import { DataTable } from '@/components/ui/DataTable';
import { SummaryTiles } from '@/components/ui/SummaryTiles';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { getErrorMessage } from '@/utils/apiError';
import type { Product } from '@/types/product';

export function ProductListPage() {
  const navigate = useNavigate();
  const { selectedTenant } = useTenant();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const { data, loading, error, refetch } = useProducts(selectedTenant?.id ?? null, {
    page_size: 50,
    q: search || undefined,
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await productsApi.delete(deleteTarget.id);
      toast.success(`Product "${deleteTarget.name}" deleted.`);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = [
    { key: 'sku', header: 'SKU', className: 'w-28' },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category' },
    {
      key: 'cost_per_unit',
      header: 'Cost/Unit',
      render: (p: Product) => `$${Number(p.cost_per_unit).toFixed(2)}`,
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (p: Product) =>
        p.inventory ? `${p.inventory.current_stock} ${p.inventory.unit}` : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: Product) => <StatusBadge status={p.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (p: Product) => (
        <ActionMenu
          items={[
            { label: 'View', onClick: () => navigate(`/products/${p.id}`) },
            { label: 'Edit', onClick: () => navigate(`/products/${p.id}/edit`) },
            { label: 'Delete', onClick: () => setDeleteTarget(p), variant: 'danger' as const },
          ]}
        />
      ),
    },
  ];

  if (!selectedTenant) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
          <button
            disabled
            className="flex items-center gap-2 bg-blue-600 opacity-50 cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus size={16} />
            New Product
          </button>
        </div>
        <div className="bg-white rounded-lg border border-gray-200">
          <EmptyState
            icon={<Buildings size={48} />}
            heading="No tenant selected"
            subtext="Choose a tenant from the dropdown above to view products."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
        <button
          onClick={() => navigate('/products/new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Product
        </button>
      </div>

      {data?.summary && (
        <SummaryTiles
          tiles={[
            { label: 'Total Products', value: data.summary.total },
            { label: 'Active', value: data.summary.active, colorClass: 'text-green-700' },
            { label: 'Inactive', value: data.summary.inactive, colorClass: 'text-gray-500' },
          ]}
        />
      )}

      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search products by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={loading}
        onRowClick={(p) => navigate(`/products/${p.id}`)}
        emptyState={
          <EmptyState
            icon={<Package size={48} />}
            heading="No products found"
            subtext="Create your first product for this tenant."
          />
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Product"
        message={`Delete "${deleteTarget?.name}"? This will also delete its inventory record.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
