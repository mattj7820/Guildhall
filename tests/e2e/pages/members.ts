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

  /** Someone's dice on their row: what they have, and giving them more. */
  dice(name: string) {
    return this.member(name).getByRole("group", { name: `${name}'s dice` });
  }

  /** Gives someone a pack, saying why. */
  async givePack(name: string, reason = "") {
    const dice = this.dice(name);
    await dice.getByLabel("Why").fill(reason);
    await dice.getByRole("button", { name: "Give a pack" }).click();
    await expect(dice.getByLabel("Why")).toHaveValue("");
  }

  /** Gives someone a particular die, by its style as listed ("Bone (Uncommon)") and sides. */
  async giveDie(name: string, style: string, sides: number) {
    const dice = this.dice(name);
    await dice.getByLabel("Style").selectOption({ label: style });
    await dice.getByLabel("Die").selectOption(String(sides));
    await dice.getByRole("button", { name: "Give this die" }).click();
  }

  async remove(name: string) {
    const row = this.member(name);
    await row.getByRole("button", { name: "Remove…" }).click();
    await row.getByRole("button", { name: `Remove ${name}` }).click();
    await expect(this.page.getByRole("listitem", { name })).toHaveCount(0);
  }
}
