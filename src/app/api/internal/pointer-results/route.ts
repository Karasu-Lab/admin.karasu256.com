import { PointerResultsHandler } from '@/lib/pointer-results';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return new PointerResultsHandler().handle(request);
}
