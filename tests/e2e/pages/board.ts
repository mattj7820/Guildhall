import { AppPage } from "./app-page";

/** The notice board: the next session and the session notes. */
export class Board extends AppPage {
  open() {
    return this.goto("/board");
  }

  get nextSession() {
    return this.page.getByRole("heading", { name: "Next session" }).locator("..");
  }

  get sessions() {
    return this.page.getByRole("region", { name: "Sessions" }).getByRole("link");
  }
}
