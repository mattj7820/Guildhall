import { expect, test } from "./support/fixtures";
import { SIGNED_IN } from "./support/sign-in";
import { uniqueName } from "./support/test-data";
import { tidyBags } from "./support/tidy";

/**
 * The bag, as Player One on Fixture PC One (and the shared companion's, for dragging). Other specs
 * add their own items to PC One's bag, so each test works with uniquely named items and never
 * asserts on the whole bag.
 */
test.use({ storageState: SIGNED_IN.playerOne });
test.afterEach(tidyBags);

test("adds a custom item and a vault item in a few keystrokes, and keeps them", async ({
  characters,
}) => {
  const lantern = uniqueName("Lantern");
  const bag = await characters.openBag("Fixture PC One");
  await bag.quickAdd(`2 ${lantern}`, `${lantern} x3`, "Fixture Rope");
  // Picking up more of the same stacks it, as in games.
  await expect(bag.tile(`${lantern}, 5`)).toBeVisible();
  await expect(bag.tile(/^Fixture Rope/).first()).toBeVisible();
  await bag.saved();

  await characters.reload();
  await expect(bag.tile(`${lantern}, 5`)).toBeVisible();
  await bag
    .tile(/^Fixture Rope/)
    .first()
    .click();
  await expect(bag.details("Fixture Rope")).toContainText("Fixture: a shared item note.");
});

test("splits, stacks, equips and unequips from the keyboard", async ({ characters }) => {
  const arrows = uniqueName("Arrows");
  const bag = await characters.openBag("Fixture PC One");
  await bag.quickAdd(`4 ${arrows}`);

  await bag.split(bag.tile(`${arrows}, 4`), arrows, 1);
  await expect(bag.tile(`${arrows}, 3`)).toBeVisible();
  await expect(bag.tile(arrows)).toBeVisible();

  // Pick up the single arrow, move it back onto the stack, and drop it there.
  await bag.keyboardDrag(bag.tile(arrows), arrows, [
    ["ArrowLeft", `Over ${arrows}: drop to stack.`],
  ]);
  await expect(bag.tile(`${arrows}, 4`)).toBeVisible();
  await expect(bag.tile(new RegExp(`^${arrows}`))).toHaveCount(1);

  await bag.tile(`${arrows}, 4`).press("e");
  await expect(bag.equipped.getByRole("button", { name: `${arrows}, 4, equipped` })).toBeVisible();
  await bag.saved();
  await characters.reload();
  await expect(bag.tile(`${arrows}, 4, equipped`)).toBeVisible();

  await bag.equipped.getByRole("button", { name: `Unequip ${arrows}` }).click();
  await expect(bag.tile(`${arrows}, 4`)).toBeVisible();

  // E on an equipped slot unequips it too.
  await bag.tile(`${arrows}, 4`).press("e");
  await bag.equipped.getByRole("button", { name: `${arrows}, 4, equipped` }).press("e");
  await expect(bag.tile(`${arrows}, 4`)).toBeVisible();
});

test("credits the icons", async ({ characters, page }) => {
  await characters.openBag("Fixture PC One");
  await page.getByRole("link", { name: "Icon credits" }).click();
  await expect(page.getByRole("heading", { name: "Credits", level: 1 })).toBeVisible();
  await expect(page.getByText("CC BY 3.0")).toBeVisible();
  await expect(page.getByRole("heading", { name: "By Lorc" })).toBeVisible();
});

test("moves and stacks items by dragging them", async ({ characters }) => {
  // The shared companion's bag, which only this test changes: a drag needs tiles that hold still
  // between finding them on screen and pressing the mouse.
  const [first, second] = [uniqueName("Bread"), uniqueName("Cheese")];
  const bag = await characters.openCompanionBag("Fixture Companion");
  await bag.quickAdd(first, second);
  await expect.poll(() => bag.order([first, second])).toEqual([first, second]);
  await bag.saved();

  await bag.drag(bag.tile(second), bag.tile(first));
  await expect.poll(() => bag.order([first, second])).toEqual([second, first]);

  // Split the bread in two, then drag one half back onto the other.
  const bread = uniqueName("Loaf");
  await bag.quickAdd(`2 ${bread}`);
  await bag.split(bag.tile(`${bread}, 2`), bread);
  await expect(bag.tile(bread)).toHaveCount(2);
  await bag.saved();
  await bag.drag(bag.tile(bread).last(), bag.tile(bread).first());
  await expect(bag.tile(`${bread}, 2`)).toBeVisible();
  await bag.saved();
});

test("removes an item, and Undo puts it back", async ({ characters, page }) => {
  const map = uniqueName("Map");
  const bag = await characters.openBag("Fixture PC One");
  await bag.quickAdd(map);
  await bag.tile(map).press("Delete");
  await expect(bag.tile(map)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).last().click();
  await expect(bag.tile(map)).toBeVisible();
  await bag.saved();
  await characters.reload();
  await expect(bag.tile(map)).toBeVisible();
});

test("a DM section in an item note never reaches the player", async ({ api, characters, page }) => {
  const bag = await characters.openBag("Fixture PC One");
  await bag.quickAdd("Fixture Cursed Ring");
  await bag
    .tile(/^Fixture Cursed Ring/)
    .first()
    .click();
  await expect(bag.details("Fixture Cursed Ring")).toContainText("Players see this paragraph");

  const sheet = characters.path;
  for (const body of [
    await page.content(),
    await (await api.request.get(`${sheet}.data`)).text(),
    await (await api.request.get(`${sheet}/changes`)).text(),
  ]) {
    expect(body).not.toContain("ringsecretsection");
    expect(body).not.toContain("ringsecretcallout");
  }
});
