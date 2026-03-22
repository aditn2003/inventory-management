import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Cube } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { authApi } from '@/api/auth';
import { useAppDispatch } from '@/store/hooks';
import { logout, setCredentials } from '@/store/authSlice';
import { getErrorMessage } from '@/utils/apiError';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Google sign-in was cancelled.',
  invalid_or_expired_state: 'Sign-in session expired. Please try again.',
  missing_code_or_state: 'Invalid response from Google. Please try again.',
  google_token_exchange_failed: 'Could not complete Google sign-in. Try again later.',
  no_access_token: 'Could not complete Google sign-in. Try again later.',
  email_not_verified: 'Your Google account email must be verified to sign in.',
  incomplete_profile: 'Google did not return enough profile information to sign you in.',
  login_not_allowed:
    'Google sign-in is not allowed for this account. Contact your system administrator.',
  invite_email_mismatch:
    'Use the Google account whose email matches the invitation. If you use a different Google account, sign out of Google in your browser and try again.',
  invalid_invite: 'This invitation is invalid or has expired.',
  missing_invite: 'Invitation data was missing. Open your invite link and try Google sign-in again.',
};

function describeOAuthError(code: string): string {
  return OAUTH_ERROR_MESSAGES[code] ?? code.replace(/_/g, ' ');
}

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const ran = useRef(false);
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const oauthError = searchParams.get('oauth_error');
    const code = searchParams.get('code');

    if (oauthError) {
      toast.error(describeOAuthError(oauthError));
      navigate('/login', { replace: true });
      return;
    }

    if (!code) {
      toast.error('Missing sign-in code. Return to the login page and try again.');
      navigate('/login', { replace: true });
      return;
    }

    (async () => {
      try {
        dispatch(logout());
        const tokens = await authApi.completeGoogleOAuth(code);
        dispatch(
          setCredentials({
            user: { id: '', name: '', role: 'user', created_at: '' },
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          }),
        );
        const user = await authApi.me();
        dispatch(
          setCredentials({
            user,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          }),
        );
        toast.success(`Welcome, ${user.name || 'back'}!`);
        navigate(user.role === 'admin' ? '/tenants' : '/products', { replace: true });
      } catch (err) {
        setMessage('Sign-in failed');
        toast.error(getErrorMessage(err));
        navigate('/login', { replace: true });
      }
    })();
  }, [dispatch, navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <Cube size={28} weight="fill" className="text-blue-600" />
          <span className="text-lg font-semibold text-gray-900">IMS</span>
        </div>
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}
