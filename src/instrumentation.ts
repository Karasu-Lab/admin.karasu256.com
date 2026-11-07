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

interface ErrorLogFields {
  [key: string]: unknown;
  name?: string;
  message: string;
  stack?: string;
}

function errorFields(value: unknown): ErrorLogFields {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return { message: typeof value === 'string' ? value : String(value) };
}

function serializeArg(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value !== null && typeof value === 'object' && 'componentStack' in value) {
    const componentStack = (value as { componentStack?: unknown }).componentStack;
    if (typeof componentStack === 'string') return componentStack;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function wrapConsole(method: 'error' | 'warn', event: string, level: 'error' | 'warn'): void {
  const original = console[method];
  console[method] = (...args: unknown[]) => {
    const errorIndex = args.findIndex((arg) => arg instanceof Error);
    if (errorIndex === -1) {
      original.apply(console, args);
      return;
    }
    const rest = args
      .filter((_, index) => index !== errorIndex)
      .map(serializeArg)
      .filter((arg) => arg.length > 0);
    log(event, { ...errorFields(args[errorIndex]), ...(rest.length > 0 ? { args: rest } : {}) }, level);
  };
}

export function register(): void {
  const state = globalThis as { __adminErrorLoggingRegistered?: boolean };
  if (state.__adminErrorLoggingRegistered) return;
  state.__adminErrorLoggingRegistered = true;
  wrapConsole('error', 'console_error', 'error');
  wrapConsole('warn', 'console_warn', 'warn');
  const proc = (
    globalThis as { process?: { on?: (event: string, listener: (reason: unknown) => void) => void } }
  ).process;
  if (proc && typeof proc.on === 'function') {
    proc.on('unhandledRejection', (reason) => {
      log('unhandled_rejection', errorFields(reason), 'error');
    });
    proc.on('uncaughtException', (reason) => {
      log('uncaught_exception', errorFields(reason), 'error');
      throw reason;
    });
  }
}
