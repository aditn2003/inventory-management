import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Navigate } from 'react-router-dom';
import { Cube, Eye, EyeSlash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { authApi } from '@/api/auth';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/authSlice';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/utils/apiError';
const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { accessToken, user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleOAuth, setGoogleOAuth] = useState<'loading' | 'on' | 'off'>('loading');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    let cancelled = false;
    authApi
      .googleOAuthStatus()
      .then((s) => {
        if (!cancelled) setGoogleOAuth(s.enabled ? 'on' : 'off');
      })
      .catch(() => {
        if (!cancelled) setGoogleOAuth('off');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (accessToken && user) {
    const home = user.role === 'admin' ? '/tenants' : '/products';
    return <Navigate to={home} replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      const tokenData = await authApi.login(values);

      // Temporarily set the token in the store so the /me request uses it
      dispatch(setCredentials({
        user: { id: '', name: '', role: 'user', created_at: '' },
        accessToken: tokenData.access_token,
      }));

      const user = await authApi.me();
      dispatch(setCredentials({ user, accessToken: tokenData.access_token }));
      navigate(user.role === 'admin' ? '/tenants' : '/products');
      toast.success(`Welcome, ${user.name || 'back'}!`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Cube size={32} weight="fill" className="text-blue-600" />
          <span className="text-2xl font-bold text-gray-900">IMS</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h1>
          <p className="text-sm text-gray-500 mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="admin@ims.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-white px-2 text-gray-400">Or</span>
            </div>
          </div>

          {googleOAuth === 'on' ? (
            <a
              href="/api/v1/auth/google/start"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              aria-label="Sign in with Google"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </a>
          ) : googleOAuth === 'loading' ? (
            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-400"
              aria-label="Sign in with Google"
            >
              <span className="h-5 w-5 shrink-0 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
              Sign in with Google
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                toast('Google sign-in is not configured', {
                  description:
                    'Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET on the server, or sign in with email and password.',
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100"
              aria-label="Sign in with Google unavailable"
            >
              <svg className="h-5 w-5 shrink-0 opacity-50" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>
          )}

          <p className="text-xs text-gray-400 mt-4 text-center">
            Demo: admin@ims.com / admin123!
          </p>
        </div>
      </div>
    </div>
  );
}
