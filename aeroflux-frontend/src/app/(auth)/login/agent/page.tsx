'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/lib/services/auth.service';

export default function LoginPage() {
  const router = useRouter();
  
  // State for login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState<'agent' | 'agency' | 'agency_agent'>('agent');
  
  // State for MFA
  const [isMfaStep, setIsMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isMfaStep) {
        const data = await authService.verifyMfa(mfaToken, mfaCode);
        localStorage.setItem('access_token', data.access_token || data.accessToken);
        router.push('/dashboard');
        return;
      }

      let data;
      if (userType === 'agency') {
        data = await authService.loginAgency({
          agencyAdminEmail: email,
          agencyAdminPassword: password,
        });
      } else if (userType === 'agency_agent') {
        data = await authService.loginAgencyAgent({ email, password });
      } else {
        data = await authService.loginAgent({ email, password });
      }

      if (data.mfa_token) {
        setMfaToken(data.mfa_token);
        setIsMfaStep(true);
      } else {
        localStorage.setItem('access_token', data.access_token || data.accessToken);
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-500 text-sm">Please sign in to your account</p>
        </div>

        {!isMfaStep && (
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          <button
            type="button"
            className={`flex-1 text-sm py-2 rounded-md transition-all font-medium ${
              userType === 'agent' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setUserType('agent')}
          >
            Agent
          </button>
          <button
            type="button"
            className={`flex-1 text-sm py-2 rounded-md transition-all font-medium ${
              userType === 'agency' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setUserType('agency')}
          >
            Agency
          </button>
          <button
            type="button"
            className={`flex-1 text-sm py-2 rounded-md transition-all font-medium ${
              userType === 'agency_agent' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setUserType('agency_agent')}
          >
            Staff
          </button>
        </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isMfaStep ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Two-Factor Authentication Code
              </label>
              <input
                type="text"
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="123456"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 mt-6"
          >
            {isLoading ? (isMfaStep ? 'Verifying...' : 'Signing in...') : (isMfaStep ? 'Verify MFA' : 'Sign in')}
          </button>
        </form>

        {!isMfaStep && (
          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
