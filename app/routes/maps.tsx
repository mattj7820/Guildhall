import { useState } from "react";
import { data, Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { DataFileError } from "~/.server/data/json-store";
import { ImagePicker } from "~/components/maps/ImagePicker";
import { NotePicker } from "~/components/maps/NotePicker";
import { inputClass, panelClass, primaryButtonClass, buttonClass } from "~/components/styles";
import type { Viewer } from "~/campaign/types";
import { canView } from "~/campaign/visibility";
import { servicesContext, viewerContext, type Services } from "~/context";
import { mapImageSchema, MAP_NAME_MAX } from "~/maps/schema";
import { mapTree, type MapTreeNode } from "~/maps/tree";
import type { MapImage } from "~/maps/types";
import { mapEditUrl, mapUrl } from "~/maps/urls";
import type { Route } from "./+types/maps";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Maps · Guildhall" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  if (viewer.role !== "dm") return playersMaps(context.get(servicesContext), viewer);
  const { maps, vault } = context.get(servicesContext);
  const current = vault.current;
  const picker = {
    images: current.mapImages(),
    notes: current.notes(viewer).map(({ id, slug, title }) => ({ id, slug, title })),
  };
  try {
    const list = (await maps.list()).map(({ id, name, areas, image }) => ({
      id,
      name,
      areas: areas.map(({ id, name, map }) => ({ id, name, map })),
      imageMissing: !current.findImage(image.path),
    }));
    return { forDm: true as const, tree: mapTree(list), ...picker };
  } catch (error) {
    if (error instanceof DataFileError) {
      return { forDm: true as const, tree: [], error: error.message, ...picker };
    }
    throw error;
  }
}

/**
 * The maps shared with players, nested as they lead to each other. Only the links between shared
 * maps are sent: area names, image files and everything else stay on the server.
 */
async function playersMaps({ maps }: Services, viewer: Viewer) {
  try {
    const shared = (await maps.list()).filter((map) => canView(viewer, map.visibility));
    const isShared = (id: string) => shared.some((map) => map.id === id);
    const list = shared.map(({ id, name, areas }) => ({
      id,
      name,
      areas: areas.flatMap((area) =>
        area.map && isShared(area.map) ? [{ id: area.id, name: "", map: area.map }] : [],
      ),
      imageMissing: false,
    }));
    return { forDm: false as const, tree: mapTree(list) };
  } catch (error) {
    // The DM is told what's wrong with the file; players aren't told where it is.
    if (error instanceof DataFileError) {
      return { forDm: false as const, tree: [], error: "The maps can't be shown just now." };
    }
    throw error;
  }
}

/** Creates a map from the form (image, its measured size, name, note) and opens the editor. */
export async function action({ request, context }: Route.ActionArgs) {
  const viewer = context.get(viewerContext);
  if (viewer.role !== "dm") throw data("Not found", { status: 404 });
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

type Loaded = Extract<Route.ComponentProps["loaderData"], { forDm: true }>;
type ListedMap = Route.ComponentProps["loaderData"]["tree"][number]["map"];

export default function Maps({ loaderData }: Route.ComponentProps) {
  const [creating, setCreating] = useState(false);
  const forDm = loaderData.forDm;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-serif text-3xl font-bold">Maps</h1>
        {forDm && !creating && (
          <button type="button" className={primaryButtonClass} onClick={() => setCreating(true)}>
            New map
          </button>
        )}
      </div>

      {forDm && creating && <NewMapForm loaded={loaderData} onCancel={() => setCreating(false)} />}

      {"error" in loaderData && loaderData.error ? (
        <p role="alert" className="rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-900">
          {loaderData.error}
        </p>
      ) : loaderData.tree.length === 0 ? (
        !creating &&
        (forDm ? (
          <div className={`${panelClass} text-center`}>
            <p className="font-semibold">No maps yet.</p>
            <p className="mt-1 text-sm text-stone-500">
              Make one from any image in the vault, then outline the places on it that lead to more
              detailed maps or to wiki notes.
            </p>
          </div>
        ) : (
          <div className={`${panelClass} text-center`}>
            <p className="font-semibold">No maps yet.</p>
            <p className="mt-1 text-sm text-stone-500">
              Maps appear here as the DM shares them, and open up as the party explores.
            </p>
          </div>
        ))
      ) : (
        <nav aria-label="All maps" className={panelClass}>
          <MapList nodes={loaderData.tree} forDm={forDm} />
        </nav>
      )}
    </main>
  );
}

function MapList({ nodes, forDm }: { nodes: MapTreeNode<ListedMap>[]; forDm: boolean }) {
  return (
    <ul className="flex flex-col gap-1 [&_ul]:mt-1 [&_ul]:ml-5 [&_ul]:border-l [&_ul]:border-stone-200 [&_ul]:pl-3 dark:[&_ul]:border-stone-800">
      {nodes.map(({ map, children }) => (
        <li key={map.id}>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <Link to={mapUrl(map.id)} className="font-serif text-lg font-semibold hover:underline">
              {map.name}
            </Link>
            {forDm && (
              <>
                <span className="text-xs text-stone-500">
                  {map.areas.length === 1 ? "1 area" : `${map.areas.length} areas`}
                </span>
                <Link
                  to={mapEditUrl(map.id)}
                  aria-label={`Edit ${map.name}`}
                  className="text-xs text-stone-500 hover:underline"
                >
                  Edit
                </Link>
              </>
            )}
            {map.imageMissing && (
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                Image not found
              </span>
            )}
          </div>
          {children.length > 0 && <MapList nodes={children} forDm={forDm} />}
        </li>
      ))}
    </ul>
  );
}

function NewMapForm({ loaded, onCancel }: { loaded: Loaded; onCancel: () => void }) {
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
        images={loaded.images}
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
          notes={loaded.notes}
          value={note}
          onChange={setNote}
        />
      </div>
      {actionData && "error" in actionData && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
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
