import { z } from 'zod';

export function githubOidcClaimsSchema() {
  return z.object({
    repository: z.string(),
    repositoryId: z.number(),
    ref: z.string(),
    jobWorkflowRef: z.string(),
    runId: z.string(),
    runAttempt: z.string(),
    eventName: z.string(),
  });
}

export type GithubOidcClaims = z.infer<ReturnType<typeof githubOidcClaimsSchema>>;

export function githubOidcVerifierOverridesSchema() {
  return z
    .object({
      issuer: z.string(),
      jwksUrl: z.string(),
      leewaySeconds: z.number(),
      nowSeconds: z.custom<() => number>((value) => value instanceof Function),
      fetchJwks: z.custom<(url: string) => Promise<unknown>>((value) => value instanceof Function),
    })
    .partial();
}

export type GithubOidcVerifierOverrides = z.infer<ReturnType<typeof githubOidcVerifierOverridesSchema>>;

function githubOidcTokenHeaderSchema() {
  return z.object({ alg: z.literal('RS256'), kid: z.string().min(1) });
}

function githubOidcJwksSchema() {
  return z.object({
    keys: z.array(z.object({ kid: z.string(), kty: z.literal('RSA'), n: z.string(), e: z.string() })),
  });
}

function githubOidcRawClaimsSchema() {
  return z.object({
    iss: z.string(),
    aud: z.union([z.string(), z.array(z.string())]),
    exp: z.number(),
    nbf: z.number().optional(),
    repository: z.string(),
    repository_id: z.string().regex(/^[0-9]+$/),
    ref: z.string(),
    job_workflow_ref: z.string(),
    run_id: z.string(),
    run_attempt: z.string(),
    event_name: z.string(),
  });
}

export class GithubOidcError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'GithubOidcError';
  }
}

export class GithubOidcVerifier {
  issuer = 'https://token.actions.githubusercontent.com';
  jwksUrl = 'https://token.actions.githubusercontent.com/.well-known/jwks';
  leewaySeconds = 60;
  nowSeconds: () => number = () => Math.floor(Date.now() / 1000);
  fetchJwks: (url: string) => Promise<unknown> = async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new GithubOidcError('jwks_unavailable');
    return response.json();
  };

  constructor(
    readonly audience: string,
    overrides: GithubOidcVerifierOverrides = {}
  ) {
    Object.assign(this, githubOidcVerifierOverridesSchema().parse(overrides));
  }

  private decodeSegment(segment: string): unknown {
    try {
      return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    } catch {
      throw new GithubOidcError('malformed_token');
    }
  }

  async verify(token: string): Promise<GithubOidcClaims> {
    const segments = token.split('.');
    if (segments.length !== 3) throw new GithubOidcError('malformed_token');
    const [encodedHeader, encodedPayload, encodedSignature] = segments;
    const header = githubOidcTokenHeaderSchema().safeParse(this.decodeSegment(encodedHeader));
    if (!header.success) throw new GithubOidcError('unsupported_header');
    const jwks = githubOidcJwksSchema().safeParse(await this.fetchJwks(this.jwksUrl));
    if (!jwks.success) throw new GithubOidcError('jwks_invalid');
    const jwk = jwks.data.keys.find((key) => key.kid === header.data.kid);
    if (!jwk) throw new GithubOidcError('unknown_key');
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signatureValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      Buffer.from(encodedSignature, 'base64url'),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
    if (!signatureValid) throw new GithubOidcError('invalid_signature');
    const claims = githubOidcRawClaimsSchema().safeParse(this.decodeSegment(encodedPayload));
    if (!claims.success) throw new GithubOidcError('invalid_claims');
    const now = this.nowSeconds();
    const audiences = Array.isArray(claims.data.aud) ? claims.data.aud : [claims.data.aud];
    if (claims.data.iss !== this.issuer) throw new GithubOidcError('invalid_issuer');
    if (!audiences.includes(this.audience)) throw new GithubOidcError('invalid_audience');
    if (claims.data.exp + this.leewaySeconds < now) throw new GithubOidcError('token_expired');
    if (claims.data.nbf !== undefined && claims.data.nbf - this.leewaySeconds > now) {
      throw new GithubOidcError('token_not_yet_valid');
    }
    return githubOidcClaimsSchema().parse({
      repository: claims.data.repository,
      repositoryId: Number(claims.data.repository_id),
      ref: claims.data.ref,
      jobWorkflowRef: claims.data.job_workflow_ref,
      runId: claims.data.run_id,
      runAttempt: claims.data.run_attempt,
      eventName: claims.data.event_name,
    });
  }
}
