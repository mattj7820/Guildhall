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
  await expect(page.getByRole("status")).toContainText("Previewing as a player");
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

/** Waits until the fight's last change has reached the server. */
export const fightSaved = (page: Page) => expect(page.getByText("Saving…")).toHaveCount(0);

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

/** The editor's list of areas in its side panel. */
export const editorAreas = (page: Page) =>
  page.getByRole("complementary", { name: "Editing" }).getByRole("list", { name: "Areas" });

/**
 * Where a point on the image is on screen, given as fractions of the image's width and height.
 * The canvas fits the whole image and centres it, so this allows for the space around it.
 */
export async function onImage(
  page: Page,
  mapName: string,
  image: { width: number; height: number },
  [fx, fy]: [number, number],
) {
  const box = await mapCanvas(page, mapName).boundingBox();
  if (!box) throw new Error("The map canvas isn't on screen");
  const scale = Math.min(box.width / image.width, box.height / image.height);
  return {
    x: (box.width - image.width * scale) / 2 + fx * image.width * scale,
    y: (box.height - image.height * scale) / 2 + fy * image.height * scale,
  };
}

/** Draws an area in the editor by clicking its corners, then presses Enter to close it. */
export async function drawArea(
  page: Page,
  mapName: string,
  image: { width: number; height: number },
  corners: [number, number][],
) {
  await page.getByRole("button", { name: "Draw area" }).click();
  for (const corner of corners) {
    await mapCanvas(page, mapName).click({ position: await onImage(page, mapName, image, corner) });
  }
  await mapCanvas(page, mapName).press("Enter");
  await expect(page.getByLabel("Area name")).toBeFocused();
}

/** The handles of the selected area's points, in order, e.g. "Point 2 of Harbour at 40.0%, 40.0%". */
export const vertexHandles = (page: Page, areaName: string) =>
  page.getByRole("button", { name: new RegExp(`^Point \\d+ of ${areaName} at `) });

/** A point handle's position as percentages of the image, read from its label. */
export async function vertexPosition(page: Page, areaName: string, point: number) {
  const label = await vertexHandles(page, areaName)
    .nth(point - 1)
    .getAttribute("aria-label");
  const [, x, y] = /at ([\d.]+)%, ([\d.]+)%$/.exec(label ?? "") ?? [];
  return { x: Number(x), y: Number(y) };
}

/** In the editor, makes a new map from a fixture image for the selected area to lead to. */
export async function linkNewMap(page: Page, image: string) {
  await page.getByRole("button", { name: "New map from image…" }).click();
  const newMap = page.getByRole("group", { name: "New map for this area" });
  await newMap.getByRole("searchbox", { name: "Find an image" }).fill(image);
  await newMap.getByRole("radio", { name: new RegExp(`${image}$`) }).check();
  await expect(newMap.getByText(/\d+ × \d+ pixels/)).toBeVisible();
  await newMap.getByRole("button", { name: "Create and link" }).click();
  await expect(newMap).toHaveCount(0);
  await expectSaved(page);
}

/* Characters */

/** Guildhall's own address in the e2e run, for posts that must look like they came from it. */
export const ORIGIN = "http://localhost:4173";

/** A party member's card on the Characters page. */
export const characterCard = (page: Page, name: string) =>
  page.getByRole("article", { name, exact: true });

/**
 * Opens a character's sheet from the Characters page, starting it first if no test has yet.
 * Tests share one server, and starting a sheet that exists just opens it, so any test may be
 * first.
 */
export async function openCharacter(page: Page, name: string) {
  await page.goto("/characters");
  const card = characterCard(page, name);
  await card
    .getByRole("link", { name: new RegExp(`^Open .* for ${name}$`) })
    .or(card.getByRole("button", { name: new RegExp(`^(Start sheet|Set up) for ${name}$`) }))
    .click();
  await expect(page).toHaveURL(/\/characters\/\w+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
