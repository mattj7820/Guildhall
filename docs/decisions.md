# Decision log

Short records of significant decisions and why they were made. Newest last. If a decision is
reversed, add a new entry rather than editing the old one.

## 1. Stack: React Router 8 (framework mode) on Express, TypeScript

**Date:** 2026-09-26

**Context.** The app needs a server that reads a local folder, a sensible path to real-time
multiplayer and hosting, good testability, and a React-friendly ecosystem for future map and
tabletop work.

**Options considered.**

- **Next.js (App Router):** best known, but its happy path is serverless hosting, which can't
  hold a vault folder or long-lived websockets. Real-time would likely need a second service, and
  server components are awkward to unit test.
- **SvelteKit + adapter-node:** little code and a nice developer experience, but a smaller
  ecosystem for canvas/map libraries.
- **React Router framework mode + Express (chosen):** one long-lived Node process serves SSR
  pages, reads the vault, and can later host websockets (Socket.IO or `ws` on the same Express
  server). A small table's game state can live in memory there. Loaders are plain async
  functions, so they're easy to test. It hosts anywhere Node runs (Fly.io, Railway, a VPS, a
  home server).

**Note.** The plan said React Router 7; v8 was current at build time and keeps the same
framework-mode architecture. v8 needs Node ≥ 22.22.

## 2. Markdown: unified/remark/rehype with a custom wikilink plugin

Obsidian syntax (`[[links]]`, aliases, heading links, `![[embeds]]`, shortest-path resolution) is
the core domain logic, and existing plugins only cover parts of it. A small in-house remark plugin
plus a separate link resolver keeps those rules explicit and unit-tested. Raw HTML in notes is
allowed but sanitised with `rehype-sanitize`, with only the app's own class names allowed.

## 3. Visibility defaults to DM-only (fail closed)

Notes are visible to players only with `visibility: players`. Missing, misspelt or unparseable
frontmatter means DM-only. Forgetting to tag a note hides it rather than leaking it. The player
view hides DM-only notes from the sidebar, search, links (rendered as plain text) and direct URLs
(a 404 identical to a missing note). Attachments are served to players only if a player-visible
note uses them.

## 4. `%%comments%%` are DM secrets

Obsidian comments are stripped from the player view before parsing and before search indexing,
so they can't leak through search. The DM view shows them highlighted as "DM note". This lets the
DM keep secrets inline in otherwise shared notes. An unclosed `%%` hides the rest of the note,
as in Obsidian.

## 5. The DM/player toggle is a preview, not security

A cookie picks the view. Anyone could flip it, and the UI says so. Visibility decisions all take
an explicit `Viewer` (set once per request by root middleware), so real authentication can
replace the cookie later without touching the wiki logic.

## 6. Stable IDs: frontmatter `id`, falling back to the path

The app can't write to the vault, so it can't stamp IDs into notes. An entity's ID is its
frontmatter `id` if present, otherwise its vault path without `.md`. URLs use the path. Future
modules (map pins, combatants) should reference notes by ID, so the DM can pin an `id` before
renaming a file.

## 7. In-memory vault index, rebuilt on change

The whole vault is read into an immutable in-memory snapshot (notes, link resolver, rendered-HTML
cache, per-role search indexes). A file watcher rebuilds it after edits (debounced), and the old
snapshot keeps serving until the new one is ready. Campaign vaults are small, so this is simpler
and faster than a database. There's no database in this slice.

## 8. Entity `type` in frontmatter, open-ended

`type: npc | location | …` is read now and shown as a badge. It's the seed of the shared campaign
model. Any string is accepted (the vault is never "wrong"); `KNOWN_ENTITY_TYPES` lists the
conventional ones future modules will give behaviour to.

## 9. Testing: Vitest + Playwright with a fixture vault

Vitest for units (fast, native TypeScript/ESM), and Playwright for end-to-end runs against the
production build. All tests use an invented fixture vault, never a real one, and the e2e run
fails if the vault is modified. See [testing.md](testing.md).

## 10. Node 26 for development and CI

**Date:** 2026-09-26

Local development moved to Node 26 (the newest release; it becomes LTS in October 2026), so
`.nvmrc` and `engines` were raised to 26 to keep CI on the same version as development. This
supersedes the Node 22 baseline in decision 1.

## 11. Statblocks: render the Fantasy Statblocks plugin's YAML

**Date:** 2026-09-26

