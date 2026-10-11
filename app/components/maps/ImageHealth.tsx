import { useState } from "react";
import { useFetcher } from "react-router";
import { buttonClass } from "~/components/styles";
import { sameShape } from "~/maps/image-size";
import type { MapImage, MapView, Size } from "~/maps/types";
import { mapEditUrl } from "~/maps/urls";
import type { action } from "~/routes/map-edit";
import { ImagePicker } from "./ImagePicker";

interface Props {
  map: Pick<MapView, "id" | "image" | "size">;
  images: readonly string[];
  /** The image's real size once it has loaded in the browser. */
  actual?: Size;
}

/**
 * Warns the DM when a map's image isn't where it was, or has changed shape since the areas were
 * drawn, and offers the fix. A re-export at a different resolution but the same shape needs
 * nothing: outlines are stored as fractions of the image.
 */
export function ImageHealth({ map, images, actual }: Props) {
  const fetcher = useFetcher<typeof action>();
  const [choosing, setChoosing] = useState(false);
  const { image, size } = map;

  const setImage = (next: MapImage) =>
    fetcher.submit(
      { intent: "setImage", image: { path: next.path, width: next.width, height: next.height } },
      { method: "post", encType: "application/json", action: mapEditUrl(map.id) },
    );
  const busy = fetcher.state !== "idle";
  const error = fetcher.data && "error" in fetcher.data ? fetcher.data.error : undefined;

  let message: React.ReactNode;
  let fix: React.ReactNode;
  if (image.status === "missing") {
    message = (
      <>
        This map's image (<code>{image.path}</code>) isn't in the vault any more. Its areas are
        kept.
      </>
    );
    fix = choosing ? (
      <div className="mt-2 w-full max-w-2xl">
        <ImagePicker images={images} compact onChange={(chosen) => chosen && setImage(chosen)} />
      </div>
    ) : (
      <button type="button" className={buttonClass} onClick={() => setChoosing(true)}>
        Choose another image…
      </button>
    );
  } else if (image.status === "moved" && image.movedTo) {
    message = (
      <>
        This map's image has moved to <code>{image.movedTo}</code>.
      </>
    );
    fix = (
      <button
        type="button"
        className={buttonClass}
        disabled={busy}
        onClick={() => setImage({ path: image.movedTo!, ...size })}
      >
        Use the new location
      </button>
    );
  } else if (actual && image.path && !sameShape(size, actual)) {
    message = (
      <>
        The image has changed shape since its areas were drawn ({size.width} × {size.height} then,{" "}
        {actual.width} × {actual.height} now), so they may not line up.
      </>
    );
    fix = (
      <button
        type="button"
        className={buttonClass}
        disabled={busy}
        onClick={() => setImage({ path: image.path!, ...actual })}
      >
        Keep the areas as they are
      </button>
    );
  } else {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-warn-surface px-4 py-2 text-sm text-warn"
    >
      <p>{message}</p>
      {fix}
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
