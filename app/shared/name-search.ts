/** Finding things by name, the way the pickers do. Pure and isomorphic. */

/** Names in order, ignoring case and accents, and numbers by value ("Goblin 2" before "Goblin 10"). */
export const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * How well `names` match a search (already trimmed and lower-cased): 0 exact, 1 a prefix, 2 a
 * word's start, 3 anywhere, the best of them; undefined if none match. An empty search matches
 * everything equally.
 */
export function matchRank(names: string[], query: string): number | undefined {
  if (!query) return 0;
  const ranks = names.flatMap((text) => {
    const name = text.toLowerCase();
    if (name === query) return [0];
    if (name.startsWith(query)) return [1];
    if (name.split(/[\s(),/'’-]+/).some((word) => word.startsWith(query))) return [2];
    return name.includes(query) ? [3] : [];
  });
  return ranks.length ? Math.min(...ranks) : undefined;
}
