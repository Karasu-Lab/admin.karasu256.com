import { log } from '@karasu-lab/utils/server';
import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const err = error instanceof Error ? error : undefined;
  const digest =
    error !== null && typeof error === 'object' && 'digest' in error ? (error as { digest?: unknown }).digest : undefined;
  log(
    'request_error',
    {
      name: err?.name,
      message: err ? err.message : String(error),
      stack: err?.stack,
      ...(typeof digest === 'string' ? { digest } : {}),
      method: request.method,
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
    },
    'error',
  );
};
