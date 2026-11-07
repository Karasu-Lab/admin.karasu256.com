export async function requestProviderLinkUrl(
  authApiUrl: string,
  provider: string,
  callbackURL: string,
  additionalData?: Record<string, unknown>
): Promise<string> {
  const response = await fetch(`${authApiUrl}/api/auth/link-social`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, callbackURL, additionalData }),
  });
  const data = (await response.json().catch(() => null)) as { url?: unknown; message?: unknown; error?: unknown } | null;
  if (!response.ok || typeof data?.url !== 'string') {
    throw new Error(
      (typeof data?.message === 'string' && data.message) ||
        (typeof data?.error === 'string' && data.error) ||
        `http_${response.status}`
    );
  }
  return data.url;
}

export async function startProviderLink(
  authApiUrl: string,
  provider: string,
  callbackURL: string,
  additionalData?: Record<string, unknown>
): Promise<void> {
  window.location.href = await requestProviderLinkUrl(authApiUrl, provider, callbackURL, additionalData);
}
