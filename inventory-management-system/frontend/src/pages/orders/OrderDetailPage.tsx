import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ordersApi } from '@/api/orders';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { InfoCardGrid } from '@/components/ui/InfoCardGrid';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/apiError';
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
    ordersApi.get(id)
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

  if (loading) return <div className="animate-pulse h-8 w-48 bg-gray-200 rounded" />;
  if (!order) return null;

  return (
    <div className="space-y-6">
      <DetailHeader
        title={order.display_id}
        subtitle={order.product?.name}
        backTo="/orders"
        backLabel="Orders"
        actions={
          <>
            {order.status === 'pending' && (
              <button
                onClick={() => setShowConfirm(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Confirm
              </button>
            )}
            {order.status !== 'cancelled' && (
              <>
                <button
                  onClick={() => navigate(`/orders/${order.id}/edit`)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowCancel(true)}
                  className="px-4 py-2 border border-yellow-400 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-50 transition-colors"
                >
                  Cancel Order
                </button>
              </>
            )}
            <button
              onClick={() => setShowDelete(true)}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </>
        }
      />

      <InfoCardGrid
        cards={[
          { label: 'Requested Qty', value: order.requested_qty },
          { label: 'Cost per Unit', value: order.product ? `$${Number(order.product.cost_per_unit).toFixed(2)}` : '—' },
          { label: 'Status', value: <StatusBadge status={order.status} /> },
          { label: 'Order Date', value: new Date(order.order_date).toLocaleDateString() },
        ]}
      />

      {order.notes && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
          <p className="text-sm text-gray-600">{order.notes}</p>
        </div>
      )}

      {order.product && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">
            Product:{' '}
            <Link to={`/products/${order.product.id}`} className="text-blue-600 hover:underline">
              {order.product.name}
            </Link>
          </p>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Confirm Order"
        message={`Confirm order ${order.display_id}? Stock will be deducted if available.`}
        confirmLabel="Confirm"
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        variant="warning"
      />

      <ConfirmDialog
        open={showCancel}
        title="Cancel Order"
        message={`Cancel order ${order.display_id}? ${order.status === 'created' ? 'Stock will be restored.' : ''}`}
        confirmLabel="Cancel Order"
        onConfirm={handleCancel}
        onCancel={() => setShowCancel(false)}
      />

      <ConfirmDialog
        open={showDelete}
        title="Delete Order"
        message={`Delete order ${order.display_id}?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
