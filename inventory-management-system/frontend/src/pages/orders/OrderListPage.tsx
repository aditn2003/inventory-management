import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, Buildings } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { ordersApi } from '@/api/orders';
import { useTenant } from '@/hooks/useTenant';
import { DataTable } from '@/components/ui/DataTable';
import { SummaryTiles } from '@/components/ui/SummaryTiles';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { getErrorMessage } from '@/utils/apiError';
import type { Order, OrderListResponse } from '@/types/order';

function useOrders(tenantId: string | null, params?: { page_size?: number; q?: string }) {
  const [data, setData] = useState<OrderListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await ordersApi.list(params);
      setData(result);
    } catch {
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, JSON.stringify(params)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function OrderListPage() {
  const navigate = useNavigate();
  const { selectedTenant } = useTenant();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const { data, loading, error, refetch } = useOrders(selectedTenant?.id ?? null, {
    page_size: 50,
    q: search || undefined,
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await ordersApi.delete(deleteTarget.id);
      toast.success(`Order "${deleteTarget.display_id}" deleted.`);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = [
    { key: 'display_id', header: 'Order ID', className: 'w-28' },
    { key: 'product', header: 'Product', render: (o: Order) => o.product?.name ?? '—' },
    { key: 'requested_qty', header: 'Qty' },
    {
      key: 'status',
      header: 'Status',
      render: (o: Order) => <StatusBadge status={o.status} />,
    },
    { key: 'order_date', header: 'Date', render: (o: Order) => new Date(o.order_date).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (o: Order) => (
        <ActionMenu
          items={[
            { label: 'View', onClick: () => navigate(`/orders/${o.id}`) },
            ...(o.status !== 'cancelled' ? [
              { label: 'Edit', onClick: () => navigate(`/orders/${o.id}/edit`) },
            ] : []),
            { label: 'Delete', onClick: () => setDeleteTarget(o), variant: 'danger' as const },
          ]}
        />
      ),
    },
  ];

  if (!selectedTenant) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
          <button
            disabled
            className="flex items-center gap-2 bg-blue-600 opacity-50 cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus size={16} />
            New Order
          </button>
        </div>
        <div className="bg-white rounded-lg border border-gray-200">
          <EmptyState
            icon={<Buildings size={48} />}
            heading="No tenant selected"
            subtext="Choose a tenant from the dropdown above to view orders."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
        <button
          onClick={() => navigate('/orders/new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Order
        </button>
      </div>

      {data?.summary && (
        <SummaryTiles
          tiles={[
            { label: 'Total Orders', value: data.summary.total },
            { label: 'Pending', value: data.summary.pending, colorClass: 'text-yellow-600' },
            { label: 'Created', value: data.summary.created, colorClass: 'text-green-700' },
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
        onRowClick={(o) => navigate(`/orders/${o.id}`)}
        emptyState={
          <EmptyState
            icon={<ShoppingCart size={48} />}
            heading="No orders found"
          />
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Order"
        message={`Delete order "${deleteTarget?.display_id}"?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
