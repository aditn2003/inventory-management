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
  product_id: z.string().min(1, 'Product is required'),
  requested_qty: z.number({ coerce: true }).int().positive('Qty must be positive'),
  notes: z.string().optional(),
  order_date: z.string().optional(),
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
        reset({ product_id: o.product_id, requested_qty: o.requested_qty, notes: o.notes ?? '', order_date: o.order_date });
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
          order_date: values.order_date,
        });
        toast.success(`Order ${o.display_id} created (${o.status}).`);
        navigate(`/orders/${o.id}`);
      } else {
        const updateData =
          orderStatus === 'created'
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

  const qtyReadOnly = !isNew && orderStatus === 'created';

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
              <select
                {...register('product_id')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select active product...</option>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
              {qtyReadOnly && <span className="ml-1 text-xs text-gray-400">(read-only — order is confirmed)</span>}
            </label>
            <input
              {...register('requested_qty', { valueAsNumber: true })}
              type="number"
              min="1"
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

          {isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Date (optional)</label>
              <input
                {...register('order_date')}
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

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
