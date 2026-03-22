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
  const [googleOAuth, setGoogleOAuth] = useState<'loading' | 'on' | 'off'>('loading');

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

  useEffect(() => {
    const err = searchParams.get('invite_oauth_error');
    if (!err) return;
    const inviteErrMessages: Record<string, string> = {
      invalid_invite: 'Google sign-in could not start — this invitation is invalid or expired.',
    };
    toast.error(inviteErrMessages[err] ?? 'Could not start Google sign-in.');
    const t = searchParams.get('token') ?? token;
    navigate(t ? `/register/invite?token=${encodeURIComponent(t)}` : '/register/invite', {
      replace: true,
    });
  }, [searchParams, navigate, token]);

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
      navigate('/products');
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

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wide">
                  <span className="bg-white px-2 text-gray-400">Or</span>
                </div>
              </div>

              {googleOAuth === 'on' ? (
                <>
                  <a
                    href={`/api/v1/auth/google/start?invite_token=${encodeURIComponent(token)}`}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                    aria-label="Continue with Google"
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
                    Continue with Google
                  </a>
                  <p className="text-xs text-center text-gray-500 mt-2">
                    Use the Google account for <span className="font-medium text-gray-700">{email}</span>.
                  </p>
                </>
              ) : googleOAuth === 'loading' ? (
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-2.5 text-sm font-medium text-gray-400"
                  aria-label="Continue with Google"
                >
                  <span className="h-5 w-5 shrink-0 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
                  Continue with Google
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      toast('Google sign-in is not configured', {
                        description:
                          'Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET on the server, or create your account with a password above.',
                      })
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100"
                    aria-label="Continue with Google unavailable"
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
                    Continue with Google
                  </button>
                  <p className="text-xs text-center text-gray-500 mt-2">
                    Use the Google account for <span className="font-medium text-gray-700">{email}</span> when enabled.
                  </p>
                </>
              )}
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
