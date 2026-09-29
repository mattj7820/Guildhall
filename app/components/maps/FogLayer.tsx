import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { cellAlpha } from "~/maps/fog/tiles";
import type { FogMask } from "~/maps/fog/types";
import type { Size } from "~/maps/types";

interface Props {
  mask: FogMask;
  /** The canvas's coordinate system: the size the areas were drawn against. */
  size: Size;
  /** 1 for fog players would see (solid black), less to see the map through it. */
  opacity: number;
  /** Drawn into the fog's mask on top: black clears the fog, white adds it (a stroke in progress). */
  preview?: ReactNode;
}

const MASK_ID = "fog-of-war";

/**
 * The fog drawn over the whole map, for the DM: from the same cell opacities players' tiles are
 * masked with, so its soft edge matches theirs. The browser smooths the low-resolution mask as it
 * scales it up. Drawn only in the browser, where there's a canvas to make the mask with.
 */
export function FogLayer({ mask, size, opacity, preview }: Props) {
  const url = useFogImage(mask, "fog");
  if (!url) return null;
  return (
    <g aria-hidden="true" pointerEvents="none">
      <defs>
        <mask id={MASK_ID} maskUnits="userSpaceOnUse" x={0} y={0} {...size}>
          <image href={url} {...size} preserveAspectRatio="none" />
          {preview}
        </mask>
      </defs>
      <rect {...size} fill="black" opacity={opacity} mask={`url(#${MASK_ID})`} />
    </g>
  );
}

const noSubscription = () => () => {};

/**
 * The fog as an image for an SVG mask, one pixel per cell: white where the fog is ("fog") or
 * where it's clear ("revealed"), grey along the edge. Only in the browser, which has a canvas.
 */
export function useFogImage(mask: FogMask, white: "fog" | "revealed"): string | undefined {
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return useMemo(() => (inBrowser ? fogImage(mask, white) : undefined), [inBrowser, mask, white]);
}

function fogImage(mask: FogMask, white: "fog" | "revealed"): string {
  const canvas = document.createElement("canvas");
  canvas.width = mask.cols;
  canvas.height = mask.rows;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const pixels = context.createImageData(mask.cols, mask.rows);
  cellAlpha(mask).forEach((shown, index) => {
    const value = white === "fog" ? 255 - shown : shown;
    pixels.data.set([value, value, value, 255], index * 4);
  });
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
}
