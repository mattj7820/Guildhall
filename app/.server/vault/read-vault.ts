import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { isMarkdown, toVaultPath } from "./paths";

/**
 * Everything read from the vault in one pass. This module is the only place that reads note files,
 * and it only ever uses read APIs (enforced by an ESLint rule on all app code).
 */
export interface VaultSnapshot {
  notes: { path: string; source: string }[];
  /** Vault paths of every non-markdown file (images and other attachments). */
  assets: string[];
}

/** Obsidian's own folders and other hidden entries are never part of the campaign. */
function isIgnored(name: string): boolean {
  return name.startsWith(".") || name === "node_modules";
}

/** Obsidian files we don't render yet. */
function isUnsupported(name: string): boolean {
  return /\.(canvas|excalidraw\.md)$/i.test(name);
}

export async function readVault(root: string): Promise<VaultSnapshot> {
  const absoluteRoot = path.resolve(root);
  const snapshot: VaultSnapshot = { notes: [], assets: [] };

  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (isIgnored(entry.name) || isUnsupported(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        const vaultPath = toVaultPath(absoluteRoot, absolute);
        if (isMarkdown(entry.name)) {
          snapshot.notes.push({ path: vaultPath, source: await readFile(absolute, "utf8") });
        } else {
          snapshot.assets.push(vaultPath);
        }
      }
    }
  }

  await walk(absoluteRoot);
  snapshot.notes.sort((a, b) => a.path.localeCompare(b.path));
  snapshot.assets.sort();
  return snapshot;
}
