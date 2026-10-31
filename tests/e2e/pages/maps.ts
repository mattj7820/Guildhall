import { expect, type Locator, type Page } from "@playwright/test";
import type { FixtureImage, MapRef, Point } from "../support/test-data";
import { AppPage, dragBetween, middleOf, settled } from "./app-page";

/** The Maps page: the list of maps, the preview of one, and the DM's "New map" form. */
export class Maps extends AppPage {
  get tree() {
    return this.page.getByRole("navigation", { name: "All maps" });
  }

  open() {
    return this.goto("/maps");
  }

  /** Previews a map from the list, as tabbing to its name does. */
  async previewMap(name: string) {
    await this.tree.getByRole("link", { name, exact: true }).focus();
    await expect(this.preview(name)).toBeVisible();
    return this.preview(name);
  }

  /** Points at the edge of a map's row in the list, away from its name. */
  async pointAtRow(name: string) {
    const row = this.tree.getByRole("link", { name, exact: true }).locator("..");
    await row.hover({ position: { x: 2, y: 4 } });
  }

  /** The preview of a map: its thumbnail, breadcrumbs, a pin for each map inside it. */
  preview(name: string) {
    return this.page.getByRole("region", { name: `Preview: ${name}`, exact: true });
  }

  /** The pin in a preview for a map inside it. */
  pin(preview: Locator, name: string) {
    return preview.getByRole("button", { name: `${name}: look inside`, exact: true });
  }

  /**
   * Makes a map through the "New map" form and waits for the editor it opens. Only for testing
   * the form: other tests make maps with `api.createMap`, which is quicker.
   */
  async create({
    image,
    name,
    note,
  }: {
    image: FixtureImage | string;
    name: string;
    note?: string;
  }) {
    const file = typeof image === "string" ? image : image.file;
    await this.open();
    await this.page.getByRole("button", { name: "New map" }).click();
    const form = this.page.getByRole("form", { name: "New map" });
    await pickImage(form, file);
    await form.getByLabel("Name").fill(name);
    if (note) await form.getByLabel("Wiki note (optional)").fill(note);
    await form.getByRole("button", { name: "Create map" }).click();
    const editor = new MapEditor(this.page, await mapFromUrl(this.page, name, image));
    await expect(editor.canvas).toBeVisible();
    return editor;
  }

  /** The map open now (its page or editor), such as one reached by clicking through. */
  current(name: string, image: FixtureImage) {
    return mapFromUrl(this.page, name, image);
  }

  /** Opens a map's page. */
  async view(map: MapRef) {
    const view = new MapView(this.page, map);
    await view.open();
    return view;
  }

  /** Opens a map's editor. */
  async edit(map: MapRef) {
    const editor = new MapEditor(this.page, map);
    await editor.open();
    return editor;
  }
}

/** The map once its page has opened, from its address. */
async function mapFromUrl(page: Page, name: string, image: FixtureImage | string) {
  await expect(page).toHaveURL(/\/maps\/[^/]+/);
  const [, id] = /\/maps\/([^/?]+)/.exec(page.url()) ?? [];
  const size = typeof image === "string" ? { file: image, width: 0, height: 0 } : image;
  return { id, url: `/maps/${id}`, name, image: size };
}

/** Picks an image in an image picker, and waits for its preview, which measures it. */
async function pickImage(picker: Locator, file: string) {
  await picker.getByRole("searchbox", { name: "Find an image" }).fill(file);
  await picker.getByRole("radio", { name: new RegExp(`${file.replace(".", "\\.")}$`) }).check();
  await expect(picker.getByText(/\d+ × \d+ pixels/)).toBeVisible();
}

/** What both of a map's pages have: the canvas, and points on its image. */
class MapCanvasPage extends AppPage {
  constructor(
    page: Page,
    readonly map: MapRef,
  ) {
    super(page);
  }

  /** The map canvas, labelled with the map's name. */
  get canvas() {
    return canvasOf(this.page, this.map.name);
  }

  get zoomLevel() {
    return this.page.getByRole("status", { name: "Zoom level" });
  }

  get breadcrumbs() {
    return this.page.getByRole("navigation", { name: "Breadcrumbs" });
  }

