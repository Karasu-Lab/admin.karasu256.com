import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { VercelConnectionStore, VercelOAuthClient } from '@/lib/vercel';

/** Starts the Vercel OAuth flow: mints a CSRF `state` and a PKCE pair, stores them via {@link VercelConnectionStore}, and redirects to Vercel's authorize page. */
export async function GET() {
  const oauthClient = new VercelOAuthClient();
  const state = randomBytes(16).toString('hex');
  const { codeVerifier, codeChallenge } = oauthClient.createPkcePair();
  const authorizeUrl = oauthClient.buildAuthorizeUrl(state, codeChallenge);
  if (!authorizeUrl) {
    return NextResponse.json({ error: 'VERCEL_CLIENT_ID is not configured' }, { status: 503 });
  }

  await new VercelConnectionStore().saveAuthorizeState(state, codeVerifier);

  return NextResponse.redirect(authorizeUrl);
}
