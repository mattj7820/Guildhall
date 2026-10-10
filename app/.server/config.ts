import { statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

export interface Config {
  /** Absolute path to the Obsidian vault. Read-only. */
  vaultPath: string;
  /** Absolute path to the folder where Guildhall keeps its own data. Never inside the vault. */
  dataPath: string;
  /**
   * The vault folder (vault-relative, no slashes at either end) whose audio is the DM's sound
   * board. Every signed-in viewer may fetch audio from it, so it's for the table.
   */
  soundsFolder: string;
  /**
   * The address people use to reach Guildhall, as an origin (`https://guildhall.example.com`).
   * Sign-in redirects and the same-origin check for form posts are built from it.
   */
  publicUrl: string;
  /**
   * How many reverse proxies (such as Traefik) sit in front of the server. They end HTTPS, so
   * without this the app would think every request came over plain HTTP from the proxy.
   * 0 means none.
   */
  trustProxy: number;
  /** Whether PUBLIC_URL was set, rather than defaulting to localhost. */
  publicUrlIsSet: boolean;
  /**
   * Secrets that sign session cookies, newest first; older ones still verify, so a secret can be
   * rotated without signing everyone out. Undefined when not set (local use only).
   */
  sessionSecrets?: string[];
  /** Discord user IDs of the DM(s), who are let straight in with the DM's view. */
  dmDiscordIds: string[];
  /** One-click sign-in as the DM or a player, for local development and tests only. */
  devLogin: boolean;
  /** The Discord application for "Sign in with Discord", when set up. */
  discord?: { clientId: string; clientSecret: string };
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

const emptyAsUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const TRUST_PROXY_ERROR =
  "TRUST_PROXY must be the number of proxies in front of Guildhall (0 for none).";

const list = (value: unknown) =>
  typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : value;

const envSchema = z.object({
  VAULT_PATH: z.preprocess(
    emptyAsUndefined,
    z.string({ error: "VAULT_PATH is not set. Point it at your Obsidian vault folder." }),
  ),
  DATA_PATH: z.preprocess(emptyAsUndefined, z.string().default("./data")),
  SOUNDS_FOLDER: z.preprocess(
    emptyAsUndefined,
    z
      .string()
      .default("Sounds")
      .transform((folder) => folder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""))
      .refine((folder) => folder !== "" && !folder.split("/").includes(".."), {
        error: "SOUNDS_FOLDER must be a folder inside the vault, such as Sounds.",
      }),
  ),
  PORT: z.preprocess(emptyAsUndefined, z.coerce.number().int().positive().default(3000)),
  PUBLIC_URL: z.preprocess(
    emptyAsUndefined,
    z.url({ protocol: /^https?$/, error: "PUBLIC_URL must be an http(s) URL." }).optional(),
  ),
  TRUST_PROXY: z.preprocess(
    emptyAsUndefined,
    z.coerce
      .number({ error: TRUST_PROXY_ERROR })
      .int({ error: TRUST_PROXY_ERROR })
      .min(0, { error: TRUST_PROXY_ERROR })
      .default(0),
  ),
  SESSION_SECRET: z.preprocess(
    (value) => list(emptyAsUndefined(value)),
    z
      .array(
        z.string().min(32, {
          error: "SESSION_SECRET must be at least 32 characters (see .env.example to make one).",
        }),
      )
      .optional(),
  ),
  DM_DISCORD_IDS: z.preprocess(
    (value) => list(emptyAsUndefined(value)) ?? [],
    z.array(
      z.string().regex(/^\d{17,20}$/, {
        error: "DM_DISCORD_IDS must be Discord user IDs (long numbers), separated by commas.",
      }),
    ),
  ),
  DISCORD_CLIENT_ID: z.preprocess(emptyAsUndefined, z.string().optional()),
  DISCORD_CLIENT_SECRET: z.preprocess(emptyAsUndefined, z.string().optional()),
  DEV_LOGIN: z.preprocess(
    emptyAsUndefined,
    z
      .enum(["true", "false"], { error: "DEV_LOGIN must be true or false." })
      .default("false")
      .transform((value) => value === "true"),
  ),
});

/**
 * Reads and validates configuration from environment variables (loaded from `.env` by the start
 * scripts). Throws a ConfigError with an actionable message rather than failing later.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  - ${issue.message}`).join("\n");
    throw new ConfigError(`Invalid configuration (see .env.example):\n${problems}`);
  }

  const vaultPath = path.resolve(parsed.data.VAULT_PATH);
  const stats = statSync(vaultPath, { throwIfNoEntry: false });
  if (!stats?.isDirectory()) {
    throw new ConfigError(`VAULT_PATH does not point to a folder: ${vaultPath}`);
  }

  const dataPath = path.resolve(parsed.data.DATA_PATH);
  if (isWithin(dataPath, vaultPath) || isWithin(vaultPath, dataPath)) {
    throw new ConfigError(
      `DATA_PATH and VAULT_PATH must not overlap: Guildhall writes to its data folder and the ` +
        `vault is read-only. DATA_PATH: ${dataPath}`,
    );
  }
  if (statSync(dataPath, { throwIfNoEntry: false })?.isFile()) {
    throw new ConfigError(`DATA_PATH points to a file, not a folder: ${dataPath}`);
  }

  const publicUrl = new URL(parsed.data.PUBLIC_URL ?? `http://localhost:${parsed.data.PORT}`);
  if (publicUrl.pathname !== "/" || publicUrl.search || publicUrl.hash) {
    throw new ConfigError(
      `PUBLIC_URL must be just the address, with no path: ${publicUrl.origin}, not ${publicUrl.href}`,
    );
  }

  // Dev sign-in lets anyone in as the DM, so it only works on this computer.
  if (parsed.data.DEV_LOGIN && !LOOPBACK_HOSTS.has(publicUrl.hostname)) {
    throw new ConfigError(
      `DEV_LOGIN is for local development only, but PUBLIC_URL is ${publicUrl.origin}. ` +
        `Turn DEV_LOGIN off when hosting.`,
    );
  }
  const { DISCORD_CLIENT_ID: clientId, DISCORD_CLIENT_SECRET: clientSecret } = parsed.data;
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new ConfigError(
      "Set both DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET for Discord sign-in, or neither.",
    );
  }
  if (publicUrl.protocol === "https:" && !parsed.data.SESSION_SECRET) {
    throw new ConfigError("SESSION_SECRET must be set when Guildhall is hosted over HTTPS.");
  }

  return {
    vaultPath,
    dataPath,
    soundsFolder: parsed.data.SOUNDS_FOLDER,
    publicUrl: publicUrl.origin,
    trustProxy: parsed.data.TRUST_PROXY,
    publicUrlIsSet: parsed.data.PUBLIC_URL !== undefined,
    sessionSecrets: parsed.data.SESSION_SECRET,
    dmDiscordIds: parsed.data.DM_DISCORD_IDS,
    devLogin: parsed.data.DEV_LOGIN,
    ...(clientId && clientSecret ? { discord: { clientId, clientSecret } } : {}),
  };
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Whether `inner` is `outer` or inside it. Case-insensitive on Windows, like its file system. */
function isWithin(inner: string, outer: string): boolean {
  const fold = (p: string) => (process.platform === "win32" ? p.toLowerCase() : p);
  const relative = path.relative(fold(outer), fold(inner));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
