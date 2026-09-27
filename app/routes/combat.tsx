import { combatCatalogue } from "~/.server/combat/catalogue";
import { browserStorage, loadEncounter } from "~/combat/storage";
import { DmOnlyNotice } from "~/components/combat/CombatNav";
import { CombatTracker } from "~/components/combat/CombatTracker";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/combat";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Combat tracker · Guildhall" }];
}

/** The vault's statblocks and party. DM only: nothing is sent to the player preview. */
export function loader({ context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  if (viewer.role !== "dm") return { dmOnly: true as const };
  const { vault } = context.get(servicesContext);
  return { dmOnly: false as const, catalogue: combatCatalogue(vault.current, viewer) };
}

/** Adds the encounter saved in this browser, which the server never sees. */
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
  return <CombatTracker catalogue={loaderData.catalogue} saved={loaderData.saved} />;
}