  /**
   * Where a point on the image is in the canvas. The canvas fits the whole image and centres it
   * (at 100%), so this allows for the space around it.
   */
  async inCanvas([fx, fy]: Point) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error("The map canvas isn't on screen");
    const { width, height } = this.map.image;
    const scale = Math.min(box.width / width, box.height / height);
    return {
      x: (box.width - width * scale) / 2 + fx * width * scale,
      y: (box.height - height * scale) / 2 + fy * height * scale,
      box,
    };
  }

  /** Where a point on the image is on the page, for the mouse. */
  async at(point: Point) {
    const { x, y, box } = await this.inCanvas(point);
    return { x: box.x + x, y: box.y + y };
  }

  async click(point: Point) {
    const { x, y } = await this.inCanvas(point);
    await this.canvas.click({ position: { x, y } });
  }

  /** Presses, moves and lets go, as a ruler or a fog brush is used. */
  async stroke(from: Point, to: Point, steps = 8) {
    await this.page.mouse.move(...xy(await this.at(from)));
    await this.page.mouse.down();
    await this.page.mouse.move(...xy(await this.at(to)), { steps });
    await this.page.mouse.up();
  }
}

const xy = ({ x, y }: { x: number; y: number }) => [x, y] as const;

/** A map canvas by its map's name, e.g. a child map reached by clicking an area. */
export const canvasOf = (page: Page, name: string) =>
  page.getByRole("region", { name: `Map: ${name}`, exact: true });

/** A map's page: the view for the DM (with tokens, fog, tools and the fight), or for players. */
export class MapView extends MapCanvasPage {
  async open() {
    await this.goto(this.map.url);
    await expect(this.canvas).toBeVisible();
  }

  /** "Live" once the page's live connection is open (it's how changes arrive). */
  get liveStatus() {
    return this.page.getByRole("status", { name: "Live updates" });
  }

  async live() {
    await expect(this.liveStatus).toHaveText("Live");
  }

  get toolbar() {
    return this.page.getByRole("toolbar", { name: "Map tools" });
  }

  get toolResult() {
    return this.page.getByRole("status", { name: "Tool result" });
  }

  get areas() {
    return this.page.getByRole("group", { name: "Map areas" });
  }

  /**
   * An area's name on the map, there all along but shown only on hover, focus or with Places
   * (so look at its opacity, not whether it's visible).
   */
  areaName(name: string) {
    return this.areas.locator("text").filter({ hasText: name });
  }

  /** Shows every place's outline and name, or stops. */
  get placesButton() {
    return this.page.getByRole("button", { name: "Places", exact: true });
  }

  /** The tiles of the image a player has been given. */
  get tiles() {
    return this.page.locator('svg image[href*="/tiles/"]');
  }

  /* Tokens */

  get tokenGroup() {
    return this.page.getByRole("group", { name: "Tokens" });
  }

  /** Every token this viewer sees: buttons they may use, and pictures they may not. */
  get anyToken() {
    return this.tokenGroup.getByRole("img").or(this.tokenGroup.getByRole("button"));
  }

  /** A token this viewer may move or pick, by its name (its label goes on: "… at 15.0%, …"). */
  token(name: string) {
    return this.tokenGroup.getByRole("button", { name: new RegExp(`^${name} at`) });
  }

  /** A token whether this viewer may use it just now or not. */
  anyTokenNamed(name: string) {
    return this.tokenGroup.locator(`[aria-label^="${name} at"]`);
  }

  /** Where a token is on the image, from its label: "Fixture PC One at 15.0%, 50.0%, …". */
  async whereIs(name: string): Promise<Point> {
    const label = (await this.anyTokenNamed(name).first().getAttribute("aria-label")) ?? "";
    const [, x, y] = /at ([\d.]+)%, ([\d.]+)%/.exec(label) ?? [];
    return [Number(x) / 100, Number(y) / 100];
  }

  /** Waits until a token is near a point on the image (it may glide there). */
  async expectTokenNear(name: string, point: Point) {
    await expect.poll(async () => near(await this.whereIs(name), point)).toBe(true);
  }

  /** Picks a token up with the mouse and moves it partway, without letting go. */
  async holdToken(name: string, to: Point) {
    const token = this.token(name);
    await settled(token);
    await this.page.mouse.move(...xy(await middleOf(token)));
    await this.page.mouse.down();
    await this.page.mouse.move(...xy(await this.at(to)), { steps: 10 });
  }

  /** Drags a token by the mouse to a point on the image, once it has stopped gliding. */
  async dragToken(name: string, to: Point) {
    await this.holdToken(name, to);
    await this.page.mouse.up();
  }

