import { data, redirect, type ShouldRevalidateFunctionArgs } from "react-router";
import { z } from "zod";
import { loadMapView, mapSource } from "~/.server/maps/load";
import { MapEditor } from "~/components/maps/MapEditor";
import { servicesContext, viewerContext, type Services } from "~/context";
import { mapChangesSchema, mapImageSchema } from "~/maps/schema";
import type { CampaignMap } from "~/maps/types";
import { mapUrl } from "~/maps/urls";
import type { Route } from "./+types/map-edit";

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.map.name ?? "Map";
  return [{ title: `Editing ${name} · Guildhall` }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  // Editing is the DM's: for anyone else it's the same 404 as a map that doesn't exist.
  if (viewer.role !== "dm") throw data("Map not found", { status: 404 });
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  const view = map && (await loadMapView(services, map, maps, viewer));
  if (!map || !view) throw data("Map not found", { status: 404 });

  const current = services.vault.current;
  return {
    map,
    view,
    /** Every map's links, so the editor can offer only maps that keep the tree a tree. */
    maps: maps.map(({ id, name, areas }) => ({
      id,
      name,
      areas: areas.map(({ id, name, map }) => ({ id, name, map })),
    })),
    notes: current.notes(viewer).map(({ id, slug, title }) => ({ id, slug, title })),
    images: current.mapImages(),
    selectedArea: new URL(request.url).searchParams.get("area") ?? undefined,
  };
}

/**
 * JSON from the editor:
 * - `{ intent: "save", name, note, areas }` autosaves the map;
 * - `{ intent: "createChild", name, image, note }` makes a new map for an area to lead to;
 * - `{ intent: "setImage", image }` records the image's new location or size;
 * - `{ intent: "setVisibility", visibility }` shares the map with players, or stops sharing it.
 *   Like the image, it isn't part of the autosave (or undo): sharing is a deliberate act.
 *
 * A form with `intent=delete` deletes the map.
 */
export async function action(args: Route.ActionArgs) {
  const result = await changeMap(args);
  // Areas link maps into a tree, so a change here can show on other maps too (breadcrumbs, links).
  await args.context.get(servicesContext).live.allMapsChanged();
  return result;
}

async function changeMap({ request, params, context }: Route.ActionArgs) {
  if (context.get(viewerContext).role !== "dm") throw data("Not found", { status: 404 });
  const services = context.get(servicesContext);
  const { maps, fogs, vault } = services;
  const inVault = (path: string) => vault.current.mapImages().includes(path);

  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    const form = await request.formData();
    if (form.get("intent") !== "delete") throw data("Unknown action", { status: 400 });
    await maps.delete(params.id);
    await fogs.delete(params.id);
    return redirect("/maps");
  }

  const body = (await request.json()) as {
    intent?: unknown;
    name?: unknown;
    image?: unknown;
    note?: unknown;
    visibility?: unknown;
  };
  switch (body.intent) {
    case "save": {
      const changes = mapChangesSchema.safeParse(body);
      if (!changes.success) return data({ error: "These changes couldn't be saved." }, 400);
      const result = await maps.update(params.id, changes.data);
      if (!result) return gone();
      if ("problem" in result) return data({ error: result.problem }, 400);
      return { savedAt: result.map.updatedAt };
    }
    case "createChild": {
      const image = mapImageSchema.safeParse(body.image);
      if (!image.success || !inVault(image.data.path)) {
        return data({ error: "Choose an image from the vault." }, 400);
      }
      const name = typeof body.name === "string" ? body.name : undefined;
      // The new map illustrates the same place as the area, so it starts with the area's note.
      const note = typeof body.note === "string" && body.note ? body.note : undefined;
      const created = await maps.create({ name, image: image.data, note });
      return { created: { id: created.id, name: created.name } };
    }
    case "setImage": {
      const image = mapImageSchema.safeParse(body.image);
      if (!image.success || !inVault(image.data.path)) {
        return data({ error: "That image isn't in the vault." }, 400);
      }
      return (await maps.setImage(params.id, image.data)) ? { imageSet: true } : gone();
    }
    case "setVisibility": {
      const visibility = z.enum(["dm", "players"]).safeParse(body.visibility);
      if (!visibility.success)
        return data({ error: "Share with players, or keep it DM-only." }, 400);
      const changed = await maps.setVisibility(params.id, visibility.data);
      if (!changed) return gone();
      if (changed.visibility === "players") void prepareTiles(services, changed);
      return { shared: changed.visibility === "players" };
    }
    default:
      throw data("Unknown action", { status: 400 });
  }
}

/** Cuts the image's tiles in the background, so no player waits for them. */
async function prepareTiles(services: Services, map: CampaignMap) {
  try {
    const source = await mapSource(services, map);
    if (source) await services.playerImages.prepare(source);
  } catch (error) {
    console.error(`[maps] Couldn't prepare the tiles of "${map.name}"`, error);
  }
}

function gone() {
  return data({ error: "This map has been deleted, perhaps in another tab." }, 404);
}

/** Autosaving doesn't change anything the editor shows, so don't reload the page's data each time. */
export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (actionResult && typeof actionResult === "object" && "savedAt" in actionResult) return false;
  return defaultShouldRevalidate;
}

export default function EditMap({ loaderData }: Route.ComponentProps) {
  return (
    <MapEditor
      key={loaderData.map.id}
      map={loaderData.map}
      view={loaderData.view}
      maps={loaderData.maps}
      notes={loaderData.notes}
      images={loaderData.images}
      selectedArea={loaderData.selectedArea}
      viewUrl={mapUrl(loaderData.map.id)}
    />
  );
}
