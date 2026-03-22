import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ordersApi } from '@/api/orders';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { InfoCardGrid } from '@/components/ui/InfoCardGrid';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/types/api';
import type { Order } from '@/types/order';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (!id) return;
    ordersApi
      .get(id)
      .then(setOrder)
      .catch(() => navigate('/orders'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleConfirm = async () => {
    if (!order) return;
    try {
      const updated = await ordersApi.confirm(order.id);
      setOrder(updated);
      toast.success('Order confirmed.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setShowConfirm(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    try {
      const updated = await ordersApi.cancel(order.id);
      setOrder(updated);
      toast.success('Order cancelled.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setShowCancel(false);
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    try {
      await ordersApi.delete(order.id);
      toast.success('Order deleted.');
      navigate('/orders');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return <div className="shimmer-line h-8 w-48" />;
  if (!order) return null;

  const p = order.product;
  const inv = p?.inventory;
  const unconfirmed = order.status === 'pending' || order.status === 'created';
  const canConfirmStock =
    unconfirmed && inv != null ? inv.current_stock >= order.requested_qty : null;

  const neutralQty = 'text-slate-900 dark:text-neutral-100';
  const requestedQtyClass =
    order.status === 'cancelled'
      ? 'text-slate-500 dark:text-neutral-400'
      : inv != null && order.requested_qty > inv.current_stock
        ? 'text-rose-600 dark:text-rose-400'
        : neutralQty;

  return (
    <div className="space-y-6">
      <DetailHeader
        title={order.display_id}
        subtitle={
          order.product ? (
            <Link
              to={`/products/${order.product.id}`}
              className="text-primary-600 hover:text-primary-700 hover:underline font-medium transition-colors"
            >
              {order.product.name}
            </Link>
          ) : undefined
        }
        backTo="/orders"
        backLabel="Orders"
        actions={
          <div className="flex gap-2.5">
            {unconfirmed && (
              <button
                type="button"
                disabled={canConfirmStock === false}
                onClick={() => setShowConfirm(true)}
                className="btn-secondary !border-emerald-500 !text-emerald-500 hover:!bg-emerald-50
                  dark:!border-emerald-400 dark:!text-emerald-400 dark:hover:!bg-emerald-950/30
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            )}
            {order.status !== 'cancelled' && (
              <button onClick={() => navigate(`/orders/${order.id}/edit`)} className="btn-secondary">
                Edit
              </button>
            )}
            {unconfirmed && (
              <button
                onClick={() => setShowCancel(true)}
                className="btn-secondary"
              >
                Cancel Order
              </button>
            )}
            <button
              onClick={() => setShowDelete(true)}
              className="btn-secondary !border-rose-500 !text-rose-500 hover:!bg-rose-50
                dark:!border-rose-400 dark:!text-rose-400 dark:hover:!bg-rose-950/30"
            >
              Delete
            </button>
          </div>
        }
      />

      <InfoCardGrid
        columns={5}
        cards={[
          {
            label: 'Requested Qty',
            value: order.requested_qty,
            valueClassName: `tabular-nums ${requestedQtyClass}`,
          },
          {
            label: 'Current inventory',
            valuePlain: true,
            value: (
              <div>
                <p className="text-lg font-semibold text-slate-900 dark:text-neutral-100 tabular-nums">
                  {inv ? `${inv.current_stock} ${inv.unit}` : 'â€”'}
                </p>
                {order.status === 'confirmed' && inv && (
                  <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1 leading-snug">
                    (Reflects stock after this order was confirmed.)
                  </p>
                )}
              </div>
            ),
          },
          {
            label: 'Reorder threshold',
            value: p?.reorder_threshold ?? 'â€”',
            valueClassName: 'tabular-nums text-slate-900 dark:text-neutral-100',
          },
          { label: 'Status', value: <StatusBadge status={order.status} /> },
          {
            label: 'Order Date',
            value: new Date(order.order_date).toLocaleDateString(),
          },
        ]}
      />

      {p && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">Product details</h2>
          {p.description ? (
            <p className="text-sm text-slate-600 dark:text-neutral-400 leading-relaxed whitespace-pre-wrap">{p.description}</p>
          ) : (
            <p className="text-sm text-slate-400 dark:text-neutral-500 italic">No description on file.</p>
          )}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-neutral-400">SKU</dt>
              <dd className="font-medium text-slate-900 dark:text-neutral-100 mt-0.5">{p.sku}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-neutral-400">Category</dt>
              <dd className="font-medium text-slate-900 dark:text-neutral-100 mt-0.5">{p.category}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-neutral-400">Cost per unit</dt>
              <dd className="font-medium text-slate-900 dark:text-neutral-100 mt-0.5 tabular-nums">${Number(p.cost_per_unit).toFixed(2)}</dd>
            </div>
          </dl>
        </div>
      )}

      {order.notes && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-800 dark:text-neutral-200 mb-1.5">Notes</p>
          <p className="text-sm text-slate-600 dark:text-neutral-400">{order.notes}</p>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Confirm Order"
        message={`Confirm order ${order.display_id}? Stock will be deducted now.`}
        confirmLabel="Confirm"
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        variant="warning"
      />
      <ConfirmDialog
        open={showCancel}
        title="Cancel Order"
        message={`Cancel order ${order.display_id}? Inventory is unchanged (stock is only reduced after confirm).`}
        confirmLabel="Cancel Order"
        onConfirm={handleCancel}
        onCancel={() => setShowCancel(false)}
      />
      <ConfirmDialog
        open={showDelete}
        title="Delete Order"
        message={`Delete order ${order.display_id}?${order.status === 'confirmed' ? ' Confirmed quantity will be returned to inventory.' : ''}`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
