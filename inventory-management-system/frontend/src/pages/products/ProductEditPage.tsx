import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { productsApi } from '@/api/products';
import { useTenant } from '@/hooks/useTenant';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { FormCard } from '@/components/ui/FormCard';
import { getErrorMessage } from '@/utils/apiError';
import { CATEGORIES, UNITS } from '@/utils/constants';

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.enum(['Metals', 'Chemicals', 'Plastics']),
  cost_per_unit: z.number({ coerce: true }).positive('Must be positive'),
  reorder_threshold: z.number({ coerce: true }).int().min(0, 'Must be 0 or more'),
  status: z.enum(['active', 'inactive']),
  unit: z.enum(['units', 'kg', 'sheets', 'litres']).optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedTenant } = useTenant();
  const isNew = !id || id === 'new';
  const [submitting, setSubmitting] = useState(false);
  const [skuLocked, setSkuLocked] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { status: 'active', unit: 'units', category: 'Metals' },
  });

  useEffect(() => {
    if (!isNew && id) {
      productsApi.get(id).then((p) => {
        reset({
          sku: p.sku,
          name: p.name,
          description: p.description ?? '',
          category: p.category,
          cost_per_unit: Number(p.cost_per_unit),
          reorder_threshold: p.reorder_threshold,
          status: p.status as 'active' | 'inactive',
          unit: (p.inventory?.unit ?? 'units') as 'units' | 'kg' | 'sheets' | 'litres',
        });
        setSkuLocked(true); // SKU is immutable after creation
      });
    }
  }, [id, isNew]);

  const onSubmit = async (values: ProductFormValues) => {
    if (!selectedTenant) {
      toast.error('Please select a tenant first.');
      return;
    }
    setSubmitting(true);
    try {
      if (isNew) {
        const p = await productsApi.create(values);
        toast.success('Product created.');
        navigate(`/products/${p.id}`);
      } else {
        const { sku, unit, ...rest } = values;
        await productsApi.update(id!, rest);
        toast.success('Product updated.');
        navigate(`/products/${id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DetailHeader
        title={isNew ? 'New Product' : 'Edit Product'}
        backTo={isNew ? '/products' : `/products/${id}`}
        backLabel={isNew ? 'Products' : 'Product'}
      />

      <FormCard>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                {...register('sku')}
                disabled={skuLocked}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                placeholder="ALU-001"
              />
              {skuLocked && <p className="text-xs text-gray-400 mt-1">SKU cannot be changed.</p>}
              {errors.sku && <p className="text-xs text-red-600 mt-1">{errors.sku.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                {...register('name')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Aluminium Sheet 2mm"
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                {...register('category')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Unit ($)</label>
              <input
                {...register('cost_per_unit', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.cost_per_unit && <p className="text-xs text-red-600 mt-1">{errors.cost_per_unit.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Threshold</label>
              <input
                {...register('reorder_threshold', { valueAsNumber: true })}
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.reorder_threshold && <p className="text-xs text-red-600 mt-1">{errors.reorder_threshold.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                {...register('status')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {isNew && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure</label>
                <select
                  {...register('unit')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? 'Saving...' : isNew ? 'Create Product' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(isNew ? '/products' : `/products/${id}`)}
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
