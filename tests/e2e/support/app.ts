import { expect, type Page } from "@playwright/test";

/** Small helpers for the parts of the app every spec touches. */

export const sidebar = (page: Page) => page.getByRole("navigation", { name: "Wiki folders" });

export const noteBody = (page: Page) => page.locator("article .note-body");

export const searchResults = (page: Page) => page.getByRole("list", { name: "Search results" });

export async function openNote(page: Page, slug: string) {
  await page.goto(`/wiki/${slug.split("/").map(encodeURIComponent).join("/")}`);
}

export async function switchToPlayerView(page: Page) {
  await page.getByRole("button", { name: "Preview as player" }).click();
  await expect(page.getByRole("status")).toContainText("Player preview");
}

export async function switchToDmView(page: Page) {
  await page.getByRole("button", { name: "Back to DM view" }).click();
  await expect(page.getByRole("button", { name: "Preview as player" })).toBeVisible();
}

export async function search(page: Page, query: string) {
  const box = page.getByRole("searchbox", { name: "Search the wiki" });
  await box.fill(query);
  await box.press("Enter");
  await expect(page).toHaveURL(/\/wiki\?q=/);
}
