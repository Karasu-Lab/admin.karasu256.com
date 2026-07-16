import { headers } from 'next/headers';

const API_URL = process.env.API_URL!;

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const incoming = await headers();
  const cfJwt = incoming.get('cf-access-jwt-assertion');

  const mergedHeaders = new Headers(init?.headers);
  if (cfJwt) mergedHeaders.set('cf-access-jwt-assertion', cfJwt);

  return fetch(`${API_URL}${path}`, { ...init, headers: mergedHeaders });
}
