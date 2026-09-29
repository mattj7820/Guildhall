# Testing strategy

Testing is a first-class part of Guildhall. The aim is confidence that the rules that matter hold
(links resolve like Obsidian does, and players never see DM content), with tests that read as a
specification of the behaviour.

## Layers

| Layer       | Tool                    | Location                                                                                                                                                                                                                                                              | What it covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                  | `app/**/*.test.ts`, next to the code                                                                                                                                                                                                                                  | Pure logic: frontmatter parsing, wikilink parsing and resolution, `%%comment%%` handling, markdown rendering and sanitising, visibility rules, config validation, hub links; combat rules (initiative and tie-breaks, turns, HP, undo, what players may see, saved-encounter validation) and dice, including the roll log and finding rolls in statblock text; maps (geometry, pan and zoom, the map tree, validation, the editor reducer, and what players may see; fog cells covered by strokes and outlines, checked against a plain cell-by-cell definition, changes and their inverses, and when an area counts as revealed); signing in (who a session belongs to, who may reach which page, the same-origin check, the Discord adapter against a stand-in for Discord, dev sign-in's guards); characters (the modifier maths and overrides, validation, who may see or change what, every action and its inverse, merging and rebasing edits, the open sheet's saving against a stand-in server, and the bag's stacking, splitting, quick add and giving) |
| Integration | Vitest                  | `app/.server/vault/vault.test.ts`, `app/.server/combat/*.test.ts`, `app/.server/maps/*.test.ts`, `app/.server/members/*.test.ts`, `app/.server/characters/*.test.ts`, `app/.server/data/*.test.ts`, `app/.server/vault/{live,read}-vault.test.ts`, `server/*.test.ts` | The `Vault` over the real fixture vault on disk: reading, folder tree, search, visibility filtering, asset access, statblocks, the party, notes by ID and finding map images; the combat catalogue built from it; the JSON store, prepared encounters, maps, fog of war and characters in temporary folders (restarts, simultaneous writes, damaged files, refused tree changes, gifts between bags); the party and sheets as each viewer may see them, item notes without their DM parts, and portraits; members and the waiting list; reading a vault while a sync tool changes it; the HTTP settings on a real Express server (trusting the proxy, headers, health check)                                                                                                                                                                                                                                                                                                                                                                                     |
| End-to-end  | Playwright              | `tests/e2e/*.spec.ts`                                                                                                                                                                                                                                                 | User journeys against the production build: hub, wikilink navigation, search, the player view hiding DM content, running a fight in the combat tracker, preparing and starting encounters, click-to-roll; making maps, drawing and reshaping areas, linking maps and clicking through them; sharing a map, revealing and hiding fog with the brush, areas and "reveal all", undoing, secret areas, and only revealed pixels reaching a player; signing in and out, newcomers waiting and being let in, removed members signed out, players kept from DM pages, forms from other sites refused, the way to Discord and back; the party, who can open which sheet, editing a sheet and rolling from it, the DM and a player editing at once, the bag by mouse and keyboard, gifts, and item notes' DM parts never reaching players                                                                                                                                                                                                                                 |
| Container   | Docker, in CI           | `.github/workflows/ci.yml` (job `docker`)                                                                                                                                                                                                                             | The image that gets deployed: it builds, becomes healthy with a vault mounted read-only, runs as a normal user, requires sign-in, and refuses dev sign-in from outside the container                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Static      | ESLint, Prettier, `tsc` | whole repo                                                                                                                                                                                                                                                            | Types, style, and a lint rule that bans filesystem write APIs in app code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Most behaviour is pinned down at the unit level, where it's fast and precise. End-to-end tests
prove the pieces are wired together and cover what only a browser can show: client-side
navigation, heading anchors scrolling into view, images loading, cookies switching views.

## Fixture vault

`tests/fixtures/vault` is a small, invented Obsidian vault. It is **test data, not campaign
content**, and it's never a real vault. Each note exists to exercise a specific behaviour, and
its body says which, for example:

- `Home.md`: one of each link form (plain, aliased, heading, path, `.md` extension, broken, and
  links inside code).
- `NPCs/Captain Voss.md`: no `visibility` field, so DM-only by default.
- `Secrets/Villain Plan.md`: explicit `visibility: dm`, a stable `id`, and a DM-only image.
- `Secrets/Broken Frontmatter.md`: invalid YAML that must fail closed to DM-only.
- `Locations/Old Mill.md` and `Locations/Brindleford/Old Mill.md`: an ambiguous name.
- `NPCs/Mira Stonehand.md`: image and audio embeds, and inline and block `%%DM comments%%`.
- `NPCs/Fixture Informant.md`: a shared note that opens with a `# DM` section, with a
  `> [!dm]` callout and a `## DM` section holding a statblock and a DM-only image; each part
  has its own search keyword.
- `Bestiary/Test Creature.md`: a statblock in the plugin format, plus an unreadable one.
- `Bestiary/Fixture Minion.md`: the combat tracker's test monster, with known DEX, AC and hit dice.
- `Bestiary/Fixture Companion.md`: a player-visible companion statblock, plus one hidden in a DM
  comment that players must never get. `type: companion` makes it the party's shared companion.
- `Bestiary/Fixture Bare Statblock.md`: a statblock with only a name (no HP, no ability scores).
- `Party/Fixture PC One.md`, `Party/Fixture PC Two.md`: `type: pc` notes with a `player`.
- `Items/Fixture Rope.md`: a shared item note. `Items/Fixture Cursed Ring.md`: a shared item note
  with a `## DM` section and a `> [!dm]` callout, each with a marker word players must never get.
  `Items/Fixture Secret Relic.md`: a DM-only item note, for unidentified items.
- `Maps/`: placeholder map images (colour fields and a grid, never real maps), explained in
  `Maps/Fixture Maps.md`. `Fixture World.png` is 400×200, deliberately not square;
  `Fixture Town.png` and `Fixture Keep.png` are child maps; `Fixture Duplicate.png` shares its
  name with one in `Attachments/`, so a moved image can't be matched by name.
- `Locations/Fixture Town.md`: a player-visible note with a stable `id`, linked from maps.
- `Secrets/Fixture Hidden Place.md`: a DM-only note linked from a map area.
- `.obsidian/` and `.trash/`: must be ignored.

Pure unit tests build their inputs inline (for example, a string of markdown and a stub resolver)
so each test shows everything it depends on. Integration and e2e tests use the fixture vault.

To add a scenario, add or extend a fixture note, state its purpose in the note body, then assert
on it. Keep fixture text short and functional.

## Guarding the read-only rule

The app must never modify the vault. Four independent checks:

1. **Lint:** ESLint's `no-restricted-imports`/`no-restricted-properties` ban `fs` write APIs
   (`writeFile`, `rename`, `rm`, `mkdir`…) and namespace imports of `fs` in `app/` and `server/`.
2. **Config:** `DATA_PATH`, the only place Guildhall writes (through `app/.server/data/json-store.ts`
   and `app/.server/data/file-cache.ts`, the two exceptions to the lint rule), is refused if it
   overlaps the vault. sharp's own `toFile` is banned everywhere, so it only ever makes buffers.
3. **Construction:** the asset route can only serve files the vault index discovered, so a
   crafted path can't reach outside the vault.
4. **E2E fingerprint:** Playwright's global setup hashes every fixture file (path, size, mtime,
   contents) before the run, and fails the run if anything changed afterwards.

