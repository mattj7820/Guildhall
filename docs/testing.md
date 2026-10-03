# Testing strategy

Testing is a first-class part of Guildhall. The aim is confidence that the rules that matter hold
(links resolve like Obsidian does, and players never see DM content), with tests that read as a
specification of the behaviour.

## Layers

| Layer       | Tool                    | Location                                                                                                                                                                                                                                                              | What it covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                  | `app/**/*.test.ts`, next to the code                                                                                                                                                                                                                                  | Pure logic: frontmatter parsing, wikilink parsing and resolution, `%%comment%%` handling, markdown rendering and sanitising, visibility rules, config validation, hub links; combat rules (initiative and tie-breaks, turns, HP, undo, what players may see, saved-encounter validation) and dice, including the roll log and finding rolls in statblock text; maps (geometry, pan and zoom, the map tree, validation, the editor reducer, and what players may see; fog cells covered by strokes and outlines, checked against a plain cell-by-cell definition, changes and their inverses, and when an area counts as revealed); signing in (who a session belongs to, who may reach which page, the same-origin check, the Discord adapter against a stand-in for Discord, dev sign-in's guards); characters (the modifier maths and overrides, validation, who may see or change what, every action and its inverse, merging and rebasing edits, the open sheet's saving against a stand-in server, and the bag's stacking, splitting, quick add and giving); tokens (validation, every action, who may move which, what each viewer sees through the fog, holds, and the browser's own moves over others' drags); the live connection (reconnecting, throttling drags, the hub's rooms against stand-in sockets); battle grids (fitting a grid to an image, snapping by size, true distances, and the squares each spell area covers, checked square by square over a wide field for every shape, size and several directions)                                                                                                                                                                                                                        |
| Integration | Vitest                  | `app/.server/vault/vault.test.ts`, `app/.server/combat/*.test.ts`, `app/.server/maps/*.test.ts`, `app/.server/members/*.test.ts`, `app/.server/characters/*.test.ts`, `app/.server/data/*.test.ts`, `app/.server/vault/{live,read}-vault.test.ts`, `server/*.test.ts` | The `Vault` over the real fixture vault on disk: reading, folder tree, search, visibility filtering, asset access, statblocks, the party, notes by ID and finding map images; the combat catalogue built from it; the JSON store, prepared encounters, maps, fog of war and characters in temporary folders (restarts, simultaneous writes, damaged files, refused tree changes, gifts between bags); the party and sheets as each viewer may see them, item notes without their DM parts, and portraits; members and the waiting list; reading a vault while a sync tool changes it; the HTTP settings on a real Express server (trusting the proxy, headers, health check); tokens in temporary folders, and who's inside which area; websockets on a real server (refused without a session, from another site or when waiting; a removed member's connection closed; nothing a player can't see ever sent to them)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| End-to-end  | Playwright              | `tests/e2e/*.spec.ts`                                                                                                                                                                                                                                                 | User journeys against the production build: hub, wikilink navigation, search, the player view hiding DM content, running a fight in the combat tracker, preparing and starting encounters, click-to-roll; making maps, drawing and reshaping areas, linking maps and clicking through them; sharing a map, revealing and hiding fog with the brush, areas and "reveal all", undoing, secret areas, and only revealed pixels reaching a player; signing in and out, newcomers waiting and being let in, removed members signed out, players kept from DM pages, forms from other sites refused, the way to Discord and back; the party, who can open which sheet, editing a sheet and rolling from it, the DM and a player editing at once, the bag by mouse and keyboard, gifts, and item notes' DM parts never reaching players; placing tokens and markers, a player and the DM dragging tokens in two browsers, keyboard moves, a held token, tokens under the fog and DM markers never reaching players, bringing the party into a deeper map, and fog reveals arriving over the socket (and by polling without it); setting up a battle grid, tokens snapping and sizing on it (and not, with snapping off), measuring by mouse, distances by keyboard, and spell areas catching tokens; the shared fight: another tab and players following it live, players ending only their own turn, Combat on a map placing monsters, hiding one from players, down at 0, Free movement, ending a fight both ways, and a prepared fight saved on a map and started there; damage for monsters picked on the map; stunts reaching a player's browser (and not one that turned them off), only the DM playing them, and sounds served only from the sounds folder |
| Container   | Docker, in CI           | `.github/workflows/ci.yml` (job `docker`)                                                                                                                                                                                                                             | The image that gets deployed: it builds, becomes healthy with a vault mounted read-only, runs as a normal user, requires sign-in, and refuses dev sign-in from outside the container                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Static      | ESLint, Prettier, `tsc` | whole repo                                                                                                                                                                                                                                                            | Types, style, and a lint rule that bans filesystem write APIs in app code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

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
- `Sounds/Fixture Tone.wav`: the sound board's one sound, a generated tone; `Sounds/Fixture
Sounds.md` says so.
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
  test IDs or CSS selectors, so they also check that the UI is accessible. A `data-*` hook is
  only for what has no accessible handle, such as decoration hidden from screen readers
  (`data-stunt`) or the page's hydration marker. Locators and steps live in page objects (see
  below), not in specs.
- Each Playwright test starts in a fresh browser context, signed in as the DM (see below).
- Table-driven cases (`it.each`) for input/output rules such as link parsing and invalid config.
- Combat unit tests build combatants with the helpers in `app/combat/test-builders.ts`, so each
  test states only the fields it depends on.

## End-to-end tests: page objects and waiting

Specs import `test` and `expect` from `tests/e2e/support/fixtures.ts`, never from
`@playwright/test`. Its fixtures:

- **Page objects** for the test's own tab: `wiki`, `characters`, `combat`, `prepared`, `maps`,
  `members` and `signIn`, all bundled as `app`. They live in `tests/e2e/pages/`, one file per
  area, and open deeper ones: `characters.openSheet()` gives a `CharacterSheet`, `openBag()` a
  `Bag`, `maps.view(map)` a `MapView` and `maps.edit(map)` a `MapEditor`.
- **`openAs(who)`**: someone else's browser (`"dm"`, `"playerOne"` or `"signedOut"`), with the
  same page objects, closed when the test ends.
- **`api`**: requests as the test's browser, with Guildhall's own Origin. It sets things up when
  the UI isn't what's under test (`api.createMap({ shared, fog, grid })`, areas, markers, ending
  the fight), and checks what the server refuses. Only `maps.spec.ts` makes a map through the
  form.

A spec that needs the same starting point in every test adds a local fixture with `test.extend`
(the newcomer in `members.spec.ts`, the shared map in `map-tokens.spec.ts`).

**How tests wait**, so they don't depend on timing:

- **Hydration.** The root layout marks `<html data-hydrated>` once React has hydrated. Every
  `goto()` and `reload()` in the page objects waits for it, since a click before then lands on a
  server-rendered button with no handler and is lost. Specs never call `page.goto` themselves.
- **Never a fixed wait.** No `waitForTimeout`; wait for what the step changes. A page object's
  action ends when its result shows (a dialog closed, a combatant listed, a keyboard drag's step
  announced), and the next step starts from there.
- **Saving.** `saved()` on the sheet, bag, editor and prepared encounter waits for "All changes
  saved"; `tracker.saved()` for the fight; `fogSaved()` for fog. Wait for it before reloading or
  checking from another browser.
- **Live.** A second browser waits for `live()` (the page's connection is open) before someone
  else changes what it shows.
- **Moving things.** A drag waits for the element's own transitions to finish (`settled()`)
  before reading where it is on screen, since mouse moves don't wait like clicks do. Positions
  read from labels are polled (`expect.poll`), never read once.
- **The fight** is ended in an automatic fixture (`tests/e2e/fight/fight-test.ts`), which is set
  up before every other fixture. A `beforeEach` hook would run after them, ending the fight under
  a page already open.

**Hunting flakes.** CI keeps the Playwright report (with traces) for every run that isn't
cancelled, so a test that passed on retry still has its first attempt's trace. To repeat a spec
on CI rather than a laptop, run the Stress workflow:
`gh workflow run stress.yml --ref <branch> -f specs=tests/e2e/inventory.spec.ts -f repeat=30`.
Repeating a spec against one server also shows tests that only pass on a fresh one. Repeat
`fight.spec.ts` with `-f workers=1`: with more workers, its repeated copies run at once against
the table's one fight and trip over each other.

## Signing in

- **Dev sign-in instead of Discord.** The e2e server turns on `DEV_LOGIN`, which offers
  one-click pretend accounts: the DM, each player named in the fixture PC notes, and "someone new"
  with any name. They go through the real member list and session code, so tests exercise the
  same checks as production.
- **Saved sign-ins.** A Playwright setup project (`tests/e2e/sign-in.setup.ts`) signs in once as
  the DM and once as Player One, and saves the cookies. Every test then starts signed in as the
  DM; a spec can choose `SIGNED_IN.playerOne` or `SIGNED_OUT` from `tests/e2e/support/sign-in.ts`
  instead. Each test still gets its own browser context, so tests can run in parallel.
- **Two people at once.** A test opens another person's browser with `openAs`, while the test's
  own page stays the DM's (or whoever the spec chose).
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
- The table has one fight, kept on the server, so every spec that uses the tracker is gathered
  in `tests/e2e/fight.spec.ts`, which imports them from `tests/e2e/fight/` and runs them one after
  another, each starting with the fight ended. Wait for `fightSaved(page)` before checking what
  the server (or another browser) has. A fight on a map makes its own shared map, so it never
  places party members (only `map-tokens.spec.ts` does).

## Maps

- **Drawing in end-to-end tests** clicks positions on the map canvas, given as fractions of the
  image (`drawArea` in `tests/e2e/support/app.ts` works out where the fitted image sits). Reshaping
  is tested through the point handles' accessible labels ("Point 2 of Harbour at 40.0%, 40.0%"),
  with the keyboard and with a mouse drag. Exact coordinates are left to the unit tests of
  `geometry.ts` and `viewport.ts`; e2e checks positions only approximately.
- **The player view of maps** is covered at unit level (`mapView`: hidden maps, secret and fogged
  areas, tiles) and end to end as Player One: shared maps in the menu and list, only the revealed
  tile on the page, an area under the fog absent even from the page's data, and a map that isn't
  shared (its page, editor, image and tiles) a 404. The DM and Player One each get a browser: the
  DM reveals, hides and stops sharing while the player's page is open, and it follows within
  seconds without reloading (a value set on the page survives).
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

## Tokens and live updates

- **Nothing a player shouldn't see is ever sent.** `app/.server/live/live.test.ts` opens real
  websockets to a real server as the DM and Player One, and checks that a DM-only marker, another
  PC under the fog, a drag of either, and anything on a map that isn't shared never reach the
  player: not a token, and not even a message saying something changed. It was checked by putting
  the leaks back on purpose (sending every drag to everyone, counting every token in the version)
  and seeing it fail. The same holds for pages: `tests/e2e/map-tokens.spec.ts` looks for hidden
  markers' names in the player's page and its `.data` request.
- **Signing a socket in** is tested on a real HTTP server with real signed cookies and a member
  list in a temporary folder (`sockets.test.ts`): no session, a forged cookie, another site, no
  Origin, a waiting member and a removed one are all refused before the connection opens.
- **The hub's rules** (rooms, one copy per viewer, not repeating a state, limits, pings, rechecking
  members) are unit tests against stand-in sockets with fake timers, and so are the browser's
  reconnecting (`app/live/client.test.ts`) and 20-a-second drags (`throttle.test.ts`).
- **Two people moving tokens** is end to end: the DM and Player One each get a browser. Drags use
  the mouse in steps, like a hand, and wait for a token to finish gliding before picking it up. A
  held token is checked while the DM still has the mouse down.
- **One party.** Each party member is in one place on the whole server, so the token spec runs its
  tests in order, and it's the only spec that places party members. Markers get unique names.
- **Fog reveals over the socket:** the reveal test refuses the version check (`page.route`), so
  the reveal can only have come live; another refuses websockets (`page.routeWebSocket`) and waits
  for polling.

## Battle maps

- **The geometry is unit-tested exactly** (`app/maps/grid/`): suggesting a grid from an image's
  size, snapping by token size, true lengths, and spell areas. `shapes.test.ts` checks the
  squares each shape covers against a plain loop over every square in a wide field, for every
  shape, the common sizes and several directions, so the quick bounded search can't miss any.
- **End to end** (`battle-grid.spec.ts`, and the grid tests in `map-tokens.spec.ts`), grids use
  64-pixel squares on the 1024×512 fog fixture, so positions and distances have exact expected
  values: a token dropped near a square settles on its centre (15.6%, 43.8%), and a ruler three
  squares across and four down reads 25 ft.

## Characters

- **One shared party.** Every spec uses the same fixture characters on the same server, so tests
  never assert on a whole bag: they add uniquely named items (`uniqueName()`) and look only at
  those. Starting a sheet that exists just opens it (`characters.openSheet()`), so
  any test may be first.
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
- **e2e** (Ubuntu): Playwright (Chromium); the HTML report, with traces of failed attempts, is
  uploaded unless the run was cancelled

`.github/workflows/stress.yml` runs only by hand: chosen specs repeated many times, with no
retries (see "Hunting flakes" above).

## Next steps

- Component tests for UI pieces as they grow (for example, the folder tree).
- Coverage reporting once the codebase is larger; kept as a signal, not a target.
- Accessibility checks with `@axe-core/playwright` on key pages.
- Visual regression screenshots once the design settles.
