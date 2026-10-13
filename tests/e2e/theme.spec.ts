import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Api } from "./support/api";
import { expect, test } from "./support/fixtures";
import { IMAGES, rectangle, REVEAL_ALL, uniqueName } from "./support/test-data";

/**
 * The three themes on each part of the app, with text readable against its background (axe's
 * colour-contrast check). With no pick, the device decides: Storybook when it's light, Iron and
 * Ember when it's dark. Gemlight is picked by a newcomer, so the shared accounts other specs use
 * keep following the device.
 */
const DM_PAGES = ["/", "/wiki/NPCs/Fixture Informant", "/characters", "/maps", "/combat"];
const PLAYER_PAGES = ["/", "/wiki/NPCs/Mira Stonehand", "/characters", "/maps", "/combat"];

const PAGE_COLOUR = {
  storybook: "rgb(243, 241, 231)",
  ember: "rgb(15, 14, 14)",
  gem: "rgb(10, 19, 34)",
};

/** A shared, explored map with an area leading to another: its page, with pins and the legend. */
async function mapPage(api: Api) {
  const inner = await api.createMap({ image: IMAGES.town, shared: true });
  const map = await api.createMap({ image: IMAGES.world, shared: true, fog: [REVEAL_ALL] });
  await api.saveMap(map, {
    areas: [
      {
        id: "inner",
        name: "Inner",
        outline: rectangle([0.2, 0.2], [0.5, 0.6]),
        visibility: "players",
        map: inner.id,
      },
    ],
  });
  return map.url;
}

async function expectReadable(page: Page, path: string) {
  const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  const problems = results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${path}: ${node.target.join(" ")}: ${node.failureSummary}`),
  );
  expect.soft(problems).toEqual([]);
}

for (const [scheme, theme] of [
  ["light", "storybook"],
  ["dark", "ember"],
] as const) {
  test.describe(`With no theme picked on a ${scheme} device`, () => {
    test.use({ colorScheme: scheme });

    test(`every part of the app is shown in ${theme === "ember" ? "Iron and Ember" : "Storybook"}`, async ({
      api,
      app,
    }) => {
      for (const path of [...DM_PAGES, await mapPage(api)]) {
        expect((await app.goto(path))?.status(), path).toBe(200);
        await expect(app.page.locator("html")).not.toHaveAttribute("data-theme");
        await expect(app.page.locator("body")).toHaveCSS("background-color", PAGE_COLOUR[theme]);
        await expectReadable(app.page, path);
      }
    });
  });
}

test("Gemlight, once picked, is on every part of the app", async ({ api, members, openAs }) => {
  const them = await openAs("signedOut");
  const name = uniqueName("Gemlight player");
  await them.signIn.asNewcomer(name);
  await members.open();
  await members.letIn(name);
  await them.settings.open();
  await them.settings.pick("Gemlight", "gem");

  for (const path of [...PLAYER_PAGES, await mapPage(api)]) {
    expect((await them.goto(path))?.status(), path).toBe(200);
    await expect(them.page.locator("html")).toHaveAttribute("data-theme", "gem");
    await expect(them.page.locator("body")).toHaveCSS("background-color", PAGE_COLOUR.gem);
    await expectReadable(them.page, path);
  }
});
