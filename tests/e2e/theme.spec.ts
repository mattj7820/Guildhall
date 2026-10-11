import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { uniqueName } from "./support/test-data";

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
      app,
    }) => {
      for (const path of DM_PAGES) {
        await app.goto(path);
        await expect(app.page.locator("html")).not.toHaveAttribute("data-theme");
        await expect(app.page.locator("body")).toHaveCSS("background-color", PAGE_COLOUR[theme]);
        await expectReadable(app.page, path);
      }
    });
  });
}

test("Gemlight, once picked, is on every part of the app", async ({ members, openAs }) => {
  const them = await openAs("signedOut");
  const name = uniqueName("Gemlight player");
  await them.signIn.asNewcomer(name);
  await members.open();
  await members.letIn(name);
  await them.settings.open();
  await them.settings.pick("Gemlight", "gem");

  for (const path of PLAYER_PAGES) {
    await them.goto(path);
    await expect(them.page.locator("html")).toHaveAttribute("data-theme", "gem");
    await expect(them.page.locator("body")).toHaveCSS("background-color", PAGE_COLOUR.gem);
    await expectReadable(them.page, path);
  }
});
