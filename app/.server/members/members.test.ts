import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { idSequence } from "~/combat/test-builders";
import type { DiscordProfile } from "~/members/types";
import { DataFileError } from "../data/json-store";
import { MAX_PENDING, Members } from "./members";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-members-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

/** A store with a controllable clock and predictable session keys. */
function store() {
  let minute = 0;
  const now = () => new Date(Date.UTC(2026, 8, 28, 19, minute++));
  return Members.inFolder(folder, { now, createKey: idSequence("session-key-long-enough") });
}

/** An invented Discord user; IDs are 18 digits, like real ones. */
const profile = (n: number, name = `Player ${n}`): DiscordProfile => ({
  discordId: `1${String(n).padStart(17, "0")}`, // built as text: too big for a JS number
  username: `player${n}`,
  name,
});

const signedIn = async (members: Members, who: DiscordProfile, options = {}) => {
  const result = await members.signIn(who, options);
  if (!("member" in result)) throw new Error("Expected to be let onto the list");
  return result.member;
};

describe("Members", () => {
  it("starts empty", async () => {
    expect(await store().list()).toEqual([]);
  });

  it("puts a newcomer on the waiting list", async () => {
    const member = await signedIn(store(), profile(1));
    expect(member).toEqual({
      discordId: "100000000000000001",
      name: "Player 1",
      username: "player1",
      status: "pending",
      sessionKey: "session-key-long-enough-1",
      requestedAt: "2026-09-28T19:00:00.000Z",
      lastSignInAt: "2026-09-28T19:00:00.000Z",
    });
  });

  it("lets the DM straight in", async () => {
    const member = await signedIn(store(), profile(1, "The DM"), { approve: true });
    expect(member).toMatchObject({ status: "approved", approvedAt: "2026-09-28T19:00:00.000Z" });
  });

  it("refreshes a returning member's Discord name, keeping everything else", async () => {
    const members = store();
    const first = await signedIn(members, profile(1));
    await members.approve(first.discordId, "player one");
    const again = await signedIn(members, profile(1, "New Name"));
    expect(again).toMatchObject({
      name: "New Name",
      status: "approved",
      playerId: "player one",
      sessionKey: first.sessionKey,
      lastSignInAt: "2026-09-28T19:02:00.000Z",
    });
  });

  it("approves someone waiting, as a player, and can change which player later", async () => {
    const members = store();
    const { discordId } = await signedIn(members, profile(1));
    expect(await members.approve(discordId, "player one")).toMatchObject({
      status: "approved",
      playerId: "player one",
    });
    expect(await members.assignPlayer(discordId, "player two")).toMatchObject({
      playerId: "player two",
    });
    const none = await members.assignPlayer(discordId, undefined);
    expect(none).not.toHaveProperty("playerId");
  });

  it(`caps the waiting list at ${MAX_PENDING}, but still lets known members and the DM in`, async () => {
    const members = store();
    for (let n = 1; n <= MAX_PENDING; n++) await signedIn(members, profile(n));
    expect(await members.signIn(profile(99))).toEqual({ waitingListFull: true });
    expect(await members.signIn(profile(1))).toHaveProperty("member");
    expect(await members.signIn(profile(98), { approve: true })).toHaveProperty("member");
  });

  it("removes someone, and a comeback starts over with a new session key", async () => {
    const members = store();
    const first = await signedIn(members, profile(1));
    await members.approve(first.discordId);
    expect(await members.remove(first.discordId)).toBe(true);
    expect(await members.get(first.discordId)).toBeUndefined();

    const comeback = await signedIn(members, profile(1));
    expect(comeback.status).toBe("pending");
    expect(comeback.sessionKey).not.toBe(first.sessionKey);
    expect(await members.remove("100000000000000999")).toBe(false);
  });

  it("lists people waiting first, oldest first, then members by name", async () => {
    const members = store();
    const zed = await signedIn(members, profile(1, "Zed"));
    await signedIn(members, profile(2, "Waiting B"));
    await signedIn(members, profile(3, "Waiting C"));
    const amy = await signedIn(members, profile(4, "Amy"));
    await members.approve(zed.discordId);
    await members.approve(amy.discordId);
    expect((await members.list()).map((member) => member.name)).toEqual([
      "Waiting B",
      "Waiting C",
      "Amy",
      "Zed",
    ]);
  });

  it("returns undefined when changing someone who isn't on the list", async () => {
    const members = store();
    expect(await members.approve("100000000000000999")).toBeUndefined();
    expect(await members.assignPlayer("100000000000000999", "x")).toBeUndefined();
    expect(await members.setTheme("100000000000000999", "gem")).toBeUndefined();
  });

  it("saves the look someone picks, and keeps it when they sign in again", async () => {
    const members = store();
    const { discordId } = await signedIn(members, profile(1), { approve: true });
    expect((await members.get(discordId))?.theme).toBeUndefined();
    await members.setTheme(discordId, "gem");
    await members.setTheme(discordId, "ember");
    await signedIn(members, profile(1, "Renamed"));
    expect(await members.get(discordId)).toMatchObject({ name: "Renamed", theme: "ember" });
  });

  it("reads a look it doesn't know as none picked, rather than refusing the file", async () => {
    const { discordId } = await signedIn(store(), profile(1), { approve: true });
    const filePath = path.join(folder, "members.json");
    const onDisk = JSON.parse(await readFile(filePath, "utf8"));
    onDisk.members[0].theme = "a look from the future";
    await writeFile(filePath, JSON.stringify(onDisk));
    const member = await store().get(discordId);
    expect(member).toMatchObject({ discordId, status: "approved" });
    expect(member?.theme).toBeUndefined();
  });

  it("keeps members in the data folder, so they survive a restart", async () => {
    const { discordId } = await signedIn(store(), profile(1));
    expect(await Members.inFolder(folder).get(discordId)).toMatchObject({ name: "Player 1" });
    const onDisk = JSON.parse(await readFile(path.join(folder, "members.json"), "utf8"));
    expect(onDisk).toMatchObject({ version: 1, members: [{ discordId }] });
  });

  it("reports a damaged file instead of overwriting it", async () => {
    const filePath = path.join(folder, "members.json");
    const damaged = '{"version": 1, "members": [{"discordId": "not a snowflake"}]}';
    await writeFile(filePath, damaged);
    await expect(store().list()).rejects.toThrow(DataFileError);
    await expect(store().signIn(profile(1))).rejects.toThrow(DataFileError);
    expect(await readFile(filePath, "utf8")).toBe(damaged);
  });
});
