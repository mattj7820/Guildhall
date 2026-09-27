import type { Express, RequestHandler } from "express";

/**
 * HTTP settings that don't depend on React Router, applied before it: whether to believe the
 * reverse proxy, a few security headers, and a health check for the host to poll.
 */
export function prepareApp(app: Express, { trustProxy }: { trustProxy: number }): void {
  // Behind Traefik the connection is plain HTTP from the proxy; X-Forwarded-* says what the
  // browser actually used. React Router's same-origin check on form posts depends on it.
  app.set("trust proxy", trustProxy > 0 ? trustProxy : false);
  app.use(securityHeaders);
  // Before React Router, so it never needs a signed-in user.
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });
}

const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  // Links out (to Roll20, Discord…) mustn't carry note names in the Referer.
  res.setHeader("Referrer-Policy", "same-origin");
  next();
};
