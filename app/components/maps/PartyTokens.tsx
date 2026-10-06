import { Link } from "react-router";
import { buttonClass, labelClass } from "~/components/styles";
import type { PartyPlacement, TokenView } from "~/maps/tokens/types";
import type { MapId } from "~/maps/types";
import { mapUrl } from "~/maps/urls";
import type { Placing } from "./PlacingHint";

/**
 * The party in the DM's Tokens tab: where each member is, finding them here, or placing them here
 * from wherever they were (each is in one place); and the whole party at once.
 */
export function PartyTokens({
  mapId,
  party,
  tokens,
  onPlace,
  onSelect,
  onFind,
}: {
  mapId: MapId;
  party: PartyPlacement[];
  tokens: TokenView[];
  onPlace: (placing: Placing) => void;
  onSelect: (token: TokenView) => void;
  onFind: (token: TokenView) => void;
}) {
  return (
    <section aria-labelledby="party-heading" className="flex flex-col gap-2">
      <h2 id="party-heading" className={labelClass}>
        Party
      </h2>
      <ul aria-label="Party" className="flex flex-col gap-1 text-sm">
        {party.map((member) => {
          const here = tokens.find((token) => token.note === member.note);
          const elsewhere = !here && member.on && member.on.id !== mapId ? member.on : undefined;
          return (
            <li key={member.note} className="flex items-center gap-2">
              <span className="mr-auto">
                {member.name}{" "}
                <span className="text-xs text-stone-500">
                  {here ? (
                    "here"
                  ) : elsewhere ? (
                    <>
                      on{" "}
                      <Link to={mapUrl(elsewhere.id)} className="underline">
                        {elsewhere.name}
                      </Link>
                    </>
                  ) : (
                    "not placed"
                  )}
                </span>
              </span>
              {here ? (
                <button
                  type="button"
                  aria-label={`Find ${member.name}`}
                  className={buttonClass}
                  onClick={() => {
                    onSelect(here);
                    onFind(here);
                  }}
                >
                  Find
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={`${elsewhere ? "Bring" : "Place"} ${member.name} here`}
                  className={buttonClass}
                  onClick={() =>
                    onPlace({ kind: "character", note: member.note, name: member.name })
                  }
                >
                  {elsewhere ? "Bring here" : "Place"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {party.length > 1 && (
        <button
          type="button"
          className={`${buttonClass} self-start`}
          onClick={() => onPlace({ kind: "party", name: "the whole party" })}
        >
          Bring everyone here
        </button>
      )}
    </section>
  );
}
