import { api } from '@/lib/api';

// Types derived from AuthController DTOs

export interface LoginDto {
  email?: string;
  password?: string;
  agencyAdminEmail?: string;
  agencyAdminPassword?: string;
}

export interface AgencyLoginDto {
  agencyAdminEmail: string;
  agencyAdminPassword: string;
}

export interface RegisterAgencyDto {
  agencyName: string;
  agencyAdminFirstName: string;
  agencyAdminLastName: string;
  agencyAdminEmail: string;
  agencyAdminPassword: string;
}

export interface RegisterAgentDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface RegisterAgencyAgentDto {
  agencyId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refresh_token: string;
}

export const authService = {
  // AGENCY ADMIN
  registerAgency: async (data: RegisterAgencyDto) => {
    const response = await api.post('/auth/agency/register', data);
    return response.data;
  },

  loginAgency: async (data: AgencyLoginDto) => {
    const response = await api.post('/auth/agency/login', data);
    return response.data;
  },

  // AGENCY AGENT
  registerAgencyAgent: async (data: RegisterAgencyAgentDto) => {
    const response = await api.post('/auth/agency-agent/register', data);
    return response.data;
  },

  loginAgencyAgent: async (data: LoginDto) => {
    const response = await api.post('/auth/agency-agent/login', data);
    return response.data;
  },

  // INDIVIDUAL AGENT
  registerAgent: async (data: RegisterAgentDto) => {
    const response = await api.post('/auth/agent/register', data);
    return response.data;
  },

  loginAgent: async (data: LoginDto) => {
    const response = await api.post('/auth/agent/login', data);
    return response.data;
  },

  // GENERAL AUTH
  refreshToken: async (data: RefreshTokenDto) => {
    const response = await api.post('/auth/refresh-token', data);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  // MFA
  setupMfa: async () => {
    const response = await api.post('/auth/mfa/setup');
    return response.data;
  },

  enableMfa: async (token: string) => {
    const response = await api.post('/auth/mfa/enable', { token });
    return response.data;
  },

  verifyMfa: async (mfaToken: string, code: string) => {
    const response = await api.post('/auth/mfa/verify', { mfaToken, code });
    return response.data;
  },
};

