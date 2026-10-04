/** Minimal HTTP helpers for SpaceFast serverless functions. */

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function apiError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: code, message }, status);
}

export class InputError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type Handler = (request: Request, env: Record<string, unknown>) => Promise<Response>;

export function withErrors(handler: Handler): Handler {
  return async (request, env) => {
    try {
      // The runtime invokes handlers as (request, { ctx, env, params }).
      // Unwrap so handlers receive the real environment bindings (DB, secrets).
      const inner = (env as Record<string, unknown> | undefined)?.["env"];
      const routeEnv =
        inner && typeof inner === "object" ? (inner as Record<string, unknown>) : env;
      return await handler(request, routeEnv);
    } catch (err) {
      if (err instanceof InputError) return apiError(400, err.code, err.message);
      console.error(err);
      return apiError(500, "internal_error", "Something went wrong.");
    }
  };
}
