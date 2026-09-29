/**
 * Pan and zoom for the map canvas. A view is where the image sits on screen: `scale` screen
 * pixels per image pixel, and the image position (`x`, `y`) shown at the top-left corner. The
 * canvas turns it into an SVG viewBox, so the browser redraws the image sharply at every zoom.
 */
import type { Size } from "./types";

export interface View {
  scale: number;
  x: number;
  y: number;
}

/** Zooming in stops at this many screen pixels per image pixel (or 4× the fit, for tiny images). */
const MAX_SCALE = 4;

/** The whole image, as large as fits, centred. */
export function fit(image: Size, viewport: Size): View {
  const scale = fitScale(image, viewport);
  return centred(scale, image, viewport);
}

function fitScale(image: Size, viewport: Size): number {
  return Math.min(viewport.width / image.width, viewport.height / image.height);
}

function centred(scale: number, image: Size, viewport: Size): View {
  return {
    scale,
    x: (image.width - viewport.width / scale) / 2,
    y: (image.height - viewport.height / scale) / 2,
  };
}

export function scaleLimits(image: Size, viewport: Size): { min: number; max: number } {
  const min = fitScale(image, viewport);
  return { min, max: Math.max(MAX_SCALE, min * 4) };
}

/**
 * Keeps the image on screen: never zoomed out beyond fitting it, and never panned so far that
 * empty space shows on a side where there's more image to see. Along an axis where the whole
 * image fits, it's centred.
 */
export function clamp(view: View, image: Size, viewport: Size): View {
  const { min, max } = scaleLimits(image, viewport);
  const scale = Math.min(max, Math.max(min, view.scale));
  const axis = (position: number, imageLength: number, viewportLength: number) => {
    const shown = viewportLength / scale;
    if (shown >= imageLength) return (imageLength - shown) / 2;
    return Math.min(imageLength - shown, Math.max(0, position));
  };
  return {
    scale,
    x: axis(view.x, image.width, viewport.width),
    y: axis(view.y, image.height, viewport.height),
  };
}

/** Zooms by `factor`, keeping the image point under `at` (screen pixels in the canvas) still. */
export function zoomAt(
  view: View,
  factor: number,
  at: { x: number; y: number },
  image: Size,
  viewport: Size,
): View {
  const [imageX, imageY] = toImage(view, at.x, at.y);
  const { min, max } = scaleLimits(image, viewport);
  const scale = Math.min(max, Math.max(min, view.scale * factor));
  return clamp({ scale, x: imageX - at.x / scale, y: imageY - at.y / scale }, image, viewport);
}

/**
 * Puts an image point (in image pixels) in the middle of the screen, zoomed in to at least twice
 * the fit so what's there stands out, as far as the image's edges allow.
 */
export function centreOn(
  view: View,
  [imageX, imageY]: [number, number],
  image: Size,
  viewport: Size,
): View {
  const { max } = scaleLimits(image, viewport);
  const scale = Math.min(max, Math.max(view.scale, fitScale(image, viewport) * 2));
  return clamp(
    { scale, x: imageX - viewport.width / 2 / scale, y: imageY - viewport.height / 2 / scale },
    image,
    viewport,
  );
}

/** Moves the image by a distance in screen pixels, as when dragging it. */
export function pan(view: View, dx: number, dy: number, image: Size, viewport: Size): View {
  return clamp(
    { scale: view.scale, x: view.x - dx / view.scale, y: view.y - dy / view.scale },
    image,
    viewport,
  );
}

/** A position in the canvas (screen pixels from its top-left) as image pixels. */
export function toImage(view: View, screenX: number, screenY: number): [number, number] {
  return [view.x + screenX / view.scale, view.y + screenY / view.scale];
}

/** An image-pixel position as screen pixels from the canvas's top-left. */
export function toScreen(view: View, imageX: number, imageY: number): [number, number] {
  return [(imageX - view.x) * view.scale, (imageY - view.y) * view.scale];
}

/** The SVG viewBox showing this view in a canvas of the given size. */
export function viewBox(view: View, viewport: Size): string {
  return [view.x, view.y, viewport.width / view.scale, viewport.height / view.scale].join(" ");
}

/** How far the view is zoomed in compared with fitting the whole image, as a percentage. */
export function zoomPercent(view: View, image: Size, viewport: Size): number {
  return Math.round((view.scale / fitScale(image, viewport)) * 100);
}
