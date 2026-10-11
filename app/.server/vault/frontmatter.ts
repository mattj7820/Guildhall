/** Reading frontmatter values leniently: a note's YAML is typed by hand in Obsidian. */

export function nonEmptyString(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Obsidian accepts both YAML lists and single/comma-separated strings for aliases and tags. */
export function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(nonEmptyString).filter((item): item is string => item !== undefined);
  }
  const single = nonEmptyString(value);
  return single
    ? single
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
