import Link from 'next/link';

export default function RegisterSelectionPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 md:p-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Create your AeroFlux Account
          </h1>
          <p className="text-gray-500 mb-10 max-w-xl mx-auto">
            Choose how you want to use AeroFlux. Whether you're managing an entire travel agency or working independently, we have the right tools for you.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Agency Option */}
            <Link 
              href="/register/agency"
              className="group relative flex flex-col items-center p-8 border-2 border-gray-200 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all text-center"
            >
              <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Register Agency</h2>
              <p className="text-sm text-gray-500">
                For travel agencies with multiple team members. Manage agents, shared bookings, and company-wide itineraries.
              </p>
            </Link>

            {/* Agency-Agent Option */}
            <Link 
              href="/register/agency-agent"
              className="group relative flex flex-col items-center p-8 border-2 border-gray-200 rounded-xl hover:border-teal-600 hover:bg-teal-50 transition-all text-center"
            >
              <div className="h-16 w-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Register Agency-Agent</h2>
              <p className="text-sm text-gray-500">
                For agents joining an existing travel agency. Collaborate with your team and manage agency clients.
              </p>
            </Link>

            {/* Agent Option */}
            <Link 
              href="/register/agent"
              className="group relative flex flex-col items-center p-8 border-2 border-gray-200 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all text-center"
            >
              <div className="h-16 w-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Register Agent</h2>
              <p className="text-sm text-gray-500">
                For independent travel agents and self-employed professionals. Manage your own clients and itineraries.
              </p>
            </Link>
          </div>

          <div className="mt-10 pt-8 border-t border-gray-100">
            <p className="text-gray-500">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
