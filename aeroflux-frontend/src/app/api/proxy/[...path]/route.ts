import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, generateToken } from '@/lib/csrf';

async function handler(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const BACKEND_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:3001/api/v1';
  const { path } = await context.params;
  const pathStr = path.join('/');
  
  // Verify CSRF before forwarding (Node.js runtime safe)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const csrfCookie = req.cookies.get('csrfToken')?.value;
    const csrfHeader = req.headers.get('X-CSRF-Token');
    
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }
    
    const [token, sig] = csrfCookie.split('.');
    if (!token || !sig || !(await verifyToken(token, sig))) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }
  }

  // Forward search params
  const searchParams = req.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/${pathStr}${searchParams ? `?${searchParams}` : ''}`;
  
  // Read token from cookie
  const accessToken = req.cookies.get('access_token')?.value;
  
  const headers = new Headers(req.headers);
  headers.delete('host');
  // Add auth header if we have token
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  
  // Parse body if needed
  let body = null;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      body = await req.text();
    } catch (e) {
      body = null;
    }
  }

  // Remove CSRF token header before forwarding to backend
  headers.delete('x-csrf-token');
  // Delete headers that might interfere with proxying
  headers.delete('content-length');
  headers.delete('connection');
  headers.delete('transfer-encoding');

  const backendReq = new Request(url, {
    method: req.method,
    headers,
    body: body || undefined,
    redirect: 'manual',
    ...({ duplex: 'half' } as any)
  });

  try {
    const backendRes = await fetch(backendReq);
    
    // We want to intercept login/register to store tokens in HTTPOnly cookies
    const authPaths = [
      'auth/agency/login', 'auth/agency/register',
      'auth/agency-agent/login', 'auth/agency-agent/register',
      'auth/agent/login', 'auth/agent/register',
      'auth/refresh-token'
    ];
    
    let isAuthEndpoint = false;
    for (const ap of authPaths) {
      if (pathStr.includes(ap)) isAuthEndpoint = true;
    }

    if (isAuthEndpoint && backendRes.ok) {
      // Parse JSON to get tokens
      const data = await backendRes.json();
      const res = NextResponse.json(data, {
        status: backendRes.status,
        headers: backendRes.headers,
      });
      // Delete problematic header from backend just in case
      res.headers.delete('content-encoding');
      res.headers.delete('content-length');

      if (data.access_token) {
        res.cookies.set('access_token', data.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 15 * 60, // 15 minutes
        });
      }
      if (data.refresh_token) {
        res.cookies.set('refresh_token', data.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/api/proxy/auth/refresh-token',
          maxAge: 24 * 60 * 60, // 1 day
        });
      }
      return res;
    } else if (pathStr === 'auth/logout') {
        const res = NextResponse.json({ success: true });
        res.cookies.delete('access_token');
        res.cookies.delete('refresh_token');
        return res;
    }

    // Standard proxy response
    const resBody = await backendRes.text();
    return new NextResponse(resBody, {
      status: backendRes.status,
      headers: backendRes.headers,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
}
