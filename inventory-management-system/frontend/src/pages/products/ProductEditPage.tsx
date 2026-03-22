import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { productsApi } from '@/api/products';
import { useTenant } from '@/hooks/useTenant';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { FormCard } from '@/components/ui/FormCard';
import { CreatableCombobox } from '@/components/ui/CreatableCombobox';
import { getErrorMessage } from '@/utils/apiError';
import { DEFAULT_CATEGORIES, DEFAULT_UNITS } from '@/utils/constants';

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  cost_per_unit: z.number({ coerce: true }).positive('Must be positive'),
  reorder_threshold: z.number({ coerce: true }).int().min(0, 'Must be 0 or more'),
  status: z.enum(['active', 'inactive']),
  unit: z.string().min(1).optional(),
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
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { status: 'active', unit: 'units', category: '' },
  });

  const statusValue = watch('status');

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
          unit: p.inventory?.unit ?? 'units',
        });
        setSkuLocked(true);
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

      <FormCard title={isNew ? 'Product Details' : undefined}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
                SKU <span className="text-rose-500">*</span>
              </label>
              <input
                {...register('sku')}
                disabled={skuLocked}
                className="input-field disabled:bg-slate-50 dark:disabled:bg-neutral-950 disabled:cursor-not-allowed"
                placeholder="ALU-001"
              />
              {skuLocked && <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">SKU cannot be changed after creation.</p>}
              {errors.sku && <p className="text-xs text-rose-600 mt-1">{errors.sku.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                {...register('name')}
                className="input-field"
                placeholder="Aluminium Sheet 2mm"
              />
              {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
                Category <span className="text-rose-500">*</span>
              </label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <CreatableCombobox
                    value={field.value}
                    onChange={field.onChange}
                    options={DEFAULT_CATEGORIES}
                    placeholder="Select or create category..."
                    createLabel="Add category"
                  />
                )}
              />
              {errors.category && <p className="text-xs text-rose-600 mt-1">{errors.category.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
                Cost per Unit <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 text-sm pointer-events-none">$</span>
                <input
                  {...register('cost_per_unit', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input-field pl-7"
                />
              </div>
              {errors.cost_per_unit && <p className="text-xs text-rose-600 mt-1">{errors.cost_per_unit.message}</p>}
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1">
                Reorder Threshold <span className="text-rose-500">*</span>
              </label>
              <p className="text-xs text-slate-400 dark:text-neutral-500 mb-1.5">
                The inventory level at which a new purchase should be triggered.
              </p>
              <input
                {...register('reorder_threshold', { valueAsNumber: true })}
                type="number"
                min="0"
                className="input-field max-w-xs"
              />
              {errors.reorder_threshold && <p className="text-xs text-rose-600 mt-1">{errors.reorder_threshold.message}</p>}
            </div>

            <div className="col-span-2">
              <span className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">Product Status</span>
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-neutral-700 p-1 bg-slate-50/80 dark:bg-neutral-950/80">
                <button
                  type="button"
                  onClick={() => setValue('status', 'active', { shouldValidate: true, shouldDirty: true })}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    statusValue === 'active'
                      ? 'bg-white dark:bg-neutral-900 text-primary-700 dark:text-primary-300 shadow-sm ring-1 ring-slate-200/80 dark:ring-neutral-700/80'
                      : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setValue('status', 'inactive', { shouldValidate: true, shouldDirty: true })}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    statusValue === 'inactive'
                      ? 'bg-white dark:bg-neutral-900 text-primary-700 dark:text-primary-300 shadow-sm ring-1 ring-slate-200/80 dark:ring-neutral-700/80'
                      : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300'
                  }`}
                >
                  Inactive
                </button>
              </div>
            </div>

            {isNew && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">Unit of Measure</label>
                <Controller
                  name="unit"
                  control={control}
                  render={({ field }) => (
                    <CreatableCombobox
                      value={field.value ?? 'units'}
                      onChange={field.onChange}
                      options={DEFAULT_UNITS}
                      placeholder="Select or create unit..."
                      createLabel="Add unit"
                    />
                  )}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">Description (optional)</label>
            <textarea
              {...register('description')}
              rows={3}
              className="input-field resize-none"
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-neutral-700">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : isNew ? 'Create Product' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(isNew ? '/products' : `/products/${id}`)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
