export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
