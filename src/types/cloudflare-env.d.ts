export {};

declare global {
  interface D1Database {
    prepare(query: string): unknown;
  }

  interface CloudflareEnv {
    ADMIN_DB: D1Database;
    ASSETS?: { fetch(request: Request): Promise<Response> };
  }
}
