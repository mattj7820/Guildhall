import { data } from "react-router";
import type { Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import { requireDm } from "../not-found";

/**
 * The DM sets the next session's date (an instant, from the browser), or clears it: the action
 * behind `NextSession`, on every page that shows it.
 */
export async function setNextSession(services: Services, viewer: Viewer, request: Request) {
  requireDm(viewer);
  const at = String((await request.formData()).get("at") ?? "");
  const date = at ? new Date(at) : undefined;
  if (date && Number.isNaN(date.getTime())) {
    return data({ error: "That isn't a date Guildhall understands." }, 400);
  }
  await services.nextSession.set(date);
  return { ok: true };
}