## Conventions

- Test names describe behaviour ("hides DM-only notes from the sidebar"), not implementation.
- E2E tests use accessible locators (`getByRole`, `getByText`, labelled landmarks) rather than
  test IDs or CSS selectors, so they also check that the UI is accessible. Shared helpers live in
  `tests/e2e/support/app.ts`.
- Each Playwright test starts in a fresh browser context, signed in as the DM (see below).
- Table-driven cases (`it.each`) for input/output rules such as link parsing and invalid config.
- Combat unit tests build combatants with the helpers in `app/combat/test-builders.ts`, so each
  test states only the fields it depends on.

## Signing in

- **Dev sign-in instead of Discord.** The e2e server turns on `DEV_LOGIN`, which offers
  one-click pretend accounts: the DM, each player named in the fixture PC notes, and "someone new"
  with any name. They go through the real member list and session code, so tests exercise the
  same checks as production.
- **Saved sign-ins.** A Playwright setup project (`tests/e2e/sign-in.setup.ts`) signs in once as
  the DM and once as Player One, and saves the cookies. Every test then starts signed in as the
  DM; a spec can choose `SIGNED_IN.playerOne` or `SIGNED_OUT` from `tests/e2e/support/sign-in.ts`
  instead. Each test still gets its own browser context, so tests can run in parallel.
- **Two people at once.** Tests of letting someone in open a second browser context for the
  newcomer (`browser.newContext`), while the DM uses the test's own page.
- **Discord.** The e2e server has a made-up Discord application. Tests check that sign-in sends
  people to Discord with the right request, and that bad answers coming back are refused. They
  never reach Discord. The adapter's exchange with Discord is unit-tested against a stand-in, and
  a real sign-in is checked by hand (see `docs/deployment.md`).

## Randomness

Dice decide initiative, tie-breaks and monster HP, so tests must control them.

- **Unit tests** pass an `Rng` into whatever rolls. `sequenceRng([14, 3, 5])` returns those faces
  in order, and throws if a face can't be on the die or the script runs out, so a test can't
  silently roll more dice than it expects.
