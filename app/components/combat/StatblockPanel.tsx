import { Link } from "react-router";
import type { CreatureOption } from "~/combat/types";
import { panelClass } from "./styles";

/** The shown combatant's statblock, in the same book layout as the wiki. */
export function StatblockPanel({
  combatantName,
  creature,
  hasStatblock,
}: {
  combatantName?: string;
  creature?: CreatureOption;
  hasStatblock: boolean;
}) {
  return (
    <section
      aria-label="Selected statblock"
      className={`${panelClass} max-h-[70vh] overflow-y-auto`}
    >
      {creature ? (
        <>
          {/* Rendered on the server from the vault, with vault text as text nodes only. */}
          <div dangerouslySetInnerHTML={{ __html: creature.html }} />
          <p className="mt-3 text-sm">
            <Link to={creature.noteUrl} className="text-amber-800 underline dark:text-amber-400">
              Open {creature.noteTitle} in the wiki
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-stone-500">
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
