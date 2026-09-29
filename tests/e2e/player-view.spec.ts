import { expect, test } from "@playwright/test";
import {
  noteBody,
  openNote,
  search,
  searchResults,
  sidebar,
  switchToDmView,
  switchToPlayerView,
} from "./support/app";

/**
 * The player preview must hide DM-only content everywhere it could surface. In the fixture vault,
 * "Captain Voss" (no visibility field) and "Villain Plan" (visibility: dm) are both DM-only.
 */
test.describe("Player view", () => {
  test("the DM sees DM-only notes by default", async ({ page }) => {
    await page.goto("/wiki");

    await expect(sidebar(page).getByRole("link", { name: /Captain Voss/ })).toBeVisible();
    await expect(sidebar(page).getByText("Secrets")).toBeVisible();
  });

  test("hides DM-only notes and folders from the sidebar", async ({ page }) => {
    await page.goto("/wiki");
    await switchToPlayerView(page);

    await expect(sidebar(page).getByRole("link", { name: /Mira Stonehand/ })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /Captain Voss/ })).toHaveCount(0);
    await expect(sidebar(page).getByText("Secrets")).toHaveCount(0);
  });

  test("shows links to DM-only notes as plain text", async ({ page }) => {
    await openNote(page, "Locations/Brindleford");
    await expect(noteBody(page).getByRole("link", { name: "Captain Voss" })).toBeVisible();

    await switchToPlayerView(page);
    await expect(noteBody(page)).toContainText("The town guard answers to Captain Voss.");
    await expect(noteBody(page).getByRole("link", { name: "Captain Voss" })).toHaveCount(0);
  });

  test("returns not found for a DM-only note's URL", async ({ page }) => {
    await page.goto("/wiki");
    await switchToPlayerView(page);

    const response = await page.goto("/wiki/Secrets/Villain%20Plan");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Note not found" })).toBeVisible();
  });

  test("leaves DM-only notes out of search results", async ({ page }) => {
    await page.goto("/wiki");
    await search(page, "quartermaster");
    await expect(searchResults(page).getByRole("link")).toHaveCount(2);

    await switchToPlayerView(page);
    await expect(page.getByText("Nothing matches “quartermaster”.")).toBeVisible();
  });

  test("hides DM comments inside player-visible notes", async ({ page }) => {
    await openNote(page, "NPCs/Mira Stonehand");
    await expect(noteBody(page)).toContainText("inline secret about the forge");
    await expect(noteBody(page)).toContainText("It spans several lines.");

    await switchToPlayerView(page);
    await expect(noteBody(page)).toContainText("She works in Brindleford.");
    await expect(noteBody(page)).not.toContainText("secret");
  });

  test("hides DM sections and DM callouts inside player-visible notes", async ({ page }) => {
    // "Fixture Informant" opens with a "# DM" section, and has a DM callout and a "## DM" section.
    await openNote(page, "NPCs/Fixture Informant");
    for (const secret of ["medlar", "loquat", "quince"]) {
      await expect(noteBody(page)).toContainText(secret);
    }
    await expect(noteBody(page).getByRole("img")).toBeVisible();

    await switchToPlayerView(page);
    await expect(page.getByRole("heading", { level: 1, name: "Fixture Informant" })).toBeVisible();
    await expect(noteBody(page)).toContainText("persimmon");
    await expect(noteBody(page)).toContainText("damson");
    for (const secret of ["medlar", "loquat", "quince", "[!dm]"]) {
      await expect(noteBody(page)).not.toContainText(secret);
    }
    await expect(noteBody(page).getByRole("img")).toHaveCount(0);

    await search(page, "quince");
    await expect(page.getByText("Nothing matches “quince”.")).toBeVisible();
  });

  test("blocks attachments that only DM-only notes use", async ({ page }) => {
    await page.goto("/wiki");
    expect((await page.request.get("/vault-asset/Attachments/dm-map.png")).status()).toBe(200);

    await switchToPlayerView(page);
    expect((await page.request.get("/vault-asset/Attachments/dm-map.png")).status()).toBe(404);
    expect((await page.request.get("/vault-asset/Attachments/mira-portrait.png")).status()).toBe(
      200,
    );
  });

  test("switching back restores the DM view on the same page", async ({ page }) => {
    await openNote(page, "Locations/Brindleford");
    await switchToPlayerView(page);
    await switchToDmView(page);

    await expect(page).toHaveURL("/wiki/Locations/Brindleford");
    await expect(noteBody(page).getByRole("link", { name: "Captain Voss" })).toBeVisible();
  });
});
