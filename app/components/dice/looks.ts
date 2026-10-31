import type { DiceLook } from "~/dice/looks";
import type { DieStyle } from "~/dice/styles";

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

/** A style's look, with the theme's display font unless the style has its own. */
export function styleLook({ look }: Pick<DieStyle, "look">) {
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
