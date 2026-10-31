import { test as base, type BrowserContext } from "@playwright/test";
import { AppPage } from "../pages/app-page";
import { Characters } from "../pages/characters";
import { Combat, Prepared } from "../pages/combat";
import { Maps } from "../pages/maps";
import { Members } from "../pages/members";
import { Settings } from "../pages/settings";
import { SignIn } from "../pages/sign-in";
import { Wiki } from "../pages/wiki";
import { Api } from "./api";
import { SIGNED_IN, SIGNED_OUT } from "./sign-in";

/**
 * One person's browser tab and the page objects over it: the test's own (signed in as the DM
 * unless the spec says otherwise), or another opened with `openAs`.
 */
export class App extends AppPage {
  readonly api = new Api(this.page.request);
  readonly wiki = new Wiki(this.page);
  readonly characters = new Characters(this.page);
  readonly combat = new Combat(this.page);
  readonly prepared = new Prepared(this.page);
  readonly maps = new Maps(this.page);
  readonly members = new Members(this.page);
  readonly settings = new Settings(this.page);
  readonly signIn = new SignIn(this.page);
}

export type Who = keyof typeof SIGNED_IN | "signedOut";

export interface Fixtures {
  /** The test's own tab. */
  app: App;
  /** Requests as the test's own browser (the DM's, by default). */
  api: Api;
  wiki: Wiki;
  characters: Characters;
  combat: Combat;
  prepared: Prepared;
  maps: Maps;
  members: Members;
  settings: Settings;
  signIn: SignIn;
  /**
   * Opens someone else's browser, with a tab of its own: another player, the DM, or someone
   * signed out. Closed when the test ends.
   */
  openAs: (who: Who) => Promise<App>;
}

export const test = base.extend<Fixtures>({
  app: async ({ page }, use) => use(new App(page)),
  api: async ({ app }, use) => use(app.api),
  wiki: async ({ app }, use) => use(app.wiki),
  characters: async ({ app }, use) => use(app.characters),
  combat: async ({ app }, use) => use(app.combat),
  prepared: async ({ app }, use) => use(app.prepared),
  maps: async ({ app }, use) => use(app.maps),
  members: async ({ app }, use) => use(app.members),
  settings: async ({ app }, use) => use(app.settings),
  signIn: async ({ app }, use) => use(app.signIn),

  openAs: async ({ browser, baseURL, reducedMotion }, use) => {
    const opened: BrowserContext[] = [];
    await use(async (who) => {
      const context = await browser.newContext({
        storageState: who === "signedOut" ? SIGNED_OUT : SIGNED_IN[who],
        baseURL,
        // Others' browsers ask for less motion like the test's own, so their dice land at once.
        reducedMotion,
      });
      opened.push(context);
      return new App(await context.newPage());
    });
    await Promise.all(opened.map((context) => context.close()));
  },
});

export { expect } from "@playwright/test";
