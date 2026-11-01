import type { IncomingMessage } from "node:http";
import path from "node:path";
import type { Duplex } from "node:stream";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import { RouterContextProvider } from "react-router";
import { CurrentFight } from "~/.server/combat/current-fight";
import { NextSession } from "~/.server/home/next-session";
import { Campaigns } from "~/.server/campaigns/campaigns";
import { PreparedEncounters } from "~/.server/combat/prepared-encounters";
import { loadConfig } from "~/.server/config";
import { discordAuth } from "~/.server/auth/discord";
import { createAttemptCookie } from "~/.server/auth/discord-sign-in";
import { cookieSettings, createSessions } from "~/.server/auth/sessions";
import { Characters } from "~/.server/characters/characters";
import { CampaignMaps } from "~/.server/maps/campaign-maps";
import { prepareThumbnails } from "~/.server/maps/load";
import { MapFogs } from "~/.server/maps/map-fogs";
import { MapTokens } from "~/.server/maps/map-tokens";
import { PlayerImages } from "~/.server/maps/player-image";
import { FileCache } from "~/.server/data/file-cache";
import { Live } from "~/.server/live/live";
import { DiceCollections } from "~/.server/dice/collections";
import { Members } from "~/.server/members/members";
import { LiveVault } from "~/.server/vault/live-vault";
import { clientAddressContext, servicesContext, type Services } from "~/context";
import { prepareApp } from "./http";

/**
 * Creates the long-lived services. In production this module is evaluated once. In development
 * Vite evaluates it again whenever server code it depends on changes; the services are then
 * built afresh, so saving runs the new code (a stale repository would quietly apply old rules
 * while the browser used new ones), and the old vault watcher is closed so watchers don't pile up.
 */
async function createServices(): Promise<Services> {
  const config = loadConfig();
  const vault = await LiveVault.open(config.vaultPath);
  console.log(`[vault] Serving ${vault.current.notes({ role: "dm" }).length} notes (read-only)`);
  console.log(`[data] Keeping Guildhall's own data in ${config.dataPath}`);
  if (config.devLogin) {
    console.warn("[auth] DEV_LOGIN is on: anyone on this computer can sign in as anyone.");
  }
  if (!config.devLogin && !config.discord) {
    console.warn("[auth] No way to sign in: set up Discord (see .env.example) or DEV_LOGIN.");
  }
  const cookies = cookieSettings(config);
  const services: Omit<Services, "live"> = {
    config,
    vault,
    fight: CurrentFight.inFolder(config.dataPath),
    nextSession: NextSession.inFolder(config.dataPath),
    campaigns: Campaigns.inFolder(config.dataPath),
    preparedEncounters: PreparedEncounters.inFolder(config.dataPath),
    maps: CampaignMaps.inFolder(config.dataPath),
    fogs: MapFogs.inFolder(config.dataPath),
    tokens: MapTokens.inFolder(config.dataPath),
    playerImages: new PlayerImages(new FileCache(path.join(config.dataPath, "cache", "map-tiles"))),
    characters: Characters.inFolder(config.dataPath),
    members: Members.inFolder(config.dataPath),
    dice: DiceCollections.inFolder(config.dataPath),
    sessions: createSessions(cookies),
    signInAttempts: createAttemptCookie(cookies),
    ...(config.discord && {
      discord: discordAuth({
        ...config.discord,
        redirectUri: new URL("/auth/discord/callback", config.publicUrl).href,
      }),
    }),
  };
  const live = new Live(services);
  // A map's notes and image come from the vault, so any open map may look different now.
  vault.onReload(() => {
    void live.allMapsChanged();
    void prepareThumbnails(services);
  });
  void prepareThumbnails(services);
  return { ...services, live };
}

const globalForServices = globalThis as typeof globalThis & {
  __guildhallServices?: Promise<Services>;
};
const services = await (globalForServices.__guildhallServices = replaceServices(
  globalForServices.__guildhallServices,
));

async function replaceServices(previous: Promise<Services> | undefined): Promise<Services> {
  if (previous) await closeServices(await previous);
  return createServices();
}

export const app = express();

prepareApp(app, services.config);
app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
    getLoadContext(req) {
      const context = new RouterContextProvider();
      context.set(servicesContext, services);
      // The connection's own address, not X-Forwarded-For, which a client could fake.
      context.set(clientAddressContext, req.socket.remoteAddress);
      return context;
    },
  }),
);

/** Hands a websocket upgrade to the live connections, which sign it in like a page. */
export function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
  return services.live.handleUpgrade(req, socket, head);
}

/**
 * Closes live connections (browsers reconnect) and stops watching the vault, so the process can
 * exit cleanly when the host stops it, or a development reload can start afresh.
 */
async function closeServices({ live, vault }: Services): Promise<void> {
  live.close();
  await vault.close();
}

export function close(): Promise<void> {
  return closeServices(services);
}