- **End-to-end tests** call `scriptDice(page, [face(20, 14), face(6, 3)])` just before the click
  that rolls. It replaces `Math.random` inside the loaded page. It isn't done in an init script
  because React and React Router also call `Math.random` while starting up and navigating. Specs
  document the order dice are rolled in (for new monsters: initiative, then hit dice).
- The encounter is saved in localStorage, and each Playwright test gets a fresh browser context,
  so every test starts with an empty tracker.

## Maps

- **Drawing in end-to-end tests** clicks positions on the map canvas, given as fractions of the
  image (`drawArea` in `tests/e2e/support/app.ts` works out where the fitted image sits). Reshaping
  is tested through the point handles' accessible labels ("Point 2 of Harbour at 40.0%, 40.0%"),
  with the keyboard and with a mouse drag. Exact coordinates are left to the unit tests of
  `geometry.ts` and `viewport.ts`; e2e checks positions only approximately.
- **The player view of maps** isn't built yet, so what players may see (`mapView`) is covered by
  unit tests only. The e2e tests check that every map page and image is DM-only.
- **Image health** (a moved, missing or reshaped image) is covered at unit level (`findImage`,
  `sameShape`, `mapView`): the e2e run can't move or change fixture files, which must stay
  untouched.
- The fixture map images are placeholders (colour fields and a grid), made once by a script that
  isn't kept; they're described in `Maps/Fixture Maps.md`.
- **Hidden pixels never reach players.** `Fixture Fog.png` has a magenta square in one corner, the
  only magenta in it. `app/.server/maps/player-image.test.ts` keeps that corner fogged and checks
  every tile a player could get three ways: no magenta pixel; every pixel in a hidden cell fully
  transparent; and exactly the same bytes when something else is painted under the fog. The last
  is the real guarantee (a player's image doesn't depend on hidden pixels at all), and it was
  checked by putting back a leak on purpose (masking a lossy copy of a tile) and seeing it fail.
  `tests/e2e/player-maps.spec.ts` checks the same over HTTP, as Player One. Pixel rules (a hidden
  cell is transparent for any fog and image size, and which tiles players may have) are unit
  tests in `app/maps/fog/tiles.test.ts`.

## Characters

- **One shared party.** Every spec uses the same fixture characters on the same server, so tests
  never assert on a whole bag: they add uniquely named items (`uniqueName()`) and look only at
  those. Starting a sheet that exists just opens it (`openCharacter()` in
  `tests/e2e/support/app.ts`), so any test may be first.
- **Editing is serial.** `character-sheet.spec.ts` is the only spec that changes Fixture PC One's
  sheet fields, and runs its tests in order. Others only add items, and because changes are
  merged as actions, that never disturbs it.
- **Dragging uses the companion's bag,** which no other test changes: a drag needs tiles that hold
  still between finding them on screen and pressing the mouse.
- **Two people at once:** the DM and Player One each get a browser context. A conflict is made on
  purpose: one saves while the other's page still shows the old value.
- **What players never get:** item notes' DM parts are checked in the page, its data request and
  the save endpoint's JSON.
- **The fog tools' saving** (batching, retrying, refusals, undo that leaves others' reveals alone)
  is unit-tested in `app/maps/fog/editor.test.ts` against a stand-in fog endpoint, with fake timers.
- **The open sheet's saving** (batching, retrying, rebasing, undo, gifts) is unit-tested in
  `app/characters/editor.test.ts` against a stand-in server that applies actions like the real
  one, with fake timers.

## Data written by tests

- Unit and integration tests of the JSON store and prepared encounters use a fresh temporary
  folder each (`mkdtemp`), deleted afterwards.
- The e2e server's `DATA_PATH` is `test-results/e2e-data`, which Playwright empties before it
  starts the server on each run. Tests share that server, so they give prepared encounters,
  maps and newcomers random names (`uniqueName()`) and never assert on the whole list. The saved
  sign-ins are kept in `test-results/.auth`.

## Running

```sh
npm test               # unit + integration
npm run test:watch     # watch mode
npm run test:e2e       # builds the app, serves it on :4173 with the fixture vault, runs Playwright
npx playwright show-report
```

The e2e config sets `VAULT_PATH` itself, overriding any local `.env`, so a real vault is never
used in tests.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

- **checks** (Ubuntu): lint, typecheck, unit tests
- **unit-windows**: unit tests on Windows, since vault paths are normalised across OSes
- **docker** (Ubuntu): builds the image and checks it (see Layers)
- **e2e** (Ubuntu): Playwright (Chromium); the HTML report is uploaded when it fails

## Next steps

- Component tests for UI pieces as they grow (for example, the folder tree).
- Coverage reporting once the codebase is larger; kept as a signal, not a target.
- Accessibility checks with `@axe-core/playwright` on key pages.
- Visual regression screenshots once the design settles.
