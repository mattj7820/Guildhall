import { expect } from "@playwright/test";
import { AppPage } from "./app-page";

/** The DM's Members page: the waiting list and who's in. */
export class Members extends AppPage {
  get waiting() {
    return this.page.getByRole("list", { name: "Waiting" });
  }

  get members() {
    return this.page.getByRole("list", { name: "Members" });
  }

  open() {
    return this.goto("/members");
  }

  request(name: string) {
    return this.waiting.getByRole("listitem", { name });
  }

  member(name: string) {
    return this.members.getByRole("listitem", { name });
  }

  /** Lets someone in, optionally choosing which player they are ("Player Two"). */
  async letIn(name: string, { plays }: { plays?: string } = {}) {
    const request = this.request(name);
    if (plays) await request.getByLabel(`${name} plays`).selectOption({ label: plays });
    await request.getByRole("button", { name: "Let in" }).click();
    await expect(this.member(name)).toBeVisible();
  }

  async dismiss(name: string) {
    await this.request(name).getByRole("button", { name: "Dismiss" }).click();
    await expect(this.page.getByRole("listitem", { name })).toHaveCount(0);
  }

  /** Gives someone a dice set, or takes it back. */
  async giveDice(name: string, set: string, give = true) {
    const button = this.member(name)
      .getByRole("group", { name: `${name}'s dice sets` })
      .getByRole("button", { name: set });
    if ((await button.getAttribute("aria-pressed")) !== String(give)) await button.click();
    await expect(button).toHaveAttribute("aria-pressed", String(give));
  }

  async remove(name: string) {
    const row = this.member(name);
    await row.getByRole("button", { name: "Remove…" }).click();
    await row.getByRole("button", { name: `Remove ${name}` }).click();
    await expect(this.page.getByRole("listitem", { name })).toHaveCount(0);
  }
}
