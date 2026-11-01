import { boardPage } from "~/.server/board/board-page";
import { setNextSession } from "~/.server/home/set-next-session";
import { NoticeBoard } from "~/components/board/NoticeBoard";
import { servicesContext, viewerContext } from "~/context";
import type { Route } from "./+types/board";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Notice board · Guildhall" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  return {
    board: await boardPage(context.get(servicesContext), viewer),
    forDm: viewer.role === "dm",
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  return setNextSession(context.get(servicesContext), context.get(viewerContext), request);
}

export default function Board({ loaderData }: Route.ComponentProps) {
  return <NoticeBoard board={loaderData.board} forDm={loaderData.forDm} />;
}
