/**
 * The combat tracker. The table has one fight, kept on the server, so every test that uses the
 * tracker is gathered here, in one file, and runs one after another, each starting with no fight
 * (see fight/fight-test.ts).
 */
import { test } from "./fight/fight-test";

test.describe.configure({ mode: "default" });

import "./fight/combat-tracker";
import "./fight/click-to-roll";
import "./fight/prepared-encounters";
import "./fight/map-fight";
import "./fight/srd-monsters";
