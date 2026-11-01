/**
 * Where the viewer's token is on the town map, kept per tab: set from every page they open
 * (top bar, links, Back, a typed address), so the front page shows them where they last were.
 */
import { placeOf, type PlaceId } from "./town";

const KEY = "guildhall:town-at";

export function rememberPage(pathname: string) {
  const place = placeOf(pathname);
  if (!place) return;
  try {
    sessionStorage.setItem(KEY, place);
  } catch {
    // Without storage, the token always starts in the hall.
  }
}

export function rememberedPlace(): PlaceId | undefined {
  try {
    return (sessionStorage.getItem(KEY) as PlaceId | null) ?? undefined;
  } catch {
    return undefined;
  }
}
