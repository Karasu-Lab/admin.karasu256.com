import { NextResponse, type NextRequest } from 'next/server';
import { VercelConnectionStore, VercelOAuthClient } from '@/lib/vercel';

/** Completes the Vercel OAuth flow: validates `state`, exchanges the authorization code (with its PKCE `code_verifier`) for a token, and persists the resulting connection. Throws on any failure rather than swallowing it, so the actual cause surfaces instead of a generic error redirect. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const providerError = searchParams.get('error');

  const connectionStore = new VercelConnectionStore();
  const { state: expectedState, codeVerifier } = await connectionStore.consumeAuthorizeState();

  if (providerError) {
    throw new Error(`Vercel OAuth authorization failed: ${providerError} - ${searchParams.get('error_description') ?? ''}`);
  }
  if (!code || !state) {
    throw new Error('Vercel OAuth callback is missing code or state');
  }
  if (!expectedState || state !== expectedState) {
    throw new Error('Vercel OAuth callback state does not match');
  }
  if (!codeVerifier) {
    throw new Error('Vercel OAuth callback is missing the PKCE code_verifier cookie');
  }

  const connection = await new VercelOAuthClient().exchangeCodeForToken(code, codeVerifier);
  await connectionStore.save(connection);
  return NextResponse.redirect(new URL('/', request.url));
}
