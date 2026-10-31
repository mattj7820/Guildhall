import { frontPage } from "~/.server/home/front-page";
import { FrontPage } from "~/components/home/FrontPage";
import { servicesContext, viewerContext } from "~/context";
import { hubLinks } from "~/hub/links";
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
    modules: hubLinks(viewer.role),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <FrontPage data={loaderData.front} modules={loaderData.modules} />;
}
