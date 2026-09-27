import { describe, expect, it } from "vitest";
import { discordIdSchema } from "~/members/schema";
import { DEV_DM, devDiscordId, devProfile, isLoopback } from "./dev-login";

describe("dev sign-in identities", () => {
  it("makes stable IDs that look like Discord's", () => {
    expect(devDiscordId("player one")).toBe(devDiscordId("player one"));
    expect(devDiscordId("player one")).not.toBe(devDiscordId("player two"));
    expect(discordIdSchema.safeParse(devDiscordId("player one")).success).toBe(true);
    expect(discordIdSchema.safeParse(DEV_DM.discordId).success).toBe(true);
  });

  it("names a pretend player after the name given", () => {
    expect(devProfile("Player One")).toEqual({
      discordId: devDiscordId("player one"),
      username: "dev-player-one",
      name: "Player One",
    });
  });
});

describe("isLoopback", () => {
  it.each(["127.0.0.1", "127.0.1.1", "::1", "::ffff:127.0.0.1"])(
    "%s is this computer",
    (address) => {
      expect(isLoopback(address)).toBe(true);
    },
  );

  it.each(["172.18.0.3", "::ffff:10.0.0.2", "192.168.1.20", "", undefined])(
    "%s is not",
    (address) => {
      expect(isLoopback(address)).toBe(false);
    },
  );
});
