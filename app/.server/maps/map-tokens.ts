import path from "node:path";
import { z } from "zod";
import { applyTokenAction, mapsTouched, type TokenAction } from "~/maps/tokens/actions";
import type { Encounter } from "~/combat/types";
import { MARKER_NAME_MAX, tokensSchema } from "~/maps/tokens/schema";
import type { Token } from "~/maps/tokens/types";
import type { MapId } from "~/maps/types";
import { JsonFile } from "../data/json-store";

const fileSchema = z.object({ version: z.literal(1), tokens: tokensSchema });
type TokensFile = z.infer<typeof fileSchema>;

export interface TokensApplied {
  /** The tokens on the map now. */
  tokens: Token[];
  /** Actions the viewer wasn't allowed to make. Nothing of them was applied. */
  refused: number;
  /** Maps whose tokens changed, to tell those watching them. */
  changed: MapId[];
}

/**
 * Tokens on every map, kept in `tokens.json` in the data folder, apart from maps and fog: moves
 * happen often during a session and mustn't race the map editor's autosave. Written only when a
 * move is made (a drop), never while dragging.
 */
export class MapTokens {
  constructor(private readonly file: JsonFile<TokensFile>) {}

  static inFolder(dataPath: string): MapTokens {
    return new MapTokens(
      new JsonFile(path.join(dataPath, "tokens.json"), fileSchema, () => ({
        version: 1,
        tokens: [],
      })),
    );
  }

  async list(): Promise<Token[]> {
    return (await this.file.read()).tokens;
  }

  async onMap(map: MapId): Promise<Token[]> {
    return (await this.list()).filter((token) => token.map === map);
  }

  /**
   * Applies the actions in order to the tokens as stored now (decision 30), each only if
   * `allowed` says the viewer may make it, given the tokens as they are at that moment.
   */
  apply(
    map: MapId,
    actions: readonly TokenAction[],
    allowed: (action: TokenAction, tokens: readonly Token[]) => boolean,
  ): Promise<TokensApplied> {
    return this.file.update((data) => {
      let tokens = data.tokens;
      let refused = 0;
      const changed = new Set<MapId>();
      for (const action of actions) {
        if (!allowed(action, tokens)) {
          refused++;
          continue;
        }
        const touched = mapsTouched(tokens, action);
        const applied = applyTokenAction(tokens, action);
        if (!applied.changed) continue;
        tokens = applied.tokens;
        for (const each of touched) changed.add(each);
      }
      const result = {
        tokens: tokens.filter((token) => token.map === map),
        refused,
        changed: [...changed],
      };
      return { next: changed.size > 0 ? { ...data, tokens } : data, result };
    });
  }

  /**
   * When a fight ends, its monsters' tokens are cleared, or left where they fell as markers the
   * DM can tidy later (seen by players, unless the monster was hidden). Answers with the maps
   * whose tokens changed.
   */
  endFight(encounter: Encounter, leave: boolean): Promise<MapId[]> {
    return this.file.update((data) => {
      const changed = new Set<MapId>();
      const tokens = data.tokens.flatMap((token): Token[] => {
        if (token.kind !== "combatant") return [token];
        const monster = encounter.combatants.find((c) => c.id === token.combatant);
        if (!monster) return [token];
        changed.add(token.map);
        if (!leave) return [];
        const marker: Token = {
          kind: "marker",
          id: token.id,
          map: token.map,
          at: token.at,
          ...(token.size && { size: token.size }),
          name: monster.name.slice(0, MARKER_NAME_MAX),
          colour: "grey",
          visibility: monster.kind === "monster" && monster.hidden ? "dm" : "players",
        };
        return [marker];
      });
      return { next: changed.size > 0 ? { ...data, tokens } : data, result: [...changed] };
    });
  }

  /** When a map is deleted: its markers go, and the party members on it are no longer anywhere. */
  deleteMap(map: MapId): Promise<void> {
    return this.file.update((data) => ({
      next: { ...data, tokens: data.tokens.filter((token) => token.map !== map) },
      result: undefined,
    }));
  }
}
