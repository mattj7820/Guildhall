import type { DiceLook } from "~/dice/looks";
import { DICE_SET_INFO, type DiceSetId } from "~/dice/sets";

/** The theme's dice: its accent colour, with its display font for the numbers. */
export function themeLook(within: HTMLElement): DiceLook {
  return {
    body: resolved(within, "color", "var(--color-accent)"),
    ink: resolved(within, "color", "var(--color-on-accent)"),
    font: resolved(within, "fontFamily", "var(--font-display)"),
    metalness: 0.1,
    roughness: 0.45,
    opacity: 1,
  };
}

/** A dice set's look, with the theme's display font unless the set has its own. */
export function setLook(set: DiceSetId) {
  const { look } = DICE_SET_INFO[set];
  return (within: HTMLElement): DiceLook => ({
    ...look,
    font: look.font ?? resolved(within, "fontFamily", "var(--font-display)"),
  });
}

/** A theme value as the browser resolves it (light-dark() included), for WebGL. */
function resolved(within: HTMLElement, property: "color" | "fontFamily", value: string): string {
  const probe = document.createElement("span");
  probe.style[property] = value;
  within.appendChild(probe);
  const result = getComputedStyle(probe)[property];
  probe.remove();
  return result;
}
