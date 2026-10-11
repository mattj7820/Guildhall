import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { Size } from "~/maps/types";
import { usePanZoom } from "~/maps/usePanZoom";

/** What the canvas's contents need: the zoom, and a way to place a pointer on the image. */
export interface CanvasTools {
  /** Screen pixels per image pixel, for keeping handles and labels the same size on screen. */
  scale: number;
  /** A pointer position in image pixels. */
  clientToImage: (clientX: number, clientY: number) => [number, number] | undefined;
}

interface Props {
  name: string;
  /** The size the areas were drawn against: the canvas's coordinate system, in image pixels. */
  size: Size;
  imageUrl?: string;
  /** Drawn instead of the whole image, e.g. the tiles players may see. */
  backdrop?: ReactNode;
  /** Areas, handles and anything else drawn over the image, in image pixels. */
  children?: (canvas: CanvasTools) => ReactNode;
  /** Called with the image's real size once it has loaded. */
  onImageMeasured?: (actual: Size) => void;
  /** A click on the map (not on an area or handle), in image pixels. */
  onCanvasClick?: (point: [number, number]) => void;
  /** The pointer's position over the map, in image pixels. */
  onCanvasPointerMove?: (point: [number, number]) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** Centres the view on this image point (image pixels) whenever `key` changes: "Find". */
  focus?: { at: [number, number]; key: number };
  className?: string;
}

/**
 * The map image with an SVG overlay, panned and zoomed by changing the SVG's viewBox, so the
 * browser redraws the image sharply at every zoom level and strokes keep their width.
 */
export function MapCanvas({
  name,
  size,
  imageUrl,
  backdrop,
  children,
  onImageMeasured,
  onCanvasClick,
  onCanvasPointerMove,
  onKeyDown,
  focus,
  className = "",
}: Props) {
  const {
    containerRef,
    viewBox,
    scale,
    percent,
    zoomIn,
    zoomOut,
    fitView,
    centreOn,
    clientToImage,
    pointerHandlers,
    onKeyDown: panZoomKeys,
  } = usePanZoom(size);

  const focusKey = focus?.key;
  const focusAt = useRef(focus?.at);
  useEffect(() => {
    focusAt.current = focus?.at;
  });
  useEffect(() => {
    if (focusKey !== undefined && focusAt.current) centreOn(focusAt.current);
  }, [focusKey, centreOn]);

  // SVG <image> doesn't report its natural size, so load it once more (from cache) to measure.
  useEffect(() => {
    if (!imageUrl || !onImageMeasured) return;
    let cancelled = false;
    const probe = new Image();
    probe.src = imageUrl;
    probe
      .decode()
      .then(() => {
        if (!cancelled) onImageMeasured({ width: probe.naturalWidth, height: probe.naturalHeight });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imageUrl, onImageMeasured]);

  return (
    <div className={`relative overflow-hidden bg-line ${className}`}>
      <div
        ref={containerRef}
        role="region"
        aria-label={`Map: ${name}`}
        aria-roledescription="map"
        tabIndex={0}
        className="h-full w-full cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset active:cursor-grabbing"
        onKeyDown={(event) => {
          onKeyDown?.(event);
          panZoomKeys(event);
        }}
        {...pointerHandlers}
      >
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="block h-full w-full select-none"
          onClick={(event) => {
            if (!onCanvasClick) return;
            const point = clientToImage(event.clientX, event.clientY);
            if (point) onCanvasClick(point);
          }}
          onPointerMove={(event) => {
            if (!onCanvasPointerMove) return;
            const point = clientToImage(event.clientX, event.clientY);
            if (point) onCanvasPointerMove(point);
          }}
        >
          {backdrop ??
            (imageUrl ? (
              <image
                href={imageUrl}
                width={size.width}
                height={size.height}
                preserveAspectRatio="none"
              />
            ) : (
              <rect
                width={size.width}
                height={size.height}
                className="fill-stone-300 dark:fill-stone-700"
              />
            ))}
          {children?.({ scale, clientToImage })}
        </svg>
      </div>
      <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-md bg-surface/90 p-1 text-sm shadow">
        <button type="button" onClick={zoomIn} aria-label="Zoom in" className={button}>
          +
        </button>
        <button type="button" onClick={zoomOut} aria-label="Zoom out" className={button}>
          −
        </button>
        <button type="button" onClick={fitView} className={button}>
          Fit
        </button>
        <span aria-label="Zoom level" role="status" className="w-12 text-center tabular-nums">
          {percent}%
        </span>
      </div>
    </div>
  );
}

const button = "min-w-8 rounded px-2 py-1 font-semibold hover:bg-line";
