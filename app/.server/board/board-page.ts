import type { Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import type { BoardPage } from "~/board/types";
import { newestFirst } from "~/home/front-page";
import { noteUrl } from "~/wiki/urls";

/**
 * The notice board for one viewer: the next session, the session notes they may read, and for the
 * DM, the notes they may pin.
 */
export async function boardPage(services: Services, viewer: Viewer): Promise<BoardPage> {
  const notes = services.vault.current.notes(viewer);
  const sessions = notes.filter((note) => note.type === "session");
  const nextSession = await services.nextSession.get();
  return {
    ...(nextSession && { nextSession }),
    sessions: newestFirst(sessions).map((note) => ({ title: note.title, url: noteUrl(note.slug) })),
    notes: viewer.role === "dm" ? notes.map(({ id, slug, title }) => ({ id, slug, title })) : [],
  };
}
