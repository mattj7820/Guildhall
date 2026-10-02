import { test as base } from "../support/fixtures";

/**
 * The `test` for every spec that uses the fight. The table has one fight, kept on the server, so
 * each test starts with none. It's ended in an automatic fixture, which is set up before any
 * other (a `beforeEach` hook would run after them, ending the fight under a page already open).
 */
export const test = base.extend<{ noFight: void }>({
  noFight: [
    async ({ api }, use) => {
      await api.endFight();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "../support/fixtures";
