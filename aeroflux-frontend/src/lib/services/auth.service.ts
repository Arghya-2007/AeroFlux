import { api } from '@/lib/api';

/**
 * Note on CSRF Protection with Next.js frontend fetch() / axios:
 * Requests must include `credentials: 'include'` (or `withCredentials: true` in axios)
 * and the `X-CSRF-Token` header obtained from the `csrfToken` cookie, for example:
 * 
 * const getCsrfToken = () => document.cookie.split('; ').find(row => row.startsWith('csrfToken='))?.split('=')[1];
 *
 * fetch('/api/proxy/auth/...', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-CSRF-Token': getCsrfToken() || ''
 *   },
 *   credentials: 'include',
 *   body: JSON.stringify(data)
 * });
 */

const getCsrfHeaders = () => {
  if (typeof document !== 'undefined') {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrfToken='))
      ?.split('=')[1];
    return token ? { 'X-CSRF-Token': token } : {};
  }
  return {};
};

// Types derived from AuthController DTOs

export interface LoginDto {
  email?: string;
  password?: string;
  agencyAdminEmail?: string;
  agencyAdminPassword?: string;
  captchaToken?: string;
}

export interface AgencyLoginDto {
  agencyAdminEmail: string;
  agencyAdminPassword: string;
  captchaToken?: string;
}

export interface RegisterAgencyDto {
  agencyName: string;
  agencyAddress?: string;
  supportEmail: string;
  supportPhone?: string;
  agencyAdminName: string;
  agencyAdminEmail: string;
  agencyAdminPassword: string;
}

export interface RegisterAgentDto {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  password: string;
}

export interface RegisterAgencyAgentDto {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: 'ADMIN' | 'AGENT';
  agencyPublicId: string;
  agencySecret: string;
}

export interface RefreshTokenDto {
  refresh_token: string;
}

export const authService = {
  // AGENCY ADMIN
  registerAgency: async (data: RegisterAgencyDto) => {
    const response = await api.post('/auth/agency/register', data, { headers: getCsrfHeaders() });
    return response.data;
  },

  loginAgency: async (data: AgencyLoginDto) => {
    const response = await api.post('/auth/agency/login', data, { headers: getCsrfHeaders() });
    return response.data;
  },

  // AGENCY AGENT
  registerAgencyAgent: async (data: RegisterAgencyAgentDto) => {
    const response = await api.post('/auth/agency-agent/register', data, { headers: getCsrfHeaders() });
    return response.data;
  },

  loginAgencyAgent: async (data: LoginDto) => {
    const response = await api.post('/auth/agency-agent/login', data, { headers: getCsrfHeaders() });
    return response.data;
  },

  // INDIVIDUAL AGENT
  registerAgent: async (data: RegisterAgentDto) => {
    const response = await api.post('/auth/agent/register', data, { headers: getCsrfHeaders() });
    return response.data;
  },

  loginAgent: async (data: LoginDto) => {
    const response = await api.post('/auth/agent/login', data, { headers: getCsrfHeaders() });
    return response.data;
  },

  // GENERAL AUTH
  refreshToken: async (data: RefreshTokenDto) => {
    const response = await api.post('/auth/refresh-token', data, { headers: getCsrfHeaders() });
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout', {}, { headers: getCsrfHeaders() });
    return response.data;
  },

  // MFA
  setupMfa: async () => {
    const response = await api.post('/auth/mfa/setup', {}, { headers: getCsrfHeaders() });
    return response.data;
  },

  enableMfa: async (token: string) => {
    const response = await api.post('/auth/mfa/enable', { token }, { headers: getCsrfHeaders() });
    return response.data;
  },

  verifyMfaLogin: async (code: string, isRecoveryCode: boolean = false) => {
    const response = await api.post('/auth/mfa/verify-login', { code, isRecoveryCode }, { headers: getCsrfHeaders() });
    return response.data;
  },

  // EMAIL VERIFICATION (POST — no longer a GET to prevent img-tag preloading)
  verifyEmail: async (token: string, type: 'agency' | 'agency-agent' | 'agent') => {
    const response = await api.post('/auth/verify-email', { token, type }, { headers: getCsrfHeaders() });
    return response.data;
  },
};
