import { expect, test, type Page } from "@playwright/test";
import { SIGNED_IN } from "./support/sign-in";

/** Smoke test for the throwaway inventory prototype (made-up items; nothing is saved). */

const grid = (page: Page) => page.getByRole("list", { name: "Inventory" });
const tile = (page: Page, name: string | RegExp) => grid(page).getByRole("button", { name });

const announcement = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

async function openPrototype(page: Page) {
  await page.goto("/prototype/inventory?bag");
  await expect(grid(page)).toBeVisible();
}

test("stacks, equips and removes items from the keyboard, with undo", async ({ page }) => {
  await openPrototype(page);

  // Pick up the second stack of torches, move it onto the first, and drop it there.
  // Each step waits for what a screen reader hears.
  await tile(page, "Torch, 2").focus();
  await page.keyboard.press("Space");
  await expect(announcement(page, "Torch is at position 6 of 11")).toBeAttached();
  await page.keyboard.press("ArrowLeft");
  await expect(announcement(page, "Over Torch: drop to stack")).toBeAttached();
  await page.keyboard.press("Space");
  await expect(tile(page, "Torch, 5")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(tile(page, /^Torch/)).toHaveCount(1);

  await tile(page, "Rope").focus();
  await page.keyboard.press("e");
  await expect(tile(page, "Rope, equipped")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Equipped" }).getByRole("button", { name: "Rope, equipped" }),
  ).toBeVisible();

  await page.keyboard.press("Delete");
  await expect(tile(page, /^Rope/)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(tile(page, "Rope, equipped")).toBeVisible();
});

test("adds an item in a few keystrokes, and opens its details", async ({ page }) => {
  await openPrototype(page);

  await page.getByRole("button", { name: "Add an item" }).click();
  await page.getByRole("combobox", { name: "Add item" }).fill("3 lanterns");
  await page.keyboard.press("Enter");
  await expect(tile(page, "lanterns, 3")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await tile(page, "Sample ring, new").click();
  const details = page.getByRole("dialog", { name: "Sample ring" });
  await expect(details).toContainText("Given by the DM");
  await details.getByRole("button", { name: "Close" }).click();
  await expect(tile(page, "Sample ring")).toBeVisible();
});

test("unequips from the equipped slots without opening the item", async ({ page }) => {
  await openPrototype(page);
  const equipped = page.getByRole("region", { name: "Equipped" });

  await equipped.getByRole("button", { name: "Unequip Dagger" }).click();
  await expect(tile(page, "Dagger")).toBeVisible();

  await equipped.getByRole("button", { name: "Leather armour, equipped" }).press("e");
  await expect(tile(page, "Leather armour")).toBeVisible();
  await expect(equipped.getByRole("button")).toHaveCount(0);
});

test("gives part of a stack to another character, who sees it as new", async ({ page }) => {
  await openPrototype(page);

  await tile(page, "Arrows, 20").focus();
  await page.keyboard.press("g");
  const details = page.getByRole("dialog", { name: "Arrows" });
  await details.getByRole("spinbutton", { name: "How many to give" }).fill("5");
  await details.getByRole("combobox").selectOption({ label: "Shared companion (companion)" });
  await details.getByRole("button", { name: "Give", exact: true }).click();
  await expect(tile(page, "Arrows, 15")).toBeVisible();

  await page.getByRole("button", { name: "Shared companion" }).click();
  await expect(tile(page, "Arrows, 5, new")).toBeVisible();
  await tile(page, "Arrows, 5, new").click();
  await expect(page.getByRole("dialog", { name: "Arrows" })).toContainText(
    "Given by Prototype character",
  );
});

test.describe("as a player", () => {
  test.use({ storageState: SIGNED_IN.playerOne });

  test("the prototype isn't there", async ({ page }) => {
    const response = await page.goto("/prototype/inventory");
    expect(response?.status()).toBe(404);
  });
});
