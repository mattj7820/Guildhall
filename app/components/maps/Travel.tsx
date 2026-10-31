import { useState } from "react";
import { useNavigate } from "react-router";
import type { TokenView, TravelWay } from "~/maps/tokens/types";
import type { MapId } from "~/maps/types";
import { mapTravelUrl, mapUrl } from "~/maps/urls";

/**
 * A player taking their own party members to another map. The server decides whether they may
 * and where they land; the page then follows them there.
 */
export function useTravel(map: MapId) {
  const navigate = useNavigate();
  const [going, setGoing] = useState(false);
  const [error, setError] = useState<string>();

  async function go(token: TokenView, way: TravelWay) {
    setGoing(true);
    setError(undefined);
    try {
      const response = await fetch(mapTravelUrl(map), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.id, to: way.map.id }),
      });
      if (response.ok) {
        await navigate(mapUrl(way.map.id));
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(response.status === 404 ? "You can't go there now." : body.error);
    } catch {
      setError("Couldn't reach Guildhall. Try again.");
    } finally {
      setGoing(false);
    }
  }

  return { go, going, error };
}

export type Travel = ReturnType<typeof useTravel>;

/**
 * A button for each of the player's own party members here to take that way: just "Go in" (or
 * "Go back") when there's one, else one by name.
 */
export function TravelButtons({
  way,
  travellers,
  travel,
  label,
}: {
  way: TravelWay;
  travellers: readonly TokenView[];
  travel: Travel;
  /** Where it goes, for the button's accessible name: "into the Inn door". */
  label: string;
}) {
  const verb = way.direction === "in" ? "Go in" : `Back to ${way.map.name}`;
  return travellers.map((token) => (
    <button
      key={token.id}
      type="button"
      disabled={travel.going}
      aria-label={`Take ${token.name} ${label}`}
      title={`Take ${token.name} ${label}`}
      className="shrink-0 rounded border border-line px-2 py-0.5 text-xs hover:bg-raised disabled:opacity-50"
      onClick={() => void travel.go(token, way)}
    >
      {travellers.length > 1 ? `${token.name}: ${verb}` : verb}
    </button>
  ));
}
