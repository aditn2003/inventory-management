import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productsApi } from '@/api/products';
import { useTenant } from '@/hooks/useTenant';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { InfoCardGrid } from '@/components/ui/InfoCardGrid';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/types/api';
import type { Product } from '@/types/product';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedTenant } = useTenant();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!id || !selectedTenant) return;
    productsApi.get(id)
      .then(setProduct)
      .catch(() => navigate('/products'))
      .finally(() => setLoading(false));
  }, [id, selectedTenant]);

  const handleDelete = async () => {
    if (!product) return;
    try {
      await productsApi.delete(product.id);
      toast.success('Product deleted.');
      navigate('/products');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return <div className="shimmer-line h-8 w-48" />;
  if (!product) return null;

  const stockValue = product.inventory
    ? `${product.inventory.current_stock} ${product.inventory.unit}`
    : 'â€”';

  const stockColorClass =
    product.inventory && product.inventory.current_stock < product.reorder_threshold
      ? 'text-rose-600'
      : 'text-primary-600';

  return (
    <div className="space-y-6">
      <DetailHeader
        title={product.name}
        subtitle={`SKU: ${product.sku}`}
        backTo="/products"
        backLabel="Products"
        actions={
          <>
            <button
              onClick={() => navigate(`/products/${product.id}/edit`)}
              className="btn-secondary"
            >
              Edit
            </button>
            <button onClick={() => setShowDelete(true)} className="btn-danger">
              Delete
            </button>
          </>
        }
      />

      <InfoCardGrid
        cards={[
          { label: 'Category', value: product.category },
          { label: 'Cost per unit', value: `$${Number(product.cost_per_unit).toFixed(2)}` },
          {
            label: 'Current inventory',
            value: stockValue,
            valueClassName: stockColorClass,
          },
          { label: 'Reorder threshold', value: product.reorder_threshold },
        ]}
      />

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500 dark:text-neutral-400">Status: </span>
            <StatusBadge status={product.status} />
          </div>
          {product.description && (
            <div className="col-span-2">
              <span className="text-slate-500 dark:text-neutral-400">Description: </span>
              <span className="text-slate-700 dark:text-neutral-300">{product.description}</span>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Delete Product"
        message={`Delete "${product.name}"? This also deletes its inventory record.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
