import { createRequestHandler } from "@react-router/express";
import express from "express";
import { RouterContextProvider } from "react-router";
import { PreparedEncounters } from "~/.server/combat/prepared-encounters";
import { loadConfig } from "~/.server/config";
import { CampaignMaps } from "~/.server/maps/campaign-maps";
import { Members } from "~/.server/members/members";
import { LiveVault } from "~/.server/vault/live-vault";
import { servicesContext, type Services } from "~/context";
import { prepareApp } from "./http";

/**
 * Creates the long-lived services once per process. In development Vite may re-evaluate this
 * module, so the instance is kept on globalThis to avoid stacking up file watchers.
 */
async function createServices(): Promise<Services> {
  const config = loadConfig();
  const vault = await LiveVault.open(config.vaultPath);
  console.log(`[vault] Serving ${vault.current.notes({ role: "dm" }).length} notes (read-only)`);
  console.log(`[data] Keeping Guildhall's own data in ${config.dataPath}`);
  return {
    config,
    vault,
    preparedEncounters: PreparedEncounters.inFolder(config.dataPath),
    maps: CampaignMaps.inFolder(config.dataPath),
    members: Members.inFolder(config.dataPath),
  };
}

const globalForServices = globalThis as typeof globalThis & {
  __guildhallServices?: Promise<Services>;
};
const services = await (globalForServices.__guildhallServices ??= createServices());

export const app = express();

prepareApp(app, services.config);
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

/** Stops watching the vault, so the process can exit cleanly when the host stops it. */
export async function close(): Promise<void> {
  await services.vault.close();
}
