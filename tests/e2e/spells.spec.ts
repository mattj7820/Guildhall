/**
 * Spells on Fixture PC One, as Player One. Preparing counts the sheet's prepared spells, and the
 * picker adds spells that may start prepared, so every test that adds spells to PC One is gathered
 * here, in one file, and runs one after another. None of them rests.
 */
import { test } from "./support/fixtures";

test.describe.configure({ mode: "default" });

import "./spells/preparing";
import "./spells/picker";
