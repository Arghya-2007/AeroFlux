import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateToken, signToken, verifyToken } from './lib/csrf';

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const isDev = process.env.NODE_ENV !== 'production';
  
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    connect-src 'self' ${apiUrl};
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const isAuthProxyPostRoute =
    request.nextUrl.pathname.startsWith('/api/proxy/auth/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('Content-Security-Policy', cspHeader);

  // If no csrfToken exists, generate one for the client
  if (!request.cookies.has('csrfToken')) {
    const rawToken = await generateToken();
    const sig = await signToken(rawToken);
    const token = `${rawToken}.${sig}`;
    response.cookies.set('csrfToken', token, {
      httpOnly: false, // JS-readable
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  // Reject POST/PUT/PATCH/DELETE missing or mismatching CSRF token on auth routes
  if (isAuthProxyPostRoute) {
    const csrfCookie = request.cookies.get('csrfToken')?.value;
    const csrfHeader = request.headers.get('X-CSRF-Token');

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }

    const [rawValue, sigValue] = csrfCookie.split('.');
    if (!rawValue || !sigValue || !(await verifyToken(rawValue, sigValue))) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    '/api/:path*',
  ],
};
