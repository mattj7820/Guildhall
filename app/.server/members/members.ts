import path from "node:path";
import { z } from "zod";
import type { PlayerId } from "~/campaign/types";
import { memberSchema } from "~/members/schema";
import type { DiscordId, DiscordProfile, Member } from "~/members/types";
import { newId } from "~/shared/ids";
import type { DiceSetId } from "~/dice/sets";
import type { Theme } from "~/theme/themes";
import { JsonFile } from "../data/json-store";

const fileSchema = z.object({
  version: z.literal(1),
  members: z.array(memberSchema),
});
type MembersFile = z.infer<typeof fileSchema>;

/** Anyone can ask to join, so the waiting list is capped; the DM can dismiss requests. */
export const MAX_PENDING = 20;

export type SignInResult = { member: Member } | { waitingListFull: true };

/**
 * Everyone who has signed in, kept in `members.json` in the data folder. Newcomers wait for the
 * DM's approval. Read fresh on every request, so removing someone takes effect at once.
 */
export class Members {
  constructor(
    private readonly file: JsonFile<MembersFile>,
    private readonly now: () => Date = () => new Date(),
    private readonly createKey: () => string = newId,
  ) {}

  /** The clock and session keys can be replaced in tests. */
  static inFolder(
    dataPath: string,
    options: { now?: () => Date; createKey?: () => string } = {},
  ): Members {
    return new Members(
      new JsonFile(path.join(dataPath, "members.json"), fileSchema, () => ({
        version: 1,
        members: [],
      })),
      options.now,
      options.createKey,
    );
  }

  /** People waiting first (oldest request first), then members by name. */
  async list(): Promise<Member[]> {
    const { members } = await this.file.read();
    const waiting = members
      .filter((member) => member.status === "pending")
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
    const approved = members
      .filter((member) => member.status === "approved")
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...waiting, ...approved];
  }

  async get(discordId: DiscordId): Promise<Member | undefined> {
    return (await this.file.read()).members.find((member) => member.discordId === discordId);
  }

  /**
   * Records a sign-in. A newcomer joins the waiting list, unless `approve` is set (the DM, whose
   * ID is in the settings, or a dev sign-in). Someone already known gets their Discord name
   * refreshed. Refuses a newcomer while the waiting list is full.
   */
  signIn(profile: DiscordProfile, { approve = false } = {}): Promise<SignInResult> {
    return this.file.update<SignInResult>((data) => {
      const timestamp = this.now().toISOString();
      const existing = data.members.find((member) => member.discordId === profile.discordId);
      if (existing) {
        const updated: Member = {
          ...existing,
          name: profile.name,
          username: profile.username,
          lastSignInAt: timestamp,
          ...(approve && existing.status === "pending"
            ? { status: "approved" as const, approvedAt: timestamp }
            : {}),
        };
        return { next: replace(data, updated), result: { member: updated } };
      }

      const waiting = data.members.filter((member) => member.status === "pending").length;
      if (!approve && waiting >= MAX_PENDING) {
        return { next: data, result: { waitingListFull: true } };
      }
      const member: Member = {
        discordId: profile.discordId,
        name: profile.name,
        username: profile.username,
        status: approve ? "approved" : "pending",
        sessionKey: this.createKey(),
        requestedAt: timestamp,
        ...(approve ? { approvedAt: timestamp } : {}),
        lastSignInAt: timestamp,
      };
      return { next: { ...data, members: [...data.members, member] }, result: { member } };
    });
  }

  /** Lets someone in, as the given player. Undefined if they're not on the list any more. */
  approve(discordId: DiscordId, playerId?: PlayerId): Promise<Member | undefined> {
    return this.change(discordId, (member) => ({
      ...member,
      status: "approved",
      approvedAt: member.approvedAt ?? this.now().toISOString(),
      ...withPlayer(playerId),
    }));
  }

  /** Changes which player someone is (or none). */
  assignPlayer(discordId: DiscordId, playerId?: PlayerId): Promise<Member | undefined> {
    return this.change(discordId, (member) => {
      const changed = { ...member };
      delete changed.playerId;
      return { ...changed, ...withPlayer(playerId) };
    });
  }

  /** Saves the look someone picked. */
  setTheme(discordId: DiscordId, theme: Theme): Promise<Member | undefined> {
    return this.change(discordId, (member) => ({ ...member, theme }));
  }

  /** Turns someone's 3D dice on or off. */
  setDiceOn(discordId: DiscordId, on: boolean): Promise<Member | undefined> {
    return this.change(discordId, (member) => {
      const dice = { ...member.dice };
      delete dice.off;
      return { ...member, dice: on ? dice : { ...dice, off: true } };
    });
  }

  /** Turns the sound of someone's dice on or off. */
  setDiceSound(discordId: DiscordId, on: boolean): Promise<Member | undefined> {
    return this.change(discordId, (member) => {
      const dice = { ...member.dice };
      delete dice.quiet;
      return { ...member, dice: on ? dice : { ...dice, quiet: true } };
    });
  }

  /** The DM gives someone a dice set, or takes it back. */
  giveDiceSet(discordId: DiscordId, set: DiceSetId, give: boolean): Promise<Member | undefined> {
    return this.change(discordId, (member) => {
      const given = member.dice?.given ?? [];
      const others = given.filter((each) => each !== set);
      const next = !give ? others : given.includes(set) ? given : [...given, set];
      return { ...member, dice: { ...member.dice, given: next } };
    });
  }

  /** Someone picks the set their dice are in, or undefined for the theme's dice. */
  chooseDiceSet(discordId: DiscordId, set: DiceSetId | undefined): Promise<Member | undefined> {
    return this.change(discordId, (member) => {
      const dice = { ...member.dice };
      delete dice.set;
      return { ...member, dice: set ? { ...dice, set } : dice };
    });
  }

  /**
   * Removes someone, whether waiting or approved, signing them out everywhere. If they sign in
   * again they're a newcomer, with a new session key. False if they weren't on the list.
   */
  remove(discordId: DiscordId): Promise<boolean> {
    return this.file.update((data) => {
      const members = data.members.filter((member) => member.discordId !== discordId);
      return { next: { ...data, members }, result: members.length < data.members.length };
    });
  }

  private change(
    discordId: DiscordId,
    apply: (member: Member) => Member,
  ): Promise<Member | undefined> {
    return this.file.update((data) => {
      const existing = data.members.find((member) => member.discordId === discordId);
      if (!existing) return { next: data, result: undefined };
      const changed = apply(existing);
      return { next: replace(data, changed), result: changed };
    });
  }
}

function replace(data: MembersFile, changed: Member): MembersFile {
  return {
    ...data,
    members: data.members.map((member) =>
      member.discordId === changed.discordId ? changed : member,
    ),
  };
}

function withPlayer(playerId: PlayerId | undefined): { playerId?: PlayerId } {
  return playerId ? { playerId } : {};
}
