import { withErrors, json } from "../_core/http";

/** GET /api/health — liveness check for the demo + judges. */
export const GET = withErrors(async () => {
  return json({
    ok: true,
    service: "outcomepay",
    phase: "agent-ready",
    time: new Date().toISOString(),
  });
});
