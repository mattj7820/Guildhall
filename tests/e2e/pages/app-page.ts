import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Waits until the page answers clicks: the root layout marks `<html data-hydrated>` once React
 * has hydrated. Before then a server-rendered button has no handler, and a click on it is lost.
 */
export async function hydrated(page: Page) {
  await expect(page.locator("html[data-hydrated]")).toBeAttached();
}

/**
 * The base of every page object: going to a page and reloading wait until it has hydrated, and
 * the parts on every page (the menu, the DM's preview switch) are here.
 */
export class AppPage {
  constructor(readonly page: Page) {}

  /** Opens a page and waits until it has hydrated; answers with the response, for its status. */
  async goto(path: string) {
    const response = await this.page.goto(path);
    await hydrated(this.page);
    return response;
  }

  async reload() {
    await this.page.reload();
    await hydrated(this.page);
  }

  /** The page's path, e.g. "/characters/abc123". */
  get path() {
    return new URL(this.page.url()).pathname;
  }

  get mainNav() {
    return this.page.getByRole("navigation", { name: "Main" });
  }

  navLink(name: string) {
    return this.mainNav.getByRole("link", { name, exact: true });
  }

  /** The DM's switch to see the page as players do. */
  async previewAsPlayer() {
    await this.page.getByRole("button", { name: "Preview as player" }).click();
    await expect(this.page.getByRole("status")).toContainText("Previewing as a player");
  }

  async backToDmView() {
    await this.page.getByRole("button", { name: "Back to DM view" }).click();
    await expect(this.page.getByRole("button", { name: "Preview as player" })).toBeVisible();
  }

  /** Marks the page, to check later that it never reloaded. */
  async markStay() {
    await this.page.evaluate(() => ((window as { stayed?: boolean }).stayed = true));
  }

  async stayed() {
    return this.page.evaluate(() => (window as { stayed?: boolean }).stayed === true);
  }
}

/**
 * Waits until an element has finished its CSS transitions and animations, so its place on
 * screen is where it will stay (for mouse moves, which don't wait like clicks do).
 */
export async function settled(locator: Locator) {
  await locator.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {}))),
  );
}

/** Where the middle of an element is on screen. */
export async function middleOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${locator} isn't on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Drags with the mouse from one point to another in small steps, as a hand would, so drag
 * libraries see the drag start (a few pixels first) and follow it.
 */
export async function dragBetween(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  { steps = 12 }: { steps?: number } = {},
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 5, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}
