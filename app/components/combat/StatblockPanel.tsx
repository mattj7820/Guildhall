import type { MouseEvent } from "react";
import { Link } from "react-router";
import { useStatblock } from "~/combat/statblocks";
import {
  SRD_DOCUMENTS,
  SRD_RULES,
  type CombatCatalogue,
  type CreatureOption,
} from "~/combat/types";
import type { RollKind, RollRequest } from "~/dice/roll-log";
import { labelClass, panelClass } from "~/components/styles";

const ROLL_KINDS: RollKind[] = ["attack", "damage", "check", "recharge"];

/**
 * The shown combatant's statblock, in the same book layout as the wiki. With `onRoll`, clicking
 * a roll in it (an attack bonus, dice, a save…) rolls it, labelled with the combatant's name;
 * without, the rolls are inert.
 */
export function StatblockPanel({
  catalogue,
  combatantName,
  creature,
  hasStatblock,
  onRoll,
}: {
  catalogue: CombatCatalogue;
  combatantName?: string;
  creature?: CreatureOption;
  hasStatblock: boolean;
  onRoll?: (request: RollRequest) => void;
}) {
  const statblock = useStatblock(catalogue, creature?.key);

  /** The statblock arrives as HTML, so its roll buttons are handled here, in one place. */
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const button = (event.target as Element).closest<HTMLButtonElement>("button.statblock-roll");
    if (!button || !onRoll) return;
    const { roll, rollKind, rollLabel, rechargeOn } = button.dataset;
    const kind = ROLL_KINDS.find((k) => k === rollKind);
    if (!roll || !kind) return;
    onRoll({
      expression: roll,
      kind,
      label: [combatantName, rollLabel].filter(Boolean).join(" · "),
      rechargeOn: rechargeOn ? Number(rechargeOn) : undefined,
    });
  }

  return (
    <section
      aria-label="Selected statblock"
      className={`${panelClass} max-h-[70vh] overflow-y-auto`}
    >
      {creature ? (
        <>
          {statblock.status === "ready" ? (
            // Rendered on the server, with the vault's or SRD's text as text nodes only.
            <div
              onClick={handleClick}
              inert={!onRoll}
              dangerouslySetInnerHTML={{ __html: statblock.view.html }}
            />
          ) : (
            <p className="text-sm text-muted" role="status">
              {statblock.status === "failed"
                ? `Couldn't load ${creature.name}'s statblock. It'll try again when shown next.`
                : statblock.status === "missing"
                  ? `${creature.name}'s statblock isn't there any more.`
                  : `Loading ${creature.name}'s statblock…`}
            </p>
          )}
          {statblock.status === "ready" && statblock.view.lore && (
            <div className="mt-3 border-t border-line pt-2">
              <h3 className={labelClass}>From the SRD</h3>
              <p className="mt-1 text-sm">{statblock.view.lore}</p>
            </div>
          )}
          <p className="mt-3 text-sm">
            {creature.noteUrl ? (
              <Link to={creature.noteUrl} className="text-link underline">
                Open {creature.noteTitle} in the wiki
              </Link>
            ) : creature.ref.source ? (
              <span className="text-muted">
                {SRD_DOCUMENTS[creature.ref.source]} ({SRD_RULES[creature.ref.source]} rules), CC BY
                4.0 ·{" "}
                <Link to="/credits" className="text-link underline">
                  Credits
                </Link>
              </span>
            ) : null}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">
          {!combatantName
            ? "Statblocks for monsters show here on their turn, or when you pick one with 📜."
            : hasStatblock
              ? `${combatantName}'s statblock isn't there any more.`
              : `${combatantName} has no statblock.`}
        </p>
      )}
    </section>
  );
}
