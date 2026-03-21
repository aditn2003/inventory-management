import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@/types/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem('ims_user') ?? 'null'),
  accessToken: localStorage.getItem('ims_access_token'),
  refreshToken: localStorage.getItem('ims_refresh_token'),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ user: User; accessToken: string; refreshToken?: string }>
    ) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
        localStorage.setItem('ims_refresh_token', action.payload.refreshToken);
      }
      localStorage.setItem('ims_user', JSON.stringify(action.payload.user));
      localStorage.setItem('ims_access_token', action.payload.accessToken);
    },
    updateAccessToken(state, action: PayloadAction<{ accessToken: string; refreshToken?: string }>) {
      state.accessToken = action.payload.accessToken;
      localStorage.setItem('ims_access_token', action.payload.accessToken);
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
        localStorage.setItem('ims_refresh_token', action.payload.refreshToken);
      }
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      localStorage.removeItem('ims_user');
      localStorage.removeItem('ims_access_token');
      localStorage.removeItem('ims_refresh_token');
    },
  },
});

export const { setCredentials, updateAccessToken, logout } = authSlice.actions;
export default authSlice.reducer;
