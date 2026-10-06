import { tokenIcon } from "~/maps/tokens/icons";
import type { MarkerColour, TokenView } from "~/maps/tokens/types";

/** Marker colours as backgrounds, for lists (the map draws them with `fill`). */
export const MARKER_BACKGROUNDS: Record<MarkerColour, string> = {
  red: "bg-red-600",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
  green: "bg-green-600",
  teal: "bg-teal-600",
  blue: "bg-blue-600",
  purple: "bg-purple-600",
  grey: "bg-stone-500",
};

/** A token's face in a list: what's drawn on the map, small. Decoration: the name is beside it. */
export function TokenThumb({
  token,
}: {
  token: Pick<TokenView, "name" | "colour" | "icon" | "portraitUrl">;
}) {
  const icon = tokenIcon(token.icon);
  const fill = token.colour ? MARKER_BACKGROUNDS[token.colour] : "bg-stone-700";
  return (
    <span
      aria-hidden="true"
      className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-900 ${fill}`}
    >
      {token.portraitUrl ? (
        <img src={token.portraitUrl} alt="" className="h-full w-full object-cover" />
      ) : icon ? (
        <svg viewBox="0 0 512 512" className="h-5 w-5">
          <path d={icon.path} className="fill-white" />
        </svg>
      ) : (
        <span className="font-serif text-xs font-bold text-white">
          {token.name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
