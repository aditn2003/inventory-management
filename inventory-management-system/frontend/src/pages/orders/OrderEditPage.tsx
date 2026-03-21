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

const editCreatedSchema = z.object({
  notes: z.string().optional(),
});

const editPendingSchema = z.object({
  requested_qty: z.number({ coerce: true }).int().positive('Qty must be positive'),
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
          o.status === 'pending'
            ? 'Pending'
            : o.status === 'created'
              ? 'Created'
              : o.status === 'confirmed'
                ? 'Confirmed'
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

      <FormCard>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
          {isNew && (
            <div>
              <label htmlFor="order-product" className="block text-sm font-medium text-gray-700 mb-1">
                Select Product <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <select
                id="order-product"
                {...register('product_id')}
                required
                aria-required="true"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
              {errors.product_id && <p className="text-xs text-red-600 mt-1">{errors.product_id.message}</p>}
            </div>
          )}

          <div>
            <label htmlFor="order-requested-qty" className="block text-sm font-medium text-gray-700 mb-1">
              {isNew ? (
                <>
                  Requested Quantity <span className="text-red-600" aria-hidden="true">*</span>
                </>
              ) : (
                <>
                  Requested quantity
                  {qtyReadOnly && (
                    <span className="ml-1 text-xs font-normal text-gray-400">(read-only — order is confirmed)</span>
                  )}
                </>
              )}
            </label>
            <input
              id="order-requested-qty"
              {...register('requested_qty', { valueAsNumber: true })}
              type="number"
              min="1"
              step="1"
              required={isNew && !qtyReadOnly}
              aria-required={isNew && !qtyReadOnly}
              disabled={qtyReadOnly}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
            {errors.requested_qty && <p className="text-xs text-red-600 mt-1">{errors.requested_qty.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              {...register('notes')}
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
              {submitting ? 'Saving...' : isNew ? 'Create Order' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(isNew ? '/orders' : `/orders/${id}`)}
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
