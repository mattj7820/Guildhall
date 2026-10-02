import { expect, test, type Page } from "@playwright/test";
import { SIGNED_IN } from "../support/sign-in";
import {
  addMonsters,
  combatant,
  createMap,
  face,
  fightSaved,
  mapCanvas,
  ORIGIN,
  scriptDice,
  uniqueName,
} from "../support/app";

/**
 * A fight run from a map page: Combat opens the tracker beside the map; monsters joining are
 * placed with a click, and their tokens follow the fight. The fixture "Fixture Minion" is Small
 * (one square) with 2d6 hit points.
 */

const d20 = (value: number) => face(20, value);
const d6 = (value: number) => face(6, value);
const tokens = (page: Page) => page.getByRole("group", { name: "Tokens" });
const token = (page: Page, name: string) => tokens(page).locator(`[aria-label^="${name} at"]`);

/** A shared map of the fog fixture, all revealed, with Combat open; answers with its URL. */
async function arena(page: Page): Promise<{ url: string; name: string }> {
  const name = uniqueName("Arena");
  await createMap(page, { image: "Fixture Fog.png", name });
  const url = page.url().replace(/\/edit$/, "");
  await page.request.post(`${url}/edit`, {
    headers: { Origin: ORIGIN },
    data: { intent: "setVisibility", visibility: "players" },
  });
  const reveal = await page.request.post(`${url}/fog`, {
    headers: { Origin: ORIGIN },
    data: { changes: [{ type: "paint", mode: "reveal", shape: { kind: "all" } }] },
  });
  expect(reveal.status()).toBe(200);
  await page.goto(url);
  await page.getByRole("button", { name: "Combat", exact: true }).click();
  await expect(page.getByRole("region", { name: "Turn", exact: true })).toBeVisible();
  return { url, name };
}

/** Two minions, placed side by side from the middle of the map, then the fight started. */
async function twoMinionsPlaced(page: Page, name: string) {
  // Per monster: initiative d20, then 2d6 hit points.
  await scriptDice(page, [d20(15), d6(3), d6(4), d20(5), d6(6), d6(6)]);
  await addMonsters(page, "Fixture Minion", 2);
  await expect(page.getByRole("status").filter({ hasText: "Click the map to place" })).toHaveText(
    "Click the map to place Fixture Minion 1, Fixture Minion 2",
  );
  await mapCanvas(page, name).click();
  await expect(token(page, "Fixture Minion 1")).toHaveAccessibleName(/7 of 7 HP/);
  await expect(token(page, "Fixture Minion 2")).toBeVisible();
  await page.getByRole("button", { name: "Start combat" }).click();
  await fightSaved(page);
}

