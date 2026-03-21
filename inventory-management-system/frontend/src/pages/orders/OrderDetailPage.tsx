import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ordersApi } from "@/api/orders";
import { DetailHeader } from "@/components/ui/DetailHeader";
import { InfoCardGrid } from "@/components/ui/InfoCardGrid";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/apiError";
import type { Order } from "@/types/order";

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
      .catch(() => navigate("/orders"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleConfirm = async () => {
    if (!order) return;
    try {
      const updated = await ordersApi.confirm(order.id);
      setOrder(updated);
      toast.success("Order confirmed.");
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
      toast.success("Order cancelled.");
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
      toast.success("Order deleted.");
      navigate("/orders");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading)
    return <div className="animate-pulse h-8 w-48 bg-gray-200 rounded" />;
  if (!order) return null;

  const p = order.product;
  const inv = p?.inventory;
  const unconfirmed = order.status === "pending" || order.status === "created";
  const canConfirmStock =
    unconfirmed && inv != null
      ? inv.current_stock >= order.requested_qty
      : null;

  const requestedQtyClass =
    order.status === "cancelled"
      ? "text-gray-500"
      : order.status === "confirmed"
        ? "text-emerald-800"
        : unconfirmed && inv != null
          ? inv.current_stock >= order.requested_qty
            ? "text-emerald-700"
            : "text-red-600"
          : "text-gray-900";

  return (
    <div className="space-y-6">
      <DetailHeader
        title={order.display_id}
        subtitle={
          order.product ? (
            <Link
              to={`/products/${order.product.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {order.product.name}
            </Link>
          ) : undefined
        }
        backTo="/orders"
        backLabel="Orders"
        actions={
          <>
            {unconfirmed && (
              <button
                type="button"
                disabled={canConfirmStock === false}
                onClick={() => setShowConfirm(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                Confirm
              </button>
            )}
            {order.status !== "cancelled" && (
              <button
                onClick={() => navigate(`/orders/${order.id}/edit`)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
            )}
            {unconfirmed && (
              <button
                onClick={() => setShowCancel(true)}
                className="px-4 py-2 border border-yellow-400 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-50 transition-colors"
              >
                Cancel Order
              </button>
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
        columns={5}
        cards={[
          {
            label: "Requested Qty",
            value: order.requested_qty,
            valueClassName: `tabular-nums ${requestedQtyClass}`,
          },
          {
            label: "Current inventory",
            valuePlain: true,
            value: (
              <div>
                <p className="text-lg font-semibold text-gray-900 tabular-nums">
                  {inv ? (
                    <>
                      {inv.current_stock} {inv.unit}
                    </>
                  ) : (
                    "—"
                  )}
                </p>
                {order.status === "confirmed" && inv ? (
                  <p className="text-xs text-gray-500 mt-1 leading-snug">
                    (Current count reflects stock after this order was
                    confirmed.)
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            label: "Reorder threshold",
            value: p?.reorder_threshold ?? "—",
            valueClassName: "tabular-nums text-gray-900",
          },
          { label: "Status", value: <StatusBadge status={order.status} /> },
          {
            label: "Order Date",
            value: new Date(order.order_date).toLocaleDateString(),
          },
        ]}
      />

      {p && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Product details
          </h2>

          {p.description ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {p.description}
            </p>
          ) : (
            <p className="text-sm text-gray-500 italic">
              No description on file.
            </p>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">SKU</dt>
              <dd className="font-medium text-gray-900 mt-0.5">{p.sku}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Category</dt>
              <dd className="font-medium text-gray-900 mt-0.5">{p.category}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Cost per unit</dt>
              <dd className="font-medium text-gray-900 mt-0.5 tabular-nums">
                ${Number(p.cost_per_unit).toFixed(2)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {order.notes && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
          <p className="text-sm text-gray-600">{order.notes}</p>
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
        message={`Delete order ${order.display_id}?${order.status === "confirmed" ? " Confirmed quantity will be returned to inventory." : ""}`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
