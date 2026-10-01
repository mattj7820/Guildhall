import { data, redirect, type ShouldRevalidateFunctionArgs } from "react-router";
import { combatCatalogue } from "~/.server/combat/catalogue";
import { preparedStartUrl } from "~/combat/prepared";
import { preparedChangesSchema } from "~/combat/schema";
import { DmOnlyNotice } from "~/components/combat/CombatNav";
import { PreparedEditor } from "~/components/combat/PreparedEditor";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/combat-prepared-edit";

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData && !loaderData.dmOnly ? loaderData.prepared.name : "Prepared encounter";
  return [{ title: `${name} · Guildhall` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  if (viewer.role !== "dm") return { dmOnly: true as const };
  const { preparedEncounters, vault, maps } = context.get(servicesContext);
  const prepared = await preparedEncounters.get(params.id);
  if (!prepared) throw data("Prepared encounter not found", { status: 404 });
  const mapIds = new Set((await maps.list()).map((map) => map.id));
  return {
    dmOnly: false as const,
    prepared,
    catalogue: combatCatalogue(vault.current, viewer),
    startUrl: preparedStartUrl(prepared, mapIds),
  };
}

/**
 * JSON `{ intent: "save", name, notes, encounter }` from the editor's autosave, or
 * `{ intent: "markRun" }` when the tracker starts it; a form with `intent=delete` deletes it.
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  if (context.get(viewerContext).role !== "dm") throw data("Not found", { status: 404 });
  const prepared = context.get(servicesContext).preparedEncounters;

  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    const form = await request.formData();
    if (form.get("intent") !== "delete") throw data("Unknown action", { status: 400 });
    await prepared.delete(params.id);
    return redirect("/combat/prepared");
  }

  const body = (await request.json()) as { intent?: unknown };
  if (body.intent === "markRun") {
    return (await prepared.markRun(params.id)) ? { ok: true } : gone();
  }
  const changes = preparedChangesSchema.safeParse(body);
  if (body.intent !== "save" || !changes.success) {
    return data({ error: "These changes couldn't be saved." }, { status: 400 });
  }
  const saved = await prepared.update(params.id, changes.data);
  return saved ? { savedAt: saved.updatedAt } : gone();
}

function gone() {
  return data(
    { error: "This encounter has been deleted, perhaps in another tab." },
    { status: 404 },
  );
}

/** Saving doesn't change anything the loader returns, so don't reload the catalogue each time. */
export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (actionResult && typeof actionResult === "object" && "savedAt" in actionResult) return false;
  return defaultShouldRevalidate;
}

export default function EditPrepared({ loaderData }: Route.ComponentProps) {
  if (loaderData.dmOnly) return <DmOnlyNotice />;
  return (
    <PreparedEditor
      key={loaderData.prepared.id}
      prepared={loaderData.prepared}
      catalogue={loaderData.catalogue}
      startUrl={loaderData.startUrl}
    />
  );
}
