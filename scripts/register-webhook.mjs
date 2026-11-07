import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const internalApiSecret = process.env.INTERNAL_API_SECRET;
if (!internalApiSecret) {
  console.error('INTERNAL_API_SECRET is not set');
  process.exit(1);
}
const webhookSecret = process.env.GH_APP_WEBHOOK_SECRET;
if (!webhookSecret) {
  console.error('GH_APP_WEBHOOK_SECRET is not set');
  process.exit(1);
}

const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const authApiUrl = config.vars?.AUTH_API_URL;
const appUrl = config.vars?.APP_URL;
if (!authApiUrl || !appUrl) {
  console.error('wrangler.jsonc does not declare AUTH_API_URL and APP_URL in its production vars');
  process.exit(1);
}

function signRequest(secret, method, url, body) {
  const key = createHmac('sha256', secret).update('auth-request-signature:v1').digest();
  const { pathname, search } = new URL(url);
  const timestamp = String(Date.now());
  const canonical = [method.toUpperCase(), `${pathname}${search}`, timestamp, createHash('sha256').update(body).digest('hex')].join('\n');
  const signature = createHmac('sha256', key).update(canonical).digest('base64url');
  return { 'x-signature': signature, 'x-signature-timestamp': timestamp };
}

const tokenUrl = `${authApiUrl.replace(/\/+$/, '')}/api/internal/github-app/token`;
const tokenBody = '{}';
const tokenResponse = await fetch(tokenUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...signRequest(internalApiSecret, 'POST', tokenUrl, tokenBody) },
  body: tokenBody,
});
if (!tokenResponse.ok) {
  console.error(`Issuing the GitHub App JWT failed (${tokenResponse.status}): ${(await tokenResponse.text()).slice(0, 300)}`);
  process.exit(1);
}
const { token } = await tokenResponse.json();
if (typeof token !== 'string' || token.length === 0) {
  console.error('Issuing the GitHub App JWT returned no token');
  process.exit(1);
}

const webhookUrl = `${appUrl.replace(/\/+$/, '')}/api/github/webhook`;
const response = await fetch('https://api.github.com/app/hook/config', {
  method: 'PATCH',
  headers: {
    accept: 'application/vnd.github+json',
    authorization: ['Bearer', token].join(' '),
    'content-type': 'application/json',
    'user-agent': 'karasu-lab-admin',
    'x-github-api-version': '2022-11-28',
  },
  body: JSON.stringify({ url: webhookUrl, content_type: 'json', insecure_ssl: '0', secret: webhookSecret }),
});
if (!response.ok) {
  console.error(`Registering the GitHub App webhook failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  process.exit(1);
}
console.log(`Registered the GitHub App webhook for ${webhookUrl}`);
