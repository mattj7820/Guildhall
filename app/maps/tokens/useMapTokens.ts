import { useCallback, useState } from "react";
import { mapTokensUrl } from "../urls";
import type { MapId } from "../types";
import type { TokenAction } from "./actions";
import type { TokenView } from "./types";

/**
 * A map's tokens as this viewer may see them, and a way to change them. Every change goes to the
 * server, which checks it and answers with the tokens as they are now; newer tokens from the
 * page's own data (after it reloads) replace them.
 */
export function useMapTokens(map: MapId, fromPage: TokenView[]) {
  const [state, setState] = useState({
    fromPage,
    tokens: fromPage,
    error: undefined as string | undefined,
  });
  // The page's data changed (it reloaded): that's newer than anything held here.
  if (state.fromPage !== fromPage) setState({ fromPage, tokens: fromPage, error: undefined });

  const send = useCallback(
    async (actions: TokenAction[]) => {
      let body: { tokens?: TokenView[]; error?: string } = {};
      let ok = false;
      try {
        const response = await fetch(mapTokensUrl(map), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ actions }),
        });
        ok = response.ok;
        body = await response.json();
      } catch {
        body = { error: "Couldn't reach Guildhall. Try again in a moment." };
      }
      setState((current) => ({
        ...current,
        ...(body.tokens && { tokens: body.tokens }),
        error: ok ? undefined : (body.error ?? "That couldn't be saved."),
      }));
    },
    [map],
  );

  return { tokens: state.tokens, error: state.error, send };
}
