'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/services/auth.service';

export default function AgencyAgentLoginPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Security elements
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await authService.verifyMfaLogin(mfaCode);
      localStorage.setItem('access_token', data.access_token || data.accessToken);
      router.push('/agency-agent');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'MFA Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaRequired && !captchaToken) {
      setError('Please complete the captcha');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const data = await authService.loginAgencyAgent({
        email,
        password,
        captchaToken: captchaRequired ? captchaToken : undefined,
      });

      if (data.mfaPending) {
        setMfaRequired(true);
      } else {
        localStorage.setItem('access_token', data.access_token || data.accessToken);
        router.push('/agency-agent');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      if (msg === 'CAPTCHA_REQUIRED') {
        setCaptchaRequired(true);
        setError('Too many failed attempts. Please solve the captcha to continue.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (mfaRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h1>
            <p className="text-gray-500 text-sm">Enter the code from your authenticator app</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Authenticator Code
              </label>
              <input
                type="text"
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="000000"
                maxLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 mt-6"
            >
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button
               type="button"
               onClick={() => {
                 setMfaRequired(false);
                 setMfaCode('');
               }}
               className="w-full text-blue-600 bg-transparent py-2.5 font-semibold mt-2"
            >
              Back to Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Agency Staff Login</h1>
          <p className="text-gray-500 text-sm">Please sign in to your staff account</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="staff@agency.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {captchaRequired && (
            <div className="mt-4 p-4 border rounded-lg bg-gray-50 flex flex-col items-center">
              <span className="text-sm text-gray-600 mb-2">Security Check Required</span>
              <input
                type="text"
                placeholder="Enter mock captcha token (e.g., bypass)"
                value={captchaToken}
                onChange={(e) => setCaptchaToken(e.target.value)}
                className="w-full px-3 py-2 border text-sm rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 mt-6"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
