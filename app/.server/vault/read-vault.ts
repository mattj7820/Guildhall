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

/**
 * Obsidian's own folders and other hidden entries are never part of the campaign, and nor are
 * half-copied files: rclone downloads to `name.<hash>.partial`, then renames it into place.
 */
function isIgnored(name: string): boolean {
  return name.startsWith(".") || name === "node_modules" || name.endsWith(".partial");
}

/** Obsidian files we don't render yet. */
function isUnsupported(name: string): boolean {
  return /\.(canvas|excalidraw\.md)$/i.test(name);
}

/** The file-reading calls used, replaceable in tests. */
export interface VaultFiles {
  readdir: typeof readdir;
  readFile: typeof readFile;
}

/**
 * Reads the whole vault. A file or folder that disappears while it's being read (a sync tool
 * replacing it, say) is skipped rather than failing the read; the next change reads it again.
 */
export async function readVault(
  root: string,
  files: VaultFiles = { readdir, readFile },
): Promise<VaultSnapshot> {
  const absoluteRoot = path.resolve(root);
  const snapshot: VaultSnapshot = { notes: [], assets: [] };

  async function walk(directory: string): Promise<void> {
    const entries = await skipIfGone(() => files.readdir(directory, { withFileTypes: true }));
    for (const entry of entries ?? []) {
      if (isIgnored(entry.name) || isUnsupported(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        const vaultPath = toVaultPath(absoluteRoot, absolute);
        if (isMarkdown(entry.name)) {
          const source = await skipIfGone(() => files.readFile(absolute, "utf8"));
          if (source !== undefined) snapshot.notes.push({ path: vaultPath, source });
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

/**
 * Only what's inside a folder: a campaign's notes and files, with their vault paths unchanged so
 * slugs, entity IDs and stored links stay as they are. No folder is the whole vault.
 */
export function inFolder(snapshot: VaultSnapshot, folder: string | undefined): VaultSnapshot {
  if (!folder) return snapshot;
  const prefix = folder.replace(/\/+$/, "") + "/";
  return {
    notes: snapshot.notes.filter((note) => note.path.startsWith(prefix)),
    assets: snapshot.assets.filter((asset) => asset.startsWith(prefix)),
  };
}

async function skipIfGone<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
