import { expect, test } from "./support/fixtures";

test.describe("Statblocks", () => {
  test("render in the book's layout", async ({ page, wiki }) => {
    await wiki.openNote("Bestiary/Test Creature");
    const statblock = page.getByRole("region", { name: "Statblock: Test Creature" });

    await expect(statblock.getByRole("heading", { name: "Test Creature" })).toBeVisible();
    await expect(statblock).toContainText("Armor Class 17");
    await expect(statblock).toContainText("Hit Points 17 (5d6 − 1)");
    await expect(statblock.getByRole("columnheader", { name: "DEX" })).toBeVisible();
    await expect(statblock.getByRole("cell", { name: "15 (+2)" })).toBeVisible();
    await expect(statblock.getByRole("heading", { name: "Reactions" })).toBeVisible();
  });

  test("an unreadable statblock explains why and keeps the original text", async ({ wiki }) => {
    await wiki.openNote("Bestiary/Test Creature");
    await expect(wiki.noteBody).toContainText("Couldn't show this statblock.");
    await expect(wiki.noteBody.locator("code.language-statblock")).toContainText("ac: 12");
  });
});
