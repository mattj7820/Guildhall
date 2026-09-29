/**
 * Quick add: turning what someone types mid-session ("3 rope", "torch x5") into an item's name,
 * quantity and a best-guess icon.
 */
import { QUANTITY_MAX } from "./inventory";
import { ITEM_ICONS, type ItemIcon } from "./item-icons";

export interface QuickAddText {
  name: string;
  quantity: number;
}

/** Units that make a leading number part of the name: "50 ft of rope" is one coil, not 50. */
const UNITS =
  /^(ft|feet|foot|in|inch|inches|lb|lbs|pounds?|oz|gp|sp|cp|ep|pp|days?|hours?|m|metres?|meters?)\b/i;

/** Undefined for blank text. A count can lead ("3 rope", "3x rope") or trail ("rope x3", "rope ×3"). */
export function parseQuickAdd(text: string): QuickAddText | undefined {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return undefined;

  const leading = /^(\d+)\s*[x×]?\s+(.+)$/i.exec(trimmed);
  if (leading && !UNITS.test(leading[2])) return item(leading[2], leading[1]);

  // A space before the x, so the x at the end of a name ("Wax5") isn't read as "times".
  const trailing = /^(.+?)\s+[x×]\s*(\d+)$/i.exec(trimmed);
  if (trailing) return item(trailing[1], trailing[2]);

  return { name: trimmed, quantity: 1 };
}

function item(name: string, count: string): QuickAddText {
  const quantity = Math.max(1, Math.min(QUANTITY_MAX, Number(count)));
  return { name: name.trim(), quantity };
}

/** The icon used when nothing better is known. */
export const FALLBACK_ICON = "bag";

/**
 * Guesses an icon from an item's name. The words before "of" usually say what the thing is ("bag
 * of holding", "potion of healing"), so they're tried first, the last of them first ("healing
 * potion"); then the rest. Plurals match too.
 */
export function guessIcon(name: string): string {
  const words: string[] = name.toLowerCase().match(/[a-z]+/g) ?? [];
  const of = words.indexOf("of");
  const head = of < 0 ? words : words.slice(0, of);
  const tail = of < 0 ? [] : words.slice(of + 1);
  for (const word of [...[...head].reverse(), ...tail]) {
    const icon = ITEM_ICONS.find((candidate) => matches(candidate, word));
    if (icon) return icon.id;
  }
  return FALLBACK_ICON;
}

function matches(icon: ItemIcon, word: string): boolean {
  const names = [icon.id, ...icon.label.toLowerCase().split(" "), ...icon.keywords];
  const singulars = [word.replace(/s$/, ""), word.replace(/es$/, "")];
  return [word, ...singulars].some((form) => names.includes(form));
}

export function iconById(id: string): ItemIcon {
  return (
    ITEM_ICONS.find((icon) => icon.id === id) ??
    ITEM_ICONS.find((icon) => icon.id === FALLBACK_ICON) ??
    ITEM_ICONS[0]
  );
}
