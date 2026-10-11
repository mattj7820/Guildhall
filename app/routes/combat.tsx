import { combatCatalogue } from "~/.server/combat/catalogue";
import { browserStorage, loadEncounter } from "~/combat/storage";
import { fightView } from "~/.server/combat/fight-view";
import { PlayerFight } from "~/components/combat/PlayerFight";
import { CombatTracker } from "~/components/combat/CombatTracker";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/combat";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Combat tracker · Guildhall" }];
}

/**
 * For the DM: the vault's statblocks and party, the fight the table is in, and with `?start=<id>`
 * the prepared encounter to start. For players: the fight as they may see it, and nothing else.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  const services = context.get(servicesContext);
  const { vault, preparedEncounters, fight } = services;
  const current = await fight.get();
  const view = current ? await fightView(services, current, viewer) : null;
  if (viewer.role !== "dm") {
    return { dmOnly: true as const, fight: view && !view.forDm ? view : null };
  }
  const startId = new URL(request.url).searchParams.get("start");
  return {
    dmOnly: false as const,
    catalogue: combatCatalogue(vault.current, viewer),
    fight: view?.forDm ? view : null,
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
      <p className="mt-4 text-muted">Loading the encounter…</p>
    </main>
  );
}

export default function Combat({ loaderData }: Route.ComponentProps) {
  if (loaderData.dmOnly) return <PlayerFight fight={loaderData.fight} />;
  return (
    <CombatTracker
      catalogue={loaderData.catalogue}
      fight={loaderData.fight}
      saved={loaderData.saved}
      starting={loaderData.starting}
    />
  );
}
