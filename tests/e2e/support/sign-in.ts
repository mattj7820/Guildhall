/**
 * Saved sign-ins, written by `sign-in.setup.ts` before the other tests run. Kept in Playwright's
 * output folder, which is emptied at the start of each run along with the data folder.
 */
export const SIGNED_IN = {
  dm: "test-results/.auth/dm.json",
  playerOne: "test-results/.auth/player-one.json",
};

/** For `test.use({ storageState })`: a browser that has never signed in. */
export const SIGNED_OUT = { cookies: [], origins: [] };
