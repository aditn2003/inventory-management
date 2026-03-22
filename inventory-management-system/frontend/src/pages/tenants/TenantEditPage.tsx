import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { tenantsApi } from '@/api/tenants';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { FormCard } from '@/components/ui/FormCard';
import { getErrorMessage } from '@/utils/apiError';

const tenantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['active', 'inactive']),
});

type TenantFormValues = z.infer<typeof tenantSchema>;

export function TenantEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { status: 'active' },
  });

  const statusValue = watch('status');

  useEffect(() => {
    if (!isNew && id) {
      tenantsApi.get(id).then((t) => reset({ name: t.name, status: t.status as 'active' | 'inactive' }));
    }
  }, [id, isNew]);

  const onSubmit = async (values: TenantFormValues) => {
    setSubmitting(true);
    try {
      if (isNew) {
        await tenantsApi.create(values);
        toast.success('Tenant created.');
        navigate('/tenants');
      } else {
        await tenantsApi.update(id!, values);
        toast.success('Tenant updated.');
        navigate('/tenants');
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
        title={isNew ? 'New Tenant' : 'Edit Tenant'}
        backTo="/tenants"
        backLabel="Tenants"
      />

      <FormCard title={isNew ? 'Tenant Details' : undefined}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              {...register('name')}
              className="input-field"
              placeholder="Alpha Manufacturing"
            />
            {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-2">Tenant Status</span>
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

          <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-neutral-700">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : isNew ? 'Create' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => navigate('/tenants')} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
