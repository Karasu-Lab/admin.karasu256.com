import { NextResponse, type NextRequest } from 'next/server';
import { VercelConnectionStore } from '@/lib/vercel';

/** Disconnects the app's Vercel OAuth connection. */
export async function GET(request: NextRequest) {
  await new VercelConnectionStore().clear();
  return NextResponse.redirect(new URL('/', request.url));
}
