import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Cube, Eye, EyeSlash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { authApi } from '@/api/auth';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/authSlice';
import { getErrorMessage } from '@/utils/apiError';

const schema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function RegisterInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(!!token);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!token) {
      setPreviewLoading(false);
      setPreviewError('Missing invitation link. Open the link from your email.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await authApi.previewInvite(token);
        if (!cancelled) {
          setEmail(data.email);
          setPreviewError(null);
        }
      } catch {
        if (!cancelled) {
          setPreviewError('This invitation is invalid or has expired. Ask an admin for a new invite.');
          setEmail(null);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (values: FormValues) => {
    if (!token || !email) return;
    setSubmitting(true);
    try {
      await authApi.registerWithInvite({
        token,
        name: values.name.trim(),
        password: values.password,
      });
      const loginRes = await authApi.login({ email, password: values.password });
      dispatch(
        setCredentials({
          user: { id: '', name: '', role: 'user', created_at: '' },
          accessToken: loginRes.access_token,
        }),
      );
      const user = await authApi.me();
      dispatch(setCredentials({ user, accessToken: loginRes.access_token }));
      toast.success(`Welcome, ${user.name}!`);
      navigate('/tenants');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Cube size={32} weight="fill" className="text-blue-600" />
          <span className="text-2xl font-bold text-gray-900">IMS</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Complete your account</h1>
          <p className="text-sm text-gray-500 mb-6">Choose your display name and password</p>

          {previewLoading && (
            <div className="animate-pulse h-24 bg-gray-100 rounded-lg mb-4" />
          )}

          {!previewLoading && previewError && (
            <div className="rounded-lg bg-red-50 text-red-800 text-sm p-4 mb-4">
              {previewError}
              <div className="mt-3">
                <Link to="/login" className="text-blue-600 font-medium hover:underline">
                  Back to sign in
                </Link>
              </div>
            </div>
          )}

          {!previewLoading && email && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
                <input
                  {...register('name')}
                  type="text"
                  autoComplete="name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  {...register('confirmPassword')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}

          <p className="text-xs text-gray-400 mt-4 text-center">
            <Link to="/login" className="text-blue-600 hover:underline">
              Already have an account? Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
