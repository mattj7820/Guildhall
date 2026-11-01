import { expect, test } from "./support/fixtures";
import { d20, scriptDice } from "./support/dice";
import { DiceCollection } from "./pages/dice-collection";
import { SIGNED_IN } from "./support/sign-in";
import { uniqueName } from "./support/test-data";

/**
 * 3D dice: rolls thrown across the screen, the result shown once they land, each member's switch
 * to turn them off, and the packs and dice the DM gives. Rolls on Fixture PC One's sheet as Player One,
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

test("the DM gives packs and particular dice, and sees what each member has", async ({
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

  const dice = members.dice(name);
  await expect(dice).toContainText("0 dice");
  await members.givePack(name, "For the session recap");
  await expect(dice).toContainText("0 dice, 1 pack unopened");
  await members.giveDie(name, "Bone (Uncommon)", 20);
  await members.giveDie(name, "Bone (Uncommon)", 20);
  await expect(dice).toContainText("2 dice, 1 pack unopened");
  await dice.getByText("2 dice").click();
  await expect(dice.getByRole("listitem")).toHaveText(["Bone d20 ×2 (Uncommon)"]);
  // Never more of one die than a roll could use: three d20s at most.
  await members.giveDie(name, "Bone (Uncommon)", 20);
  await members.giveDie(name, "Bone (Uncommon)", 20);
  await expect(dice.getByRole("alert")).toContainText("as many of that die as a roll could use");
  await members.giveDie(name, "Glass (Rare)", 6);
  await expect(dice).toContainText("4 dice, 1 pack unopened");

  // They see their dice and the pack, with why, and nothing of dice they haven't found.
  await them.settings.open();
  await expect(them.settings.yourDice).toContainText("4 dice found, 1 pack to open");
  await expect(them.page.getByRole("link", { name: "1 pack to open", exact: true })).toBeVisible();
  await them.settings.yourDice.click();
  await expect(them.diceCollection.collection).toHaveText("Collection (4 dice)");
  await expect(them.diceCollection.packs).toHaveText(["A dice packFor the session recapOpen"]);
  // Each type's slot shows what it rolls first: their only d20 is Bone, and no d8s at all.
  await expect(them.diceCollection.type(20)).toHaveAccessibleName("d20 Bone");
  await expect(them.diceCollection.type(8)).toHaveAccessibleName("d8 Theme's dice");
  await expect(them.diceCollection.die("Bone d20")).toContainText("Bone ×3");
  await expect(them.diceCollection.die("Bone d20")).toHaveAttribute("aria-pressed", "true");
  await expect(them.diceCollection.shown).toContainText("(your rarest)");
  await them.diceCollection.showType(6);
  await expect(them.diceCollection.shown).toContainText("RareGlass");
  await expect(them.diceCollection.die("Glass d6")).toBeVisible();
  expect(await them.page.content()).not.toContain("Gilded");

  // Chosen rather than only the rarest, it stays chosen.
  await them.diceCollection.showType(20);
  await them.diceCollection.rollFirst("Bone d20");
  await them.diceCollection.open();
  await them.diceCollection.showType(20);
  await expect(them.diceCollection.shown).not.toContainText("(your rarest)");
  await expect(them.diceCollection.die("Bone d20")).toHaveAttribute("aria-pressed", "true");

  // Opening the pack: its die is drawn on the server, and added to theirs.
  const opening = await them.diceCollection.openPack();
  await expect(opening).toContainText("For the session recap");
  await expect(opening.getByRole("heading")).toHaveText(/^\w+ d(4|6|8|10|12|20)$/);
  await opening.getByRole("button", { name: "Done" }).click();
  await expect(opening).toHaveCount(0);
  await expect(them.diceCollection.collection).toHaveText("Collection (5 dice)");
  await expect(them.diceCollection.packs).toHaveCount(0);

  // A pack opened in another tab, then opened again here: it says so, and is gone once closed.
  await members.givePack(name, "Fixture: a pack opened twice");
  await expect(members.dice(name)).toContainText("1 pack unopened");
  await them.diceCollection.open();
  const otherTab = new DiceCollection(await them.page.context().newPage());
  await otherTab.open();
  await otherTab.openPack();
  await them.diceCollection.packs.first().getByRole("button", { name: "Open" }).click();
  const again = them.page.getByRole("dialog", { name: "Opening a pack" });
  await expect(again.getByRole("alert")).toHaveText("That pack has already been opened.");
  await again.getByRole("button", { name: "Close" }).click();
  await expect(them.diceCollection.packs).toHaveCount(0);
  await expect(them.diceCollection.collection).toHaveText("Collection (6 dice)");
  await expect(them.page.getByRole("link", { name: "1 pack to open", exact: true })).toHaveCount(0);
});
