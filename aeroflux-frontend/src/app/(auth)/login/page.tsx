import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">Welcome to AeroFlux</h1>
          <p className="text-lg text-gray-600">Please select your account type to sign in.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Link 
            href="/login/agency-admin"
            className="flex flex-col p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-500 transition-all text-center group"
          >
            <h2 className="text-xl font-semibold mb-2 group-hover:text-blue-600">Agency Admin</h2>
            <p className="text-sm text-gray-500">Manage your travel agency, agents, and analytics.</p>
          </Link>

          <Link 
            href="/login/agency-agent"
            className="flex flex-col p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:blue-500 transition-all text-center group"
          >
            <h2 className="text-xl font-semibold mb-2 group-hover:text-blue-600">Agency Agent</h2>
            <p className="text-sm text-gray-500">Log in as a staff member of a registered agency.</p>
          </Link>

          <Link 
            href="/login/agent"
            className="flex flex-col p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:blue-500 transition-all text-center group"
          >
            <h2 className="text-xl font-semibold mb-2 group-hover:text-blue-600">Independent Agent</h2>
            <p className="text-sm text-gray-500">Log in as a freelance or independent travel agent.</p>
          </Link>
        </div>
        
        <div className="mt-12 text-sm text-gray-500">
          Don't have an account? <Link href="/register" className="text-blue-600 hover:underline">Register here</Link>
        </div>
      </div>
    </div>
  );
}

