import { expect, test } from "@playwright/test";
import { noteBody, openNote } from "./support/app";

test.describe("Statblocks", () => {
  test("render in the book's layout", async ({ page }) => {
    await openNote(page, "Bestiary/Test Creature");
    const statblock = page.getByRole("region", { name: "Statblock: Test Creature" });

    await expect(statblock.getByRole("heading", { name: "Test Creature" })).toBeVisible();
    await expect(statblock).toContainText("Armor Class 17");
    await expect(statblock).toContainText("Hit Points 17 (5d6 − 1)");
    await expect(statblock.getByRole("columnheader", { name: "DEX" })).toBeVisible();
    await expect(statblock.getByRole("cell", { name: "15 (+2)" })).toBeVisible();
    await expect(statblock.getByRole("heading", { name: "Reactions" })).toBeVisible();
  });

  test("an unreadable statblock explains why and keeps the original text", async ({ page }) => {
    await openNote(page, "Bestiary/Test Creature");
    await expect(noteBody(page)).toContainText("Couldn't show this statblock.");
    await expect(noteBody(page).locator("code.language-statblock")).toContainText("ac: 12");
  });
});
