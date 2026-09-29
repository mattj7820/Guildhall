import { expect, test, type Page } from "@playwright/test";
import { openCharacter, uniqueName } from "./support/app";
import { SIGNED_IN } from "./support/sign-in";

/**
 * The bag, as Player One on Fixture PC One (and the shared companion's, for dragging). Other specs
 * add their own items to PC One's bag, so each test works with uniquely named items and never
 * asserts on the whole bag.
 */
test.use({ storageState: SIGNED_IN.playerOne });

const grid = (page: Page) => page.getByRole("list", { name: "Inventory" });
/** A tile by its accessible name, e.g. "Rope, 3, equipped": exactly, unless given a pattern. */
const tile = (page: Page, name: string | RegExp) =>
  grid(page).getByRole("button", { name, exact: typeof name === "string" });
const saved = (page: Page) => expect(page.getByText("✓ All changes saved")).toBeVisible();
const announced = (page: Page, text: string) =>
  expect(page.getByRole("status").filter({ hasText: text })).toBeAttached();

async function openBag(page: Page) {
  await openCharacter(page, "Fixture PC One");
  await page.getByRole("button", { name: /^Bag/ }).click();
  await expect(grid(page)).toBeVisible();
}

/**
 * The shared companion's bag, which only the dragging test changes: a drag needs tiles that hold
 * still between finding them on screen and pressing the mouse.
 */
async function openCompanionBag(page: Page) {
  await openCharacter(page, "Fixture Companion");
  await expect(grid(page)).toBeVisible();
}

/** Types into quick add and presses Enter, which picks the first suggestion. */
async function quickAdd(page: Page, ...texts: string[]) {
  await page.getByRole("button", { name: "+ Add item" }).click();
  const box = page.getByRole("combobox", { name: "Add item" });
  for (const text of texts) {
    await box.fill(text);
    await box.press("Enter");
    await expect(box).toHaveValue("");
  }
  await page.getByRole("button", { name: "Done" }).click();
}

/** The names of these items, in the order the bag shows them. */
async function order(page: Page, names: string[]) {
  const labels = await grid(page)
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? ""));
  return labels
    .map((label) => names.find((name) => label.startsWith(name)))
    .filter((name) => name !== undefined);
}

test("adds a custom item and a vault item in a few keystrokes, and keeps them", async ({
  page,
}) => {
  const lantern = uniqueName("Lantern");
  await openBag(page);
  await quickAdd(page, `2 ${lantern}`, `${lantern} x3`, "Fixture Rope");
  // Picking up more of the same stacks it, as in games.
  await expect(tile(page, `${lantern}, 5`)).toBeVisible();
  await expect(tile(page, /^Fixture Rope/).first()).toBeVisible();
  await saved(page);

  await page.reload();
  await expect(tile(page, `${lantern}, 5`)).toBeVisible();
  await tile(page, /^Fixture Rope/)
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "Fixture Rope" })).toContainText(
    "Fixture: a shared item note.",
  );
});

test("splits, stacks, equips and unequips from the keyboard", async ({ page }) => {
  const arrows = uniqueName("Arrows");
  await openBag(page);
  await quickAdd(page, `4 ${arrows}`);

  await tile(page, `${arrows}, 4`).focus();
  await page.keyboard.press("s");
  const details = page.getByRole("dialog", { name: arrows });
  await details.getByRole("spinbutton", { name: "Split off" }).fill("1");
  await details.getByRole("button", { name: "Split", exact: true }).click();
  await expect(tile(page, `${arrows}, 3`)).toBeVisible();
  await expect(tile(page, arrows)).toBeVisible();

  // Pick up the single arrow, move it back onto the stack, and drop it there.
  await tile(page, arrows).focus();
  await page.keyboard.press("Space");
  await announced(page, `${arrows} is at position`);
  await page.keyboard.press("ArrowLeft");
  await announced(page, `Over ${arrows}: drop to stack.`);
  await page.keyboard.press("Space");
  await expect(tile(page, `${arrows}, 4`)).toBeVisible();
  await expect(tile(page, new RegExp(`^${arrows}`))).toHaveCount(1);

  await tile(page, `${arrows}, 4`).press("e");
  const equipped = page.getByRole("region", { name: "Equipped" });
  await expect(equipped.getByRole("button", { name: `${arrows}, 4, equipped` })).toBeVisible();
  await saved(page);
  await page.reload();
  await expect(tile(page, `${arrows}, 4, equipped`)).toBeVisible();

  await equipped.getByRole("button", { name: `Unequip ${arrows}` }).click();
  await expect(tile(page, `${arrows}, 4`)).toBeVisible();
});

test("moves and stacks items by dragging them", async ({ page }) => {
  const [first, second] = [uniqueName("Bread"), uniqueName("Cheese")];
  await openCompanionBag(page);
  await quickAdd(page, first, second);
  expect(await order(page, [first, second])).toEqual([first, second]);
  await saved(page);

  await drag(page, tile(page, second), tile(page, first));
  await expect.poll(() => order(page, [first, second])).toEqual([second, first]);

  // Split the bread in two, then drag one half back onto the other.
  const bread = uniqueName("Loaf");
  await quickAdd(page, `2 ${bread}`);
  await tile(page, `${bread}, 2`).press("s");
  await page
    .getByRole("dialog", { name: bread })
    .getByRole("button", { name: "Split", exact: true })
    .click();
  await expect(tile(page, bread)).toHaveCount(2);
  await saved(page);
  await drag(page, tile(page, bread).last(), tile(page, bread).first());
  await expect(tile(page, `${bread}, 2`)).toBeVisible();
  await saved(page);
});

test("removes an item, and Undo puts it back", async ({ page }) => {
  const map = uniqueName("Map");
  await openBag(page);
  await quickAdd(page, map);
  await tile(page, map).press("Delete");
  await expect(tile(page, map)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).last().click();
  await expect(tile(page, map)).toBeVisible();
  await saved(page);
  await page.reload();
  await expect(tile(page, map)).toBeVisible();
});

test("a DM section in an item note never reaches the player", async ({ page }) => {
  await openBag(page);
  await quickAdd(page, "Fixture Cursed Ring");
  await tile(page, /^Fixture Cursed Ring/)
    .first()
    .click();
  const details = page.getByRole("dialog", { name: "Fixture Cursed Ring" });
  await expect(details).toContainText("Players see this paragraph");

  const sheet = new URL(page.url()).pathname;
  for (const body of [
    await page.content(),
    await (await page.request.get(`${sheet}.data`)).text(),
    await (await page.request.get(`${sheet}/changes`)).text(),
  ]) {
    expect(body).not.toContain("ringsecretsection");
    expect(body).not.toContain("ringsecretcallout");
  }
});

/** Drags with the mouse in small steps, as a person would, so the drag starts and settles. */
async function drag(
  page: Page,
  from: ReturnType<Page["getByRole"]>,
  to: ReturnType<Page["getByRole"]>,
) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error("A tile isn't on screen");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2 + 5, {
    steps: 5,
  });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}
