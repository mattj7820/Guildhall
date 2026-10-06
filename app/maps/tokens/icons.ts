/** Built-in icons for the DM's tokens, and guessing one from a token's name. */
import { TOKEN_ICONS, type TokenIcon } from "./token-icons";

export function tokenIcon(id: string | undefined): TokenIcon | undefined {
  return id === undefined ? undefined : TOKEN_ICONS.find((icon) => icon.id === id);
}

/**
 * Guesses an icon from a token's name: "Bandit 2" a rogue, "The Prancing Pony inn" a tavern.
 * The last word that matches wins, as names usually end with what the thing is ("Old Mill
 * door"). Undefined when nothing matches, for initials on a colour.
 */
export function guessTokenIcon(name: string): string | undefined {
  const words: string[] = name.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const word of words.reverse()) {
    const icon = TOKEN_ICONS.find((candidate) => matches(candidate, word));
    if (icon) return icon.id;
  }
  return undefined;
}

function matches(icon: TokenIcon, word: string): boolean {
  const names = [icon.id, ...icon.label.toLowerCase().split(" "), ...icon.keywords];
  const singulars = [word.replace(/s$/, ""), word.replace(/es$/, "")];
  return [word, ...singulars].some((form) => names.includes(form));
}
