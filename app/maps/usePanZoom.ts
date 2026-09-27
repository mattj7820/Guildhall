import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { Size } from "./types";
import {
  clamp,
  fit,
  pan,
  toImage,
  viewBox as toViewBox,
  zoomAt,
  zoomPercent,
  type View,
} from "./viewport";

/** A press that moves less than this is a click, not a drag. */
const DRAG_THRESHOLD = 4;
const ZOOM_STEP = 1.5;
const KEY_PAN = 80;

interface Press {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  panning: boolean;
}

/**
 * Pan and zoom state for the map canvas: drag to pan, wheel to zoom at the cursor, arrow keys,
 * `+`, `-` and `0`. Until the canvas has been measured (and while the DM hasn't moved it) the
 * whole image is fitted, which is also what the server renders, so nothing jumps on hydration.
 */
export function usePanZoom(image: Size) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ viewport: Size | null; moved: View | null }>({
    viewport: null,
    /** Null while the image is simply fitted, so it stays fitted when the window resizes. */
    moved: null,
  });
  const press = useRef<Press | null>(null);
  const swallowClick = useRef(false);

  const { viewport } = state;
  const view = viewport && currentView(state.moved, image, viewport);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) setState((prev) => ({ ...prev, viewport: { width, height } }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const update = useCallback(
    (change: (view: View, viewport: Size) => View) =>
      setState((prev) =>
        prev.viewport
          ? { ...prev, moved: change(currentView(prev.moved, image, prev.viewport), prev.viewport) }
          : prev,
      ),
    [image],
  );

  const zoomBy = useCallback(
    (factor: number, at?: { x: number; y: number }) =>
      update((current, size) =>
        zoomAt(current, factor, at ?? { x: size.width / 2, y: size.height / 2 }, image, size),
      ),
    [image, update],
  );

  const fitView = useCallback(() => setState((prev) => ({ ...prev, moved: null })), []);

  // React's onWheel is passive, so it can't stop the page scrolling; listen natively instead.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoomBy(Math.exp(-event.deltaY * 0.0015), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  /** A pointer position in image pixels, or undefined before the canvas is measured. */
  function clientToImage(clientX: number, clientY: number): [number, number] | undefined {
    const element = containerRef.current;
    if (!element || !view) return undefined;
    const rect = element.getBoundingClientRect();
    return toImage(view, clientX - rect.left, clientY - rect.top);
  }

  const pointerHandlers = {
    onPointerDown(event: PointerEvent<Element>) {
      if (event.button !== 0 && event.button !== 1) return;
      press.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        panning: false,
      };
    },
    onPointerMove(event: PointerEvent<Element>) {
      const current = press.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!current.panning) {
        const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
        if (distance < DRAG_THRESHOLD) return;
        // Capture only once it's a drag: capturing on press would send the click to the canvas
        // instead of the area or handle under the pointer.
        current.panning = true;
        containerRef.current?.setPointerCapture(event.pointerId);
      }
      const dx = event.clientX - current.lastX;
      const dy = event.clientY - current.lastY;
      current.lastX = event.clientX;
      current.lastY = event.clientY;
      update((view, size) => pan(view, dx, dy, image, size));
    },
    onPointerUp(event: PointerEvent<Element>) {
      const current = press.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (current.panning) {
        swallowClick.current = true;
        containerRef.current?.releasePointerCapture(event.pointerId);
      }
      press.current = null;
    },
    onPointerCancel() {
      press.current = null;
    },
    /** The click that ends a drag isn't a click on whatever the pointer stopped over. */
    onClickCapture(event: MouseEvent<Element>) {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };

  function onKeyDown(event: KeyboardEvent<Element>) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const panBy = (dx: number, dy: number) => update((v, size) => pan(v, dx, dy, image, size));
    const actions: Record<string, () => void> = {
      ArrowLeft: () => panBy(KEY_PAN, 0),
      ArrowRight: () => panBy(-KEY_PAN, 0),
      ArrowUp: () => panBy(0, KEY_PAN),
      ArrowDown: () => panBy(0, -KEY_PAN),
      "+": () => zoomBy(ZOOM_STEP),
      "=": () => zoomBy(ZOOM_STEP),
      "-": () => zoomBy(1 / ZOOM_STEP),
      "0": fitView,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  return {
    containerRef,
    /** Before the canvas is measured: the whole image, which `meet` fits and centres. */
    viewBox: view && viewport ? toViewBox(view, viewport) : `0 0 ${image.width} ${image.height}`,
    /** Screen pixels per image pixel, for sizing handles and strokes; 1 until measured. */
    scale: view?.scale ?? 1,
    percent: view && viewport ? zoomPercent(view, image, viewport) : 100,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    fitView,
    clientToImage,
    pointerHandlers,
    onKeyDown,
  };
}

function currentView(moved: View | null, image: Size, viewport: Size): View {
  return moved ? clamp(moved, image, viewport) : fit(image, viewport);
}
