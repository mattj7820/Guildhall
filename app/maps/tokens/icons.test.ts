import { describe, expect, it } from "vitest";
import { guessTokenIcon, tokenIcon } from "./icons";
import { TOKEN_ICONS } from "./token-icons";

describe("guessTokenIcon", () => {
  it.each([
    ["Bandit 2", "rogue"],
    ["Hooded stranger", "hood"],
    ["The Rusty Anchor inn", "tavern"],
    ["Old Mill door", "door"],
    ["Wolves", "wolf"],
    ["Merchant's cart", "cart"],
    ["Treasure chest", "chest"],
  ])("guesses %s as %s", (name, icon) => {
    expect(guessTokenIcon(name)).toBe(icon);
  });

  it("guesses nothing for a name it doesn't know, for initials instead", () => {
    expect(guessTokenIcon("Mira Stonehand")).toBeUndefined();
    expect(guessTokenIcon("")).toBeUndefined();
  });
});

describe("tokenIcon", () => {
  it("finds an icon by ID, and nothing for an unknown or missing one", () => {
    expect(tokenIcon("campfire")?.label).toBe("Campfire");
    expect(tokenIcon("no-such-icon")).toBeUndefined();
    expect(tokenIcon(undefined)).toBeUndefined();
  });

  it("has unique IDs, each with an author for the credits", () => {
    expect(new Set(TOKEN_ICONS.map((icon) => icon.id)).size).toBe(TOKEN_ICONS.length);
    expect(TOKEN_ICONS.every((icon) => icon.author && icon.path)).toBe(true);
  });
});
