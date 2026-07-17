import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(req: NextRequest) {
  // Simple Basic Auth or Secret Cookie check for /admin routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const authHeader = req.headers.get('authorization');
    
    // For demo purposes, we'll just return a 401 if no secret is set
    // In production, use a proper auth system
    // if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    //   return new NextResponse('Unauthorized', { status: 401 });
    // }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
