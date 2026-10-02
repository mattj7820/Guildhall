import { expect } from "@playwright/test";
import { AppPage } from "./app-page";

/** The sign-in page, with dev sign-in's pretend accounts (the e2e server turns it on). */
export class SignIn extends AppPage {
  open() {
    return this.goto("/login");
  }

  /** Signs in as one of the pretend accounts, e.g. "the DM" or "Player One". */
  async as(who: string) {
    await this.page.getByRole("button", { name: `Sign in as ${who}` }).click();
  }

  /** Signs in as someone new, who lands on the waiting page. */
  async asNewcomer(name: string) {
    await this.open();
    await this.page.getByLabel("Someone new").fill(name);
    await this.page.getByRole("button", { name: "Sign in as someone new" }).click();
    await expect(this.page).toHaveURL("/waiting");
    await expect(this.page.getByRole("heading", { name: "Waiting for the DM" })).toBeVisible();
  }

  async signOut() {
    await this.page.getByRole("button", { name: "Sign out" }).click();
    await expect(this.page).toHaveURL("/login");
  }
}
