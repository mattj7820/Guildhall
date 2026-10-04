// PROTOTYPE (removed before the PR): the sheet as it would sit beside the map: what matters
// mid-session, with a way through to the full sheet.
import { useState } from "react";
import { Link, useParams } from "react-router";
import { signed } from "~/characters/abilities";
import type { CharacterAction } from "~/characters/actions";
import type { RollLogControls } from "~/dice/useRollLog";
import { HitPointsPanel } from "~/components/characters/HitPointsPanel";
import { Portrait } from "~/components/characters/Portrait";
import { Bag } from "~/components/inventory/Bag";
import { buttonClass, labelClass } from "~/components/styles";
import { protoActions, type ProtoSheet } from "./model";
import { AttackList, ChecksList, LatestRoll, SpellList, Trackers } from "./parts";

export const FULL_SHEET_PROTOTYPE = "/characters/tracking-prototype";

/** The real HP panel, over the pretend state. */
export function protoDispatch(...actions: CharacterAction[]) {
  for (const action of actions) {
    if (action.type === "damage") protoActions.damage(action.amount);
    if (action.type === "heal") protoActions.heal(action.amount);
    if (action.type === "hp") protoActions.setHp(action.field, action.value);
  }
}

export function CompactSheet({
  sheet,
  rolls,
  canUndo,
}: {
  sheet: ProtoSheet;
  rolls: RollLogControls;
  canUndo: boolean;
}) {
  const [notice, setNotice] = useState<string>();
  const { id: mapId } = useParams();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Portrait name={sheet.name} />
        <div className="min-w-0">
          <h2 className="truncate font-serif text-xl font-bold">{sheet.name}</h2>
          <p className="truncate text-sm text-stone-500">{sheet.subtitle}</p>
        </div>
      </div>
      <HitPointsPanel hp={sheet.hp} editing={false} dispatch={protoDispatch} />
      <p className="flex flex-wrap gap-x-3 text-sm">
        <span>
          AC <strong>{sheet.armourClass}</strong>
        </span>
        <span>
          Init{" "}
          <button
            type="button"
            className="font-semibold text-amber-800 hover:underline dark:text-amber-400"
            onClick={() =>
              rolls.roll({
                expression: `1d20${signed(sheet.initiative)}`,
                kind: "check",
                label: "Initiative",
              })
            }
          >
            {signed(sheet.initiative)}
          </button>
        </span>
        <span>
          Speed <strong>{sheet.speed}</strong>
        </span>
        <span>
          Passive Perception <strong>{sheet.passivePerception}</strong>
        </span>
      </p>
      <Trackers sheet={sheet} compact />
      <section aria-labelledby="compact-attacks">
        <h3 id="compact-attacks" className={labelClass}>
          Attacks
        </h3>
        <AttackList sheet={sheet} rolls={rolls} compact />
      </section>
      <section aria-labelledby="compact-spells">
        <h3 id="compact-spells" className={`${labelClass} mb-1`}>
          Spells
        </h3>
        <SpellList sheet={sheet} rolls={rolls} compact onNotice={setNotice} />
      </section>
      <ChecksList sheet={sheet} rolls={rolls} />
      {notice && <p className="text-sm text-sky-800 dark:text-sky-300">{notice}</p>}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-stone-200 bg-stone-50 px-4 py-2 dark:border-stone-800 dark:bg-stone-950">
        <LatestRoll rolls={rolls} />
        <span className="ml-auto inline-flex items-center gap-2">
          <button
            type="button"
            className={buttonClass}
            disabled={!canUndo}
            onClick={() => protoActions.undo()}
          >
            Undo
          </button>
          <span className="text-xs text-stone-500">Saved (pretend)</span>
          <Link
            to={mapId ? `${FULL_SHEET_PROTOTYPE}?map=${mapId}` : FULL_SHEET_PROTOTYPE}
            className="text-sm text-amber-800 hover:underline dark:text-amber-400"
          >
            Full sheet ↗
          </Link>
        </span>
      </div>
    </div>
  );
}

export function CompactBag({ sheet }: { sheet: ProtoSheet }) {
  return (
    <Bag
      state={sheet.inventory}
      onChange={(change) => protoActions.inventory(change)}
      catalogue={[]}
      notes={{}}
    />
  );
}
