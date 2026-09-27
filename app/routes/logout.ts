import { redirect } from "react-router";
import { servicesContext } from "~/context";
import type { Route } from "./+types/logout";

/** Signs out of this browser. A POST, so another site can't sign someone out with a link. */
export async function action({ request, context }: Route.ActionArgs) {
  const { sessions } = context.get(servicesContext);
  const session = await sessions.getSession(request.headers.get("Cookie"));
  return redirect("/login", {
    headers: { "Set-Cookie": await sessions.destroySession(session) },
  });
}

export function loader() {
  return redirect("/");
}
