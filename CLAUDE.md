# Guildhall: notes for Claude

A personal D&D campaign hub (hobby project and portfolio piece, in a private GitHub repo). The
owner DMs an online campaign for two players: Roll20 for maps, Discord for voice, and all notes in
an Obsidian vault.
Guildhall links out to those tools and grows its own modules. The point of building it is
**interconnection**: eventually wiki, maps, characters, combat and dice all link through a shared
campaign model (NPCs, locations, maps, characters, sessions). See `docs/roadmap.md`.

Built so far: hub home page, read-only Obsidian wiki with a DM preview of the players' view, a
DM-only combat tracker (the live fight is kept in the browser; prepared encounters in the data
folder), DM-only interactive maps (vault images with outlined areas leading to deeper maps and
notes; kept in the data folder), character sheets with a game-style bag (players edit their own,
the DM gives items; kept in the data folder), and sign-in with Discord, where the DM lets players
in and says who they play. It's built to be hosted: a Docker image, with the vault copied
read-only from Google Drive (see `docs/deployment.md`).

## Hard constraints

- **Never write to, move or delete anything in the vault.** Read-only access only. An ESLint rule
  bans fs write APIs (and namespace `fs` imports) in `app/` and `server/`; don't work around it.
  The single exception is `app/.server/data/json-store.ts`, which writes only inside `DATA_PATH`
  (config refuses a data folder that overlaps the vault). New persistent data goes through it.
- **Keep the repo shareable:** it's private on GitHub (so its code and CI can't be read without
  signing in), but it may be shown as a portfolio piece: never commit real vault content, personal
  file paths or secrets. Config lives in a gitignored `.env`; keep `.env.example` in sync when
  adding variables.
- **Tests use only the fixture vault** in `tests/fixtures/vault` (invented, minimal test data).
  Never point tests at a real vault.
- **No AI-generated story, lore or narrative content** anywhere in the app or fixtures. Writing
  the story is the owner's job. Fixture text stays functional ("Fixture: tests X"). AI for maps
  and images may come later.
- **Every request is someone:** sign-in is required everywhere except the sign-in pages, and every
  visibility decision takes the explicit `Viewer` the root middleware sets. Never trust the client
  for who someone is or what they may see; players must never get DM content, including through
  files, search or data requests. No database or real-time infrastructure until asked.
- **Never loosen dev sign-in's guards** (`DEV_LOGIN`: local `PUBLIC_URL` and local connections
  only). It signs anyone in as anyone.

## Working style

- Exploratory hobby project: favour a small, working, usable slice over architecture. Don't build
  abstractions for modules that don't exist yet.
