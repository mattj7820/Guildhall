import { useState } from "react";
import { inputClass, labelClass } from "~/components/styles";
import type { MapImage } from "~/maps/types";
import { assetUrl } from "~/wiki/urls";

/** Long lists get cut short; typing narrows them. */
const SHOWN = 40;

interface Props {
  images: readonly string[];
  /** The chosen image and its measured size, once it has loaded. */
  onChange: (image: MapImage | undefined, path: string) => void;
  /** One column, for narrow spaces such as the editor's side panel. */
  compact?: boolean;
}

/**
 * Chooses a vault image to make a map from, with a preview. The preview also measures the image,
 * since the browser knows its real size (EXIF rotation included) without any image library.
 */
export function ImagePicker({ images, onChange, compact = false }: Props) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string>();
  const [size, setSize] = useState<{ width: number; height: number }>();

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = images.filter((path) => words.every((word) => path.toLowerCase().includes(word)));

  function choose(path: string) {
    setChosen(path);
    setSize(undefined);
    onChange(undefined, path);
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={labelClass}>Image</legend>
      <input
        type="search"
        aria-label="Find an image"
        placeholder="Find an image in the vault"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={inputClass}
      />
      <div className={`grid gap-3 ${compact ? "" : "md:grid-cols-2"}`}>
        <div
          role="radiogroup"
          aria-label="Vault images"
          className={`flex ${compact ? "max-h-40" : "max-h-72"} flex-col overflow-y-auto rounded-md border border-stone-200 p-1 dark:border-stone-800`}
        >
          {matches.length === 0 && (
            <p className="p-2 text-sm text-stone-500">No images match “{query}”.</p>
          )}
          {matches.slice(0, SHOWN).map((path) => (
            <label
              key={path}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-stone-100 has-checked:bg-amber-100 dark:hover:bg-stone-800 dark:has-checked:bg-amber-950"
            >
              <input
                type="radio"
                name="image-choice"
                value={path}
                checked={chosen === path}
                onChange={() => choose(path)}
              />
              <span className="break-all">{path}</span>
            </label>
          ))}
          {matches.length > SHOWN && (
            <p className="p-2 text-xs text-stone-500">
              {matches.length - SHOWN} more; keep typing to narrow the list.
            </p>
          )}
        </div>
        <div className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-md bg-stone-100 p-2 text-sm text-stone-500 dark:bg-stone-800">
          {chosen ? (
            <>
              <img
                key={chosen}
                src={assetUrl(chosen)}
                alt={`Preview of ${chosen}`}
                className="max-h-56 max-w-full object-contain"
                onLoad={(event) => {
                  const measured = {
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  };
                  setSize(measured);
                  onChange({ path: chosen, ...measured }, chosen);
                }}
              />
              <span>{size ? `${size.width} × ${size.height} pixels` : "Loading…"}</span>
            </>
          ) : (
            "Choose an image to preview it."
          )}
        </div>
      </div>
    </fieldset>
  );
}
