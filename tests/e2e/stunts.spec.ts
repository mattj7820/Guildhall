import { expect, test, type Page } from "@playwright/test";
import { createMap, mapCanvas, ORIGIN, uniqueName } from "./support/app";
import { SIGNED_IN } from "./support/sign-in";

/**
 * The DM's stunts: played with a click on the map, and seen at once by players watching it.
 * Stunts are decoration (hidden from screen readers), so they're found by their `data-stunt`.
 */

const stunt = (page: Page, kind: string) => page.locator(`[data-stunt="${kind}"]`);

/** A map of the fog fixture, shared with players, with nothing revealed; answers with its URL. */
async function sharedMap(page: Page): Promise<{ url: string; name: string }> {
  const name = uniqueName("Stunts");
  await createMap(page, { image: "Fixture Fog.png", name });
  const url = page.url().replace(/\/edit$/, "");
  await page.request.post(`${url}/edit`, {
    headers: { Origin: ORIGIN },
    data: { intent: "setVisibility", visibility: "players" },
  });
  await page.goto(url);
  return { url, name };
}

test("the DM's stunt plays for a player watching the map, even under the fog", async ({
  page,
  browser,
}) => {
  const { url, name } = await sharedMap(page);
  const context = await browser.newContext({ baseURL: ORIGIN, storageState: SIGNED_IN.playerOne });
  const player = await context.newPage();
  await player.goto(url);
  await expect(player.getByRole("status").filter({ hasText: "Live" })).toBeVisible();

  await page.getByRole("button", { name: "Stunts", exact: true }).click();
  const palette = page.getByRole("toolbar", { name: "Stunts" });
  await palette.getByRole("button", { name: "Impact" }).click();
  await mapCanvas(page, name).click();
  await expect(stunt(page, "impact")).toHaveCount(1);
  await expect(stunt(player, "impact")).toHaveCount(1);
  // Gone again once it's played.
  await expect(stunt(player, "impact")).toHaveCount(0, { timeout: 6000 });
  await context.close();
});

test("a player who turns stunts off doesn't see them, and it's remembered", async ({
  page,
  browser,
}) => {
  const { url, name } = await sharedMap(page);
  // Two browsers as Player One: settings belong to the browser, so one turns stunts off and the
  // other, left as it is, shows when the stunt has arrived.
  const open = async () => {
    const context = await browser.newContext({
      baseURL: ORIGIN,
      storageState: SIGNED_IN.playerOne,
    });
    const tab = await context.newPage();
    await tab.goto(url);
    return { context, tab };
  };
  const quiet = await open();
  const witness = await open();
  await quiet.tab.getByText("Effects", { exact: true }).click();
  await quiet.tab.getByLabel("Show the DM's stunts").uncheck();
  await quiet.tab.reload();
  await expect(quiet.tab.getByText("Effects off", { exact: true })).toBeVisible();
  for (const { tab } of [quiet, witness]) {
    await expect(tab.getByRole("status").filter({ hasText: "Live" })).toBeVisible();
  }

  await page.getByRole("button", { name: "Stunts", exact: true }).click();
  await page
    .getByRole("toolbar", { name: "Stunts" })
    .getByRole("button", { name: "Smoke" })
    .click();
  await mapCanvas(page, name).click();
  await expect(stunt(witness.tab, "smoke")).toHaveCount(1);
  await expect(stunt(quiet.tab, "smoke")).toHaveCount(0);
  await quiet.context.close();
  await witness.context.close();
});

test("only the DM plays stunts, and only sounds from the sounds folder", async ({
  page,
  browser,
}) => {
  const { url } = await sharedMap(page);
  const shake = { stunt: { id: "e2e-1", kind: "shake" } };
  const ok = await page.request.post(`${url}/stunts`, { headers: { Origin: ORIGIN }, data: shake });
  expect(ok.status()).toBe(200);
  const elsewhere = await page.request.post(`${url}/stunts`, {
    headers: { Origin: ORIGIN },
    data: { stunt: { id: "e2e-2", kind: "sound", sound: "../Attachments/voice-sample.wav" } },
  });
  expect(elsewhere.status()).toBe(400);

  const context = await browser.newContext({ baseURL: ORIGIN, storageState: SIGNED_IN.playerOne });
  const player = await context.request.post(`${url}/stunts`, {
    headers: { Origin: ORIGIN },
    data: shake,
  });
  expect(player.status()).toBe(404);
  await context.close();
});
