import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { inventoryApi } from '@/api/inventory';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { FormCard } from '@/components/ui/FormCard';
import { getErrorMessage } from '@/utils/apiError';
import { UNITS } from '@/utils/constants';

const inventorySchema = z.object({
  current_stock: z.number({ coerce: true }).int().min(0, 'Must be 0 or more'),
});

type InventoryFormValues = z.infer<typeof inventorySchema>;

export function InventoryEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [productName, setProductName] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InventoryFormValues>({ resolver: zodResolver(inventorySchema) });

  useEffect(() => {
    if (!id) return;
    inventoryApi.get(id).then((inv) => {
      reset({ current_stock: inv.current_stock });
      setProductName(inv.product?.name ?? 'Inventory Item');
    }).catch(() => navigate('/inventory'));
  }, [id]);

  const onSubmit = async (values: InventoryFormValues) => {
    if (!id) return;
    setSubmitting(true);
    try {
      await inventoryApi.patchStock(id, values);
      toast.success('Stock updated.');
      navigate(`/inventory/${id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DetailHeader
        title={`Edit Stock — ${productName}`}
        backTo={`/inventory/${id}`}
        backLabel="Inventory"
      />

      <FormCard>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xs">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
            <input
              {...register('current_stock', { valueAsNumber: true })}
              type="number"
              min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.current_stock && <p className="text-xs text-red-600 mt-1">{errors.current_stock.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Stock'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/inventory/${id}`)}
              className="border border-gray-300 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
