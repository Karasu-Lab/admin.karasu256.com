import 'server-only';
import { cookies } from 'next/headers';
import type { VercelConnection } from './types';

/**
 * Persists the app-wide Vercel OAuth connection, plus the short-lived
 * CSRF `state` and PKCE `code_verifier` used while an authorize round trip
 * is in flight — all as httpOnly cookies set by this app itself, since it
 * has no database or other persistent store of its own. Tracks a single,
 * app-wide connection rather than per-user connections.
 */
export class VercelConnectionStore {
  private static readonly CONNECTION_COOKIE = 'vercel_connection';
  private static readonly CONNECTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
  private static readonly STATE_COOKIE = 'vercel_oauth_state';
  private static readonly VERIFIER_COOKIE = 'vercel_oauth_verifier';
  private static readonly AUTHORIZE_COOKIE_MAX_AGE = 600;

  private cookieOptions(maxAge: number) {
    return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge, path: '/' };
  }

  /** Returns the persisted Vercel connection, or `null` when never connected. */
  async get(): Promise<VercelConnection | null> {
    const raw = (await cookies()).get(VercelConnectionStore.CONNECTION_COOKIE)?.value;
    return raw ? (JSON.parse(raw) as VercelConnection) : null;
  }

  /** Persists the Vercel connection, replacing any existing one. */
  async save(connection: VercelConnection): Promise<void> {
    (await cookies()).set(
      VercelConnectionStore.CONNECTION_COOKIE,
      JSON.stringify(connection),
      this.cookieOptions(VercelConnectionStore.CONNECTION_COOKIE_MAX_AGE)
    );
  }

  /** Removes the persisted Vercel connection. */
  async clear(): Promise<void> {
    (await cookies()).delete(VercelConnectionStore.CONNECTION_COOKIE);
  }

  /** Stores the CSRF `state` and PKCE `code_verifier` for an in-flight authorize round trip. */
  async saveAuthorizeState(state: string, codeVerifier: string): Promise<void> {
    const store = await cookies();
    const options = this.cookieOptions(VercelConnectionStore.AUTHORIZE_COOKIE_MAX_AGE);
    store.set(VercelConnectionStore.STATE_COOKIE, state, options);
    store.set(VercelConnectionStore.VERIFIER_COOKIE, codeVerifier, options);
  }

  /** Reads and clears the CSRF `state` and PKCE `code_verifier` stored by {@link saveAuthorizeState}. */
  async consumeAuthorizeState(): Promise<{ state: string | undefined; codeVerifier: string | undefined }> {
    const store = await cookies();
    const state = store.get(VercelConnectionStore.STATE_COOKIE)?.value;
    const codeVerifier = store.get(VercelConnectionStore.VERIFIER_COOKIE)?.value;
    store.delete(VercelConnectionStore.STATE_COOKIE);
    store.delete(VercelConnectionStore.VERIFIER_COOKIE);
    return { state, codeVerifier };
  }
}