- Portfolio quality: clean code, meaningful tests, up-to-date docs. Record notable decisions in
  `docs/decisions.md` (append; don't rewrite history).
- Ask rather than guess on product decisions.

## Stack

TypeScript · React Router 8 framework mode (SSR) on Express · Tailwind v4 + typography ·
unified/remark/rehype · MiniSearch · chokidar · zod · Vitest · Playwright. Node 26 (`.nvmrc`).
React Router ships version-matched docs in `node_modules/react-router/docs/`, and there's an
agent skill in `.agents/skills/react-router/`; check them before using router APIs, since v8
differs from older versions.

## Commands

```sh
npm run dev          # dev server, http://localhost:3000 (reads .env)
npm run lint         # eslint + prettier --check   (npm run format to fix)
npm run typecheck    # react-router typegen && tsc -b
npm test             # vitest unit/integration
npm run test:e2e     # playwright: builds, serves on :4173 with the fixture vault
npm run check        # everything CI runs (CI also builds and checks the Docker image)
```

Locally, `DEV_LOGIN=true` in `.env` gives one-click sign-in as the DM or a player (see
`.env.example`).

First e2e run needs `npx playwright install chromium`.

## Architecture map

- `server.js`: HTTP entry (Vite middleware in dev, static and build in prod), and a clean shutdown
  on SIGTERM.
- `server/app.ts`: creates long-lived services once (config, `LiveVault`, `PreparedEncounters`,
  `CampaignMaps`, `Characters`, `Members`, sessions, Discord sign-in) and passes them to React
  Router through `servicesContext`; also the connection's address, for dev sign-in.
  `server/http.ts`: trusting the proxy, security headers, `/healthz`.
- `app/root.tsx`: its middleware is `authMiddleware` (`app/.server/auth/middleware.ts`), which
  checks the Origin of posts, reads the session, decides access, and sets `accountContext` and
  `viewerContext`. **Loaders read the viewer from context and pass it into every vault query.**
- `app/.server/auth/`: `sessions.ts` (signed cookie session), `account.ts` (`resolveAccount`,
  `viewerFor`: pure), `access.ts` (who may reach which path: pure), `origin.ts`, `discord.ts`
  (OAuth adapter over `fetch`), `discord-sign-in.ts` (the attempt cookie, `checkCallback`),
  `dev-login.ts`. `app/.server/viewer.ts` is the DM's preview-as-player cookie.
- `app/.server/members/`: `members.ts` (repository over `members.json`: waiting list, approval,
  session keys), `players.ts` (`partyPlayers`). Shared shapes in `app/members/`.
- `app/campaign/`: shared model (isomorphic): `Viewer` (with optional `playerId`), `Player`,
  `Visibility`, `EntityId`, entity types, `canView`.
- `app/shared/`: small generic helpers used by several modules: `newId()` and `history.ts` (undo).
- `app/dice/`: dice expressions (`parseDice`, `rollText`, `critical`), the `Rng` type, and the
  roll log (`rollInto`: labelled rolls, one-roll advantage, Critical) with its `useRollLog` hook
  (isomorphic).
- `app/combat/`: the combat tracker's model (isomorphic): `types.ts`, `encounter.ts` (reducer,
  action creators, `perform`), `initiative.ts` (ordering, reroll tie-breaks), `turns.ts`, `hp.ts`,
  `visibility.ts` (`encounterForViewer`), `schema.ts` (zod),
  `storage.ts` (localStorage), `prepared.ts` (`startPrepared`, `toPrepared`, `summarise`), and the
  `useEncounter` hook.
