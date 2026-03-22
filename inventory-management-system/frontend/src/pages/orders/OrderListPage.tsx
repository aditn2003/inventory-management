import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, Buildings, CaretLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
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
      header: <OrderSortHeader label="Order ID" field="display_id" sort={sort} onSortClick={handleSortClick} />,
      className: 'w-28',
    },
    {
      key: 'product',
      header: <OrderSortHeader label="Product" field="product_name" sort={sort} onSortClick={handleSortClick} />,
      render: (o: Order) => o.product?.name ?? '—',
    },
    {
      key: 'requested_qty',
      header: <OrderSortHeader label="Qty" field="requested_qty" sort={sort} onSortClick={handleSortClick} />,
    },
    {
      key: 'status',
      header: <OrderSortHeader label="Status" field="status" sort={sort} onSortClick={handleSortClick} />,
      render: (o: Order) => <StatusBadge status={o.status} />,
    },
    {
      key: 'order_date',
      header: <OrderSortHeader label="Order date" field="order_date" sort={sort} onSortClick={handleSortClick} />,
      render: (o: Order) => new Date(o.order_date).toLocaleDateString(),
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
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">Orders</h1>
            <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">Track and manage customer orders</p>
          </div>
          <button disabled className="btn-primary opacity-50 cursor-not-allowed">
            <Plus size={16} />
            New Order
          </button>
        </div>
        <div className="card">
          <EmptyState
            icon={<Buildings size={40} />}
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
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">Orders</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">Track and manage customer orders</p>
        </div>
        <button onClick={() => navigate('/orders/new')} className="btn-primary">
          <Plus size={16} />
          New Order
        </button>
      </div>

      {data?.summary && (
        <SummaryTiles
          tiles={[
            { label: 'Total Orders', value: data.summary.total,
              icon: <ShoppingCart size={20} className="text-violet-600 dark:text-violet-400" />, iconBg: 'bg-violet-50 dark:bg-violet-950/30' },
            { label: 'Pending', value: data.summary.pending, colorClass: 'text-amber-600 dark:text-amber-400',
              icon: <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />, iconBg: 'bg-amber-50 dark:bg-amber-950/30' },
            { label: 'Created', value: data.summary.created, colorClass: 'text-sky-600 dark:text-sky-400',
              icon: <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />, iconBg: 'bg-sky-50 dark:bg-sky-950/30' },
            { label: 'Confirmed', value: data.summary.confirmed, colorClass: 'text-emerald-600 dark:text-emerald-400',
              icon: <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />, iconBg: 'bg-emerald-50 dark:bg-emerald-950/30' },
            { label: 'Cancelled', value: data.summary.cancelled, colorClass: 'text-rose-600 dark:text-rose-400',
              icon: <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />, iconBg: 'bg-rose-50 dark:bg-rose-950/30' },
          ]}
        />
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
          <input
            type="search"
            placeholder="Search by product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 w-full sm:w-72"
          />
        </div>
        <div className="flex items-center gap-2">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value || 'all'}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                ${statusFilter === opt.value
                  ? 'bg-primary-50 dark:bg-primary-950/30 border-primary-200 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600 hover:text-slate-700 dark:hover:text-neutral-300'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={loading}
        onRowClick={(o) => navigate(`/orders/${o.id}`)}
        emptyState={
          <EmptyState
            icon={<ShoppingCart size={40} />}
            heading="No orders found"
            subtext={
              search || statusFilter
                ? 'Try clearing search or the status filter.'
                : 'Create an order to see it here.'
            }
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
            {filteredLabel && <span className="text-slate-400 dark:text-neutral-500"> ({filteredLabel} only)</span>}
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
                        : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
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
        title="Delete Order"
        message={`Delete order "${deleteTarget?.display_id}"?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