  /* The DM's Tokens tab */

  /** Opens the Tokens tab of the DM's side panel, if it isn't open already. */
  async openTokens() {
    const tab = this.page.getByRole("tab", { name: "Tokens" });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }

  get party() {
    return this.page.getByRole("list", { name: "Party" });
  }

  /** Places a party member (by the name on their card) where the DM clicks. */
  async placeMember(member: string, at: Point) {
    await this.openTokens();
    await this.party
      .getByRole("button", { name: new RegExp(`^(Place|Bring) ${member} here$`) })
      .click();
    await this.click(at);
    await expect(this.token(member)).toBeVisible();
  }

  /**
   * Adds NPCs or markers in the Tokens tab and places them where the DM clicks: from a note (by
   * its path) if given, a monster's statblock (by its line in the list, "Fixture Minion (Mine,
   * CR 1/8)") if given, numbered if more than one, with an icon if given.
   */
  async addToken({
    name,
    note,
    monster,
    count = 1,
    icon,
    shown,
    at,
  }: {
    name: string;
    note?: string;
    monster?: string;
    count?: number;
    icon?: string;
    shown: boolean;
    at: Point;
  }) {
    await this.openTokens();
    await this.page.getByRole("button", { name: "Add", exact: true }).click();
    const form = this.page.getByRole("form", { name: "New token" });
    if (note) await form.getByLabel("Note (optional)").fill(note);
    await form.getByLabel("Name", { exact: true }).fill(name);
    if (monster) await form.getByLabel(/^Monster/).fill(monster);
    if (count > 1) await form.getByLabel("How many").fill(String(count));
    await form.getByRole("button", { name: "teal" }).click();
    if (icon) {
      // Clicked even if an icon guessed from the name is chosen already: it opens the grid.
      await form.getByRole("radio", { name: "Icon" }).click();
      await form
        .getByRole("listbox", { name: "Icons" })
        .getByRole("option", { name: icon })
        .click();
    }
    if (shown) await form.getByLabel(/Players can see/).check();
    await form.getByRole("button", { name: "Place on the map" }).click();
    await this.click(at);
    await expect(this.token(count > 1 ? `${name} 1` : name)).toBeVisible();
  }

  /** NPCs and markers on this map, in the Tokens tab. */
  get onThisMap() {
    return this.page.getByRole("list", { name: "On this map" });
  }

  /** The chosen token's settings. */
  tokenSettings(name: string) {
    return this.page.getByRole("region", { name: `Token: ${name}` });
  }

  /* Picking tokens, for a fight */

  /** Adds a token to the pick, or takes it out, as Shift-clicking it does. */
  async shiftClickToken(name: string) {
    await this.token(name).click({ modifiers: ["Shift"] });
  }

  /** Draws a box with Shift held, picking the tokens inside. */
  async pickWithBox(from: Point, to: Point) {
    await this.page.keyboard.down("Shift");
    await this.page.mouse.move(...xy(await this.at(from)));
    await this.page.mouse.down();
    await this.page.mouse.move(...xy(await this.at(to)), { steps: 4 });
    await this.page.mouse.up();
    await this.page.keyboard.up("Shift");
  }

  /** The bar over the map listing the picked tokens a fight can be started with. */
  get pickBar() {
    return this.page.getByRole("region", { name: "Picked for a fight" });
  }

  /** Shows a token to players, or hides it, with its button in the list. */
  async toggleShown(name: string, to: "show" | "hide") {
    const label = to === "show" ? `Show ${name} to players` : `Hide ${name} from players`;
    await this.onThisMap.getByRole("button", { name: label }).click();
  }

  /* Fog (the DM's) */

  get fogToolbar() {
    return this.page.getByRole("toolbar", { name: "Fog of war" });
  }

  /** "37% revealed". */
  get revealed() {
    return this.fogToolbar.getByText(/% revealed$/);
  }

  async openFog() {
    await this.page.getByRole("button", { name: "Fog", exact: true }).click();
    await expect(this.fogToolbar).toBeVisible();
  }

  async fogSaved() {
    await expect(this.fogToolbar.getByRole("status")).toHaveText("✓ Saved");
  }

  /* Combat on the map (the DM's) */

  /** Opens Combat beside the map and waits for the tracker. */
  async openCombat() {
    await this.page.getByRole("button", { name: "Combat", exact: true }).click();
    await expect(this.page.getByRole("region", { name: "Turn", exact: true })).toBeVisible();
  }