test.describe("A fight on a map", () => {
  test("places monsters, rings whose turn it is, and shows players what they may see", async ({
    page,
    browser,
  }) => {
    const { url, name } = await arena(page);
    await twoMinionsPlaced(page, name);
    await expect(page.getByRole("status", { name: "Whose turn" })).toHaveText(
      "Round 1 · Fixture Minion 1's turn",
    );

    // An ambusher: hidden from players, in the turn order and on the map.
    await combatant(page, "Fixture Minion 2")
      .getByRole("button", { name: "Hide Fixture Minion 2 from players" })
      .click();
    await expect(token(page, "Fixture Minion 2")).toHaveAccessibleName(/players can't see this/);
    await fightSaved(page);

    const context = await browser.newContext({
      baseURL: ORIGIN,
      storageState: SIGNED_IN.playerOne,
    });
    const player = await context.newPage();
    await player.goto(url);
    await expect(player.getByRole("status", { name: "Whose turn" })).toHaveText(
      "Round 1 · Fixture Minion 1's turn",
    );
    await expect(token(player, "Fixture Minion 1")).toBeVisible();
    // No hit points for players.
    await expect(token(player, "Fixture Minion 1")).not.toHaveAccessibleName(/HP/);
    await expect(token(player, "Fixture Minion 2")).toHaveCount(0);
    await expect(
      player.getByRole("list", { name: "Turn strip" }).getByRole("listitem"),
    ).toHaveCount(1);

    // Down at 0, for everyone, live.
    const minion = combatant(page, "Fixture Minion 1");
    await minion.getByLabel("Amount for Fixture Minion 1").fill("7");
    await minion.getByRole("button", { name: "Damage Fixture Minion 1" }).click();
    await expect(token(page, "Fixture Minion 1")).toHaveAccessibleName(/down, 0 of 7 HP/);
    await expect(token(player, "Fixture Minion 1")).toHaveAccessibleName(/down/);

    // Revealed: the ambusher appears for players.
    await combatant(page, "Fixture Minion 2")
      .getByRole("button", { name: "Hide Fixture Minion 2 from players" })
      .click();
    await expect(token(player, "Fixture Minion 2")).toBeVisible();
    await context.close();
  });

  test("lets players move any time with Free movement, kept on reload", async ({ page }) => {
    const { name } = await arena(page);
    await twoMinionsPlaced(page, name);
    const free = page.getByRole("checkbox", { name: /Free movement/ });
    await expect(free).not.toBeChecked();
    await free.check();
    await expect(page.getByText("players move any time")).toBeVisible();
    await expect
      .poll(async () => (await (await page.request.get("/combat/fight")).json()).fight.freeMovement)
      .toBe(true);
    // The fight is on this map, so its page opens in Combat.
    await page.reload();
    await expect(page.getByRole("button", { name: "Combat", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("checkbox", { name: /Free movement/ })).toBeChecked();
  });

  test("damages or heals the monsters picked on the map, all at once", async ({ page }) => {
    const { name } = await arena(page);
    await twoMinionsPlaced(page, name);
    // Minion 1 has 7 HP, Minion 2 has 12.
    await token(page, "Fixture Minion 1").click();
    await token(page, "Fixture Minion 2").click({ modifiers: ["Shift"] });
    const panel = page.getByRole("form", { name: "Damage the picked monsters" });
    await expect(panel).toContainText("Fixture Minion 1, Fixture Minion 2");

    // A fireball's 5, halved for both: they saved.
    await panel.getByLabel("Amount").fill("5");
    await panel.getByRole("button", { name: "Half" }).click();
    await expect(combatant(page, "Fixture Minion 1")).toContainText("HP 5/7");
    await expect(combatant(page, "Fixture Minion 2")).toContainText("HP 10/12");

    // A click without Shift picks just the one.
    await token(page, "Fixture Minion 2").click();
    await expect(panel).not.toContainText("Fixture Minion 1");
    await panel.getByLabel("Amount").fill("4");
    await panel.getByRole("button", { name: "Heal" }).click();
    await expect(combatant(page, "Fixture Minion 2")).toContainText("HP 12/12");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(combatant(page, "Fixture Minion 2")).toContainText("HP 10/12");
  });

  test("takes a monster's token off the map when it leaves the fight", async ({ page }) => {
    const { name } = await arena(page);
    await twoMinionsPlaced(page, name);
    await combatant(page, "Fixture Minion 2")
      .getByRole("button", { name: "Remove Fixture Minion 2" })
      .click();
    await expect(token(page, "Fixture Minion 2")).toHaveCount(0);
    await expect(token(page, "Fixture Minion 1")).toBeVisible();
  });

  test("ends the fight, clearing the monsters or leaving them as markers", async ({ page }) => {
    const { name } = await arena(page);
    await twoMinionsPlaced(page, name);
    await combatant(page, "Fixture Minion 2")
      .getByRole("button", { name: "Hide Fixture Minion 2 from players" })
      .click();
    await fightSaved(page);

    await page.getByRole("button", { name: "End fight" }).click();
    await page.getByRole("button", { name: "Leave them on the map" }).click();
    await expect(page.getByRole("button", { name: "Combat", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // Markers now: no hit points, and the hidden one still hidden.
    await expect(token(page, "Fixture Minion 1")).not.toHaveAccessibleName(/HP/);
    await expect(token(page, "Fixture Minion 2")).toHaveAccessibleName(/players can't see this/);
    expect((await (await page.request.get("/combat/fight")).json()).fight).toBeNull();

    // A new fight, cleared at the end.
    await page.getByRole("button", { name: "Combat", exact: true }).click();
    await expect(page.getByRole("list", { name: "Turn order" })).toHaveCount(0);
    await scriptDice(page, [d20(15), d6(3), d6(4)]);
    await addMonsters(page, "Fixture Minion", 1);
    await mapCanvas(page, name).click();
    await expect(token(page, "Fixture Minion 1")).toHaveCount(2);
    await fightSaved(page);
    await page.getByRole("button", { name: "End fight" }).click();
    await page.getByRole("button", { name: "Clear the monsters" }).click();
    await expect(token(page, "Fixture Minion 1")).toHaveCount(1);
  });

  test("prepares a fight on a map, and starts it there with the monsters in place", async ({
    page,
  }) => {
    const { url, name } = await arena(page);
    await scriptDice(page, [d6(3), d6(4), d6(6), d6(6)]);
    await addMonsters(page, "Fixture Minion", 2);
    await mapCanvas(page, name).click();
    await expect(token(page, "Fixture Minion 2")).toBeVisible();
    const placedAt = await token(page, "Fixture Minion 2").getAttribute("aria-label");

    const encounterName = uniqueName("Ambush");
    await page.getByText("Save as a prepared encounter").click();
    await page.getByLabel("Prepared encounter name").fill(encounterName);
    await page.getByRole("button", { name: "Save as prepared" }).click();
    await expect(page.getByText(`Saved as “${encounterName}”.`)).toBeVisible();
    await page.getByRole("button", { name: "End fight" }).click();
    await page.getByRole("button", { name: "Clear the monsters" }).click();
    await expect(token(page, "Fixture Minion 2")).toHaveCount(0);

    await page.goto("/combat/prepared");
    await expect(page.getByRole("listitem").filter({ hasText: encounterName })).toContainText(
      `Set up on ${name}`,
    );
    await page.getByRole("link", { name: `Start ${encounterName}` }).click();
    await page.waitForURL((current) => current.searchParams.has("start"));
    expect(page.url().split("?")[0]).toBe(url);
    const panel = page.getByRole("region", { name: `Start “${encounterName}”` });
    await panel.getByRole("button", { name: "Add to tracker" }).click();

    await expect(page).not.toHaveURL(/start=/);
    // Where it was put, with the hit points it was prepared with.
    await expect(token(page, "Fixture Minion 2")).toHaveAttribute("aria-label", placedAt!);
    await expect(combatant(page, "Fixture PC One")).toBeVisible();
    // The party comes in with a click, from wherever they are.
    await page.getByRole("button", { name: "Bring the party here" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Click the map to place" })).toHaveText(
      /the whole party/,
    );
    await page.getByRole("button", { name: "Cancel" }).click();
  });
});
