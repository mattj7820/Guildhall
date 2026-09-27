import { statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

export interface Config {
  /** Absolute path to the Obsidian vault. Read-only. */
  vaultPath: string;
  /** Absolute path to the folder where Guildhall keeps its own data. Never inside the vault. */
  dataPath: string;
  roll20CampaignUrl?: string;
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

const emptyAsUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const envSchema = z.object({
  VAULT_PATH: z.preprocess(
    emptyAsUndefined,
    z.string({ error: "VAULT_PATH is not set. Point it at your Obsidian vault folder." }),
  ),
  DATA_PATH: z.preprocess(emptyAsUndefined, z.string().default("./data")),
  ROLL20_CAMPAIGN_URL: z.preprocess(
    emptyAsUndefined,
    z
      .url({ protocol: /^https?$/, error: "ROLL20_CAMPAIGN_URL must be an http(s) URL." })
      .optional(),
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

  return { vaultPath, dataPath, roll20CampaignUrl: parsed.data.ROLL20_CAMPAIGN_URL };
}

/** Whether `inner` is `outer` or inside it. Case-insensitive on Windows, like its file system. */
function isWithin(inner: string, outer: string): boolean {
  const fold = (p: string) => (process.platform === "win32" ? p.toLowerCase() : p);
  const relative = path.relative(fold(outer), fold(inner));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