The vault already holds monster statblocks as ` ```statblock ` YAML from the Obsidian Fantasy
Statblocks plugin, so Guildhall reads that format as-is rather than inventing its own: notes keep
working in Obsidian, and nothing needs migrating. The YAML is parsed into a typed `Statblock` (the
start of a creature model that a future combat tracker can reuse) and rendered in the 5e book
layout. The markup is generated after sanitising, with every vault value inserted as a text node.
Bestiary references (`monster: Goblin`) can't be resolved outside the plugin, so they show a
notice asking for the full statblock. A statblock that can't be read shows a short explanation
and the original block, rather than failing the page.

## 12. Audio embeds play inline, served with range support

**Date:** 2026-09-26

NPC voice memos from Obsidian's audio recorder are embedded as `![[Voice.m4a]]`. Audio embeds
render as a native `<audio controls>` player with a download link inside as a fallback, and
`<audio>` is added to the sanitiser's allowlist. The asset route serves the right audio
Content-Type and answers HTTP `Range` requests (206), which browsers use to stream and seek
media. Audio follows the same visibility rule as images: players can load it only if a note they
can see embeds it.

## 13. Combat encounters live in the browser, behind a pure reducer

**Date:** 2026-09-26

**Context.** The combat tracker's encounter must survive a page reload, the vault can't be written
to, and this slice has no database or real-time infrastructure. A future player view will need the
same encounter shared live.

**Options considered.**

- **Browser localStorage (chosen):** instant updates, survives reloads and server restarts, and
  needs no server state or exception to the no-fs-writes lint rule. Tied to one browser.
- **Server memory store:** closest to the eventual shared design, but every click is a round trip,
  and a server restart loses the fight.
- **Server store plus a JSON file outside the vault:** survives restarts, but needs a carve-out in
  the read-only lint rule and a guard that the file can't be inside the vault. Too much for now.

**Decision.** Every change is a plain, serialisable action applied by `encounterReducer`. Action
creators roll the dice and put the results in the action, so the reducer is pure. `perform()`
adds automatic monster rerolls for ties, as further recorded actions. The page keeps the encounter
in memory with an undo history (not persisted), saves it to localStorage after each change, and
validates it with zod when loading, so bad data is reported rather than crashing the page.

**Path to sharing.** An `EncounterStore` among the server's long-lived services runs the same
reducer; the DM page sends actions; a websocket on the same Express server pushes
`encounterForViewer(encounter, viewer)` to each connection; and the server rolls, which also allows
hidden DM rolls. localStorage then becomes a cache or goes away.

## 14. Who controls a combatant: PC notes' `player`, and `Viewer.playerId`

**Date:** 2026-09-26

Player characters are vault notes with `type: pc`, and a new `player` frontmatter field names the
person who plays them. `playerFromName` turns that into a `Player` with a case- and
spacing-insensitive ID. Player-controlled combatants record their controller. Companions (like a
shared blink dog) are assigned to a player per battle, and may link to their statblock. `Viewer`
gains an optional `playerId`. `canSeeCombatantDetails` follows `canView`: the DM sees everything,
and a player sees conditions and notes only for combatants they control. `encounterForViewer` gives
players the turn order (names and whose turn it is), their own combatants' details, and nothing
while the DM is still setting up. No page uses it yet; the tracker is DM-only.

## 15. Initiative ties are broken by rerolling

**Date:** 2026-09-26

A table rule rather than the rulebook's: tied combatants each reroll a d20, highest first, and any
still level reroll again until they differ (three-way ties included). Monsters reroll
automatically; for a player combatant the DM types in their reroll, and combat can't start until
it's in. Rerolls are stored per combatant (`tiebreaks`) and compared in order, so a combatant who
joins a tie that's already been settled just rolls against the rerolls on record. Mid-fight, a
newcomer is placed without reshuffling anyone else, so the DM's manual reordering survives.
Automatic rerolls stop after 10 identical rounds, a guard against a broken random source.

Other table-flow choices from the same slice: monsters at 0 HP stay in the order but are skipped;
player combatants never are (players track their own HP and death saves). Monster HP is rolled from
the statblock's hit dice. Temporary HP absorbs damage first and doesn't stack.

## 16. Dice: an isomorphic module with an injected random source

**Date:** 2026-09-26

`app/dice` parses expressions such as `2d6+3` (including the Fantasy Statblocks plugin's
`5d6 + -1` hit dice) and rolls them, with advantage and disadvantage on d20s. All randomness goes
through an `Rng`, a function that rolls one die (`(sides) => face`), so unit tests script exact
faces with `sequenceRng`. The real `Rng` reads `Math.random` when called. End-to-end tests replace
`Math.random` inside the loaded page just before an action that rolls. An init script wouldn't do:
React and React Router also call `Math.random` while starting up and navigating, and would use up
the scripted values. So no test hooks are needed in app code. IDs use `crypto.getRandomValues`,
never `Math.random`, and not `randomUUID`, which browsers only offer on HTTPS or localhost.

## 17. Statblocks reach the browser as a pre-rendered catalogue

**Date:** 2026-09-26

The statblock parser stays server-only. The vault lists every readable statblock (per role, with
`%%comments%%` stripped for players, like search), and `combatCatalogue` turns them into
browser-safe `CreatureOption`s: a stable reference (the note's entity ID plus the statblock's
name), the numbers the tracker needs (AC, average HP, rollable hit dice, DEX modifier), and the
statblock rendered to HTML by the wiki's own renderer. When a monster joins an encounter its
numbers are copied into it, so editing the note mid-fight can't change a live fight. The panel
still shows the current statblock. Sending every statblock with the page suits a campaign vault;
if that grows large, a per-statblock resource route can replace it.

## 18. Guildhall's own data lives in a JSON file in a data folder

**Date:** 2026-09-27

**Context.** Prepared combat encounters must survive browser reloads and server restarts, and
must be editable in the app. The vault can't be written to, so the app needs storage of its own.

**Options considered.**

- **JSON file on the server (chosen):** human-readable, backed up by copying one file, no new
  dependency, and a first step towards server-held state for a future shared player view.
- **Browser localStorage:** smallest change, but tied to one browser profile, and lost when site
  data is cleared, which is too fragile for prep work.
- **Obsidian `encounter` blocks (the Initiative Tracker plugin's format):** keeps the vault as the
  only source of truth, but then editing and deleting happen in Obsidian, not the app.
- **SQLite (`node:sqlite`):** robust, but a database with a schema and migrations, which is too
  much for a handful of records.

**Decision.** `DATA_PATH` (default `./data`, gitignored) holds Guildhall's own data. Config refuses
to start if it overlaps the vault in either direction, case-insensitively on Windows.
`app/.server/data/json-store.ts` is the only module exempt from the no-fs-writes lint rule. It
validates the file with zod on every read (read fresh each time, so the file stays the single
source of truth), queues updates so they can't interleave, writes atomically (a temp file, then a
rename, retried on Windows), and never overwrites a file it can't read. It reports the problem
instead. Decision 13's live fight stays in the browser for now.

## 19. Prepared encounters are templates; HP is rolled when prepared, initiative when started

**Date:** 2026-09-27

A prepared encounter is a name, notes, timestamps and an ordinary setup-phase `Encounter`, so the
reducer, schema and tracker components are reused. The schema rejects one that has started.

- **When dice roll:** monster HP is rolled when monsters are added during prep, so the DM can see
  it and tweak or reroll it. Initiative is rolled when the fight starts.
- **Who's playing:** the party isn't stored. The start panel lists every PC (all ticked) so absent
  players can be unticked. Companions can be pre-assigned to a player in the prepared encounter.
- **Templates:** starting copies the encounter with fresh IDs, and the prepared one is unchanged
  apart from "last run", so it can be run again or duplicated for a variant.
- **Replacing a fight:** starting goes through the tracker's undo history, so a fight already in
  the tracker can be brought back with Undo.
- **Saving:** the editor autosaves the whole encounter shortly after each change, and on blur and
  before leaving by its own links, with a visible saved status. The browser warns before closing
  the tab with a save pending.
- **Save as prepared:** a fight set up in the tracker can be kept this way, minus the party and
  rolls.

## 20. Click-to-roll: rolls marked up on the server, handled in the tracker only

**Date:** 2026-09-27

Statblock rolls (attack bonuses, dice, ability checks, saving throws, skills and recharges) are
found when the statblock is rendered: a small tokenizer keeps every character of the text and marks
the rolls. `renderStatblock(statblock, { rollable: true })` then renders them as `<button>`s with
the roll, its kind and a label in `data-*` attributes. The roll is normalised by the dice parser,
and vault text only ever ends up in text nodes or escaped attribute values, as before. The combat
catalogue turns this on; the wiki doesn't, so wiki statblocks are unchanged. The tracker's
statblock panel handles every click in one place (the HTML arrives pre-rendered) and rolls into the
shared dice log, labelled "Goblin 1 · Scimitar attack". Where there's no roller (the
prepared-encounter editor), the statblock is `inert`.

Table rules, chosen for a table that's new to D&D:

- Advantage and disadvantage last one d20 roll, then reset, so they can't carry over to the next
  monster's attack by mistake.
- A natural 20 on an attack arms **Critical**, which doubles the dice (not the modifiers) of the
  next damage roll and then switches off. Any other attack disarms it, and it can be toggled by
  hand.
- Natural 20s and 1s are flagged on rolls with exactly one d20. Recharge rolls a d6 against the
  ability's threshold.

## 21. Maps are Guildhall data that point at vault images and notes

**Date:** 2026-09-27

**Context.** Interactive maps turn vault images (Wonderdraft and Dungeondraft PNG exports) into
maps with clickable outlined areas that lead to other maps and to wiki notes. Maps and areas are
drawn and edited in the app, and the vault can't be written to.

**Options considered.**

- **All in the data folder (chosen):** a `maps.json` through `JsonFile` (decision 18). Editable in
  the app, one source of truth, and the rules that link maps into a tree can be checked in one
  atomic update.
- **Hybrid:** a note's frontmatter (`type: map`, `image: X.png`) defines the map, and its areas live
  in the data folder keyed by the note's ID. The map would "exist" in Obsidian, but creating one
  means hand-editing a note, there are two sources of truth, and renaming a note without an `id`
  orphans its areas.
- **All in the vault** (areas as a YAML block in a note): the app couldn't draw or edit them.

**Decision.**

- A map references its image by vault path. If the file has moved, a single image with the same
  name elsewhere in the vault is used, and the DM is offered to record the new location; with no
  match or several, the map shows a placeholder and keeps its areas. (The wiki's link resolver
  isn't used for this: it can pick a note, and quietly chooses between duplicates.)
- Maps and areas reference notes by entity ID (decision 6), so pinning an `id` in a note's
  frontmatter makes the link survive a rename. A link that no longer resolves is shown to the DM
  as broken, never followed.
- Outlines are stored as fractions of the image's width and height, so a map re-exported at a
  different resolution still lines up. The map records the pixel size its areas were drawn
  against; the browser measures the image when it loads and warns the DM only if the shape
  (aspect ratio) has changed. Measuring in the browser handles every format and EXIF rotation,
  needs no image library, and avoids reading a 15 MB file on the server.

## 22. Maps render as one SVG, panned and zoomed through its viewBox

**Date:** 2026-09-27

**Context.** A world map can be a 3840×2160, 15 MB PNG. It has to fit the screen at first, pan and
zoom smoothly, and carry clickable outlines that are accessible and testable.

**Options considered.**

- **Leaflet with a simple coordinate system:** handles pan, zoom and overlays, but it needs a
  client-only setup under server rendering, its drawing plugins are dated, and its polygons have
  no accessible names.
- **OpenSeadragon or tiling:** made for gigapixel images; it needs a tile pyramid, and so an image
  library with native code (`sharp`). Overkill for one 4K image on a desktop.
- **An image and an SVG overlay under a CSS transform:** simple, but Chromium rasterises a
  transformed layer once, so it blurs when zoomed in, and strokes scale with the zoom.
- **One inline SVG holding the image and the outlines, zoomed by its viewBox (chosen):** the
  browser redraws the image at every zoom, so it stays sharp; strokes keep their width
  (`non-scaling-stroke`); and the server renders the whole-image viewBox, which is already "fit to
  screen", so nothing moves on hydration.

**Decision.** The viewport maths is pure and unit-tested (`app/maps/viewport.ts`); a hook adds
wheel, drag and keyboard controls. A press becomes a pan only after it moves a few pixels, so
clicks still reach areas and handles. Areas that lead to a map are real links; others are buttons
that open the side panel, and a list in the panel is a second way in. The image is sent whole, with
ETag revalidation and a version in its URL; a downscaled preview can be added later without
changing the page.

## 23. Maps form a tree through their areas

**Date:** 2026-09-27

A map's parent is never stored: it's the map with an area that leads to it. Each map may have only
one parent, so breadcrumbs are always unambiguous and there are no cycles. The repository refuses a
save that would give a map a second parent or put it inside itself, checking inside the write so
two tabs can't race past it; the editor only offers maps that keep the tree intact. A link to a map
that has been deleted, perhaps in another tab, is dropped rather than refused, so a stale editor
can't block every later save; deleting a map clears the areas that led to it, and its own child
maps become top-level. The tree functions still cope with a hand-edited file that breaks the rule,
listing every map once and stopping breadcrumbs at a cycle.

A new map made for an area starts with the area's note, since it's a map of the same place. The
map's image is not part of what the editor autosaves; it changes only through its own action (a
moved image's new location, or accepting a new shape), so an open editor can't put an old image
back.

## 24. Map visibility follows notes: explicit, failing closed, hidden looks missing

**Date:** 2026-09-27

Players will one day browse maps, seeing only what the DM has revealed, and reveals will change as
the campaign goes on. So maps and areas each carry a `visibility` now, defaulting to `dm` (a
missing or unrecognised value also means `dm`). `mapView` prepares a map for a `Viewer`, and for
players:

- a hidden map is `undefined`, so the page and its image give the same 404 as a missing map;
- hidden areas are dropped entirely: no outline, no name;
- links to hidden maps and notes are removed, so an area whose targets are secret looks exactly
  like one that isn't mapped yet;
- breadcrumbs start below the innermost hidden ancestor;
- broken links and image file paths are reported to the DM only.

The image is served by map ID, not file name, so a player-visible map never reveals its file name
or makes the sibling images next to it reachable. It's also independent of the wiki's attachment
rule (decision 3): a player-visible map doesn't make its image loadable through `vault-asset`. In
this slice every map page and image requires the DM, and there's no control for visibility yet;
the filter is covered by unit tests.

## 25. Signing in with Discord, and sessions checked on every request

**Date:** 2026-09-28

**Context.** To replace Roll20, the group has to use Guildhall from their own machines, so "who
is the DM" can no longer be a cookie anyone can flip (decision 5). The group already talks on
Discord.

**Options considered.**

- **Discord OAuth (chosen):** no new passwords, and everyone has an account already. Guildhall
  asks for the `identify` scope only (ID and name), through a small `fetch` adapter rather than an
  OAuth library.
- **Usernames and passwords:** no third party, but Guildhall would have to store passwords safely
  and handle resets.
- **Email sign-in links:** no passwords, but needs an email-sending service.

**Decision.**

- A signed cookie session holds only the member's Discord ID and a random session key. Everything
  else is looked up on every request: whether they're still a member, whether they're waiting,
  and whether they're the DM (from `DM_DISCORD_IDS`, never stored). Removing a member, or giving
  them a new key, signs them out everywhere at once, with no server-side session store. The
  cookie is refreshed once a day while in use, and several secrets can be listed to rotate them.
- The root middleware decides access before any loader runs. Signed-out visitors are sent to sign
  in (images and other files get a bare 401 instead); people waiting only see the waiting page.
- The preview toggle (decision 5) remains, as the DM's alone: for anyone else the view comes from
  who they are, so a player can't give themselves the DM's view.
- Every form post must come from Guildhall's own address. React Router checks this for its
  routes, but not for resource routes such as sign-out, so Guildhall checks it for all. Behind a
  proxy, `TRUST_PROXY` is required for the check to see the browser's real address.
- For development and tests, `DEV_LOGIN` offers one-click pretend accounts. It's refused unless
  `PUBLIC_URL` is this computer, and each sign-in is refused unless the connection comes from this
  computer too, so a misconfigured server can't be taken over with it.

## 26. Newcomers wait for the DM, who says which player they are

**Date:** 2026-09-28

Anyone can sign in with Discord, but a newcomer sees "waiting for the DM" until the DM lets them in
on the Members page. There the DM also picks which player they are, from the names in PC notes'
`player:` field, which gives `Viewer.playerId` its first real use. Members are kept in
`members.json` in the data folder, like the rest of Guildhall's data (decision 18). The waiting
list is capped, since anyone can join it. Removing a member deletes them; if they sign in again
they're a newcomer with a new session key, so their old cookies never work again.

## 27. Hosting: Docker on a shared server, with the vault copied from Google Drive

**Date:** 2026-09-28

**Context.** The DM edits the vault in Obsidian on several devices, synced through Google Drive.
The hosted Guildhall needs its own copy, and the vault must stay read-only.

**Options considered.**

- **Obsidian Git to a private repository, pulled by the server:** version history, but a `.git`
  folder inside a Drive-synced folder risks corruption, and re-exported map images make the
  repository grow for ever.
- **Running it on the DM's PC behind a tunnel:** no copy needed, but it's only up while the PC is.
- **A one-way copy from Google Drive (chosen):** an rclone container mirrors one folder every
  minute, using a service account that can only read that folder, so Google itself enforces the
  read-only rule. Nothing changes in how the DM works.

**Decision.** Guildhall runs as a Docker Compose app on a housemate's server managed by Dokploy,
which puts Traefik in front for HTTPS. The app mounts the vault copy read-only. The vault reader
skips rclone's half-downloaded `.partial` files and files that vanish mid-read, and reloads one at
a time, so a sync in progress can't break or roll back what's served. There's no database: the
copy plus the in-memory index is Guildhall's own copy of the vault. The image is built and checked
in CI; `docs/deployment.md` is the runbook.

## 28. DM sections and DM callouts: one shared note, with the DM's parts marked

**Date:** 2026-09-29

**Context.** Most notes are about things the players will learn some of: a place, a person, a
faction. Keeping a player version and a DM version of each would double the vault and let them
drift apart. `%%comments%%` (decision 4) keep secrets in a shared note, but Obsidian hides them in
its own reading view, so the DM can't comfortably read their own notes.

**Decision.** Two more ways to mark DM-only parts of a shared note, both readable in Obsidian:

- **A DM section:** a heading whose text is exactly "DM" (any level, any case) hides everything
  under it, up to the next heading of the same or a higher level. This suits the usual shape of a
  note: what everyone knows, then a `## DM` section at the bottom.
