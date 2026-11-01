import { frontPage } from "~/.server/home/front-page";
import { setNextSession } from "~/.server/home/set-next-session";
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

export async function action({ request, context }: Route.ActionArgs) {
  return setNextSession(context.get(servicesContext), context.get(viewerContext), request);
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <FrontPage data={loaderData.front} forDm={loaderData.forDm} />;
}
