import { useRouteLoaderData } from "react-router";
import type { BoardPage } from "~/board/types";
import type { loader as rootLoader } from "~/root";
import { Corkboard } from "./Corkboard";

/**
 * The notice board: when the table next meets, the session notes the viewer may read, the DM's
 * pinned notes and everyone's short cards, tied together with string.
 */
export function NoticeBoard({ board, forDm }: { board: BoardPage; forDm: boolean }) {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  return (
    <main className="mx-auto max-w-[100rem] px-4 py-6 lg:px-8">
      <h1 className="font-display text-3xl text-title">Notice board</h1>
      <Corkboard board={board} forDm={forDm} you={root?.user?.name ?? "You"} />
    </main>
  );
}
