import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ordersApi } from '@/api/orders';
import { productsApi } from '@/api/products';
import { useTenant } from '@/hooks/useTenant';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { FormCard } from '@/components/ui/FormCard';
import { getErrorMessage } from '@/utils/apiError';
import type { Product } from '@/types/product';

const createSchema = z.object({
  product_id: z.string().min(1, 'Please select a product.'),
  requested_qty: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    if (typeof val === 'number' && Number.isNaN(val)) return undefined;
    return val;
  }, z
    .number({
      required_error: 'Requested quantity is required.',
      invalid_type_error: 'Requested quantity is required.',
    })
    .int('Requested quantity must be a whole number.')
    .positive('Requested quantity must be greater than zero.')),
  notes: z.string().optional(),
});

type OrderCreateValues = z.infer<typeof createSchema>;

export function OrderEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedTenant } = useTenant();
  const isNew = !id || id === 'new';
  const [submitting, setSubmitting] = useState(false);
  const [orderStatus, setOrderStatus] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrderCreateValues>({
    resolver: zodResolver(createSchema),
  });

  useEffect(() => {
    if (isNew && selectedTenant) {
      productsApi.list({ page_size: 100 }).then((res) => {
        setProducts(res.data.filter((p) => p.status === 'active'));
      });
    }
    if (!isNew && id) {
      ordersApi.get(id).then((o) => {
        setOrderStatus(o.status);
        reset({ product_id: o.product_id, requested_qty: o.requested_qty, notes: o.notes ?? '' });
      });
    }
  }, [id, isNew, selectedTenant]);

  const onSubmit = async (values: OrderCreateValues) => {
    if (!selectedTenant) {
      toast.error('Please select a tenant first.');
      return;
    }
    setSubmitting(true);
    try {
      if (isNew) {
        const o = await ordersApi.create({
          product_id: values.product_id,
          requested_qty: values.requested_qty,
          notes: values.notes,
        });
        const statusLabel =
          o.status === 'pending' ? 'Pending'
          : o.status === 'created' ? 'Created'
          : o.status === 'confirmed' ? 'Confirmed'
          : o.status;
        toast.success(`Order ${o.display_id} saved with status ${statusLabel}.`);
        navigate(`/orders/${o.id}`);
      } else {
        const updateData =
          orderStatus === 'confirmed'
            ? { notes: values.notes }
            : { requested_qty: values.requested_qty, notes: values.notes };
        await ordersApi.update(id!, updateData);
        toast.success('Order updated.');
        navigate(`/orders/${id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const qtyReadOnly = !isNew && orderStatus === 'confirmed';

  return (
    <div className="space-y-6">
      <DetailHeader
        title={isNew ? 'New Order' : 'Edit Order'}
        backTo={isNew ? '/orders' : `/orders/${id}`}
        backLabel={isNew ? 'Orders' : 'Order'}
      />

      <FormCard title={isNew ? 'Order Details' : undefined}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
          {isNew && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
                Select Product <span className="text-rose-500">*</span>
              </label>
              <select {...register('product_id')} className="input-field">
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </select>
              {errors.product_id && <p className="text-xs text-rose-600 mt-1">{errors.product_id.message}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
              {isNew ? (
                <>Requested Quantity <span className="text-rose-500">*</span></>
              ) : (
                <>
                  Requested quantity
                  {qtyReadOnly && (
                    <span className="ml-1 text-xs font-normal text-slate-400 dark:text-neutral-500">(read-only — order is confirmed)</span>
                  )}
                </>
              )}
            </label>
            <input
              {...register('requested_qty', { valueAsNumber: true })}
              type="number"
              min="1"
              step="1"
              disabled={qtyReadOnly}
              className="input-field disabled:bg-slate-50 dark:disabled:bg-neutral-950 disabled:cursor-not-allowed"
            />
            {errors.requested_qty && <p className="text-xs text-rose-600 mt-1">{errors.requested_qty.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">Notes (optional)</label>
            <textarea {...register('notes')} rows={3} className="input-field resize-none" />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-neutral-700">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : isNew ? 'Create Order' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(isNew ? '/orders' : `/orders/${id}`)}
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
