export {};

declare global {
  interface D1Result<T = Record<string, unknown>> {
    results: T[];
    success: boolean;
    error?: string;
    meta: Record<string, unknown>;
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
    run(): Promise<D1Result<Record<string, unknown>>>;
  }

  interface D1Database {
    prepare(query: string): D1PreparedStatement;
  }

  interface CloudflareEnv {
    ADMIN_DB: D1Database;
  }
}
