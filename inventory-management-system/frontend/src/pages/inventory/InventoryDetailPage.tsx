import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { inventoryApi } from '@/api/inventory';
import { useTenant } from '@/hooks/useTenant';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { InfoCardGrid } from '@/components/ui/InfoCardGrid';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/apiError';
import type { Inventory } from '@/types/inventory';

export function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedTenant } = useTenant();
  const [item, setItem] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    if (!id) return;
    inventoryApi.get(id)
      .then(setItem)
      .catch(() => navigate('/inventory'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!item) return;
    try {
      await inventoryApi.delete(item.id);
      toast.success('Inventory deleted.');
      navigate('/inventory');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleResetStock = async () => {
    if (!item) return;
    try {
      const updated = await inventoryApi.resetStock(item.id);
      setItem(updated);
      toast.success('Stock reset to 0.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setShowReset(false);
    }
  };

  if (loading) return <div className="animate-pulse h-8 w-48 bg-gray-200 rounded" />;
  if (!item) return null;

  const belowReorder = item.product && item.current_stock < item.product.reorder_threshold;
  const stockColorClass = belowReorder ? 'text-red-600' : 'text-blue-600';

  return (
    <div className="space-y-6">
      <DetailHeader
        title={item.product?.name ?? 'Inventory Item'}
        subtitle={`SKU: ${item.product?.sku ?? '—'}`}
        backTo="/inventory"
        backLabel="Inventory"
        actions={
          <>
            <button
              onClick={() => navigate(`/inventory/${item.id}/edit`)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setShowReset(true)}
              className="px-4 py-2 border border-amber-400 text-amber-600 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors"
            >
              Reset Stock
            </button>
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
          { label: 'Category', value: item.product?.category ?? '—' },
          { label: 'Cost per Unit', value: item.product ? `$${Number(item.product.cost_per_unit).toFixed(2)}` : '—' },
          {
            label: 'Current Stock',
            value: `${item.current_stock} ${item.unit}`,
            valueClassName: stockColorClass,
          },
          { label: 'Reorder Point', value: item.product?.reorder_threshold ?? '—' },
        ]}
      />

      {item.product && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">
            Product:{' '}
            <Link to={`/products/${item.product.id}`} className="text-blue-600 hover:underline">
              {item.product.name}
            </Link>
          </p>
        </div>
      )}

      <ConfirmDialog
        open={showReset}
        title="Reset Stock"
        message={`Reset stock for "${item.product?.name}" to 0? The product will not be deleted.`}
        confirmLabel="Reset"
        onConfirm={handleResetStock}
        onCancel={() => setShowReset(false)}
        variant="warning"
      />

      <ConfirmDialog
        open={showDelete}
        title="Delete Inventory"
        message={`Delete inventory for "${item.product?.name}"? This will also delete the product.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
