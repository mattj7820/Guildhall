import { randomUUID } from "node:crypto";
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

/* Prepared encounters */

/**
 * A name no other test uses, since tests share the server's data folder. Random rather than from
 * the test's ID, which repeats and retries share.
 */
export const uniqueName = (base: string) => `${base} ${randomUUID().slice(0, 8)}`;

export const expectSaved = (page: Page) =>
  expect(page.getByText("✓ All changes saved")).toBeVisible();

export const preparedList = (page: Page) => page.getByRole("list", { name: "Prepared encounters" });

export const preparedCombatant = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "Monsters and companions" })
    .getByRole("listitem", { name, exact: true });

/** Creates a prepared encounter from the list page and names it; ends in the editor. */
export async function createPrepared(page: Page, name: string) {
  await page.goto("/combat/prepared");
  await page.getByRole("button", { name: "New encounter" }).click();
  await expect(page).toHaveURL(/\/combat\/prepared\/\w+/);
  await page.getByLabel("Encounter name").fill(name);
  await expectSaved(page);
}

export async function addCompanion(page: Page, controller: string, statblock: string) {
  const form = page.getByRole("form", { name: "Add a companion or other player combatant" });
  await form.getByLabel("Controlled by").fill(controller);
  await form.getByLabel("Linked statblock (optional)").selectOption({ label: statblock });
  await form.getByRole("button", { name: "Add player combatant" }).click();
}

/* Maps */

/** The map canvas, labelled with the map's name. */
export const mapCanvas = (page: Page, name: string) =>
  page.getByRole("region", { name: `Map: ${name}`, exact: true });

export const zoomLevel = (page: Page) => page.getByRole("status", { name: "Zoom level" });

export const breadcrumbs = (page: Page) => page.getByRole("navigation", { name: "Breadcrumbs" });

/**
 * Makes a map from a fixture image through the "New map" form and waits for the page it opens.
 * The image's preview has to load (it measures the image) before the form can be sent.
 */
export async function createMap(
  page: Page,
  { image, name, note }: { image: string; name: string; note?: string },
) {
  await page.goto("/maps");
  await page.getByRole("button", { name: "New map" }).click();
  const form = page.getByRole("form", { name: "New map" });
  await form.getByRole("searchbox", { name: "Find an image" }).fill(image);
  await form.getByRole("radio", { name: new RegExp(`${image}$`) }).check();
  await expect(form.getByText(/\d+ × \d+ pixels/)).toBeVisible();
  await form.getByLabel("Name").fill(name);
  if (note) await form.getByLabel("Wiki note (optional)").fill(note);
  await form.getByRole("button", { name: "Create map" }).click();
  await expect(mapCanvas(page, name)).toBeVisible();
}
