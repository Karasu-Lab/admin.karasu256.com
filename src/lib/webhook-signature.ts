import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export class GithubWebhookSignature {
  algorithm = 'sha256';
  prefix = 'sha256=';
  digestEncoding: 'hex' = 'hex';

  isValid(secret: string, body: string, header: string | null): boolean {
    if (!header?.startsWith(this.prefix)) return false;
    const expected = Buffer.from(
      `${this.prefix}${createHmac(this.algorithm, secret).update(body).digest(this.digestEncoding)}`
    );
    const actual = Buffer.from(header);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
