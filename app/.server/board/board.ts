import path from "node:path";
import { applyBoardAction, withFixedCards, type BoardAction } from "~/board/actions";
import { boardFileSchema, type BoardFile } from "~/board/schema";
import type { Board, BoardAuthor, BoardCard } from "~/board/types";
import { JsonFile } from "../data/json-store";

/**
 * The notice board, kept in `board.json` in the data folder: its cards and string. Changes are
 * `BoardAction`s applied to what's stored now, never a whole board.
 */
export class CampaignBoard {
  constructor(private readonly file: JsonFile<BoardFile>) {}

  static inFolder(dataPath: string): CampaignBoard {
    return new CampaignBoard(
      new JsonFile(path.join(dataPath, "board.json"), boardFileSchema, () => ({
        version: 1,
        cards: [],
        strings: [],
      })),
    );
  }

  async get(): Promise<Board> {
    const { cards, strings } = await this.file.read();
    return withFixedCards({ cards, strings });
  }

  /**
   * Applies each action the actor may make, seeing the cards `canSee` allows, in one write.
   * Answers how many were refused.
   */
  async apply(
    actions: readonly BoardAction[],
    actor: BoardAuthor,
    canSee: (card: BoardCard) => boolean,
  ): Promise<{ refused: number }> {
    return this.file.update((current) => {
      let board = withFixedCards({ cards: current.cards, strings: current.strings });
      let refused = 0;
      for (const action of actions) {
        const next = applyBoardAction(board, action, actor, canSee);
        if (next) board = next;
        else refused += 1;
      }
      return { next: { version: 1 as const, ...board }, result: { refused } };
    });
  }
}
