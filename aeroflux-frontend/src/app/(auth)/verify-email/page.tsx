'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const type = searchParams.get('type');

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        if (!token || !type) {
            setStatus('error');
            return;
        }

        api.post('/auth/verify-email', { token, type })
            .then(() => setStatus('success'))
            .catch(() => setStatus('error'));
    }, [token, type]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <div className="p-8 bg-white shadow-md rounded-lg text-center max-w-md w-full">
                <h1 className="text-2xl font-bold mb-4 flex items-center justify-center">
                    AeroFlux Verification
                </h1>

                {status === 'loading' && (
                    <p className="text-gray-600">Verifying your email address, please wait...</p>
                )}

                {status === 'success' && (
                    <div>
                        <div className="text-green-500 mb-4">
                            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Email Verified!</h2>
                        <p className="mb-6 text-gray-600">Your email has been successfully verified.</p>
                        <Link href="/login" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                            Go to Login
                        </Link>
                    </div>
                )}

                {status === 'error' && (
                    <div>
                         <div className="text-red-500 mb-4">
                            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Verification Failed</h2>
                        <p className="mb-6 text-gray-600">The verification link is invalid or has expired.</p>
                        <Link href="/login" className="inline-block px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition">
                            Back to Login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen grid items-center justify-center">Loading...</div>}>
            <VerifyEmailContent />
        </Suspense>
    );
}

