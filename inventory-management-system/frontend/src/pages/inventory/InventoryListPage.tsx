import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Buildings } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useInventory } from '@/hooks/useInventory';
import { inventoryApi } from '@/api/inventory';
import { useTenant } from '@/hooks/useTenant';
import { DataTable } from '@/components/ui/DataTable';
import { SummaryTiles } from '@/components/ui/SummaryTiles';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { InventoryQuickUpdate } from '@/components/ui/InventoryQuickUpdate';
import { getErrorMessage } from '@/utils/apiError';
import type { Inventory } from '@/types/inventory';

export function InventoryListPage() {
  const navigate = useNavigate();
  const { selectedTenant } = useTenant();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Inventory | null>(null);
  const [resetTarget, setResetTarget] = useState<Inventory | null>(null);
  /** Bump per row so ActionMenu "Edit" opens the inline stock editor. */
  const [stockEditVersion, setStockEditVersion] = useState<Record<string, number>>({});
  const { data, loading, error, refetch } = useInventory(selectedTenant?.id ?? null, {
    page_size: 50,
    q: search || undefined,
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await inventoryApi.delete(deleteTarget.id);
      toast.success(`Inventory deleted (product "${deleteTarget.product?.name}" also deleted).`);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleResetStock = async () => {
    if (!resetTarget) return;
    try {
      await inventoryApi.resetStock(resetTarget.id);
      toast.success(`Stock reset to 0 for "${resetTarget.product?.name}".`);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setResetTarget(null);
    }
  };

  const columns = [
    { key: 'sku', header: 'SKU', render: (inv: Inventory) => inv.product?.sku ?? '—' },
    { key: 'name', header: 'Product', render: (inv: Inventory) => inv.product?.name ?? '—' },
    { key: 'category', header: 'Category', render: (inv: Inventory) => inv.product?.category ?? '—' },
    {
      key: 'stock',
      header: 'Stock',
      render: (inv: Inventory) => (
        <InventoryQuickUpdate
          current={inv.current_stock}
          unit={inv.unit}
          reorderThreshold={inv.product?.reorder_threshold ?? null}
          externalEditVersion={stockEditVersion[inv.id] ?? 0}
          onSave={async (v) => {
            await inventoryApi.patchStock(inv.id, { current_stock: v });
            refetch();
          }}
        />
      ),
    },
    {
      key: 'reorder',
      header: 'Reorder Pt.',
      render: (inv: Inventory) => inv.product?.reorder_threshold ?? '—',
    },
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (inv: Inventory) => (
        <ActionMenu
          items={[
            { label: 'View', onClick: () => navigate(`/inventory/${inv.id}`) },
            {
              label: 'Edit',
              onClick: () =>
                setStockEditVersion((prev) => ({
                  ...prev,
                  [inv.id]: (prev[inv.id] ?? 0) + 1,
                })),
            },
            { label: 'Reset Stock', onClick: () => setResetTarget(inv), variant: 'warning' as const },
            { label: 'Delete', onClick: () => setDeleteTarget(inv), variant: 'danger' as const },
          ]}
        />
      ),
    },
  ];

  if (!selectedTenant) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
        <div className="bg-white rounded-lg border border-gray-200">
          <EmptyState
            icon={<Buildings size={48} />}
            heading="No tenant selected"
            subtext="Choose a tenant from the dropdown above to view inventory."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>

      {data?.summary && (
        <SummaryTiles
          tiles={[
            {
              label: 'Below Reorder Point',
              value: data.summary.below_reorder_count,
              colorClass: data.summary.below_reorder_count > 0 ? 'text-red-600' : 'text-gray-900',
            },
          ]}
        />
      )}

      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search by product name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={loading}
        onRowClick={(inv) => navigate(`/inventory/${inv.id}`)}
        emptyState={
          <EmptyState
            icon={<Stack size={48} />}
            heading="No inventory found"
            subtext="Create products to auto-generate inventory records."
          />
        }
      />

      <ConfirmDialog
        open={!!resetTarget}
        title="Reset Stock"
        message={`Reset stock for "${resetTarget?.product?.name}" to 0? The product will not be deleted.`}
        confirmLabel="Reset"
        onConfirm={handleResetStock}
        onCancel={() => setResetTarget(null)}
        variant="warning"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Inventory"
        message={`Delete inventory for "${deleteTarget?.product?.name}"? This will also delete the product "${deleteTarget?.product?.name}".`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
