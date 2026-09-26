import { expect, test } from "@playwright/test";
import { noteBody, openNote, sidebar } from "./support/app";

test.describe("Wiki navigation", () => {
  test("clicking a wikilink opens the linked note", async ({ page }) => {
    await openNote(page, "Home");
    await noteBody(page).getByRole("link", { name: "Brindleford" }).click();

    await expect(page).toHaveURL("/wiki/Locations/Brindleford");
    await expect(page.getByRole("heading", { level: 1, name: "Brindleford" })).toBeVisible();
  });

  test("an aliased wikilink shows its alias and opens the target note", async ({ page }) => {
    await openNote(page, "Home");
    await noteBody(page).getByRole("link", { name: "the blacksmith" }).click();

    await expect(page).toHaveURL("/wiki/NPCs/Mira%20Stonehand");
    await expect(page.getByRole("heading", { level: 1, name: "Mira Stonehand" })).toBeVisible();
  });

  test("a heading link opens the note at that heading", async ({ page }) => {
    await openNote(page, "Home");
    await noteBody(page).getByRole("link", { name: "Session 1 > Loot" }).click();

    await expect(page).toHaveURL("/wiki/Sessions/Session%201#loot");
    await expect(page.getByRole("heading", { name: "Loot" })).toBeInViewport();
  });

  test("an ambiguous link resolves to the shortest path", async ({ page }) => {
    await openNote(page, "Locations/Brindleford");
    await noteBody(page).getByRole("link", { name: "Old Mill" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Old Mill (outside town)" }),
    ).toBeVisible();
  });

  test("a broken link is shown but not clickable", async ({ page }) => {
    await openNote(page, "Home");
    const body = noteBody(page);
    await expect(body.getByText("A Note That Does Not Exist")).toBeVisible();
    await expect(body.getByRole("link", { name: "A Note That Does Not Exist" })).toHaveCount(0);
  });

  test("embedded images load from the vault", async ({ page }) => {
    await openNote(page, "NPCs/Mira Stonehand");
    const images = noteBody(page).getByRole("img", { name: "mira-portrait.png" });

    await expect(images).toHaveCount(2);
    await expect(images.last()).toHaveAttribute("width", "120");
    const naturalWidth = await images.first().evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  });

  test("the folder sidebar navigates to notes", async ({ page }) => {
    await page.goto("/wiki");
    const link = sidebar(page).getByRole("link", { name: /Session 1/ });
    await link.click();

    await expect(page).toHaveURL("/wiki/Sessions/Session%201");
    await expect(link).toHaveAttribute("aria-current", "page");
  });

  test("an unknown note shows a not-found page", async ({ page }) => {
    const response = await page.goto("/wiki/No/Such/Note");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Note not found" })).toBeVisible();
  });
});
