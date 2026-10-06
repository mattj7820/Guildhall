/** Names for tokens placed several at a time: Bandit 1, Bandit 2, Bandit 3. */
import { MARKER_NAME_MAX } from "./schema";

/**
 * Names for `count` new tokens called `name`, given the names already on the map. They're
 * numbered when there's more than one, or when the name's already taken, carrying on after the
 * highest number there (a plain "Bandit" counts as the first). Case and spacing don't matter
 * when comparing, and a long name is cut so its number still fits.
 */
export function numberedNames(name: string, count: number, existing: readonly string[]): string[] {
  const base = name.trim().replace(/\s+/g, " ");
  const key = base.toLowerCase();
  let highest = 0;
  for (const other of existing) {
    const normal = other.trim().replace(/\s+/g, " ").toLowerCase();
    if (normal === key) highest = Math.max(highest, 1);
    const number = normal.startsWith(`${key} `) && /^\d+$/.exec(normal.slice(key.length + 1));
    if (number) highest = Math.max(highest, Number(number[0]));
  }
  if (count === 1 && highest === 0) return [base.slice(0, MARKER_NAME_MAX)];
  return Array.from({ length: count }, (_, index) => {
    const suffix = ` ${highest + index + 1}`;
    return `${base.slice(0, MARKER_NAME_MAX - suffix.length).trimEnd()}${suffix}`;
  });
}
