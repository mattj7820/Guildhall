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

/* Combat tracker */

export const turnOrder = (page: Page) => page.getByRole("list", { name: "Turn order" });

export const combatant = (page: Page, name: string) =>
  turnOrder(page).getByRole("listitem", { name, exact: true });

/** The round and whose turn it is, e.g. "Round 2 · Goblin 1's turn". */
export const turnStatus = (page: Page) => page.getByRole("region", { name: "Turn", exact: true });

/** Opens the tracker and waits until the saved encounter has loaded in the browser. */
export async function openCombat(page: Page) {
  await page.goto("/combat");
  await expect(turnStatus(page)).toBeVisible();
}

/** The value Math.random must return for a die with `sides` to land on `face`. */
export const face = (sides: number, value: number) => (value - 0.5) / sides;

/**
 * Scripts the next dice the page rolls. Replaces Math.random in the loaded page (not in an init
 * script, because React and React Router also call it while starting up and navigating), so call
 * it just before the action that rolls. Real randomness resumes once the script runs out.
 */
export async function scriptDice(page: Page, values: number[]) {
  await page.evaluate((scripted) => {
    const real = Math.random;
    let next = 0;
    Math.random = () => (next < scripted.length ? scripted[next++] : real());
  }, values);
}

export async function addMonsters(page: Page, statblock: string, quantity: number) {
  const form = page.getByRole("form", { name: "Add monsters" });
  await form.getByLabel("Statblock", { exact: true }).selectOption({ label: statblock });
  await form.getByLabel("How many").fill(String(quantity));
  await form.getByRole("button", { name: "Add monsters" }).click();
}

export async function setInitiative(page: Page, name: string, value: number) {
  const input = combatant(page, name).getByLabel(`Initiative for ${name}`);
  await input.fill(String(value));
  await input.press("Enter");
}
