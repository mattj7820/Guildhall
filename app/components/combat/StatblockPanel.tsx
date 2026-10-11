import type { MouseEvent } from "react";
import { Link } from "react-router";
import type { CreatureOption } from "~/combat/types";
import type { RollKind, RollRequest } from "~/dice/roll-log";
import { panelClass } from "~/components/styles";

const ROLL_KINDS: RollKind[] = ["attack", "damage", "check", "recharge"];

/**
 * The shown combatant's statblock, in the same book layout as the wiki. With `onRoll`, clicking
 * a roll in it (an attack bonus, dice, a save…) rolls it, labelled with the combatant's name;
 * without, the rolls are inert.
 */
export function StatblockPanel({
  combatantName,
  creature,
  hasStatblock,
  onRoll,
}: {
  combatantName?: string;
  creature?: CreatureOption;
  hasStatblock: boolean;
  onRoll?: (request: RollRequest) => void;
}) {
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
          {/* Rendered on the server from the vault, with vault text as text nodes only. */}
          <div
            onClick={handleClick}
            inert={!onRoll}
            dangerouslySetInnerHTML={{ __html: creature.html }}
          />
          <p className="mt-3 text-sm">
            <Link to={creature.noteUrl} className="text-link underline">
              Open {creature.noteTitle} in the wiki
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">
          {!combatantName
            ? "Statblocks for monsters show here on their turn, or when you pick one with 📜."
            : hasStatblock
              ? `${combatantName}'s statblock isn't in the vault any more.`
              : `${combatantName} has no statblock.`}
        </p>
      )}
    </section>
  );
}
