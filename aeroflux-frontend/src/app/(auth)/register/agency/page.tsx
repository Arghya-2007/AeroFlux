'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService, RegisterAgencyDto } from '@/lib/services/auth.service';

export default function RegisterAgencyPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState<RegisterAgencyDto>({
    agencyName: '',
    agencyAddress: '',
    supportEmail: '',
    supportPhone: '',
    agencyAdminName: '',
    agencyAdminEmail: '',
    agencyAdminPassword: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.registerAgency(formData);
      router.push('/login/agency-admin');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Register Agency</h1>
          <p className="text-gray-500 text-sm">Create a new agency and admin account</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Agency Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Agency Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agency Name *</label>
                <input
                  type="text"
                  name="agencyName"
                  required
                  value={formData.agencyName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agency Address</label>
                <input
                  type="text"
                  name="agencyAddress"
                  value={formData.agencyAddress}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Support Email *</label>
                <input
                  type="email"
                  name="supportEmail"
                  required
                  value={formData.supportEmail}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Support Phone</label>
                <input
                  type="text"
                  name="supportPhone"
                  value={formData.supportPhone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Admin Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 border-b pb-2">Admin Details</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name *</label>
                <input
                  type="text"
                  name="agencyAdminName"
                  required
                  value={formData.agencyAdminName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email *</label>
                <input
                  type="email"
                  name="agencyAdminEmail"
                  required
                  value={formData.agencyAdminEmail}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password *</label>
                <input
                  type="password"
                  name="agencyAdminPassword"
                  required
                  minLength={8}
                  value={formData.agencyAdminPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 mt-6"
          >
            {isLoading ? 'Registering...' : 'Register Agency'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an agency?{' '}
          <Link href="/login/agency-admin" className="font-semibold text-blue-600 hover:text-blue-500">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}

