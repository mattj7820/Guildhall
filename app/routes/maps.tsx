import { useState } from "react";
import { data, Form, redirect, useActionData, useNavigation } from "react-router";
import { requireDm } from "~/.server/not-found";
import { DataFileError } from "~/.server/data/json-store";
import { facesByMap, listMaps } from "~/.server/maps/maps-page";
import { whereabouts } from "~/.server/maps/tokens";
import { ImagePicker } from "~/components/maps/ImagePicker";
import { MapsBrowser } from "~/components/maps/MapsBrowser";
import { NotePicker } from "~/components/maps/NotePicker";
import { inputClass, panelClass, primaryButtonClass, buttonClass } from "~/components/styles";
import type { Viewer } from "~/campaign/types";
import { servicesContext, viewerContext, type Services } from "~/context";
import { mapImageSchema, MAP_NAME_MAX } from "~/maps/schema";
import { mapTree } from "~/maps/tree";
import type { MapImage } from "~/maps/types";
import type { Whereabouts } from "~/maps/tokens/types";
import { mapEditUrl } from "~/maps/urls";
import type { Route } from "./+types/maps";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Maps · Guildhall" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const party = await partyWhereabouts(services, viewer);
  const forDm = viewer.role === "dm";
  const current = services.vault.current;
  const picker = forDm
    ? {
        images: current.mapImages(),
        notes: current.notes(viewer).map(({ id, slug, title }) => ({ id, slug, title })),
      }
    : undefined;
  try {
    const maps = await listMaps(services, viewer);
    return { forDm, tree: mapTree(maps), party, faces: facesByMap(party, maps), picker };
  } catch (error) {
    if (!(error instanceof DataFileError)) throw error;
    // The DM is told what's wrong with the file; players aren't told where it is.
    const message = forDm ? error.message : "The maps can't be shown just now.";
    return { forDm, tree: [], party, faces: {}, picker, error: message };
  }
}

/** Where the party is, or nothing if the tokens can't be read just now (the map list says why). */
async function partyWhereabouts(services: Services, viewer: Viewer): Promise<Whereabouts[]> {
  try {
    return await whereabouts(services, viewer);
  } catch (error) {
    if (error instanceof DataFileError) return [];
    throw error;
  }
}

/** Creates a map from the form (image, its measured size, name, note) and opens the editor. */
export async function action({ request, context }: Route.ActionArgs) {
  const viewer = context.get(viewerContext);
  requireDm(viewer);
  const { maps, vault } = context.get(servicesContext);
  const form = await request.formData();

  const image = mapImageSchema.safeParse({
    path: form.get("image"),
    width: Number(form.get("width")),
    height: Number(form.get("height")),
  });
  if (!image.success || !vault.current.mapImages().includes(image.data.path)) {
    return data({ error: "Choose an image from the vault, and wait for its preview." }, 400);
  }
  const noteSlug = String(form.get("note") ?? "").trim();
  const note = noteSlug ? vault.current.getNote(noteSlug, viewer) : undefined;
  if (noteSlug && !note) return data({ error: `There's no note called “${noteSlug}”.` }, 400);

  const created = await maps.create({
    name: String(form.get("name") ?? ""),
    image: image.data,
    note: note?.id,
  });
  return redirect(mapEditUrl(created.id));
}

type Picker = NonNullable<Route.ComponentProps["loaderData"]["picker"]>;

export default function Maps({ loaderData }: Route.ComponentProps) {
  const [creating, setCreating] = useState(false);
  const { forDm, tree, party, faces, picker } = loaderData;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-serif text-3xl font-bold">Maps</h1>
        {picker && !creating && (
          <button type="button" className={primaryButtonClass} onClick={() => setCreating(true)}>
            New map
          </button>
        )}
      </div>

      {picker && creating && <NewMapForm picker={picker} onCancel={() => setCreating(false)} />}

      {"error" in loaderData && loaderData.error ? (
        <p role="alert" className="rounded-md bg-danger-surface px-3 py-2 text-sm text-danger">
          {loaderData.error}
        </p>
      ) : tree.length === 0 ? (
        !creating &&
        (forDm ? (
          <div className={`${panelClass} text-center`}>
            <p className="font-semibold">No maps yet.</p>
            <p className="mt-1 text-sm text-muted">
              Make one from any image in the vault, then outline the places on it that lead to more
              detailed maps or to wiki notes.
            </p>
          </div>
        ) : (
          <div className={`${panelClass} text-center`}>
            <p className="font-semibold">No maps yet.</p>
            <p className="mt-1 text-sm text-muted">
              Maps appear here as the DM shares them, and open up as the party explores.
            </p>
          </div>
        ))
      ) : (
        <MapsBrowser tree={tree} party={party} faces={faces} forDm={forDm} />
      )}
    </main>
  );
}

function NewMapForm({ picker, onCancel }: { picker: Picker; onCancel: () => void }) {
  const actionData = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  const [image, setImage] = useState<MapImage>();
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [note, setNote] = useState("");

  return (
    <Form method="post" aria-label="New map" className={`${panelClass} mb-6 flex flex-col gap-4`}>
      <h2 className="font-serif text-xl font-bold">New map</h2>
      <ImagePicker
        images={picker.images}
        onChange={(chosen, path) => {
          setImage(chosen);
          if (!nameEdited) setName(nameFromPath(path));
        }}
      />
      <input type="hidden" name="image" value={image?.path ?? ""} />
      <input type="hidden" name="width" value={image?.width ?? ""} />
      <input type="hidden" name="height" value={image?.height ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Name</span>
          <input
            type="text"
            name="name"
            value={name}
            maxLength={MAP_NAME_MAX}
            className={inputClass}
            onChange={(event) => {
              setName(event.target.value);
              setNameEdited(true);
            }}
          />
        </label>
        <NotePicker
          label="Wiki note (optional)"
          name="note"
          notes={picker.notes}
          value={note}
          onChange={setNote}
        />
      </div>
      {actionData && "error" in actionData && (
        <p role="alert" className="text-sm text-danger">
          {actionData.error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass} disabled={!image || busy}>
          Create map
        </button>
        <button type="button" className={buttonClass} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Form>
  );
}

/** `Maps/Old Town Map.png` → `Old Town Map` */
function nameFromPath(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
}
