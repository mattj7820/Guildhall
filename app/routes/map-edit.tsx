import { data, redirect, type ShouldRevalidateFunctionArgs } from "react-router";
import { z } from "zod";
import { notFound, requireDm } from "~/.server/not-found";
import { loadMapView, mapSource } from "~/.server/maps/load";
import { readJson } from "~/.server/read-json";
import { MapEditor } from "~/components/maps/MapEditor";
import { servicesContext, viewerContext, type Services } from "~/context";
import { MAP_NAME_MAX, mapChangesSchema, mapImageSchema } from "~/maps/schema";
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
  requireDm(viewer, "Map not found");
  const services = context.get(servicesContext);
  const maps = await services.maps.list();
  const map = maps.find((candidate) => candidate.id === params.id);
  const view = map && (await loadMapView(services, map, maps, viewer));
  if (!map || !view) notFound("Map not found");

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
 * - `{ intent: "setVisibility", visibility }` shares the map with players, or stops sharing it;
 * - `{ intent: "setSnapping", snap }` makes tokens snap to the grid's squares, or move freely.
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
  requireDm(context.get(viewerContext));
  const services = context.get(servicesContext);
  const { maps, fogs, vault } = services;
  const inVault = (path: string) => vault.current.mapImages().includes(path);

  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    const form = await request.formData();
    if (form.get("intent") !== "delete") throw data("Unknown action", { status: 400 });
    await maps.delete(params.id);
    await fogs.delete(params.id);
    await services.tokens.deleteMap(params.id);
    return redirect("/maps");
  }

  const parsed = await readJson(request, editSchema);
  if (!parsed.success) return data({ error: "These changes couldn't be saved." }, 400);
  const body = parsed.data;
  switch (body.intent) {
    case "save": {
      const { intent, ...changes } = body;
      const result = await maps.update(params.id, changes);
      if (!result) return gone();
      if ("problem" in result) return data({ error: result.problem }, 400);
      return { savedAt: result.map.updatedAt };
    }
    case "createChild": {
      if (!inVault(body.image.path)) return data({ error: "Choose an image from the vault." }, 400);
      // The new map illustrates the same place as the area, so it starts with the area's note.
      const created = await maps.create({
        name: body.name,
        image: body.image,
        note: body.note || undefined,
      });
      return { created: { id: created.id, name: created.name } };
    }
    case "setImage": {
      if (!inVault(body.image.path)) return data({ error: "That image isn't in the vault." }, 400);
      return (await maps.setImage(params.id, body.image)) ? { imageSet: true } : gone();
    }
    case "setSnapping":
      return (await maps.setSnapping(params.id, body.snap)) ? { snap: body.snap } : gone();
    case "setVisibility": {
      const changed = await maps.setVisibility(params.id, body.visibility);
      if (!changed) return gone();
      if (changed.visibility === "players") void prepareTiles(services, changed);
      return { shared: changed.visibility === "players" };
    }
  }
}

const editSchema = z.union([
  z.object({ intent: z.literal("save") }).and(mapChangesSchema),
  z.object({
    intent: z.literal("createChild"),
    name: z.string().max(MAP_NAME_MAX).optional(),
    image: mapImageSchema,
    note: z.string().optional(),
  }),
  z.object({ intent: z.literal("setImage"), image: mapImageSchema }),
  z.object({ intent: z.literal("setSnapping"), snap: z.boolean() }),
  z.object({ intent: z.literal("setVisibility"), visibility: z.enum(["dm", "players"]) }),
]);

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