- **A DM callout:** `> [!dm] optional title` hides one boxed secret anywhere in a note.

Players never receive them: `forPlayers` (in `app/.server/vault/dm-parts.ts`) removes comments
and then DM parts, and the page, search and statblocks for players are all made from its result,
so a DM part's text, statblocks and embedded images never reach them. It uses the wiki's own
markdown parser, so a DM part is hidden exactly when it would render as one. The DM sees each DM
part boxed and labelled "DM only", nested ones included, so the rule when writing is simple:
anything not in a box is what players see. Only an exact "DM" heading counts (not "DM notes"),
and a callout ends at a blank line, as in Obsidian. Notes stay DM-only unless marked
`visibility: players`; an Obsidian template can set that for new notes.

## 29. Characters are Guildhall data, linked to their notes; who plays them comes from the vault

**Date:** 2026-09-29

**Context.** Players get character sheets and bags they change during play, so this is the first
module where players write data. The PC note is the character's story, and the vault is read-only.

**Options considered.**

- **One `characters.json` in the data folder (chosen):** the same `JsonFile` as maps and members
  (decision 18): one file to back up, queued atomic writes, and a gift between two bags is one
  write.
- **A file per character:** smaller writes, but new directory handling in the store for no gain
  at a party's size.
- **Sheets in the PC note's frontmatter:** the vault is read-only.
- **SQLite:** not needed for a handful of records.

