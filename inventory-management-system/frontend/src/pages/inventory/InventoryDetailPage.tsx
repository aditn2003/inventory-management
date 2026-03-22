import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { inventoryApi } from '@/api/inventory';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { InfoCardGrid } from '@/components/ui/InfoCardGrid';
import { InventoryQuickUpdate } from '@/components/ui/InventoryQuickUpdate';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/apiError';
import type { Inventory } from '@/types/inventory';

export function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    inventoryApi
      .get(id)
      .then(setItem)
      .catch(() => navigate('/inventory'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

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

  if (loading) return <div className="shimmer-line h-8 w-48" />;
  if (!item) return null;

  return (
    <div className="space-y-6">
      <DetailHeader
        title={
          item.product ? (
            <Link
              to={`/products/${item.product.id}`}
              className="text-inherit hover:text-primary-600 hover:underline underline-offset-2
                rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30
                focus-visible:ring-offset-2 transition-colors"
            >
              {item.product.name}
            </Link>
          ) : (
            'Inventory Item'
          )
        }
        subtitle={`SKU: ${item.product?.sku ?? '—'}`}
        backTo="/inventory"
        backLabel="Inventory"
        actions={
          <button type="button" onClick={() => setShowDelete(true)} className="btn-danger">
            Delete
          </button>
        }
      />

      <InfoCardGrid
        cards={[
          { label: 'Category', value: item.product?.category ?? '—' },
          { label: 'Cost per unit', value: item.product ? `$${Number(item.product.cost_per_unit).toFixed(2)}` : '—' },
          {
            label: 'Current inventory',
            valuePlain: true,
            value: (
              <InventoryQuickUpdate
                variant="card"
                current={item.current_stock}
                unit={item.unit}
                reorderThreshold={item.product?.reorder_threshold ?? null}
                onSave={async (v) => {
                  try {
                    const updated = await inventoryApi.patchStock(item.id, { current_stock: v });
                    setItem(updated);
                    toast.success('Inventory updated.');
                  } catch (err) {
                    toast.error(getErrorMessage(err));
                    throw err;
                  }
                }}
              />
            ),
          },
          { label: 'Reorder threshold', value: item.product?.reorder_threshold ?? '—' },
        ]}
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
