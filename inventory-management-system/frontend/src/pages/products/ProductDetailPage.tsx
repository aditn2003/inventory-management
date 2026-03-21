import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productsApi } from '@/api/products';
import { useTenant } from '@/hooks/useTenant';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { InfoCardGrid } from '@/components/ui/InfoCardGrid';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/apiError';
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

  if (loading) return <div className="animate-pulse h-8 w-48 bg-gray-200 rounded" />;
  if (!product) return null;

  const stockValue = product.inventory
    ? `${product.inventory.current_stock} ${product.inventory.unit}`
    : '—';

  const stockColorClass =
    product.inventory && product.inventory.current_stock < product.reorder_threshold
      ? 'text-red-600'
      : 'text-blue-600';

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
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Edit
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
          { label: 'Category', value: product.category },
          { label: 'Cost per Unit', value: `$${Number(product.cost_per_unit).toFixed(2)}` },
          {
            label: 'Current Stock',
            value: stockValue,
            valueClassName: stockColorClass,
          },
          { label: 'Reorder Point', value: product.reorder_threshold },
        ]}
      />

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-medium text-gray-700">Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Status: </span><StatusBadge status={product.status} /></div>
          {product.description && (
            <div className="col-span-2"><span className="text-gray-500">Description: </span>{product.description}</div>
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
