import { combatCatalogue } from "~/.server/combat/catalogue";
import { browserStorage, loadEncounter } from "~/combat/storage";
import { DmOnlyNotice } from "~/components/combat/CombatNav";
import { CombatTracker } from "~/components/combat/CombatTracker";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/combat";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Combat tracker · Guildhall" }];
}

/**
 * The vault's statblocks and party, and with `?start=<id>` the prepared encounter to start.
 * DM only: nothing is sent to the player preview.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  if (viewer.role !== "dm") return { dmOnly: true as const };
  const { vault, preparedEncounters, fight } = context.get(servicesContext);
  const current = await fight.get();
  const startId = new URL(request.url).searchParams.get("start");
  return {
    dmOnly: false as const,
    catalogue: combatCatalogue(vault.current, viewer),
    fight: current ? { encounter: current.encounter, revision: current.revision } : null,
    starting: startId ? ((await preparedEncounters.get(startId)) ?? null) : undefined,
  };
}

/** Adds a fight this browser kept from before fights were kept on the server, to bring over. */
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  const storage = browserStorage();
  return {
    ...(await serverLoader()),
    saved: storage ? loadEncounter(storage) : ({ status: "empty" } as const),
  };
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="font-serif text-3xl font-bold">Combat tracker</h1>
      <p className="mt-4 text-stone-500">Loading the encounter…</p>
    </main>
  );
}

export default function Combat({ loaderData }: Route.ComponentProps) {
  if (loaderData.dmOnly) return <DmOnlyNotice />;
  return (
    <CombatTracker
      catalogue={loaderData.catalogue}
      fight={loaderData.fight}
      saved={loaderData.saved}
      starting={loaderData.starting}
    />
  );
}
