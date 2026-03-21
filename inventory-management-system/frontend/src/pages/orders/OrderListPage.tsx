import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, Buildings, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { ordersApi } from '@/api/orders';
import { useOrders } from '@/hooks/useOrders';
import { useTenant } from '@/hooks/useTenant';
import { DataTable } from '@/components/ui/DataTable';
import { SummaryTiles } from '@/components/ui/SummaryTiles';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { getErrorMessage } from '@/utils/apiError';
import type { Order } from '@/types/order';
import {
  OrderSortHeader,
  type OrderSortField,
  type OrderSortState,
} from '@/components/orders/OrderSortHeader';

const PAGE_SIZE = 10;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'created', label: 'Created' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export function OrderListPage() {
  const navigate = useNavigate();
  const { selectedTenant } = useTenant();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<OrderSortState>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);

  useEffect(() => {
    setPage(1);
    setSort(null);
    setStatusFilter('');
    setSearch('');
  }, [selectedTenant?.id]);

  useEffect(() => {
    setPage(1);
  }, [search, sort?.field, sort?.dir, statusFilter]);

  const handleSortClick = useCallback((field: OrderSortField) => {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, dir: 'asc' };
      if (prev.dir === 'asc') return { field, dir: 'desc' };
      return null;
    });
  }, []);

  const { data, loading, error, refetch } = useOrders(selectedTenant?.id ?? null, {
    page,
    page_size: PAGE_SIZE,
    q: search || undefined,
    ...(sort ? { sort_by: sort.field, sort_dir: sort.dir } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
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
    {
      key: 'display_id',
      header: (
        <OrderSortHeader label="Order ID" field="display_id" sort={sort} onSortClick={handleSortClick} />
      ),
      className: 'w-28',
    },
    {
      key: 'product',
      header: (
        <OrderSortHeader label="Product" field="product_name" sort={sort} onSortClick={handleSortClick} />
      ),
      render: (o: Order) => o.product?.name ?? '—',
    },
    {
      key: 'requested_qty',
      header: (
        <OrderSortHeader label="Qty" field="requested_qty" sort={sort} onSortClick={handleSortClick} />
      ),
    },
    {
      key: 'status',
      header: <OrderSortHeader label="Status" field="status" sort={sort} onSortClick={handleSortClick} />,
      render: (o: Order) => <StatusBadge status={o.status} />,
    },
    {
      key: 'order_date',
      header: (
        <OrderSortHeader label="Order date" field="order_date" sort={sort} onSortClick={handleSortClick} />
      ),
      render: (o: Order) => new Date(o.order_date).toLocaleDateString(),
    },
    {
      key: 'created_at',
      header: (
        <OrderSortHeader label="Created" field="created_at" sort={sort} onSortClick={handleSortClick} />
      ),
      render: (o: Order) => new Date(o.created_at).toLocaleString(),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      render: (o: Order) => (
        <ActionMenu
          items={[
            { label: 'View', onClick: () => navigate(`/orders/${o.id}`) },
            ...(o.status !== 'cancelled'
              ? [{ label: 'Edit', onClick: () => navigate(`/orders/${o.id}/edit`) }]
              : []),
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

  const filteredLabel = statusFilter
    ? STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label ?? statusFilter
    : null;

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
            { label: 'Confirmed', value: data.summary.confirmed, colorClass: 'text-emerald-700' },
            { label: 'Cancelled', value: data.summary.cancelled, colorClass: 'text-red-600' },
          ]}
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <input
          type="search"
          placeholder="Search by product name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span className="shrink-0 text-gray-500">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[11rem]"
            aria-label="Filter by order status"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
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
            subtext={
              search || statusFilter
                ? 'Try clearing search or the status filter, or change page.'
                : 'Create an order to see it here.'
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
            {filteredLabel ? (
              <>
                {' '}
                <span className="text-gray-500">({filteredLabel} only)</span>
              </>
            ) : null}
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
        title="Delete Order"
        message={`Delete order "${deleteTarget?.display_id}"?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