  get combatButton() {
    return this.page.getByRole("button", { name: "Combat", exact: true });
  }

  /** The prompt to click the map to place monsters (or the party) joining the fight. */
  get placing() {
    return this.page.getByRole("status").filter({ hasText: "Click the map to place" });
  }

  async endFight(choice: "Leave them on the map" | "Clear the monsters") {
    await this.page.getByRole("button", { name: "End fight" }).click();
    await this.page.getByRole("button", { name: choice }).click();
    await expect(this.combatButton).toHaveAttribute("aria-pressed", "false");
  }

  /* Stunts */

  /** A stunt as it plays; decoration, hidden from screen readers, so found by `data-stunt`. */
  stunt(kind: string) {
    return this.page.locator(`[data-stunt="${kind}"]`);
  }

  /** The DM plays a stunt from the palette where they click on the map. */
  async playStunt(name: string) {
    await this.page.getByRole("button", { name: "Stunts", exact: true }).click();
    await this.page.getByRole("toolbar", { name: "Stunts" }).getByRole("button", { name }).click();
    await this.canvas.click();
  }
}

/** Close enough: a drop lands to the nearest pixel. */
export const near = ([x, y]: Point, [tx, ty]: Point) =>
  Math.abs(x - tx) < 0.02 && Math.abs(y - ty) < 0.02;

/** A map's editor: areas, their outlines and links, the map's settings and its grid. */
export class MapEditor extends MapCanvasPage {
  async open() {
    await this.goto(`${this.map.url}/edit`);
    await expect(this.canvas).toBeVisible();
  }

  /** The list of areas in the side panel. */
  get areas() {
    return this.page.getByRole("complementary", { name: "Editing" }).getByRole("list", {
      name: "Areas",
    });
  }

  get areaName() {
    return this.page.getByLabel("Area name");
  }

  async saved() {
    await expect(this.page.getByText("✓ All changes saved")).toBeVisible();
  }

  /** Leaves the editor for the map's page. */
  async done() {
    await this.page.getByRole("link", { name: "Done" }).click();
    const view = new MapView(this.page, this.map);
    await expect(this.page.getByRole("link", { name: "Edit map" })).toBeVisible();
    return view;
  }

  /** Draws an area by clicking its corners, presses Enter to close it, and names it. */
  async drawArea(corners: Point[], name?: string) {
    await this.page.getByRole("button", { name: "Draw area" }).click();
    for (const corner of corners) await this.click(corner);
    await this.canvas.press("Enter");
    await expect(this.areaName).toBeFocused();
    if (name) await this.areaName.fill(name);
  }

  /** The handles of the selected area's points, in order: "Point 2 of Harbour at 40.0%, …". */
  vertexHandles(area: string) {
    return this.page.getByRole("button", { name: new RegExp(`^Point \\d+ of ${area} at `) });
  }

  /** A point handle's position as percentages of the image, read from its label. */
  async vertexPosition(area: string, point: number) {
    const label = await this.vertexHandles(area)
      .nth(point - 1)
      .getAttribute("aria-label");
    const [, x, y] = /at ([\d.]+)%, ([\d.]+)%$/.exec(label ?? "") ?? [];
    return { x: Number(x), y: Number(y) };
  }

  async dragVertex(area: string, point: number, by: { x: number; y: number }) {
    const from = await middleOf(this.vertexHandles(area).nth(point - 1));
    await dragBetween(this.page, from, { x: from.x + by.x, y: from.y + by.y }, { steps: 5 });
  }

  /** Makes a new map from a fixture image for the selected area to lead to. */
  async linkNewMap(file: string) {
    await this.page.getByRole("button", { name: "New map from image…" }).click();
    const newMap = this.page.getByRole("group", { name: "New map for this area" });
    await pickImage(newMap, file);
    await newMap.getByRole("button", { name: "Create and link" }).click();
    await expect(newMap).toHaveCount(0);
    await this.saved();
  }

  /** The battle grid's settings, opened if they're folded away. */
  async gridSettings() {
    const section = this.page.locator("details", { hasText: "Battle map grid" });
    if ((await section.getAttribute("open")) === null) await section.locator("summary").click();
    await expect(section).toHaveAttribute("open", "");
    return section;
  }

  get shareSwitch() {
    return this.page.getByRole("switch", { name: "Share with players" });
  }
}