**Decision.** A character has its own ID, used in URLs, and points at its note by entity ID
(decision 6), so a note renamed without an `id` leaves the sheet intact, and the DM can link it
again. Who plays a character is never stored: it's read from the note's `player:` on every
request, as for Members and combat, so the vault stays the one place the DM says so. A character
whose note has gone fails closed: only the DM can reach it. An item copies its name and icon when
added and points at its item note by entity ID, so an item linked to a note kept from players
shows only its own name: an unidentified item needs no extra field.

## 30. Changes are actions applied to what's stored; undo sends inverse actions

**Date:** 2026-09-29

**Context.** The DM and a player may edit the same sheet at once (a player tracking HP while the
DM hands out loot), and two tabs can be open. Neither may silently lose the other's change, and
there's no real-time infrastructure yet.

**Options considered.**

- **Save the whole sheet, last write wins** (the map editor's way): a player's save would wipe the
  potion the DM just gave.
- **A revision check that refuses stale saves:** safe, but the loser redoes their change,
  mid-session.
- **Send small intent actions, applied to whatever is stored now (chosen):** "set DEX to 14",
  "take 7 damage", "move the rope". Edits to different things merge by themselves, and relative
  ones (damage, healing, adding items) add up.

**Decision.** Every change is a `CharacterAction`, applied by one pure function in the browser (at
once) and on the server (inside the file's queued update). A set action carries the value its
sender saw; if someone else changed it since, the action still wins (last write wins per field)
and the sender is told what it replaced. Actions about an item that's gone are dropped and
reported, never errors. The browser keeps the server's last copy with unsaved actions on top,
sends one batch at a time through a small JSON endpoint (`/characters/:id/changes`, behind the
same sign-in, origin and permission checks), rebases onto each answer, retries when offline, and
polls while the tab is visible and when it's focused. Undo can't restore an old copy, which would
wipe others' changes, so it sends the inverse of what one action changed (for the bag, a small
diff). Websockets can later replace polling without changing any of this (decision 13's path to
sharing).

## 31. The bag is an ordered list, and stacking never loses anything

**Date:** 2026-09-29

A bag's items are a list in grid order, flowed into however many columns fit, so a phone and a
desktop show the same order; fixed (x, y) cells would reflow badly between widths. The grid always
shows a spare row and never fills up: at the table the DM decides what's carried, not a slot
count. Items stack only when nothing would be lost (the same note or name, icon, description and
source, neither equipped), and a new item that hasn't been looked at doesn't join one that has,
so a gift of something already in the bag is still noticed. Two new items do stack, and stay new,
and splitting a new stack keeps both halves new, so the DM can arrange gifts before the player has
opened them. While something is being dragged, the bag holds
still: changes arriving from elsewhere wait until the drop, so nothing moves under the pointer.
Drag and drop uses dnd-kit (`@dnd-kit/core` and `sortable`), for its keyboard and touch support and
screen-reader announcements; keyboard moves follow the list's order, so Left at the start of a row
goes to the end of the row above.

## 32. Other players see a summary; hidden looks missing

**Date:** 2026-09-29

A player opens and edits only characters they play (and the party's companion); the DM, all.
Other players' characters appear as a summary card: name, portrait, species, class, level and
equipped items. Anything else about them (the sheet, the bag, the save endpoint) gives the same
404 as a character that doesn't exist. A portrait is the image chosen on the sheet only if the
viewer could load that image anyway, otherwise the first image the viewer can see in the note, so
it can never be a way to see a DM-only image; the save endpoint refuses such a choice outright.
The DM previewing as a player sees what a player assigned to no one sees.

## 33. Item icons from game-icons.net

**Date:** 2026-09-29

Items need recognisable icons, and no art may come from the games that inspired the bag, nor be
AI-generated in this slice. A curated set of 57 icons from game-icons.net (CC BY 3.0) is imported
by a script that keeps only each icon's path data and author, so tiles draw them in the app's own
colours. The licence asks for credit: each icon's author is recorded, listed on the Credits page
(linked from every bag) and in the README. Quick add guesses an icon from an item's name; any icon
can be changed. Vault images as icons can come later.

## 34. Companions are shared, and gifts are one write

**Date:** 2026-09-29

A companion the party shares (the blink dog) is a vault note with `type: companion`; its statblock
stays the source of its numbers. Guildhall keeps only its hit points (the maximum starting as the
statblock's) and a bag every player can use, and shows it as a card beside the PCs. Every player
can open it, including one not yet assigned to anyone, and so the DM previewing as a player; a
companion's note can name one `player:` to keep it to them. Players give
items to each other and to the companion: a gift changes both bags in one update of
`characters.json`, so it can't vanish from one bag without reaching the other. A player may give
only from a bag they may change, to someone they can see, and nobody can take. Gifts arrive as a
new tile saying who gave them, and can't be undone. The DM's additions to any bag are gifts "from
the DM".

## 35. Fog of war is a coarse mask in image fractions, changed by paint actions

**Date:** 2026-09-29

**Context.** Shared maps get fog of war: players see only what the DM has revealed, and the DM
reveals more as the party explores, often mid-session. Reveals must survive a re-exported image
(like outlines, decision 21), stay small enough to poll, and be undoable.

**Options considered.**

- **A log of vector operations** (strokes, polygons): exact edges and simple undo, but it grows all
  session long, and every read, render and "is this area revealed?" gets slower with it.
- **A coarse mask, changed by actions (chosen):** a grid of cells over the image, with 512 along
  its longer side (2 to 15 image pixels on the campaign's maps), stored as run lengths: usually a
  few hundred bytes, never more than about 44 KB, however much has been painted.
- **A mask plus a recent log:** more moving parts than needed.

**Decision.** The grid is in fractions of the image, so a re-export at another resolution lines
up. A cell is revealed or not; a cell counts as covered by a shape when its centre is inside it,
and a shape too small to hold a centre still covers the cell under it. Changes follow decision
30: the DM's tools send `paint` actions (a brush stroke, an outline or rectangle, or everything),
applied by one pure function in the browser at once and on the server to what's stored. Undo sends
the inverse, which sets back only the cells that change flipped, so it never hides what was
revealed meanwhile elsewhere. A new shared map starts fully fogged. Players see an area once at
least half of its cells are revealed, so a brush grazing its edge doesn't give its name away. One
fog per map for now; per-player fog or an "explored" memory would be further masks beside it.

## 36. Sharing a map, and areas seen through the fog

**Date:** 2026-09-29

**Context.** Decision 24 gave maps and areas a `visibility`, failing closed to `dm`, with no way
to change it. With fog of war, what players see of a shared map is decided by what's revealed.

**Decision.** The DM shares a whole map from the editor, as its own action outside the autosave
and undo, since sharing is deliberate. A shared map appears for players in the maps list and
breadcrumbs exactly as `mapView` already works out, and starts fully fogged. On a shared map an
area needs no sharing of its own: players see it once at least half of it is revealed (decision
35). An area can be made secret (`visibility: dm`), for example a hidden door, and then players
never see it, however much is revealed. New areas are `players`. `maps.json` moves to version 2 to
change what an area's `dm` means: version 1 had no way to share, so its areas were all `dm` without
meaning "secret", and reading a version 1 file turns them into `players`. That's safe because every
version 1 map was DM-only. Players never get the whole image's address, even for a fully
revealed map; the parts they may see come another way (decision 37). An area's links still follow
their own targets: a link to a map shows only if that map is shared, and a note only if it's shared.
Fog lives in its own `fog.json`, so changes during a session never race the editor's autosave.

## 37. Players get maps as tiles, with the fog taken out on the server

**Date:** 2026-09-29

**Context.** Players must never receive hidden parts of a map image: covering them in the browser
isn't enough, since the image file or the page's data would still hold them. The campaign's maps
are big (3840×2160 to 5120×5120 and 3840×7680, up to 16 MB of PNG), reveals happen mid-session
and should reach players within seconds, and the image library must work in the Docker image and
on Windows.

**Options considered.**

- **Hiding in the browser:** leaks the whole image. Ruled out.
- **One masked copy of the whole image per fog change:** simplest, but every reveal means about a
  second of work on the server and players downloading 1 to 5 MB again.
- **Tiles, masked only where the fog's edge crosses them (chosen):** a reveal changes only the
  tiles along its edge, about 30 ms each on the server, and players fetch only those.
- **Whole tiles only, with blocky fog:** no masking, but square 512-pixel reveals.

**Decision.** `PlayerImages` (sharp, with libvips's prebuilt binaries) decodes each version of an
image once and cuts it into 512-pixel tiles, each with a pixel of overlap so no seam shows:
compressed WebP (quality 82: lettering stays crisp, and a whole map is 1 to 3 MB) to send when a
tile is fully revealed, and an exact PNG copy to mask when it's partly revealed. Masking starts from
the exact copy because a lossy one has already blended hidden pixels into their neighbours. In a
masked tile, a pixel in a hidden cell is transparent black; revealed pixels keep their colour, and
their opacity fades in over 2.5 cells from the fog's edge, so the soft edge eats into the reveal,
never out of it. The page lists the tiles a player may have; each URL carries the image's version
and a hash of the fog around that tile, so a reveal changes only the URLs of tiles it touched and
the browser keeps the rest. The tile route always answers from the fog as it is now, so an old or
guessed URL gets no more than the fog allows. The whole image stays DM-only, even when a map is
fully revealed.

Cut tiles are cached in `DATA_PATH/cache` by a second module allowed to write
(`app/.server/data/file-cache.ts`), since they're files rather than JSON: it writes only there, one
folder per image and version, through a temporary folder renamed into place, one set at a time, and
removes older versions. sharp only ever makes buffers (its `toFile` is lint-banned), so every write
still goes through one of the two modules. The cache is disposable. Sharing a map cuts its tiles in
the background (about 3 s for the largest map), so the first player doesn't wait. A small overview
image was left out: shrinking the whole image blends pixels from both sides of the fog's edge, so a
minimap needs a resampling that respects cells first.

## 38. The DM's fog tools live on the map page

**Date:** 2026-09-29

Revealing happens mid-session, while the DM is looking at the map, so the tools are a **Fog** mode
on the map page rather than in the editor: a brush with an adjustable size, a rectangle, and
clicking an area's outline, each revealing or hiding (X, or hold Alt), plus reveal all and hide
all. A stroke or rectangle shows in the fog as it's drawn and becomes one change, and one undo
step, when released. The DM always sees a shared map's fog as a see-through veil drawn from the
same cell opacities as players' tiles, and a list says which areas players see (with reveal and
hide buttons that also work from the keyboard). The existing preview toggle shows exactly what
players get. Presenting a shared map draws the fog solid and only the areas players see, since
presenting is for showing the table. Saving follows the character sheets (decision 30): changes
show at once, go in small batches, retry when offline, and undo sends the inverse.

## 39. What players see of a map

**Date:** 2026-09-29

Players get Maps in the menu and on the hub, listing only shared maps, nested as they lead to each
other; only the links between shared maps are sent, never area names or image files. A map's page
is black except for the tiles they may have (decision 37). Areas they can see (decision 36) are
drawn only over the revealed parts, so an outline never runs off into the fog; clicking one opens
its deeper map if that's shared, or its note if it's shared and has anything left for players once
DM parts are taken out. Otherwise the panel just says nothing more is known yet: an empty note
reads like nothing to find, not like a secret. There's no editing: the editor is the same 404 as a
missing map. Players pan and zoom freely; showing where the party is will come with tokens.
Revealing an area never shares its note, which stays a vault decision (a later idea: revealing
them together).
