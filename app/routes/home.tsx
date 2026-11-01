import { data } from "react-router";
import { frontPage } from "~/.server/home/front-page";
import { requireDm } from "~/.server/not-found";
import { FrontPage } from "~/components/home/FrontPage";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Guildhall" },
    { name: "description", content: "A campaign hub for the table." },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  return {
    front: await frontPage(context.get(servicesContext), viewer),
    forDm: viewer.role === "dm",
  };
}

/** The DM sets the next session's date (an instant, from the browser), or clears it. */
export async function action({ request, context }: Route.ActionArgs) {
  requireDm(context.get(viewerContext));
  const at = String((await request.formData()).get("at") ?? "");
  const date = at ? new Date(at) : undefined;
  if (date && Number.isNaN(date.getTime())) {
    return data({ error: "That isn't a date Guildhall understands." }, 400);
  }
  await context.get(servicesContext).nextSession.set(date);
  return { ok: true };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <FrontPage data={loaderData.front} forDm={loaderData.forDm} />;
}
