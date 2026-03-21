import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Buildings, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useInventory } from '@/hooks/useInventory';
import { inventoryApi } from '@/api/inventory';
import { useTenant } from '@/hooks/useTenant';
import { DataTable } from '@/components/ui/DataTable';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { InventoryAttentionSummary } from '@/components/inventory/InventoryAttentionSummary';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { InventoryQuickUpdate } from '@/components/ui/InventoryQuickUpdate';
import { getErrorMessage } from '@/utils/apiError';
import type { Inventory } from '@/types/inventory';
import {
  InventorySortHeader,
  type InventorySortField,
  type InventorySortState,
} from '@/components/inventory/InventorySortHeader';

const PAGE_SIZE = 10;

export function InventoryListPage() {
  const navigate = useNavigate();
  const { selectedTenant } = useTenant();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<InventorySortState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Inventory | null>(null);
  /** Table shows only rows where current stock is below reorder threshold (server-filtered). */
  const [filterBelowReorder, setFilterBelowReorder] = useState(false);
  /** Bump per row so ActionMenu "Edit" opens the inline inventory editor. */
  const [stockEditVersion, setStockEditVersion] = useState<Record<string, number>>({});

  useEffect(() => {
    setPage(1);
    setSort(null);
    setStockEditVersion({});
    setFilterBelowReorder(false);
  }, [selectedTenant?.id]);

  useEffect(() => {
    setPage(1);
  }, [search, sort?.field, sort?.dir, filterBelowReorder]);

  const handleSortClick = useCallback((field: InventorySortField) => {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, dir: 'asc' };
      if (prev.dir === 'asc') return { field, dir: 'desc' };
      return null;
    });
  }, []);

  const { data, loading, error, refetch } = useInventory(selectedTenant?.id ?? null, {
    page,
    page_size: PAGE_SIZE,
    q: search || undefined,
    ...(sort ? { sort_by: sort.field, sort_dir: sort.dir } : {}),
    ...(filterBelowReorder ? { below_reorder_only: true } : {}),
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
      await inventoryApi.delete(deleteTarget.id);
      toast.success(`Inventory deleted (product "${deleteTarget.product?.name}" also deleted).`);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = [
    {
      key: 'name',
      header: (
        <InventorySortHeader
          label="Product name"
          field="product_name"
          sort={sort}
          onSortClick={handleSortClick}
        />
      ),
      render: (inv: Inventory) => inv.product?.name ?? '—',
    },
    {
      key: 'sku',
      header: <InventorySortHeader label="SKU" field="sku" sort={sort} onSortClick={handleSortClick} />,
      render: (inv: Inventory) => inv.product?.sku ?? '—',
    },
    {
      key: 'cost_per_unit',
      header: (
        <InventorySortHeader
          label="Cost per unit"
          field="cost_per_unit"
          sort={sort}
          onSortClick={handleSortClick}
        />
      ),
      render: (inv: Inventory) =>
        inv.product != null ? `$${Number(inv.product.cost_per_unit).toFixed(2)}` : '—',
    },
    {
      key: 'current_inventory',
      header: (
        <InventorySortHeader
          label="Current inventory"
          field="current_stock"
          sort={sort}
          onSortClick={handleSortClick}
        />
      ),
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
      header: (
        <InventorySortHeader
          label="Reorder threshold"
          field="reorder_threshold"
          sort={sort}
          onSortClick={handleSortClick}
        />
      ),
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data?.summary && (
        <InventoryAttentionSummary
          belowReorderCount={data.summary.below_reorder_count}
          filterBelowReorderActive={filterBelowReorder}
          onOpenBelowReorderView={() => {
            setFilterBelowReorder(true);
            setPage(1);
          }}
          onClearBelowReorderView={() => {
            setFilterBelowReorder(false);
            setPage(1);
          }}
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
            heading={filterBelowReorder ? 'No items below threshold' : 'No inventory found'}
            subtext={
              filterBelowReorder
                ? 'Nothing is currently under its reorder level, or try clearing the filter.'
                : 'Create products to auto-generate inventory records.'
            }
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
        title="Delete Inventory"
        message={`Delete inventory for "${deleteTarget?.product?.name}"? This will also delete the product "${deleteTarget?.product?.name}".`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
