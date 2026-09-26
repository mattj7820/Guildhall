import { basename, dirname, joinVaultPath } from "./paths";

/** The parts of a `[[wikilink]]` or `![[embed]]`, before resolution. */
export interface WikilinkParts {
  /** Target note or file as written, e.g. `NPCs/Mira`. Empty for same-note links like `[[#Heading]]`. */
  target: string;
  /** Heading after `#`, e.g. `Loot` in `[[Session 1#Loot]]`. For nested headings, the last one. */
  heading?: string;
  /** Block ID after `#^`, e.g. `abc123` in `[[Note#^abc123]]`. */
  block?: string;
  /** Text after `|`: display text for links, size for image embeds. */
  alias?: string;
}

/** Splits the inside of `[[…]]` into its parts. `\|` (used inside markdown tables) counts as `|`. */
export function parseWikilink(inner: string): WikilinkParts {
  const normalised = inner.replace(/\\\|/g, "|");
  const pipe = normalised.indexOf("|");
  const linkPart = (pipe === -1 ? normalised : normalised.slice(0, pipe)).trim();
  const alias = pipe === -1 ? undefined : normalised.slice(pipe + 1).trim() || undefined;

  const hash = linkPart.indexOf("#");
  const target = (hash === -1 ? linkPart : linkPart.slice(0, hash)).trim();
  const subpath = hash === -1 ? "" : linkPart.slice(hash + 1);

  const parts: WikilinkParts = { target, alias };
  if (subpath.startsWith("^")) {
    parts.block = subpath.slice(1).trim() || undefined;
  } else if (subpath) {
    const headings = subpath
      .split("#")
      .map((h) => h.trim())
      .filter(Boolean);
    parts.heading = headings.at(-1);
  }
  return parts;
}

/**
 * Resolves link targets to vault paths using Obsidian's rules:
 *
 * 1. A target containing `/` is tried as a path from the vault root, then relative to the linking
 *    note, then as a path suffix (`Brindleford/Old Mill` matches `Locations/Brindleford/Old Mill.md`).
 * 2. Otherwise it's matched by file name anywhere in the vault.
 * 3. Targets without an extension also try `.md`, so `[[Mira]]` finds `Mira.md`.
 * 4. When several files match, prefer one in the linking note's folder, then the shortest path,
 *    then alphabetical order, so resolution is deterministic.
 *
 * Matching is case-insensitive, as Obsidian is on Windows and macOS.
 */
export interface LinkResolver {
  /** Returns the vault path the target points at, or undefined if nothing matches. */
  resolve(target: string, fromPath: string): string | undefined;
}

export function createLinkResolver(vaultPaths: readonly string[]): LinkResolver {
  const byPath = new Map<string, string>();
  const byName = new Map<string, string[]>();
  for (const vaultPath of vaultPaths) {
    byPath.set(vaultPath.toLowerCase(), vaultPath);
    const name = basename(vaultPath).toLowerCase();
    byName.set(name, [...(byName.get(name) ?? []), vaultPath]);
  }

  function pickBest(candidates: string[], fromPath: string): string | undefined {
    if (candidates.length <= 1) return candidates[0];
    const fromDir = dirname(fromPath);
    return [...candidates].sort(
      (a, b) =>
        Number(dirname(b) === fromDir) - Number(dirname(a) === fromDir) ||
        a.split("/").length - b.split("/").length ||
        a.length - b.length ||
        a.localeCompare(b),
    )[0];
  }

  function resolveExact(target: string, fromPath: string): string | undefined {
    const lower = target.toLowerCase();
    if (lower.includes("/")) {
      const relative = joinVaultPath(dirname(fromPath), target)?.toLowerCase();
      const direct =
        byPath.get(lower.replace(/^\/+/, "")) ?? (relative ? byPath.get(relative) : undefined);
      if (direct) return direct;
      const suffix = `/${lower.replace(/^(\.\.?\/)+/, "")}`;
      return pickBest(
        [...byPath.entries()].filter(([key]) => key.endsWith(suffix)).map(([, value]) => value),
        fromPath,
      );
    }
    return pickBest(byName.get(lower) ?? [], fromPath);
  }

  return {
    resolve(target, fromPath) {
      const trimmed = target.trim();
      if (!trimmed) return undefined;
      return resolveExact(trimmed, fromPath) ?? resolveExact(`${trimmed}.md`, fromPath);
    },
  };
}
