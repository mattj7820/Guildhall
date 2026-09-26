import { redirect } from "react-router";
import { safeRedirect } from "~/.server/safe-redirect";
import { serializeViewCookie } from "~/.server/viewer";
import type { Route } from "./+types/view-mode";

/** Sets the DM/player preview cookie, then returns to the page the toggle was pressed on. */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const role = form.get("role") === "player" ? "player" : "dm";
  return redirect(safeRedirect(form.get("redirectTo")), {
    headers: { "Set-Cookie": await serializeViewCookie(role) },
  });
}

export function loader() {
  return redirect("/");
}
