import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateToken, signToken, verifyToken } from './lib/csrf';

export function middleware(request: NextRequest) {
  // Only apply to POST/PUT/PATCH/DELETE proxy routes
  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  ) {
    const csrfCookie = request.cookies.get('csrfToken')?.value;
    const csrfHeader = request.headers.get('X-CSRF-Token');

    if (!csrfCookie || !csrfHeader || !verifyToken(csrfCookie, csrfHeader)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }
  }

  const response = NextResponse.next();

  // If no csrfToken exists, generate one
  if (!request.cookies.has('csrfToken')) {
    const token = generateToken();
    response.cookies.set('csrfToken', token, {
      httpOnly: false, // JavaScript readable
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};

