// HTTP entry point. Serves the React Router app from Express so that, later, the same process
// can host real-time features (e.g. websockets for a shared map) alongside the pages.
import compression from "compression";
import express from "express";
import morgan from "morgan";

const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";
const PORT = Number.parseInt(process.env.PORT || "3000");

const app = express();
/**
 * Set in production: stops the app's long-lived services (the vault watcher).
 * @type {(() => Promise<void>) | undefined}
 */
let closeApp;

app.use(compression());
app.disable("x-powered-by");

if (DEVELOPMENT) {
  console.log("Starting development server");
  const viteDevServer = await import("vite").then((vite) =>
    vite.createServer({
      server: { middlewareMode: true },
    }),
  );
  app.use(viteDevServer.middlewares);
  app.use(async (req, res, next) => {
    try {
      const source = await viteDevServer.ssrLoadModule("./server/app.ts");
      return await source.app(req, res, next);
    } catch (error) {
      if (typeof error === "object" && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error);
      }
      next(error);
    }
  });
} else {
  console.log("Starting production server");
  const build = await import(BUILD_PATH);
  app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
  app.use(morgan("tiny"));
  app.use(express.static("build/client", { maxAge: "1h" }));
  app.use(build.app);
  closeApp = build.close;
}

const server = app.listen(PORT, () => {
  console.log(`Guildhall is running on port ${PORT}`);
});

// Hosts stop containers with SIGTERM (Ctrl+C sends SIGINT): finish open requests, stop watching
// the vault, then exit, rather than being killed mid-write after a timeout.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    console.log(`${signal} received; shutting down`);
    server.close(async () => {
      await closeApp?.();
      process.exit(0);
    });
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
