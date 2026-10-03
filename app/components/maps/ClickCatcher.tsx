import type { Size } from "~/maps/types";
import type { CanvasTools } from "./MapCanvas";

/**
 * A see-through layer over the whole image that takes the next click on the map, for placing or
 * playing something there: it answers with the point in image pixels, and the canvas's scale.
 */
export function ClickCatcher({
  size,
  canvas,
  label,
  onPoint,
}: {
  size: Size;
  canvas: CanvasTools;
  label?: string;
  onPoint: (point: [number, number], scale: number) => void;
}) {
  return (
    <rect
      {...size}
      fill="transparent"
      className="cursor-crosshair"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        const point = canvas.clientToImage(event.clientX, event.clientY);
        if (point) onPoint(point, canvas.scale);
      }}
    />
  );
}
