import { usePlayerFight, type PlayerFightView } from "~/combat/usePlayerFight";
import { panelClass, primaryButtonClass } from "~/components/styles";
import { TurnStrip } from "./TurnStrip";

/**
 * The fight as a player sees it: the turn order, and their own characters' hit points (from their
 * sheets), conditions and notes. When it's their turn, they can end it.
 */
export function PlayerFight({ fight: fromPage }: { fight: PlayerFightView | null }) {
  const { fight, endTurn, ending, error } = usePlayerFight(fromPage);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 font-serif text-3xl font-bold">Combat</h1>
      {!fight || !fight.view.started ? (
        <p className="text-stone-500">No fight right now.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <TurnStrip round={fight.view.round} turnOrder={fight.view.turnOrder}>
            <EndMyTurn fight={fight} onEnd={endTurn} ending={ending} />
          </TurnStrip>
          {error && (
            <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
              {error}
            </p>
          )}
          <section aria-labelledby="yours-heading" className={panelClass}>
            <h2 id="yours-heading" className="mb-2 font-serif text-xl font-bold">
              Yours
            </h2>
            <ul className="flex flex-col gap-2">
              {fight.view.turnOrder
                .filter((entry) => entry.id in fight.view.details)
                .map((entry) => {
                  const details = fight.view.details[entry.id];
                  const hp = fight.hp?.[entry.id];
                  return (
                    <li key={entry.id} aria-label={entry.name} className="text-sm">
                      <span className="font-semibold">{entry.name}</span>
                      {hp && (
                        <span className="ml-2 tabular-nums">
                          HP {hp.current}/{hp.max}
                          {hp.temp > 0 && ` (+${hp.temp} temp)`}
                        </span>
                      )}
                      {details.conditions.length > 0 && (
                        <span className="ml-2 text-stone-500">{details.conditions.join(", ")}</span>
                      )}
                      {details.note && <p className="text-stone-500">{details.note}</p>}
                    </li>
                  );
                })}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}

/** "End my turn", when it's the turn of someone this player controls. */
export function EndMyTurn({
  fight,
  onEnd,
  ending,
}: {
  fight: PlayerFightView;
  onEnd: () => void;
  ending: boolean;
}) {
  if (!fight.theirTurn) return null;
  return (
    <button type="button" className={primaryButtonClass} disabled={ending} onClick={onEnd}>
      End my turn
    </button>
  );
}
