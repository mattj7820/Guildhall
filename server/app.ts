import { createRequestHandler } from "@react-router/express";
import express from "express";
import { RouterContextProvider } from "react-router";
import { loadConfig } from "~/.server/config";
import { LiveVault } from "~/.server/vault/live-vault";
import { servicesContext, type Services } from "~/context";

/**
 * Creates the long-lived services once per process. In development Vite may re-evaluate this
 * module, so the instance is kept on globalThis to avoid stacking up file watchers.
 */
async function createServices(): Promise<Services> {
  const config = loadConfig();
  const vault = await LiveVault.open(config.vaultPath);
  console.log(`[vault] Serving ${vault.current.notes({ role: "dm" }).length} notes (read-only)`);
  return { config, vault };
}

const globalForServices = globalThis as typeof globalThis & {
  __guildhallServices?: Promise<Services>;
};
const services = await (globalForServices.__guildhallServices ??= createServices());

export const app = express();

app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
    getLoadContext() {
      const context = new RouterContextProvider();
      context.set(servicesContext, services);
      return context;
    },
  }),
);
