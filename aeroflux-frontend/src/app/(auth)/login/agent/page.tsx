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
  
  // State for MFA
  const [isMfaStep, setIsMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  
  // State for Captcha
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMfaStep && captchaRequired && !captchaToken) {
      setError('Please complete the captcha');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      if (isMfaStep) {
        const data = await authService.verifyMfaLogin(mfaCode);
        localStorage.setItem('access_token', data.access_token || data.accessToken);
        router.push('/agent');
        return;
      }

      const data = await authService.loginAgent({ 
        email, 
        password,
        captchaToken: captchaRequired ? captchaToken : undefined
      });

      if (data.mfaPending) {
        setIsMfaStep(true);
      } else {
        localStorage.setItem('access_token', data.access_token || data.accessToken);
        router.push('/agent');
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Agent Login</h1>
          <p className="text-gray-500 text-sm">Please sign in to your agent account</p>
        </div>

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
                  placeholder="agent@example.com"
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
            <Link href="/register/agent" className="font-semibold text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
