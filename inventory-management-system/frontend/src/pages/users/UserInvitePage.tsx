import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { usersApi } from '@/api/users';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { FormCard } from '@/components/ui/FormCard';
import { getErrorMessage } from '@/utils/apiError';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});

type FormValues = z.infer<typeof schema>;

export function UserInvitePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const res = await usersApi.sendInvitation({ email: values.email.trim() });
      toast.success(res.message);
      navigate('/users');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DetailHeader
        title="Invite user"
        subtitle="They'll get an email to choose their own name and password. New accounts are created as User role."
        backTo="/users"
        backLabel="Users"
      />

      <FormCard title="Send Invitation">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
              Email address <span className="text-rose-500">*</span>
            </label>
            <input
              {...register('email')}
              type="email"
              autoComplete="off"
              className="input-field"
              placeholder="colleague@company.com"
            />
            {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
            <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1.5">
              The server must have <code className="text-xs bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">RESEND_API_KEY</code> set;
              otherwise invitations cannot be sent.
            </p>
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-neutral-700">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </span>
              ) : 'Send invitation'}
            </button>
            <button type="button" onClick={() => navigate('/users')} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
