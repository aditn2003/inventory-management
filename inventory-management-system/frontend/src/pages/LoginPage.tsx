import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Navigate } from 'react-router-dom';
import { Cube, Eye, EyeSlash, Package, Stack, ShoppingCart } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { authApi } from '@/api/auth';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/authSlice';
import { useAuth } from '@/hooks/useAuth';
import { getErrorMessage } from '@/types/api';

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
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      const tokenData = await authApi.login(values);
      dispatch(setCredentials({
        user: { id: '', name: '', role: 'user', created_at: '' },
        accessToken: tokenData.access_token,
      }));
      const user = await authApi.me();
      dispatch(setCredentials({ user, accessToken: tokenData.access_token }));
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500
        relative overflow-hidden flex-col justify-between p-12">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Cube size={24} weight="fill" className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">IMS</span>
          </div>
        </div>

        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Inventory<br />Management<br />System
          </h2>
          <p className="text-primary-100 text-lg leading-relaxed max-w-sm">
            Streamline your multi-tenant inventory, products, and orders in one powerful platform.
          </p>

          <div className="mt-10 space-y-3">
            {[
              { icon: <Package size={18} />, text: 'Product catalog management' },
              { icon: <Stack size={18} />, text: 'Real-time stock tracking' },
              { icon: <ShoppingCart size={18} />, text: 'Order lifecycle automation' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 text-primary-100">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  {f.icon}
                </div>
                <span className="text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-primary-200 text-xs">
          Secure multi-tenant platform with role-based access.
        </p>

        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-12 w-32 h-32 rounded-full bg-white/5" />
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-surface dark:bg-neutral-950">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
              <Cube size={22} weight="fill" className="text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-neutral-100">IMS</span>
          </div>

          <div className="card p-8 shadow-elevated">
            <h1 className="text-xl font-bold text-slate-900 dark:text-neutral-100 mb-1">Welcome back</h1>
            <p className="text-sm text-slate-500 dark:text-neutral-400 mb-7">Enter your credentials to continue</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="admin@ims.com"
                  className="input-field"
                />
                {errors.email && <p className="text-xs text-rose-600 mt-1.5">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="input-field pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300
                      transition-colors"
                  >
                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-rose-600 mt-1.5">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="relative my-7">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-neutral-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-white dark:bg-neutral-900 px-3 text-slate-400 dark:text-neutral-500">Or</span>
              </div>
            </div>

            {googleOAuth === 'on' ? (
              <a
                href="/api/v1/auth/google/start"
                className="btn-secondary w-full justify-center"
                aria-label="Sign in with Google"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </a>
            ) : googleOAuth === 'loading' ? (
              <button
                type="button"
                disabled
                className="btn-secondary w-full justify-center opacity-50 cursor-not-allowed"
                aria-label="Sign in with Google"
              >
                <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 dark:border-neutral-600 border-t-slate-500 dark:border-t-neutral-400 animate-spin" />
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
                className="btn-secondary w-full justify-center border-dashed opacity-70 hover:opacity-100"
                aria-label="Sign in with Google unavailable"
              >
                <svg className="h-5 w-5 shrink-0 opacity-50" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
            )}

            <p className="text-xs text-slate-400 dark:text-neutral-500 mt-5 text-center">
              Demo: admin@ims.com / admin123!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
