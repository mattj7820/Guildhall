import { expect, test } from "./support/fixtures";
import { uniqueName } from "./support/test-data";

/**
 * The DM's stunts: played with a click on the map, and seen at once by players watching it.
 * Stunts are decoration (hidden from screen readers), so they're found by their `data-stunt`.
 */

test("the DM's stunt plays for a player watching the map, even under the fog", async ({
  api,
  maps,
  openAs,
}) => {
  const map = await api.createMap({ name: uniqueName("Stunts"), shared: true });
  const view = await maps.view(map);
  const theirs = await (await openAs("playerOne")).maps.view(map);
  await theirs.live();

  await view.playStunt("Impact");
  await expect(view.stunt("impact")).toHaveCount(1);
  await expect(theirs.stunt("impact")).toHaveCount(1);
  // Gone again once it's played.
  await expect(theirs.stunt("impact")).toHaveCount(0, { timeout: 6000 });
});

test("a player who turns stunts off doesn't see them, and it's remembered", async ({
  api,
  maps,
  openAs,
}) => {
  const map = await api.createMap({ name: uniqueName("Stunts"), shared: true });
  const view = await maps.view(map);
  // Two browsers as Player One: settings belong to the browser, so one turns stunts off and the
  // other, left as it is, shows when the stunt has arrived.
  const quiet = await (await openAs("playerOne")).maps.view(map);
  const witness = await (await openAs("playerOne")).maps.view(map);
  await quiet.page.getByText("Effects", { exact: true }).click();
  await quiet.page.getByLabel("Show the DM's stunts").uncheck();
  await quiet.reload();
  await expect(quiet.page.getByText("Effects off", { exact: true })).toBeVisible();
  await quiet.live();
  await witness.live();

  await view.playStunt("Smoke");
  await expect(witness.stunt("smoke")).toHaveCount(1);
  await expect(quiet.stunt("smoke")).toHaveCount(0);
});

test("only the DM plays stunts, and only sounds from the sounds folder", async ({
  api,
  openAs,
}) => {
  const map = await api.createMap({ name: uniqueName("Stunts"), shared: true });
  const shake = { stunt: { id: "e2e-1", kind: "shake" } };
  expect((await api.post(`${map.url}/stunts`, shake)).status()).toBe(200);
  const elsewhere = await api.post(`${map.url}/stunts`, {
    stunt: { id: "e2e-2", kind: "sound", sound: "../Attachments/voice-sample.wav" },
  });
  expect(elsewhere.status()).toBe(400);

  const player = await openAs("playerOne");
  expect((await player.api.post(`${map.url}/stunts`, shake)).status()).toBe(404);
});
