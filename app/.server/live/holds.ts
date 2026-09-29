import type { MapId } from "~/maps/types";
import type { TokenId } from "~/maps/tokens/types";

/** A hold ends this long after the holder last moved the token (a closed laptop, a lost tab). */
export const HOLD_MS = 3000;

/** Who is moving a token: a connection (a tab), and the member it belongs to. */
export interface Holder {
  connection: object;
  discordId: string;
  name: string;
  isDm: boolean;
}

interface Hold {
  holder: Holder;
  until: number;
}

export type Grab = { granted: true } | { granted: false; by: string };

/**
 * Who is moving which token right now, so two people don't fight over one: the first to pick a
 * token up holds it until they put it down, stop moving it for a few seconds, or disconnect. The
 * DM can take a token from anyone. Kept in memory only: a hold lasts seconds.
 */
export class Holds {
  private readonly holds = new Map<string, Hold>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Picking up or still moving a token: granted, and held a while longer, unless someone else has it. */
  grab(map: MapId, token: TokenId, holder: Holder): Grab {
    const key = keyOf(map, token);
    const current = this.live(key);
    if (current && current.holder.connection !== holder.connection && !holder.isDm) {
      return { granted: false, by: current.holder.name };
    }
    this.holds.set(key, { holder, until: this.now() + HOLD_MS });
    return { granted: true };
  }

  /** Put down (or the move was saved): free for anyone, if this holder had it. */
  release(map: MapId, token: TokenId, connection: object): void {
    const key = keyOf(map, token);
    if (this.holds.get(key)?.holder.connection === connection) this.holds.delete(key);
  }

  /** A tab closed: everything it held is free. */
  releaseAll(connection: object): void {
    for (const [key, hold] of this.holds) {
      if (hold.holder.connection === connection) this.holds.delete(key);
    }
  }

  /**
   * Who else is holding a token, for a saved move from another member: nobody, or the name of
   * whoever has it. A member's own tabs, and the DM, are never kept out.
   */
  heldByOther(map: MapId, token: TokenId, discordId: string, isDm: boolean): string | undefined {
    const current = this.live(keyOf(map, token));
    if (!current || isDm || current.holder.discordId === discordId) return undefined;
    return current.holder.name;
  }

  private live(key: string): Hold | undefined {
    const hold = this.holds.get(key);
    if (hold && hold.until <= this.now()) {
      this.holds.delete(key);
      return undefined;
    }
    return hold;
  }
}

const keyOf = (map: MapId, token: TokenId) => `${map}\n${token}`;
