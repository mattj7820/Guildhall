import type { Viewer } from "~/campaign/types";
import type { Services } from "~/context";
import type { BoardAuthor, BoardCard, BoardPage, BoardView } from "~/board/types";
import { boardForViewer, seesCard, type BoardLookups } from "~/board/view";
import { newestFirst } from "~/home/front-page";
import { noteUrl } from "~/wiki/urls";
import { partyPlayers } from "../members/players";
import type { Vault } from "../vault/vault";

/**
 * Who a viewer is on the board: the DM, a player by who they are, or no one (a player without a
 * character, or the DM previewing as a player), who may look but not put anything up.
 */
export function boardActor(viewer: Viewer): BoardAuthor | undefined {
  if (viewer.role === "dm") return { dm: true };
  return viewer.playerId ? { dm: false, player: viewer.playerId } : undefined;
}

/** What the board needs from the vault, as this viewer may see it. */
export function boardLookups(vault: Vault, viewer: Viewer): BoardLookups {
  const names = new Map(partyPlayers(vault).map((player) => [player.id, player.name]));
  return {
    note: (id) => {
      const note = vault.noteById(id, viewer);
      return note && { title: note.title, url: noteUrl(note.slug) };
    },
    playerName: (id) => names.get(id) ?? "A player",
  };
}

/** The cards a viewer may see, for checking what they ask to change. */
export function cardsSeenBy(vault: Vault, viewer: Viewer): (card: BoardCard) => boolean {
  const { note } = boardLookups(vault, viewer);
  return (card) => seesCard(viewer.role === "dm", card, note);
}

/** The board as one viewer sees it: only what they may see, from the stored board. */
export async function boardView(
  services: Pick<Services, "board" | "vault">,
  viewer: Viewer,
): Promise<BoardView> {
  return boardForViewer(
    await services.board.get(),
    boardActor(viewer),
    boardLookups(services.vault.current, viewer),
  );
}

/**
 * The notice board for one viewer: the next session, the session notes they may read, the board
 * as they may see it, and for the DM, the notes they may pin.
 */
export async function boardPage(services: Services, viewer: Viewer): Promise<BoardPage> {
  const notes = services.vault.current.notes(viewer);
  const sessions = notes.filter((note) => note.type === "session");
  const [nextSession, board] = await Promise.all([
    services.nextSession.get(),
    boardView(services, viewer),
  ]);
  return {
    ...(nextSession && { nextSession }),
    sessions: newestFirst(sessions).map((note) => ({ title: note.title, url: noteUrl(note.slug) })),
    notes: viewer.role === "dm" ? notes.map(({ id, slug, title }) => ({ id, slug, title })) : [],
    board,
    canWrite: boardActor(viewer) !== undefined,
  };
}
