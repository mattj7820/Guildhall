import { expect, test } from "./support/fixtures";
import { d20, scriptDice } from "./support/dice";
import { SIGNED_IN } from "./support/sign-in";
import { uniqueName } from "./support/test-data";

/**
 * 3D dice: rolls thrown across the screen, the result shown once they land, each member's switch
 * to turn them off, and the dice sets the DM gives. Rolls on Fixture PC One's sheet as Player One,
 * which changes nothing on it. Serial, since Player One's switch is shared by both tests.
 */
test.describe.configure({ mode: "serial" });

test.describe("as Player One", () => {
  test.use({ storageState: SIGNED_IN.playerOne, reducedMotion: "no-preference" });

  test("throws the dice, and shows the result only once they've landed", async ({
    characters,
    page,
  }) => {
    const sheet = await characters.openSheet("Fixture PC One");
    const dice = page.getByRole("region", { name: "Dice" });
    await scriptDice(page, [d20(17)]);
    await dice.getByLabel("Dice to roll").fill("1d20");
    await dice.getByRole("button", { name: "Roll" }).click();
    await expect(sheet.latestRoll).toHaveText("Rolling…");
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByRole("status", { name: "Latest roll" })).toContainText("17", {
      timeout: 10_000,
    });
    // They stay a moment, then fade away.
    await expect(page.locator("canvas")).toHaveCount(0, { timeout: 10_000 });
  });

  test("shows rolls at once, with no dice, once they're turned off", async ({
    characters,
    settings,
    page,
  }) => {
    await settings.open();
    await settings.rollWithDice(false);
    try {
      await characters.openSheet("Fixture PC One");
      const dice = page.getByRole("region", { name: "Dice" });
      await scriptDice(page, [d20(4)]);
      await dice.getByLabel("Dice to roll").fill("1d20");
      await dice.getByRole("button", { name: "Roll" }).click();
      await expect(page.getByRole("status", { name: "Latest roll" })).toContainText("4");
      await expect(page.locator("canvas")).toHaveCount(0);
    } finally {
      await settings.open();
      await settings.rollWithDice(true);
    }
  });
});

test("the DM gives a dice set, the member rolls with it, and it goes when taken back", async ({
  members,
  openAs,
}) => {
  const them = await openAs("signedOut");
  const name = uniqueName("Dice roller");
  await them.signIn.asNewcomer(name);
  await members.open();
  await members.letIn(name);

  await them.settings.open();
  await expect(them.settings.diceSwitch).toHaveAttribute("aria-checked", "true");
  // Their dice can go quiet, and stay quiet.
  await them.settings.diceSoundSwitch.click();
  await expect(them.settings.diceSoundSwitch).toHaveAttribute("aria-checked", "false");
  await them.settings.open();
  await expect(them.settings.diceSoundSwitch).toHaveAttribute("aria-checked", "false");
  // Only the theme's dice until the DM gives a set.
  await expect(them.settings.diceSets).toHaveCount(0);

  await members.giveDice(name, "Bone");
  await them.settings.open();
  await them.settings.diceSet("Bone").click();
  await expect(them.settings.diceSet("Bone")).toHaveAttribute("aria-pressed", "true");
  await expect(them.settings.diceSet("The theme")).toHaveAttribute("aria-pressed", "false");

  await members.giveDice(name, "Bone", false);
  await them.settings.open();
  await expect(them.settings.diceSets).toHaveCount(0);
});
