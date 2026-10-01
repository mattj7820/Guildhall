import { test } from "@playwright/test";
import { ORIGIN } from "./support/app";

/**
 * The combat tracker. The table has one fight, kept on the server, so every test that uses the
 * tracker is gathered here, in one file, and runs one after another, each starting with no fight.
 */
test.describe.configure({ mode: "default" });

test.beforeEach(async ({ request }) => {
  await request.post("/combat/fight", { headers: { Origin: ORIGIN }, data: { intent: "end" } });
});

import "./fight/combat-tracker";
import "./fight/click-to-roll";
import "./fight/prepared-encounters";
