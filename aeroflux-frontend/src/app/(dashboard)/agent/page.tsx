'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AgentDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login/agent');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">AeroFlux Agent Dashboard</h1>
            </div>
            <div className="flex items-center">
              <button 
                onClick={() => {
                  localStorage.removeItem('access_token');
                  router.push('/login/agent');
                }}
                className="text-gray-500 hover:text-gray-700 font-medium"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Welcome back, Agent!</h2>
            <p className="text-gray-600 mb-8">Here's an overview of your recent activity and tools.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">My Bookings</h3>
                <p className="text-blue-600 mb-4">Manage your recent flight and hotel bookings.</p>
                <button className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
                  View Bookings
                </button>
              </div>

              <div className="bg-green-50 p-6 rounded-lg border border-green-100">
                <h3 className="text-lg font-semibold text-green-800 mb-2">Travelers</h3>
                <p className="text-green-600 mb-4">Manage traveler profiles and details.</p>
                <button className="text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
                  View Travelers
                </button>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg border border-purple-100">
                <h3 className="text-lg font-semibold text-purple-800 mb-2">Reports</h3>
                <p className="text-purple-600 mb-4">Analytics and performance reports.</p>
                <button className="text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded">
                  View Reports
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

