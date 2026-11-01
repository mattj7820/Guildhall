import type { Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import type { BoardPage } from "~/board/types";
import { newestFirst } from "~/home/front-page";
import { noteUrl } from "~/wiki/urls";

/** The notice board for one viewer: the next session, and the session notes they may read. */
export async function boardPage(services: Services, viewer: Viewer): Promise<BoardPage> {
  const sessions = services.vault.current.notes(viewer).filter((note) => note.type === "session");
  const nextSession = await services.nextSession.get();
  return {
    ...(nextSession && { nextSession }),
    sessions: newestFirst(sessions).map((note) => ({ title: note.title, url: noteUrl(note.slug) })),
  };
}
