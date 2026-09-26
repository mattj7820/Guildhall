import path from "node:path";

/**
 * Vault paths are always POSIX-style and relative to the vault root (e.g. `NPCs/Mira.md`),
 * regardless of the host OS, so IDs and URLs are identical on Windows and Linux.
 */
export function toVaultPath(absoluteRoot: string, absoluteFile: string): string {
  return path.relative(absoluteRoot, absoluteFile).split(path.sep).join("/");
}

/** `NPCs/Mira Stonehand.md` → `Mira Stonehand.md` */
export function basename(vaultPath: string): string {
  return vaultPath.slice(vaultPath.lastIndexOf("/") + 1);
}

/** `NPCs/Mira Stonehand.md` → `NPCs`; root-level files → `` */
export function dirname(vaultPath: string): string {
  const index = vaultPath.lastIndexOf("/");
  return index === -1 ? "" : vaultPath.slice(0, index);
}

/** `NPCs/Mira Stonehand.md` → `NPCs/Mira Stonehand` */
export function stripMarkdownExtension(vaultPath: string): string {
  return vaultPath.replace(/\.md$/i, "");
}

export function isMarkdown(vaultPath: string): boolean {
  return /\.md$/i.test(vaultPath);
}

/**
 * Resolves a path written relative to another file (`../Maps/x.png`) into a vault path.
 * Returns undefined if it would escape the vault root.
 */
export function joinVaultPath(fromDir: string, relative: string): string | undefined {
  const segments = fromDir ? fromDir.split("/") : [];
  for (const segment of relative.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return undefined;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join("/");
}
