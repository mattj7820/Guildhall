import { useEffect, useState } from "react";
import { normalise } from "~/maps/geometry";
import { addToPick, togglePick, tokensInBox } from "~/maps/tokens/picking";
import type { TokenId, TokenView } from "~/maps/tokens/types";
import type { Point, Size } from "~/maps/types";
import type { CanvasTools } from "./MapCanvas";

/**
 * The DM's pick of tokens on the map page, for starting a fight with them or damaging them in
 * one: Shift-click adds or takes out one, and a drag with Shift held draws a box that adds the
 * tokens inside. Tokens that leave the map leave the pick.
 */
export function useTokenPick(tokens: readonly TokenView[], enabled: boolean) {
  const [ids, setIds] = useState<TokenId[]>([]);
  const picked = ids.filter((id) => tokens.some((token) => token.id === id));
  const shift = useShiftHeld(enabled);
  const [box, setBox] = useState<{ from: Point; to: Point }>();

  /** Drawn under the tokens while Shift is held, so a click on a token still reaches it. */
  function boxLayer(size: Size, canvas: CanvasTools) {
    if (!enabled || (!shift && !box)) return null;
    const at = (event: { clientX: number; clientY: number }): Point | undefined => {
      const point = canvas.clientToImage(event.clientX, event.clientY);
      return point && normalise(point[0], point[1], size);
    };
    const [x, y] = box ? [Math.min(box.from[0], box.to[0]), Math.min(box.from[1], box.to[1])] : [];
    return (
      <>
        <rect
          {...size}
          fill="transparent"
          className="cursor-crosshair"
          aria-label="Drag to pick the tokens inside"
          onPointerDown={(event) => {
            const point = at(event);
            if (!point || event.button !== 0) return;
            // Not a pan.
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            setBox({ from: point, to: point });
          }}
          onPointerMove={(event) => {
            const point = box && at(event);
            if (point) setBox({ ...box, to: point });
          }}
          onPointerUp={() => {
            if (box) setIds(addToPick(picked, tokensInBox(tokens, box.from, box.to)));
            setBox(undefined);
          }}
          onPointerCancel={() => setBox(undefined)}
          // A click on the map with Shift held places nothing.
          onClick={(event) => event.stopPropagation()}
        />
        {box && x !== undefined && y !== undefined && (
          <rect
            x={x * size.width}
            y={y * size.height}
            width={Math.abs(box.to[0] - box.from[0]) * size.width}
            height={Math.abs(box.to[1] - box.from[1]) * size.height}
            strokeWidth={1.5 / canvas.scale}
            strokeDasharray={`${6 / canvas.scale} ${4 / canvas.scale}`}
            className="pointer-events-none fill-sky-400/15 stroke-sky-400"
          />
        )}
      </>
    );
  }

  return {
    picked,
    toggle: (id: TokenId) => setIds(togglePick(picked, id)),
    set: (next: readonly TokenId[]) => setIds([...next]),
    clear: () => setIds([]),
    boxLayer,
  };
}

/** Whether Shift is held down now (forgotten when the window loses focus). */
function useShiftHeld(enabled: boolean): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const down = (event: KeyboardEvent) => event.key === "Shift" && setHeld(true);
    const up = (event: KeyboardEvent) => event.key === "Shift" && setHeld(false);
    const blur = () => setHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [enabled]);
  return enabled && held;
}
