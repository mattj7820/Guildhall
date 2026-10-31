# Guildhall: notes for Claude

A personal D&D campaign hub (hobby project and portfolio piece, in a private GitHub repo). The
owner DMs an online campaign for two players: Roll20 for maps, Discord for voice, and all notes in
an Obsidian vault.
Guildhall links out to those tools and grows its own modules. The point of building it is
**interconnection**: eventually wiki, maps, characters, combat and dice all link through a shared
campaign model (NPCs, locations, maps, characters, sessions). See `docs/roadmap.md`.

Built so far: a front page with the campaign as it stands (where the party is, a fight, the next
session with a countdown, who's here now), read-only Obsidian wiki with a DM preview of the players'
view, a combat tracker (one fight for the table, kept in the data folder and pushed live; players
follow it and end their own turn; run beside a map, with monsters' tokens and quick damage for
picked monsters; fights started from tokens picked on the map, each monster the same marker all
through; prepared encounters, which can start on a map; every SRD monster from both the 2014 and
2024 SRDs beside the vault's statblocks), the DM's stunts and sounds on maps (played live for
everyone, only when the DM plays them), interactive maps (vault images with areas, shown as pins,
leading to deeper maps and notes; found on a Maps page with a preview of each; kept in the data
folder), fog of war and tokens on maps (the party's, NPCs from their notes and the DM's markers,
moved live over websockets and managed from the DM's Tokens tab; kept in the data folder), character
sheets with a game-style bag (players edit their own, the DM gives items; spells, slots, features'
uses, hit dice and rests tracked on them, spells picked from both SRDs and the DM's spell notes, and
prepared from a longer list; a player's sheet and bag beside the map; kept in the data folder), 3D
dice (every roll thrown across the roller's own screen, landing on the result already rolled, which
shows once they land; a switch in Settings, and dice sets the DM gives each member), sign-in with
Discord, where the DM lets players in and says who they play, and three themes (Storybook, Iron and
Ember, Gemlight), each person's pick saved on their account. It's built to be hosted: a Docker
image, with the vault copied read-only from Google Drive (see `docs/deployment.md`).

## Hard constraints

- **Guildhall never writes to, moves or deletes anything in the vault.** Read-only access only.
  An ESLint rule allows only fs's reading APIs in `app/`, `server/` and `server.js` (no writes,
  no default or namespace `fs` imports); don't work around it.
  The two exceptions are `app/.server/data/json-store.ts` and `app/.server/data/file-cache.ts`
  (generated files such as map tiles), which write only inside `DATA_PATH` (config refuses a data
  folder that overlaps the vault). New persistent data goes through the JSON store. sharp may only
  make buffers (`toFile` is banned too).
  The one way anything goes into the vault is the authoring skills (`/add-monster`, `/add-spell`,
  `/add-item`): Claude adding new notes on the DM's request, following `docs/vault-authoring.md`.
  They never edit, move or delete an existing note unless asked for exactly that, and the DM
  confirms first. Don't otherwise write to the vault.
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
  files, search or data requests, **including live messages**: websocket connections are signed
  in like pages, and every message is built for its viewer on the server. No database until asked.
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
npm run note:check -- <file> [monster|spell|item]   # what Guildhall makes of a note
npm run srd:note -- spell Fireball --srd 2024        # an SRD monster or spell as a vault note
npm run srd:import   # regenerate the SRD's monsters and spells from the pinned data (srd:check: CI's check)
```

Locally, `DEV_LOGIN=true` in `.env` gives one-click sign-in as the DM or a player (see
`.env.example`).

First e2e run needs `npx playwright install chromium`.

## Architecture map

- `server.js`: HTTP entry (Vite middleware in dev, static and build in prod), hands websocket
  upgrades to the app, and a clean shutdown on SIGTERM.
- `server/app.ts`: creates long-lived services once (config, `LiveVault`, `PreparedEncounters`,
  `CurrentFight`, `NextSession`, `CampaignMaps`, `MapFogs`, `MapTokens`, `Characters`, `Members`,
  sessions, Discord sign-in, and `Live`) and passes them to React Router through `servicesContext`;
  also the connection's address, for dev sign-in. Exports `handleUpgrade` for websockets.
  `server/http.ts`: trusting the proxy, security headers, `/healthz`.
- `app/root.tsx`: its middleware is `authMiddleware` (`app/.server/auth/middleware.ts`), which
  checks the Origin of posts, reads the session, decides access, and sets `accountContext` and
  `viewerContext`. **Loaders read the viewer from context and pass it into every vault query.**
- `app/.server/auth/`: `sessions.ts` (signed cookie session), `account.ts` (`resolveAccount`,
  `viewerFor`: pure), `access.ts` (who may reach which path: pure), `origin.ts`, `discord.ts`
  (OAuth adapter over `fetch`), `discord-sign-in.ts` (the attempt cookie, `checkCallback`),
  `dev-login.ts`, `identify.ts` (who a request is and what they may see: the one reader of the
  session, for pages and websockets). `app/.server/viewer.ts` is the DM's preview-as-player cookie.
- `app/.server/members/`: `members.ts` (repository over `members.json`: waiting list, approval,
  session keys), `players.ts` (`partyPlayers`). Shared shapes in `app/members/`.
- `app/campaign/`: shared model (isomorphic): `Viewer` (with optional `playerId`), `Player`,
  `Visibility`, `EntityId`, entity types, `canView`; `srd.ts` (`SRD_SOURCES`, `SRD_DOCUMENTS`,
  `SRD_RULES`: the bundled SRDs, for monsters and spells).
- `app/theme/`: `themes.ts` (`THEMES`, `THEME_INFO`, `isTheme`) and `modules.ts` (`moduleOf`: which
  part of the app a path is in, for `<body data-module>`). The themes themselves are CSS in
  `app/app.css`: named colours, fonts, and each theme's decoration on the `gh-*` hooks.
- `app/shared/`: small generic helpers used by several modules: `newId()`, `history.ts` (undo) and
  `name-search.ts` (`matchRank`, `byName`: the pickers' search).
- `app/dice/`: dice expressions (`parseDice`, `rollText`, `critical`), the `Rng` type (and
  `seededRng`, for what only has to look random), and the roll log (`rollInto`: labelled rolls,
  one-roll advantage, Critical) with its `useRollLog` hook (isomorphic). `sets.ts` (`DICE_SETS`,
  `DICE_SET_INFO`, `setsFor`, `chosenSet`) and `looks.ts` (`DiceLook`). `tray/`: 3D dice, loaded
  only in the browser when first thrown: `shapes.ts` (d4 to d20, `faceUp`), `plan.ts`
  (`planThrow`: the throw simulated with cannon-es, each die numbered to land on its roll; pure),
  `scene.ts` (`throwDice`: drawn with three.js) and `sound.ts` (`DiceSound`, Web Audio).
- `app/combat/`: the combat tracker's model (isomorphic): `types.ts`, `encounter.ts` (reducer,
  action creators, `perform`), `initiative.ts` (ordering, reroll tie-breaks), `turns.ts`, `hp.ts`,
  `visibility.ts` (`encounterForViewer`), `schema.ts` (zod),
  `storage.ts` (localStorage: only a fight left from before, to bring over), `statblocks.ts`
  (statblocks loaded when shown: `loadStatblock`, kept with their catalogue; `useStatblock`,
  `usePrefetchStatblocks`), `find-creatures.ts` (finding a monster: the search's order, Mine /
  2024 / 2014 tags, challenge rating and type), `prepared.ts`
  (`startPrepared`, `startPreparedOnMap`, `toPrepared`, `preparedStartUrl`, `summarise`), and the
  `useEncounter` hook. The shared fight: `fight.ts` (`Fight`, `fightForViewer`, `isTheirTurn`,
  `fightAllowsMove`), `fight-saver.ts` (`FightSaver`: whole-encounter saves after a revision,
  retries, taking up the server's newer fight), `useSharedFight` (the DM's tracker over it) and
  `usePlayerFight` (a player's view, and ending their turn).
- `app/maps/`: the interactive maps model (isomorphic): `types.ts` (`CampaignMap`, `Area`, and the
  browser-safe `MapView`), `schema.ts` (zod), `geometry.ts` (normalised outlines), `tree.ts`
  (parents derived from area links: breadcrumbs, attachable maps, `treeProblem`), `viewport.ts`
  (pan and zoom maths), `image-size.ts` (`sameShape`), `editor.ts` (the editor's reducer, with a
  draft outline that's never saved), `urls.ts`, and the `usePanZoom` and `useMapUpdates` (the
  map's version, pushed live, or polled while the connection is down) hooks.
- `app/maps/fog/`: fog of war (isomorphic): `types.ts` (`FogMask`, `FogChange`), `mask.ts` (the
  grid, run-length text form, cell ranges), `shapes.ts` (the cells a stroke or polygon covers),
  `changes.ts` (`applyFogChange`, `inverseOf`), `coverage.ts` (`areaRevealed`: at least half),
  `tiles.ts` (`cellAlpha`, `pixelAlpha`: a pixel in a hidden cell is always transparent; which
  tiles players may have, and their keys), `overview.ts` (`cellOverview`: the image one pixel per
  fog cell, for thumbnails; `maskOverview`, players' copy), `schema.ts` (zod for requests), `editor.ts`
  (`FogEditor`: the DM's changes shown at once, saved in batches, undone with inverses) and its
  `useFogEditor` hook.
- `app/maps/tokens/`: tokens (isomorphic): `types.ts` (`Token` is a party member by note, a DM
  marker (an NPC when it has a note; a picture, an icon; set aside; a monster's `statblock`, the
  `hp` it kept, and its `combatant` while in the fight), or (stored by earlier versions) a monster
  in the fight by its combatant; `TokenView` is one viewer's copy; `InsideBadge`, `Whereabouts`; `TokenTools`, the
  DM's Tokens tab's notes, tokens elsewhere and maps), `schema.ts` (zod), `actions.ts`
  (`TokenAction`, `applyTokenAction`), `permissions.ts` (`canMoveToken`, `mayApply`),
  `visibility.ts` (`tokensForViewer`: fog, markers, a player's own "in the dark", monsters from the
  fight, and who may move on their turn; `markerView`, a marker's name and picture), `naming.ts`
  (`numberedNames`), `picking.ts` (`tokensInBox`, the pick), `fight-markers.ts` (`monsterMarker`:
  a monster placed from the tracker), `icons.ts` (`tokenIcon`, `guessTokenIcon`), `token-icons.ts` (generated by
  `scripts/import-icons.mjs`), `moves.ts` (the browser's copy: its own drag and unanswered moves over
  the server's, and others' drags) and the `useMapTokens` hook.
- `app/maps/stunts.ts`: stunts (isomorphic): `Stunt`/`StuntEvent` (points and sizes as fractions of
  the map), `stuntEventSchema`, `stuntSeenBy` (anywhere, fog or not; a token's only if the viewer
  sees the token). `stunt-settings.ts`: each viewer's show/sound/volume, in their browser.
- `app/maps/grid/`: battle grids (isomorphic, pure): `grid.ts` (`MapGrid` in image fractions,
  `toPixels`, `suggestSquare`, `startingGrid`, `snapToGrid` by token size, `gridPath`),
  `distance.ts` (true lengths at 5 ft a square, `formatFeet`), `shapes.ts` (spell areas:
  `insideArea`, `coveredSquares` by the centre rule, `areaPath`, `caughtIn`).
- `app/live/`: the live connection (isomorphic): `messages.ts` (what each end sends; zod for the
  browser's; `FIGHT_ROOM`, the room for the fight; `PARTY_ROOM`, who's here), `client.ts`
  (`LiveClient`: one connection per tab, rooms, reconnecting), `throttle.ts` (20 drags a second) and
  `useLive.ts` (`useLiveMap`, `sendLive`).
- `app/characters/`: character sheets and bags (isomorphic): `types.ts` (`Character` is a
  `PlayerCharacter` with a `Sheet`, or a shared `Companion`; `InventoryItem`, `Purse`),
  `abilities.ts` (abilities, skills, `abilityModifier`, `signed`), `derive.ts` (`deriveSheet`: the
  paper sheet's maths, typed overrides win, spell DC and attack too; `spellNumbers`), `schema.ts`
  (zod, with defaults; `blankSheet`), `tracking.ts` (what gets used up: counters by `CounterRef`,
  `shortRest`, `longRest`, `restSummary`), `lists.ts` (`ListChange` for spells, attacks and
  features, with edits by field and `inverseListChange`), `spells.ts` (`castOptions`,
  `castActions`, `numbersFor`), `preparing.ts` (`alwaysReady`, `isReady`, `preparedCount`,
  `startsPrepared`, `prepareAction`), `spell-options.ts` (`SpellOption`, one spell in the picker;
  tags, keys, and `pickedSpell`: what picking one adds), `find-spells.ts` (`findSpells`,
  `spellClasses`), `spell-texts.ts` (`loadSpellOptions`, `loadSpellText`, `useSpellText`: loaded
  when wanted), `permissions.ts` (`characterAccess`: edit, summary or none;
  `canGive`), `inventory.ts` (move, stack, split, equip), `inventory-changes.ts`
  (`InventoryChange`, `giveItem`), `actions.ts`
  (`CharacterAction`, `applyAction`, request schemas), `undo.ts` (`inverseOf`, the undo stack),
  `sync.ts` (unsaved actions over the server's copy), `editor.ts` (`CharacterEditor`: an open
  sheet's saving, polling, undo and gifts) with its `useCharacterEditor` hook, `quick-add.ts`
  ("3 torches", icon guessing), `item-icons.ts` (generated by `scripts/import-icons.mjs`),
  `describe.ts` (notice wording), `view.ts` (shapes sent to the browser), `urls.ts`.
- `app/.server/characters/`: `characters.ts` (the repository over `characters.json`: apply
  actions, give, relink), `controllers.ts` (who plays a character, read from its note),
  `openable.ts` (the character if the viewer may open it, else 404), `load.ts` (`partyCards`,
  `characterPage`, `itemCatalogue`, `spellCatalogue`, `portraitPath`), `spell-catalogue.ts`
  (`spellOptions`: the SRD's spells and the viewer's spell notes for the picker; `spellText`;
  `sheetSpellTexts`, the text of a sheet's SRD spells, sent with it).
- `app/.server/vault/`:
  - `read-vault.ts`: the only reader of vault files. Skips dotfolders.
  - `parse-note.ts`: frontmatter → `Note`. Visibility fails closed to `dm`. A `type: spell`
    note's fields come from `spell-fields.ts` (the README's format, read leniently);
    `frontmatter.ts` holds the lenient readers.
  - `link-resolver.ts`: Obsidian wikilink parsing and shortest-path resolution.
  - `comments.ts`: `%%comments%%` stripped for players, highlighted for the DM.
  - `dm-parts.ts`: DM sections (a heading that is exactly "DM") and DM callouts (`> [!dm]`).
    `forPlayers(body)` is **the** player text: comments and DM parts removed. The page,
    search and statblocks for players all come from it. `remarkDmParts` boxes DM parts for
    the DM.
  - `remark-wikilinks.ts` + `render.ts`: markdown → sanitised HTML.
  - `search.ts`: MiniSearch, one index per role, built from role-appropriate text.
  - `statblock/`: parses ` ```statblock ` YAML (Fantasy Statblocks plugin format), or the same
    fields as data (`statblockFromData`, for the SRD), including the numbers the tracker uses and
    2024 statblocks' `initiative` and `gear`, and renders it book-style, after sanitising, with
    vault values inserted only as text nodes. `extract-statblocks.ts` finds them in a note. With
    `{ rollable: true }` (the combat catalogue only), `rolls.ts` finds attack bonuses, dice,
    saves, skills and recharges, which are rendered as `button.statblock-roll` with `data-roll*`
    attributes.
  - `vault.ts`: immutable snapshot (also `statblocks()`, `party()`, `noteById()`, `mapImages()`,
    `findImage()`, which finds a moved image by its unique file name, and `firstImage()`, a note's
    first image as a viewer sees it). `live-vault.ts` rebuilds it on file changes.
    `serve-image.ts` streams a vault image the caller has already allowed (maps, portraits);
    `stream-file.ts` streams any allowed vault file with byte ranges (attachments, sounds).
    `soundsIn(folder)` lists the sound board.
- `app/.server/combat/catalogue.ts`: the vault's statblocks and the SRD's monsters (with their
  size in squares, challenge rating and type), PCs and companions as browser-safe shapes, without
  the statblocks themselves; `statblockView` renders one when it's shown.
  `prepared-encounters.ts`: the prepared-encounter repository. `current-fight.ts`: `CurrentFight`, the fight over `fight.json`
  (saves after a revision, a player's end of turn, free movement, ending). `fight-view.ts`:
  `fightView`, the fight for one viewer with party hit points from their sheets.
- `app/.server/maps/`: `campaign-maps.ts` (the map repository over `maps.json`; tree rules checked
  inside the write; sharing), `map-fogs.ts` (each map's fog over `fog.json`),
  `player-image.ts` (`PlayerImages`: cuts an image into tiles with sharp, and masks the partly
  revealed ones from exact copies; makes thumbnails from the overview, masked for players: the
  only way players get a map's pixels), `maps-page.ts` (`listMaps`: the Maps page's maps as a
  viewer may see them, with thumbnails and pins; `facesByMap`), `view.ts` (`mapView`: a map for a
  `Viewer`, with hidden things and fogged areas left out), and `load.ts` (finds the image,
  versions its URL, renders linked notes, reads the fog; `prepareThumbnails`, at start and when
  the vault changes).
- `app/.server/maps/`, for tokens: `map-tokens.ts` (the repository over `tokens.json`, applying only
  allowed actions; `removeCombatants` when monsters leave the fight), `tokens.ts` (`loadMapTokens`:
  a viewer's tokens and who's inside which area; `whereabouts`; `partyPlacements`, the DM's party
  panel; `notePicture` and `picturesIn`, NPCs' pictures by token; `tokensElsewhere` and
  `tokenTools`, the DM's Tokens tab), `travel.ts` (`travelWays`: where a player may take their
  token from a map; `fightStopsTravel`, `travelLanding`).
- `app/.server/live/`: websockets. `sockets.ts` (`LiveSockets`: signs an upgrade in with
  `identify`, and a strict Origin check), `hub.ts` (`LiveHub`: connections, rooms per map,
  `publish` building each viewer's copy, not repeating a state, limits, pings, rechecking members,
  `online`: who has a connection open),
  `map-rooms.ts` (a map's state and tokens for one viewer), `holds.ts` (who's moving which token),
  `live.ts` (`Live`, in the services: `mapChanged`, `memberChanged`, `fightChanged`, `stunt`,
  `online`, drags; tells the party room when someone comes or goes).
- `app/.server/srd/`: the SRD's monsters and spells, generated by `scripts/import-srd.ts` (with
  `scripts/srd/convert.ts` and `scripts/srd/spells.ts`, the pure conversions) and never edited by
  hand: `monsters-5.1.json`, `monsters-5.2.json`, `spells-5.1.json`, `spells-5.2.json`,
  `NOTICE.md` (the licences), `monsters.ts` (`srdMonsters`, parsed once; `srdStatblockView`,
  rendered once), `spells.ts` (`srdSpells`, as picker options; `srdSpellText`, rendered once) and
  `vault-notes.ts` (`lookUp`: an SRD monster or spell as a vault note, for the authoring skills).
- Authoring skills' scripts: `scripts/check-note.ts` (over `app/.server/vault/check-note.ts`:
  what Guildhall makes of a note, and what it would drop) and `scripts/srd-lookup.ts`, both loading
  app modules through Vite (`scripts/app-module.ts`).
- `app/.server/data/json-store.ts`: `JsonFile`, a validated, queued, atomically written JSON file.
  `file-cache.ts`: `FileCache`, disposable generated files in `DATA_PATH/cache`, one folder per key
  and version, made one set at a time. `when-free.ts`: retries a read or rename while Windows holds
  the file.
- `app/.server/read-json.ts`: `readJson(request, schema)`, a JSON body checked with zod (a body
  that isn't JSON fails the check: a 400, never a 500). `app/.server/not-found.ts`: `notFound()`
  and `requireDm(viewer)`, the one 404 for missing and not-yours alike.
- `app/wiki/`: URL helpers and types shared with the browser.
- `app/home/`: the front page (isomorphic): `front-page.ts` (`FrontPage`, `bannerMap`: the map
  where the party is for one viewer, `fightSummary`, `latestSession`) and `countdown.ts`.
  `app/.server/home/`: `front-page.ts` (`frontPage`, the page for a viewer), `next-session.ts`
  (`NextSession`, over `next-session.json`) and `presence.ts` (`presenceFor`: who's here, by
  party-card names). `app/components/home/`: `FrontPage`, `BannerMap`, `NextSession`,
  `PartyStrip`, `HubIcon`.
- `app/routes/`: `home` (the front page; the DM sets the next session), `wiki` (layout + sidebar),
  `wiki-home` (landing page + `?q=` search), `wiki-note` (`/wiki/*`), `combat` (the DM's tracker, or
  a player's view of the fight; a hydrating `clientLoader` adds a fight left in the browser from
  before; `?start=<id>` starts a prepared encounter), `combat-fight` (JSON: GET the fight as the
  viewer may see it; POST the DM's saves, free movement and ending, and a player's end of turn),
  `combat-statblock` (JSON: one statblock for the DM, by key), `combat-prepared` (list; create,
  duplicate and delete actions), `combat-prepared-edit` (editor; autosave action), `maps` (the
  nested list of maps with a preview: every map for the DM, only shared ones for players; create
  action), `map-view` (`/maps/:id`: the table view for the DM, with Combat and `?start=<id>` for a
  prepared fight there; the fogged view for players, with the fight's turn strip), `map-edit`
  (editor; save, createChild, setImage, setVisibility and delete actions; `?area=` preselects an
  area), `map-fog` (JSON: the DM's fog changes), `map-tile` (resource route: one tile of a map's
  image as players may see it), `map-thumbnail` (resource route: a map's thumbnail, the DM's whole
  or players' masked), `map-version` (JSON: what an open player map polls while its live connection
  is down: the version and its tokens), `map-tokens` (JSON: POST token actions), `map-travel` (JSON:
  a player takes their token to another map), `map-token-picture` (resource route: an NPC token's
  picture, only to those who may see the token), `map-stunts` (JSON: the DM plays a stunt or sound),
  `sound` (resource route: audio from the sounds folder only, for anyone signed in), `map-image`
  (resource route: a map's image by map ID), `vault-asset` (resource route), `view-mode` (the DM's
  preview toggle), `login` (sign-in page; dev sign-in action), `logout` (POST), `auth-discord`
  (starts Discord sign-in) and `auth-discord-callback`, `waiting` (for newcomers), `members`
  (DM-only: approve, assign, remove), `settings` (each member's own: their theme), `characters` (the
  party; start, relink and delete actions), `character` (`/characters/:id`, a sheet or companion),
  `character-changes` (JSON: GET the stored character, POST a batch of actions),
  `character-sheet-data` (JSON: a sheet's page data, for opening it beside the map),
  `character-give` (JSON: a gift to another bag), `character-portrait` (resource route), `spells`
  (JSON: every spell the viewer may pick, for the picker when it opens), `spell-text` (JSON: one
  spell's text as the viewer may read it), `credits` (icon and SRD credits).
- `app/components/dice/`: `useDiceTray` (a roller's dice: throws each roll and holds it back from
  what's shown until they land; the tray to place), `useDicePreferences` (on or off and the set,
  from the root loader) and `looks.ts` (`themeLook`, `setLook`: resolved in the browser).
- `app/components/combat/`: the tracker's UI (`CombatTracker` lays it out), and the prepared
  encounter editor (`PreparedEditor`). `TurnStrip` (the turn order as round faces, over a map or
  in a page), `PlayerFight` (a player's Combat page, and `EndMyTurn`), `FightStatus` (saving,
  offline, replaced). `CombatantRow` and `AddCombatants` have a `"prep"` mode; `AddCombatants`
  opens with `MonsterPicker` (search, tags and filters, + on each row). `StatblockPanel` loads the
  statblock it shows.
- `app/components/characters/`: `CharacterSheet` (the layout, edit mode, click-to-roll and the
  docked bag; its parts are `SheetHeader`, `SheetSections` and `SheetTabs`, built by
  `useSheetParts`), `CompanionSheet`, `PartyCard`, `SheetBag` (a bag saved through the editor),
  `EditorBar`, `HitPointsPanel`, `Fields`, `SheetParts`, `Portrait`. What gets used up: `Trackers`
  (slots, uses, hit dice and concentration at a glance; their maximums while editing), `Pips`,
  `Rests` (Short and Long rest), and the tabs `ActionsTab` (attacks, then features by how they're
  used), `SpellsTab` (by level, Cast; only what's ready day to day, Prepare mode, editing as rows
  that open one at a time, a feat's free spell with its uses, and Add spells opening
  `SpellPicker`, whose `SpellTextBox` also shows a linked spell's SRD text) and `FeaturesTab`
  (a feature with uses can choose its free spell), with `FilterChips` and `SheetLists`.
  `CharacterPanel` is a character beside the map: a compact sheet, the companion, or the bag.
  `app/components/inventory/`: `Bag`, `InventoryBoard` (the drag-and-drop grid; the drag's state
  and rules are `useInventoryDrag`, its other drop targets `DropZones`, with `SortableTile`,
  `keyboard.ts` and `drag-ids.ts`), `ItemTile`, `ItemTooltip`, `ItemDetails`, `QuickAdd`, `Purse`,
  `UndoToast`.
- `app/components/maps/`: `MapCanvas` (the SVG canvas; `focus` centres it), `MapViewer` and
  `MapEditor` (the two pages; the viewer's bar is `MapViewerBar`, placing tokens
  `useTokenPlacing`, its smaller parts `MapViewerParts`, and `ClickCatcher` takes the next click on
  the map), `AreaShape` (an area as a pin, its outline and name on hover, focus or Places; the
  first tap on touch), `Places` (`usePlaces`: the Places switch and P, the list's highlight),
  `MapsBrowser` (the Maps page's list and preview), `VertexHandles`, `DraftOutline`, `AreaForm`,
  `MapSettings`, `ImageHealth`, `ImagePicker`, `NotePicker`, `NotePanel`, `MapBreadcrumbs`, and for
  fog of war `FogLayer` (the fog drawn from the cell opacities), `FogPainter` (brush, rectangle and
  area tools), `FogToolbar`, `FogAreaList` (what players see of each area) and `useFogTools` (tool
  state and keys). `PlayerMapViewer` is a map as players see it: tiles over black, and outlines
  drawn only over what's revealed; its side panel is `MapSidePanel` (Map, Sheet and Bag tabs, the
  sheet fetched when it's opened); the DM's is `DmSidePanel` (Map, Tokens, and Fight while it's
  open; fog takes it over), both built on `SidePanel` and `rememberedPanel`. For tokens:
  `TokenLayer` (drawn over the fog, dragged, moved by keys; filling and snapping to squares on a
  battle map; portraits, pictures and icons), `TokensTab` (the DM's: the party in `PartyTokens`,
  NPCs and markers on this map with Shown / DM only, set aside and elsewhere, `AddTokenForm`,
  `TokenSettings` for the chosen token (with a monster's statblock and kept HP), `TokenLook` for a
  picture and colour, `TokenThumb` for a face in a list, `MonsterField` for a statblock, `PickBox`),
  `useTokenPick` (the DM's pick: Shift-click, a Shift-drag box) and `FightPickBar` (starting a
  fight with it), `PlacingHint` (what the next click places), `Travel` (a player's Go in and Back to buttons), `InsideBadges`, `TokenDistances`. For battle maps: `GridLayer`, `GridSettings` (the editor's
  section), and `useBattleTools` (the toolbar over the map and what its tools draw, for the DM and
  players alike), built from `MapToolbar`, `useMapTools` (which tool, the ruler and spell area,
  shortcuts), `MeasureLayer`, `SpellAreaLayer` and `SpellAreaOptions`. `MapSwitch` is a setting
  changed from the map's page (sharing, snapping). For the fight: `useMapFight` (Combat on the map
  page: the tracker panel, what's drawn over the map, placing monsters, starting a prepared fight
  there) and `EndFight`. `Stunts.tsx`: `useStunts` (what's playing, from the live connection or the
  DM's own clicks), `useStuntPicker` and `StuntPalette` (the DM's), `StuntLayer`, `FlashOverlay`,
  `StuntSettingsMenu` (each viewer's). `TokenLayer` plays a token's stunt.
  `app/components/combat/MonsterDamage.tsx`: damage, half or heal for monsters picked on the map.
  `app/components/LiveStatus.tsx` says whether a page is live. Shared control classes are in
  `app/components/styles.ts`.

## Conventions

- Vault paths are POSIX, vault-relative, with extension (`NPCs/Mira.md`). The slug drops `.md`.
  Note URLs come from `noteUrl()` in `app/wiki/urls.ts`.
- Server-only code lives under `app/.server/`. Browser code must not import from it (types
  included; put shared shapes in `app/wiki/`, `app/campaign/`, `app/combat/`, `app/maps/` or
  `app/members/`).
- Frontmatter: `visibility` (`players`|`dm`, default `dm`), `type`, `aliases`, `tags`, `id`, and
  `player` on `type: pc` notes (who plays the character). `type: spell` notes may give the spell's
  fields (level, classes, casting time…; the README's "Spell notes").
- Dice: the `Rng` decides every result; 3D dice only show it (`planThrow` numbers them after the
  simulation), with their motion from `seededRng`, never the roll's `Rng`. Anything showing a roll
  reads the log from `useDiceTray`, so it waits for the dice. Dice are drawn only on the roller's
  own screen; nothing about them is sent. Sets are the app's, given per member (`dice.given` in
  `members.json`), never stored in bags.
- Combat: every encounter change is an `EncounterAction` through the pure `encounterReducer`.
  Dice are rolled in action creators (or `perform`) and carried in the action. All randomness goes
  through an injected `Rng`; never call `Math.random` directly. IDs come from `newId()`
  (`app/shared/ids.ts`).
  Combatants reference statblocks by `StatblockRef`: a vault note's entity ID plus the
  statblock's name, or with `source` ("srd-5.1", "srd-5.2") an SRD monster's ID; refs without a
  source are the vault's (everything stored before the SRD). Pages carry the catalogue without
  statblocks; a statblock is loaded when shown (`combat-statblock`), never sent with a page. The
  SRD's data (monsters and spells) changes only by re-running `npm run srd:import` (pinned sources;
  never hand-edited, and its text is never rewritten), and its notices stay on Credits.
- Maps: outlines are stored as fractions of the image (0..1), never pixels; the map records the
  pixel size they were drawn against. Maps and areas reference notes by entity ID and images by
  vault path. A map's parent is derived from area links, never stored (one parent per map). Map
  images are served by map ID through `map-image`, not `vault-asset`, and only ever to the DM;
  players' pixels come only from `PlayerImages` (tiles and thumbnails, masked by the fog now).
  Map changes go through `editorReducer`; the image and sharing change only through their own
  actions. An area's `visibility` is `players` (seen once at least half revealed on a shared map)
  or `dm` (secret). A battle grid is also in fractions (a square's side as a fraction of the
  width), saved with the editor; snapping is its own switch (`setSnapping`), and happens in the
  browser. Fog changes are `FogChange`s through `applyFogChange`, in the browser and on
  the server; undo sends `inverseOf`.
- Tokens: every change is a `TokenAction` through `applyTokenAction`, POSTed to
  `/maps/:id/tokens` and applied to what's stored (never a whole list). A party member is in one
  place (a map and a point); who may move them comes from their note every time. Players move
  only their own PC and the shared companion, about the map they're on. Players' token data comes
  only from `tokensForViewer`, never the stored tokens; party members' notes are DM-only data.
  An NPC is a marker with a note: its name is its own (never read from the note), its picture is
  served by the token through `map-token-picture`, never by path or note, and players get exactly
  what the DM sees on a shown token and nothing of its note. A marker set aside is on no map: sent
  to no one, listed for the DM. Only the DM moves a token between maps with a token action, or brings one here (a
  move naming this map); players take their own between maps only through `map-travel`, along the
  ways `travelWays` gives them (decision 81).
- The fight: one at a time, in `fight.json`. The DM's tracker saves the whole encounter with the
  revision it last had (a stale save gets the newer fight back, to take up); players only end
  their own turn, checked on the server. Everyone's copy comes from `fightView`, never the stored
  fight; a hidden monster is absent for players. A monster on the map is a marker linked to its
  combatant (`joinFight`), keeping its own name (the combatant takes it) and look; while it's in
  the fight, its hiding and HP come from the fight each time it's sent, and showing or hiding it
  is the monster's hiding. Leaving the fight it stays a marker with its HP (unless the DM clears
  the monsters), on the server (`removeCombatants`). A fight from tokens saves the links first. Who may move in a fight is `fightAllowsMove`, everywhere a move is decided. Tell
  `Live` when it changes (`fightChanged`, also after a sheet change, for party HP).
- Stunts: only ever played by the DM, never automatically (decision 55); sent through
  `Live.stunt`, built per viewer with `stuntSeenBy`; nothing kept. Sounds only from
  `config.soundsFolder`, through the `sound` route. Don't make Guildhall read PCs' sheets to
  resolve rolls or change them: players' characters are theirs.
- Live messages: the only way to send is `LiveHub.publish(map, viewer => message)` (or `reply`
  for one connection, built for its viewer); never send one message to a room. Anything on a map
  goes through `Live.publishOnMap`, which checks the viewer may see the map. State messages (a
  map's version, its tokens) aren't repeated, so a change a viewer can't see sends them nothing.
  What browsers send is checked with zod and like the matching page request (drags like moves);
  saved changes go through the usual endpoints. Tell `Live` when something changes
  (`mapChanged`, `memberChanged`).
- Characters: every change is a `CharacterAction` through `applyAction`, the same in the browser
  and on the server, which applies it to what's stored now (never save a whole sheet). Set actions
  carry `from` (what the sender saw). New IDs are made by the sender and carried in the action.
  Who plays a character comes from its note's `player:` every time, never stored. Anyone who
  can't open a character gets the same 404 as for a missing one; others' characters are only
  ever a summary. Gifts change both bags in one `Characters.give`. Ticking something off is a
  relative `count` (so two tabs' ticks add up); a feature's uses are edited by their maximum and
  reset, never how many are used. A rest is one action. Casting only ticks off what's spent;
  rolling is its own click. Preparing is a `prepared` field edit of one spell; cantrips and free
  spells are always ready (worked out in `preparing.ts`, never stored), and nothing checks a cast
  against what's prepared. A spell picked from the SRD is an ordinary spell (`pickedSpell`), the
  player's copy, with `srd` linking the SRD's text, which is shown from the data and never copied
  onto the sheet; the picker's list and texts are loaded when wanted (`/spells`), never sent with a
  page, and players get only spell notes they may read. New stored fields get defaults and stored data is never refused
  (clamp or `catch` instead): sheets are live data.
- Anything players read from a note's body must come from `forPlayers`, never `note.body`.
- Hidden content must be indistinguishable from missing content in player view (same 404, links
  become plain text, excluded from search and the tree).
- Signing in: who someone is comes from `accountContext` (DM, member or waiting), what they may
  see from `viewerContext`. DM-only pages and actions call `requireDm(viewer)` (the DM previewing
  as a player sees the players' view), and anything missing or not the viewer's is `notFound()`; pages about the DM's own account, such as Members, check the account.
  Every form post must come from `PUBLIC_URL` (the Origin check); state-changing requests are
  POSTs, sign-out included. New public (signed-out) pages must be added to `access.ts`. JSON
  bodies are read with `readJson` and a zod schema, never cast.
- Unit tests sit next to the code (`*.test.ts`); e2e specs in `tests/e2e/` import `test` from
  `tests/e2e/support/fixtures.ts` and work through page objects (`tests/e2e/pages/`, accessible
  locators), `openAs` for other people's browsers and `api` for setting up through endpoints.
  Page objects' `goto`/`reload` wait for `<html data-hydrated>`; never `waitForTimeout`, always
  wait for a visible result. E2E tests start signed in as the DM; use `SIGNED_IN.playerOne`,
  `playerTwo` or `SIGNED_OUT` (`tests/e2e/support/sign-in.ts`) for others. New behaviour gets a
  fixture note whose body states what it tests. Character specs share one party: add uniquely
  named items and never assert on a whole bag. Only `map-tokens.spec.ts` places party members (in
  order, since each is in one place). Rests give back everything on a sheet, so only
  `sheet-tracking.spec.ts` changes Fixture PC Two's sheet (as Player Two), and the specs on PC One
  never rest. Specs that add spells to PC One are gathered in `spells.spec.ts`, which runs them in
  order (preparing counts its prepared spells). See `docs/testing.md`.
- Themes: components use the named colours (`bg-surface`, `text-ink`, `text-muted`, `border-line`,
  `bg-accent`, `text-link`, `text-danger`, `bg-dm-surface`, `text-module`, …; see `@theme` in
  `app/app.css`), never raw palette classes (a lint error in `app/`). White or black with an
  opacity (`bg-white/10`) is fine over the top bar or map art. Content drawn over maps (fog, grids,
  outlines, tokens, measuring, spell areas, stunts) and the turn strip's faces keep fixed colours;
  their files are listed in `eslint.config.js`. A theme's decoration goes in `app/app.css` on the
  `gh-*` hooks (with the `storybook`, `ember` and `gem` variants), never in components. `dark:`
  still works and means a dark theme, but a named colour is almost always better. Note text uses
  `prose prose-theme`.
- Prettier formats everything (print width 100). Keep comments short and about _why_.
