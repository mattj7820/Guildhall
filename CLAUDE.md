# Guildhall: notes for Claude

A personal D&D campaign hub (hobby project and public portfolio repo). The owner DMs an online
campaign for two players: Roll20 for maps, Discord for voice, and all notes in an Obsidian vault.
Guildhall links out to those tools and grows its own modules. The point of building it is
**interconnection**: eventually wiki, maps, characters, combat and dice all link through a shared
campaign model (NPCs, locations, maps, characters, sessions). See `docs/roadmap.md`.

Built so far: hub home page, read-only Obsidian wiki with a DM/player preview, a DM-only combat
tracker (the live fight is kept in the browser; prepared encounters in the data folder), and
DM-only interactive maps (vault images with outlined areas leading to deeper maps and notes; kept
in the data folder).

## Hard constraints

- **Never write to, move or delete anything in the vault.** Read-only access only. An ESLint rule
  bans fs write APIs (and namespace `fs` imports) in `app/` and `server/`; don't work around it.
  The single exception is `app/.server/data/json-store.ts`, which writes only inside `DATA_PATH`
  (config refuses a data folder that overlaps the vault). New persistent data goes through it.
- **Public repo:** never commit real vault content, personal file paths or secrets. Config lives in
  a gitignored `.env`; keep `.env.example` in sync when adding variables.
- **Tests use only the fixture vault** in `tests/fixtures/vault` (invented, minimal test data).
  Never point tests at a real vault.
- **No AI-generated story, lore or narrative content** anywhere in the app or fixtures. Writing
  the story is the owner's job. Fixture text stays functional ("Fixture: tests X"). AI for maps
  and images may come later.
- **Keep multiplayer possible, don't build it yet:** stable entity IDs, an explicit `Viewer` in
  every visibility decision, no single-user assumptions. No auth, database or real-time
  infrastructure until asked.

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
npm run check        # everything CI runs
```

First e2e run needs `npx playwright install chromium`.

## Architecture map

- `server.js`: HTTP entry (Vite middleware in dev, static and build in prod).
- `server/app.ts`: creates long-lived services once (config, `LiveVault`, `PreparedEncounters`,
  `CampaignMaps`)
  and passes them to React Router through `servicesContext`.
- `app/root.tsx`: middleware sets `viewerContext` from the view cookie (`app/.server/viewer.ts`).
  **Loaders read the viewer from context and pass it into every vault query.**
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
- `app/.server/vault/`:
  - `read-vault.ts`: the only reader of vault files. Skips dotfolders.
  - `parse-note.ts`: frontmatter → `Note`. Visibility fails closed to `dm`.
  - `link-resolver.ts`: Obsidian wikilink parsing and shortest-path resolution.
  - `comments.ts`: `%%comments%%` stripped for players, highlighted for the DM.
  - `remark-wikilinks.ts` + `render.ts`: markdown → sanitised HTML.
  - `search.ts`: MiniSearch, one index per role, built from role-appropriate text.
  - `statblock/`: parses ` ```statblock ` YAML (Fantasy Statblocks plugin format), including the
    numbers the tracker uses, and renders it book-style, after sanitising, with vault values
    inserted only as text nodes. `extract-statblocks.ts` finds them in a note. With
    `{ rollable: true }` (the combat catalogue only), `rolls.ts` finds attack bonuses, dice,
    saves, skills and recharges, which are rendered as `button.statblock-roll` with `data-roll*`
    attributes.
  - `vault.ts`: immutable snapshot (also `statblocks()`, `party()`, `noteById()`, `mapImages()`
    and `findImage()`, which finds a moved image by its unique file name). `live-vault.ts`
    rebuilds it on file changes.
- `app/.server/combat/catalogue.ts`: vault statblocks and PCs as browser-safe shapes, with
  statblocks pre-rendered. `prepared-encounters.ts`: the prepared-encounter repository.
- `app/.server/maps/`: `campaign-maps.ts` (the map repository over `maps.json`; tree rules checked
  inside the write), `view.ts` (`mapView`: a map for a `Viewer`, with hidden things left out), and
  `load.ts` (finds the image, versions its URL, renders linked notes).
- `app/.server/data/json-store.ts`: `JsonFile`, a validated, queued, atomically written JSON file.
- `app/wiki/`: URL helpers and types shared with the browser.
- `app/routes/`: `home`, `wiki` (layout + sidebar), `wiki-home` (landing page + `?q=` search),
  `wiki-note` (`/wiki/*`), `combat` (DM-only tracker; server `loader` + hydrating `clientLoader`;
  `?start=<id>` starts a prepared encounter), `combat-prepared` (list; create, duplicate and delete
  actions), `combat-prepared-edit` (editor; autosave action), `maps` (tree of maps; create action),
  `map-view` (`/maps/:id`, the table view), `map-edit` (editor; save, createChild, setImage and
  delete actions; `?area=` preselects an area), `map-image` (resource route: a map's image by map
  ID), `vault-asset` (resource route), `view-mode` (toggle action).
- `app/components/combat/`: the tracker's UI (`CombatTracker` lays it out), and the prepared
  encounter editor (`PreparedEditor`). `CombatantRow` and `AddCombatants` have a `"prep"` mode.
- `app/components/maps/`: `MapCanvas` (the SVG canvas), `MapViewer` and `MapEditor` (the two
  pages), `AreaShape`, `VertexHandles`, `DraftOutline`, `AreaForm`, `MapSettings`, `ImageHealth`,
  `ImagePicker`, `NotePicker`, `NotePanel`, `MapBreadcrumbs`. Shared control classes are in
  `app/components/styles.ts`.

## Conventions

- Vault paths are POSIX, vault-relative, with extension (`NPCs/Mira.md`). The slug drops `.md`.
  Note URLs come from `noteUrl()` in `app/wiki/urls.ts`.
- Server-only code lives under `app/.server/`. Browser code must not import from it (types
  included; put shared shapes in `app/wiki/`, `app/campaign/` or `app/combat/`).
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
  images are served by map ID through `map-image`, not `vault-asset`. Map changes go through
  `editorReducer`; the image changes only through its own action.
- Hidden content must be indistinguishable from missing content in player view (same 404, links
  become plain text, excluded from search and the tree).
- Unit tests sit next to the code (`*.test.ts`); e2e specs in `tests/e2e/` use accessible
  locators (`getByRole`) and the helpers in `tests/e2e/support/app.ts`. New behaviour gets a
  fixture note whose body states what it tests. See `docs/testing.md`.
- Prettier formats everything (print width 100). Keep comments short and about _why_.
