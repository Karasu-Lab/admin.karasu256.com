import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { MissingEnvError } from '@Hashibutogarasu/utils/server';
import type { VercelConnection } from './types';

/** A PKCE (RFC 7636) verifier/challenge pair for the authorization code flow. */
export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

/** Talks to Vercel's OAuth authorization server: builds the authorize URL and exchanges an authorization code for an access token. */
export class VercelOAuthClient {
  private static readonly AUTHORIZE_URL = 'https://vercel.com/oauth/authorize';
  private static readonly TOKEN_URL = 'https://api.vercel.com/login/oauth/token';
  private static readonly TEAMS_URL = 'https://api.vercel.com/v2/teams';

  private getRedirectUri(): string {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/vercel`;
  }

  /** Generates a PKCE verifier/challenge pair — `code_challenge` (S256) is sent on the authorize request, and `code_verifier` must be sent back on the token exchange. */
  createPkcePair(): PkcePair {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  /** Builds the Vercel OAuth authorize URL, or `null` when `VERCEL_CLIENT_ID` is unset. */
  buildAuthorizeUrl(state: string, codeChallenge: string): string | null {
    const clientId = process.env.VERCEL_CLIENT_ID;
    if (!clientId) return null;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.getRedirectUri(),
      state,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${VercelOAuthClient.AUTHORIZE_URL}?${params.toString()}`;
  }

  /** Exchanges an authorization `code` for an access token, resolving a team association since the token response itself carries none. */
  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<VercelConnection> {
    const clientId = process.env.VERCEL_CLIENT_ID;
    const clientSecret = process.env.VERCEL_CLIENT_SECRET;
    if (!clientId) throw new MissingEnvError('VERCEL_CLIENT_ID');
    if (!clientSecret) throw new MissingEnvError('VERCEL_CLIENT_SECRET');

    const res = await fetch(VercelOAuthClient.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: this.getRedirectUri(),
      }),
    });
    if (!res.ok) {
      throw new Error(`Vercel token exchange failed with status ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { access_token?: string; team_id?: string };
    if (!data.access_token) {
      throw new Error('Vercel token exchange response is missing access_token');
    }

    const teamId = data.team_id ?? (await this.resolveTeamId(data.access_token));
    return { accessToken: data.access_token, teamId };
  }

  /**
   * Sign in with Vercel's token response carries no team association, but
   * this app's projects all live under a team, not the personal account —
   * without a `teamId`, deployment queries silently scope to the personal
   * account and return nothing. Best-effort: picks the first team the
   * token can see.
   */
  private async resolveTeamId(accessToken: string): Promise<string | undefined> {
    const res = await fetch(VercelOAuthClient.TEAMS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { teams?: { id: string }[] };
    return data.teams?.[0]?.id;
  }
}