- `app/maps/`: the interactive maps model (isomorphic): `types.ts` (`CampaignMap`, `Area`, and the
  browser-safe `MapView`), `schema.ts` (zod), `geometry.ts` (normalised outlines), `tree.ts`
  (parents derived from area links: breadcrumbs, attachable maps, `treeProblem`), `viewport.ts`
  (pan and zoom maths), `image-size.ts` (`sameShape`), `editor.ts` (the editor's reducer, with a
  draft outline that's never saved), `urls.ts`, and the `usePanZoom` hook.
- `app/maps/fog/`: fog of war (isomorphic): `types.ts` (`FogMask`, `FogChange`), `mask.ts` (the
  grid, run-length text form, cell ranges), `shapes.ts` (the cells a stroke or polygon covers),
  `changes.ts` (`applyFogChange`, `inverseOf`), `coverage.ts` (`areaRevealed`: at least half),
  `schema.ts` (zod for requests).
- `app/characters/`: character sheets and bags (isomorphic): `types.ts` (`Character` is a
  `PlayerCharacter` with a `Sheet`, or a shared `Companion`; `InventoryItem`, `Purse`),
  `abilities.ts` (abilities, skills, `abilityModifier`, `signed`), `derive.ts` (`deriveSheet`: the
  paper sheet's maths, typed overrides win), `schema.ts` (zod, with defaults; `blankSheet`),
  `permissions.ts` (`characterAccess`: edit, summary or none; `canGive`), `inventory.ts` (move,
  stack, split, equip), `inventory-changes.ts` (`InventoryChange`, `giveItem`), `actions.ts`
  (`CharacterAction`, `applyAction`, request schemas), `undo.ts` (`inverseOf`, the undo stack),
  `sync.ts` (unsaved actions over the server's copy), `editor.ts` (`CharacterEditor`: an open
  sheet's saving, polling, undo and gifts) with its `useCharacterEditor` hook, `quick-add.ts`
  ("3 torches", icon guessing), `item-icons.ts` (generated by `scripts/import-item-icons.mjs`),
  `describe.ts` (notice wording), `view.ts` (shapes sent to the browser), `urls.ts`.
- `app/.server/characters/`: `characters.ts` (the repository over `characters.json`: apply
  actions, give, relink), `controllers.ts` (who plays a character, read from its note),
  `openable.ts` (the character if the viewer may open it, else 404), `load.ts` (`partyCards`,
  `characterPage`, `itemCatalogue`, `portraitPath`).
- `app/.server/vault/`:
  - `read-vault.ts`: the only reader of vault files. Skips dotfolders.
  - `parse-note.ts`: frontmatter → `Note`. Visibility fails closed to `dm`.
  - `link-resolver.ts`: Obsidian wikilink parsing and shortest-path resolution.
  - `comments.ts`: `%%comments%%` stripped for players, highlighted for the DM.
  - `dm-parts.ts`: DM sections (a heading that is exactly "DM") and DM callouts (`> [!dm]`).
    `forPlayers(body)` is **the** player text: comments and DM parts removed. The page,
    search and statblocks for players all come from it. `remarkDmParts` boxes DM parts for
    the DM.
  - `remark-wikilinks.ts` + `render.ts`: markdown → sanitised HTML.
  - `search.ts`: MiniSearch, one index per role, built from role-appropriate text.
  - `statblock/`: parses ` ```statblock ` YAML (Fantasy Statblocks plugin format), including the
    numbers the tracker uses, and renders it book-style, after sanitising, with vault values
    inserted only as text nodes. `extract-statblocks.ts` finds them in a note. With
    `{ rollable: true }` (the combat catalogue only), `rolls.ts` finds attack bonuses, dice,
    saves, skills and recharges, which are rendered as `button.statblock-roll` with `data-roll*`
    attributes.
  - `vault.ts`: immutable snapshot (also `statblocks()`, `party()`, `noteById()`, `mapImages()`,
    `findImage()`, which finds a moved image by its unique file name, and `firstImage()`, a note's
    first image as a viewer sees it). `live-vault.ts` rebuilds it on file changes.
    `serve-image.ts` streams a vault image the caller has already allowed (maps, portraits).
- `app/.server/combat/catalogue.ts`: vault statblocks and PCs as browser-safe shapes, with
  statblocks pre-rendered. `prepared-encounters.ts`: the prepared-encounter repository.
- `app/.server/maps/`: `campaign-maps.ts` (the map repository over `maps.json`; tree rules checked
  inside the write; sharing), `map-fogs.ts` (each map's fog over `fog.json`), `view.ts` (`mapView`:
  a map for a `Viewer`, with hidden things and fogged areas left out), and `load.ts` (finds the
  image, versions its URL, renders linked notes, reads the fog).
- `app/.server/data/json-store.ts`: `JsonFile`, a validated, queued, atomically written JSON file.
- `app/wiki/`: URL helpers and types shared with the browser.
- `app/routes/`: `home`, `wiki` (layout + sidebar), `wiki-home` (landing page + `?q=` search),
  `wiki-note` (`/wiki/*`), `combat` (DM-only tracker; server `loader` + hydrating `clientLoader`;
  `?start=<id>` starts a prepared encounter), `combat-prepared` (list; create, duplicate and delete
  actions), `combat-prepared-edit` (editor; autosave action), `maps` (tree of maps; create action),
  `map-view` (`/maps/:id`, the table view), `map-edit` (editor; save, createChild, setImage,
  setVisibility and delete actions; `?area=` preselects an area), `map-fog` (JSON: the DM's fog
  changes), `map-image` (resource route: a map's image by map
  ID), `vault-asset` (resource route), `view-mode` (the DM's preview toggle), `login` (sign-in
  page; dev sign-in action), `logout` (POST), `auth-discord` (starts Discord sign-in) and
  `auth-discord-callback`, `waiting` (for newcomers), `members` (DM-only: approve, assign,
  remove), `characters` (the party; start, relink and delete actions), `character`
  (`/characters/:id`, a sheet or companion), `character-changes` (JSON: GET the stored character,
  POST a batch of actions), `character-give` (JSON: a gift to another bag), `character-portrait`
  (resource route), `credits` (icon credits).
- `app/components/combat/`: the tracker's UI (`CombatTracker` lays it out), and the prepared
  encounter editor (`PreparedEditor`). `CombatantRow` and `AddCombatants` have a `"prep"` mode.
- `app/components/characters/`: `CharacterSheet` (with edit mode, click-to-roll and the docked
  bag), `CompanionSheet`, `PartyCard`, `SheetBag` (a bag saved through the editor), `EditorBar`,
  `HitPointsPanel`, `Fields`, `SheetParts`, `Portrait`. `app/components/inventory/`: `Bag`,
  `InventoryBoard` (the drag-and-drop grid, equipped slots, give targets), `ItemTile`,
  `ItemTooltip`, `ItemDetails`, `QuickAdd`, `Purse`, `UndoToast`.
- `app/components/maps/`: `MapCanvas` (the SVG canvas), `MapViewer` and `MapEditor` (the two
  pages), `AreaShape`, `VertexHandles`, `DraftOutline`, `AreaForm`, `MapSettings`, `ImageHealth`,
  `ImagePicker`, `NotePicker`, `NotePanel`, `MapBreadcrumbs`. Shared control classes are in
  `app/components/styles.ts`.

## Conventions

- Vault paths are POSIX, vault-relative, with extension (`NPCs/Mira.md`). The slug drops `.md`.
  Note URLs come from `noteUrl()` in `app/wiki/urls.ts`.
- Server-only code lives under `app/.server/`. Browser code must not import from it (types
  included; put shared shapes in `app/wiki/`, `app/campaign/`, `app/combat/`, `app/maps/` or
  `app/members/`).
- Frontmatter: `visibility` (`players`|`dm`, default `dm`), `type`, `aliases`, `tags`, `id`, and
  `player` on `type: pc` notes (who plays the character).
- Combat: every encounter change is an `EncounterAction` through the pure `encounterReducer`.
  Dice are rolled in action creators (or `perform`) and carried in the action. All randomness goes
  through an injected `Rng`; never call `Math.random` directly. IDs come from `newId()`
  (`app/shared/ids.ts`).
  Combatants reference vault statblocks by `StatblockRef` (entity ID plus statblock name).
- Maps: outlines are stored as fractions of the image (0..1), never pixels; the map records the
  pixel size they were drawn against. Maps and areas reference notes by entity ID and images by
  vault path. A map's parent is derived from area links, never stored (one parent per map). Map
  images are served by map ID through `map-image`, not `vault-asset`, and only ever to the DM.
  Map changes go through `editorReducer`; the image and sharing change only through their own
  actions. An area's `visibility` is `players` (seen once at least half revealed on a shared map)
  or `dm` (secret). Fog changes are `FogChange`s through `applyFogChange`, in the browser and on
  the server; undo sends `inverseOf`.
- Characters: every change is a `CharacterAction` through `applyAction`, the same in the browser
  and on the server, which applies it to what's stored now (never save a whole sheet). Set actions
  carry `from` (what the sender saw). New IDs are made by the sender and carried in the action.
  Who plays a character comes from its note's `player:` every time, never stored. Anyone who
  can't open a character gets the same 404 as for a missing one; others' characters are only
  ever a summary. Gifts change both bags in one `Characters.give`.
- Anything players read from a note's body must come from `forPlayers`, never `note.body`.
- Hidden content must be indistinguishable from missing content in player view (same 404, links
  become plain text, excluded from search and the tree).
- Signing in: who someone is comes from `accountContext` (DM, member or waiting), what they may
  see from `viewerContext`. DM-only pages check `viewer.role` (the DM previewing as a player sees
  the players' view); pages about the DM's own account, such as Members, check the account.
  Every form post must come from `PUBLIC_URL` (the Origin check); state-changing requests are
  POSTs, sign-out included. New public (signed-out) pages must be added to `access.ts`.
- Unit tests sit next to the code (`*.test.ts`); e2e specs in `tests/e2e/` use accessible
  locators (`getByRole`) and the helpers in `tests/e2e/support/app.ts`. E2E tests start signed in
  as the DM; use `SIGNED_IN.playerOne` or `SIGNED_OUT` (`tests/e2e/support/sign-in.ts`) for
  others. New behaviour gets a
  fixture note whose body states what it tests. Character specs share one party: add uniquely
  named items and never assert on a whole bag. See `docs/testing.md`.
- Prettier formats everything (print width 100). Keep comments short and about _why_.
