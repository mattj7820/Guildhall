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
their opacity rises smoothly with the distance to the nearest hidden cell's centre, from nothing at
a hidden cell's edge to fully shown 2.5 cells further in, so the soft edge eats into the reveal,
never out of it. (Fading cell by cell showed the grid as a faint staircase when zoomed in, and
distances to the cells' squares kept it; distances to their centres give smooth, fog-like
contours.) The page lists the tiles a player may have; each URL carries the image's version
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
them together). One way round the fog is outside maps: a note players can read that embeds the map's
image makes the wiki serve all of it (decision 3). The DM's map page warns when that's so.

## 40. Players' maps update by polling a version, ready for websockets

**Date:** 2026-09-29

A reveal should reach players within a few seconds, and there's no real-time infrastructure yet.
An open player map asks `/maps/:id/version` every 3 seconds while its tab is visible, and again
when it's shown or focused. The version changes with the map (areas, links, sharing), its fog, its
image file and the vault's notes. When it changes, the page reloads its data in place (React
Router's revalidation), through the same loader and `mapView` as the first load, so there's no
second path deciding what a player may see; only tiles whose fog changed get new URLs, so only
those download again. A map that's no longer shared answers 404, and the page closes to "Map not
found". A reveal typically shows within 1 to 4 seconds. With websockets (the counters slice), the
server will push the same version and nothing else needs to change.

## 41. Live updates: websockets with `ws`, on the same server as the pages

**Date:** 2026-09-29

**Context.** Tokens on maps must move for everyone as they're dragged, and fog reveals should
arrive at once rather than within a few seconds (decision 40). Decision 1 chose Express so that a
websocket could run on the same server.

**Options considered.**

- **`ws` (chosen):** one small package with no dependencies. Guildhall writes its own few dozen
  lines on top (rooms per map, reconnecting), which keeps the one rule that matters in its own
  code: every message is built for the viewer who gets it (decision 42).
- **Socket.IO:** reconnecting, rooms and a long-polling fallback built in, but a protocol and
  client of its own, and its rooms make it easy to send the same message to everyone in one, which
  is the wrong default here. The fallback already existed: polling the map's version.
- **Server-sent events for pushes, with POSTs for moves:** simpler through proxies, but one way
  only, and a drag would be a POST 20 times a second.

**Decision.** `server.js` owns the HTTP server and hands every websocket upgrade to the app (in
development through Vite, like requests, so a code change takes effect; the old connections are
closed and browsers reconnect to the new code). A connection is signed in exactly like a page,
through the same `identify` the root middleware uses, when it opens: someone signed out gets a
401, someone waiting, or a page on another site, a 403. The Origin check is stricter than for
forms: opening a websocket is a GET, which the form check lets through, and without it any site
could open one as the signed-in user; browsers always send `Origin` there, so it's required. Each
browser tab has one connection, opened while something watches a map, and reopened after a drop
(after 1, 2, 5, then every 10 seconds, spread out so everyone doesn't come back at once), and
when the DM's preview changes. Pages load their data through their loaders as before; the socket
only pushes what changed. While it's down, open maps check their version every 3 seconds as
before (decision 40), and say so ("Reconnecting…"). Stopping the server closes every connection
as "restarting". Traefik passes websockets through with nothing to configure; the server pings
every 25 seconds, which also finds connections that have died.

## 42. Every live message is built for its viewer, on the server

**Date:** 2026-09-29

Players must never receive a token, or a message about one, that they shouldn't see: hiding it in
the browser isn't enough (the same rule as pages, decision 24). So the hub's only way to send is
`publish(map, viewer => message)`, which builds each connection's own copy from its `Viewer` (once
per kind of viewer), or sends it nothing. There is no way to send one message to a whole room. A
message that says how something is now (a map's version, its tokens) isn't sent to a connection
that was last sent the same, so a player never hears that something changed when nothing they can
see did: a DM moving a hidden marker sends players nothing at all. Watching a map a viewer can't
see answers "gone", exactly as for a missing map; the connection stays watching it, to hear if
it's shared later, so everything else about a map goes only to those who may see the map.
Browsers send only small messages (watching a map, and dragging), checked with zod, 40 a second at
most; saved changes still go through the usual endpoints, with their checks. A member's
connections are closed when the DM removes them or makes them someone else's player (and every
minute, a check against the member list catches anything else), so they sign in afresh or are
refused.

## 43. Tokens: party members in one place each, and the DM's markers

**Date:** 2026-09-29

**Context.** Exploration maps need to show where the party is, like a game's map screen: the DM
and players move tokens, and everyone sees it. Battle maps (a grid, snapping, measuring, monsters
from the combat tracker) come later, and the model should grow into them.

**Decision.** A token is a party member (a PC or the shared companion, by their note, decision 29)
or a DM marker (a name, one of eight colours, and a visibility that fails closed to DM-only), at a
point in fractions of the image, like outlines. Tokens are kept in `tokens.json`, apart from maps
and fog, written only when a move is let go. Changes are small actions (place, move, remove, edit
a marker) applied by one pure function to what's stored now (decision 30); a move carries where
its sender saw the token, and the last one wins. Who plays a party member comes from their note
every time. Players may only move their own PC and the companion the party shares, about the map
they're looking at; placing, removing, markers and moving between maps are the DM's. A token a
player can't see, or can't move, is refused the same way whether it exists or not. Tokens keep
their size on screen as the map zooms. Their data never includes a party member's note for
players, since a note's path could name a secret.

**Growing into battle maps.** A map gains an optional grid (a square's size and offset in image
fractions; about 256 pixels on the campaign's Dungeondraft exports) and a way to size tokens by it
rather than on screen. A token gains a size in squares and a third kind, a creature linked to a
statblock and to its combatant in a server-held encounter (decision 13's path to sharing), whose
initiative, hit points and turn order are pushed through the same hub with `encounterForViewer`.
Snapping is a pure function applied where a move is made, so the move action doesn't change, and
hidden monsters are markers' `dm` visibility again.

## 44. Tokens and the fog

**Date:** 2026-09-29

A token is under the fog when the fog cell its centre is in is hidden, the same "centre" rule as
painting (decision 35). Players always see their own party members (their PC, and the companion
they share), even under the fog, drawn dimmed as "in the dark": it tells them only where they
already know they are, and dragging your own token into the black is a way to say where the party
goes next. Other party members, and markers the DM shows, appear only where it's revealed; DM-only
markers never. Anything a player can't see isn't in their page's data, their map's version or any
live message; a drag is shown only to those who could see the token where it is now. The DM sees
every token, marked as under the fog or secret, and presenting shows what players see. Revealing
stays the DM's: fog clearing as tokens move is a later idea.

## 45. Where the party is, across nested maps

**Date:** 2026-09-29

**Options considered.** Separate tokens on every map (simple, but the town would still show the
party at its gate after they'd gone into the keep); a party that follows its members into deeper
maps as a group (wrong when the party splits); or **each party member in one place, a map and a
point on it (chosen)**.

**Decision.** Placing a party member on a map moves them there from wherever they were. The maps
above show where they are: an area leading, at any depth, to a map with party members on it
carries a badge of their faces. It's worked out from the map tree (decision 23), never stored, and
players get a badge only through areas and links they can see, and only with those they'd see on
that map, so a badge never gives a hidden place away. Moving between maps is the DM's, since
entering somewhere is a story beat: "Bring here" on a party member, or "Bring everyone here" for
the whole party side by side. The Maps page says where each player's own party members are (on a
map they may open, or not yet on one), and Find centres a map on a party member.

## 46. Moving tokens live, and who's holding one

**Date:** 2026-09-29

A prototype of dragging between two browsers settled the feel: sending a drag 20 times a second,
with others' copies gliding between positions, felt smooth even with a quarter of a second's
delay. While a token is dragged (or moved with the arrow keys), where it is goes over the socket
20 times a second, checked like a saved move and shown only to those who may see it there; it's
never saved. Letting go saves the move through the tokens endpoint. The mover's copy stays where
it was put until the server answers, and holds still under the pointer whatever arrives, so it
never jumps back. Others' copies glide for 80 ms between the positions they hear, and say who's
moving the token. So two people can't fight over one, the first to pick a token up holds it until
they let go, stop moving it for three seconds, or close the tab; anyone else who tries is told who
has it, and their saved move is refused the same way. The DM can always take a token. If two grabs
arrive together, the first to reach the server wins, and underneath it all the last move saved
wins. Holds are kept in memory only. Tokens have their own live message, so a move doesn't change
a map's version and reload anyone's page; while the connection is down, the version check brings
the tokens too.

## 47. Battle maps: a grid over any map

**Date:** 2026-09-30

**Context.** Fights still happen on Roll20. The campaign's battle maps are Dungeondraft exports
with their own grid drawn in (about 256 pixels a square), but a fight can break out anywhere: a
town map, a watabou building, a cave.

**Decision.** A battle map is any map with a grid turned on; there's no separate kind of map. The
grid is kept with the map in fractions of the image, like outlines: a square's side as a fraction
of the image's width (so squares stay square), where two lines cross, and how strongly the lines
are drawn (0 hides them, for images with their own). Squares are always 5 ft; a setting for other
scales can come if a map needs one. It's set up in the editor's Battle map grid section, as part
of the autosave and undo. A new grid starts at a size that fits the image exactly, trying
Dungeondraft's 256 pixels first, then other common exports, and only if that makes at least 10
squares along the longer side; otherwise about 20 across. The prototype showed that the scale
matters most: on a town map the squares (and so the tokens) were far too big, so the scale is a
slider that moves like zooming, with half-pixel steps and a count of squares across, plus an
offset to line up with a grid in the image. Players get the grid of a map they can see, drawn only
over what's revealed.

## 48. Tokens on a battle map: filling their squares, sizes, and a snapping switch

**Date:** 2026-09-30

On a map with a grid, a token fills its squares, as on a real battle map, but never gets smaller
than 12 pixels on screen, so it can still be found zoomed out. Tokens are 1 to 4 squares across
(Medium or smaller, Large, Huge, Gargantuan); the DM sets a token's size in its panel, and size 1
isn't stored. Tokens snap to squares as they're dragged or moved by the arrow keys (a square at a
time): odd sizes in a square's middle, even sizes on a corner. The DM isn't strict about
positioning and sometimes places tokens round obstacles or between squares, so snapping is a
switch on the map's page, for the whole map, on unless turned off; holding Alt places one token
freely. Snapping happens in the browser, where the move is made: the server stores whatever point
it's sent, since where a token sits isn't a matter of who may see what.

## 49. Measuring and spell areas: a toolbar over the map, on each viewer's own screen

**Date:** 2026-09-30

The map's tools live in a small toolbar over its top-left corner (Select and move V, Measure M,
Spell area A), where people expect them on a VTT, leaving the side panel for notes and, next, the
combat tracker. Changing tool clears what the last one drew; Escape clears too. They step aside
for the DM's fog tools and while placing tokens.

The ruler gives a line's true length at the grid's scale, to the nearest half foot, rather than
counting squares as the rules do: the prototype showed that counting read wrong within a square
and along diagonals, and the table wants to know how far things really are. Space adds a turn
while dragging. Spell areas are the shapes spell descriptions use, named the same way on their
buttons (Sphere, Cube, Cone, Line) so players recognise them: a cone is as wide as it is far, a
line is 5 ft wide, a cube extends from its near face. A square is covered when its centre is
inside, the same rule as painting the fog, and the tokens with any square covered are listed. A
spell starts on a grid corner while tokens snap. Both are drawn only on the screen of whoever is
measuring; sharing them with everyone can come later over the live connection. For measuring
without a mouse, a chosen token lists how far every other token is.

## 50. The shared fight: the DM's tracker writes it, the server keeps it

**Date:** 2026-10-01

The table has one fight at a time, kept in `fight.json` in the data folder and seen by everyone,
rather than in the DM's browser. The DM's tracker stays as it was (dice rolled in the browser,
undo, the same reducer) and saves the whole encounter after each change, saying which revision it
last had. If the stored fight has moved on (another tab, or a player ending their turn), nothing is
written and the newer fight comes back to be taken up, with a notice: simpler than merging
actions, and with one person running the fight, a conflict is rare and the newer fight is the
right answer. A save that can't reach the server is retried every few seconds and says so. The
only thing players change is ending their own turn, checked on the server against the fight as
it is then. Fights left in a browser from before can be brought over once.

## 51. What players see of the fight

**Date:** 2026-10-01

Players get the turn order with everyone's names (monsters' names too, as the DM chose), whose
turn it is and the round; for their own characters and the companion the party shares, conditions,
notes and hit points. Hit points come from character sheets, not the tracker, since sheets are
where players keep them; a sheet change is pushed to everyone watching the fight. Monsters' hit
points, initiative numbers and the DM's notes never leave the server. Each viewer's copy is built
on the server (`fightForViewer`, `fightView`), for the page and every push alike. A hidden monster
(an ambusher) is left out of players' turn order and maps entirely, and its turn looks to them like
a moment between turns, so it can't be told apart from a monster that isn't there.

## 52. The fight on the map page, and monsters' tokens

**Date:** 2026-10-01

The fight is run from the map's page (Combat, beside Fog), with the tracker in the side panel, the
turn strip over the map and the dice log in its corner; `/combat` stays the same tracker for fights
without a map. Changing the fight from a map brings it to that map. A monster's token is a third
kind of token, linked to its combatant: its name, hit points, being down and being hidden come from
the fight each time tokens are sent, so they can't drift apart, and every fight change re-sends
the tokens on watched maps. Monsters join without a place and the next click puts them down, side
by side, sized from their statblock's size (Large 2 squares, and so on). When a save takes monsters
out of the fight, the server takes their tokens with them, wherever they are. End fight asks
whether to clear the monsters or leave them where they fell, as markers (a hidden one still for
the DM only) to tidy later. On battle maps, token names show on hover, for the selected token and
for whoever's turn it is, since a fight fills the map.

## 53. Moving in a fight: on your own turn

**Date:** 2026-10-01

In a fight on a map, a player moves someone who's in it only on that combatant's turn; the DM moves
anything, any time, and a Free movement switch lets players move whenever they like (kept with the
fight, not changing its revision, so the tracker's saves aren't made stale). Before the fight
starts, and for anyone not in it, movement is as before. One pure rule, `fightAllowsMove`, is used
by the page request, by live drags (rechecked as the turn changes) and for which tokens players
are told they can move. Live drags now see the fight too, so the DM dragging a hidden monster is
never shown to players.

## 54. Prepared fights on maps

**Date:** 2026-10-01

A fight set up on a map can be saved as a prepared encounter with the map and where its monsters
stand (by combatant, in fractions of the image, like everything else on maps). Starting it opens
the map in Combat, where the DM picks who's playing as usual and the monsters go back where they
were put, under their new IDs. The party isn't placed with the encounter: they're wherever the
story took them, so "Bring the party here" drops everyone in with a click when the fight begins. A
monster added in the editor since has no place yet and is placed with a click; one removed is
left out. If the map has been deleted, it starts in the tracker as before.

## 55. The table plays D&D; Guildhall keeps the DM's books

**Date:** 2026-10-02

Battle maps' third slice was first planned as effects that played by themselves (a turn banner,
hit and miss flashes, damage floating off tokens) and as attacks resolved by the app against a
target's AC, with damage applied to PCs' sheets. The DM turned that down: it's a tabletop game,
and Guildhall is there to make the DM quick, not to play it for anyone. So:

- Guildhall automates only the DM's own bookkeeping, for monsters. Players roll their own dice,
  anywhere, and track their characters however they like, sheet or paper: nothing reads a PC's
  sheet to decide a roll, and nothing changes one but the person typing into it.
- A monster's attack is just its roll; the DM asks the player their AC, as at the table.
- Typed damage and healing on monsters always stays, alongside anything quicker: players' rolls
  arrive as numbers, and the DM needs room to improvise.
- Effects are the DM's to play for a moment that deserves one, like a sound effect at the table.
  Nothing plays automatically.

## 56. Damage for monsters picked on the map

**Date:** 2026-10-02

A spell catches several monsters, so the DM picks them on the map (Shift-click, or everyone a
spell area catches) and types the number once: Damage, Half (rounded down, for those who saved or
resist) or Heal. Each is an ordinary tracker action, so undo and the shared fight work as before.
Who saved is the DM's call: picking separately for Damage and Half is quick enough, and keeps
judgement at the table.

## 57. Stunts: the DM's effects, for everyone watching

**Date:** 2026-10-02

Stunts were tried in a prototype on the DM's screen first. The DM kept the screen shake, wanted
bursts much bigger (a few squares) and long enough to take in (three to five seconds), dropped
fire and floating numbers, and reworked the token stunts into a wobble (twisting back and forth)
and a glow (a light about five squares round the token, pulsing three times); a fall leaves the
token down until the DM stands them up.

A stunt is sent like everything live: the DM's tab plays it at once and posts it (DM only); the
hub sends it to each viewer who may see the map, built for them. Positions and sizes are fractions
of the map, like outlines. Players see a stunt wherever the DM put it, under the fog too, since it
shows nothing of the map beneath, but a token's stunt only if they can see the token, so it never
gives away a hidden monster. Nothing is kept: someone who opens the map later just sees the map.

Each viewer can turn stunts off, mute sounds or set the volume, kept in their browser; with
reduced motion asked for, stunts fade in and out instead of moving, and the map's flash is soft.

## 58. Sounds from a vault folder

**Date:** 2026-10-02

The DM's sound board is the audio in one vault folder (`SOUNDS_FOLDER`, default `Sounds`), so the
DM chooses and owns the sounds and Guildhall only reads them. Players' browsers must fetch a sound
to play it, so a route serves audio from that folder, and nothing else, to anyone signed in. Rather
than tickets for each sound played, the folder is simply for the table: the DM is told so in
`.env.example`. A stunt naming a sound outside the folder is refused. Browsers hold sound back
until a page has been clicked, so a held-back sound offers a "Turn sound on" button.

## 59. End-to-end tests through page objects, waiting for hydration

**Date:** 2026-10-03

The e2e specs had grown their own copies of the same helpers (a second browser as Player One in
three specs, the bag's helpers in two, making a shared map through the UI in five), and the few
flaky tests came from steps that didn't wait for the right thing. Specs now work through page
objects in `tests/e2e/pages/`, given to them as Playwright fixtures along with `openAs` (another
person's browser, closed at the end) and `api` (endpoints, for setting up). Page objects keep
accessible locators, so the e2e suite still checks the UI is accessible; a `data-*` hook is
added only where there's no accessible handle.

The app marks `<html data-hydrated>` once React has hydrated, and page objects wait for it after
every navigation: until then a click can land on a server-rendered button with no handler. It's
one attribute set in an effect, invisible to people, and cheaper than every test guessing when a
page is ready.

Setting up through endpoints (maps, sharing, fog, areas, markers) replaced the UI where the UI
isn't what's tested, which made the suite quicker and gave it fewer steps to go wrong. CI now keeps
the report for flaky runs, and a manual Stress workflow repeats a spec on CI to prove a fix.

## 60. Paying down debt: refusals said, failures retried, routes checked, big components split

**Date:** 2026-10-03

A pass over the app code, after the e2e work in decision 59, fixed what a review found rather
than adding anything new:

- **Saving says what happened.** The fight tracker showed "saved" when the server refused a save
  (400, 403, 404); it now says the change wasn't kept. The fog tools let the DM's changes go on a
  5xx as if refused; they're now sent again, like when Guildhall can't be reached, and a real
  refusal also clears the undo steps made from them.
- **Every JSON body is checked.** Three DM routes cast their JSON, so bad input was a 500.
  `readJson(request, schema)` is now the one way to read a JSON body, and the copies of the same
  try/catch in six routes went. `requireDm` and `notFound` replace the 404 written out in 22
  routes, so "not yours" and "not there" stay the same answer by construction.
- **Lint checks what it claimed to.** The read-only rule listed banned write APIs, so a default
  or namespace import of `fs` got past it; it now allows only the reading APIs. React's hooks
  rules ran only on `.tsx`; on the `.ts` hooks they found two real problems, now fixed.
- **Windows file locks** retry for reads as well as renames (local runs only; production is Linux).
- **The three largest components were split** by what they do (the bag's drag state, the map
  page's token placing and bar, the sheet's sections), without changing behaviour; the e2e suite
  is the check.

A race once suspected when a prepared fight starts on its map turned out to be the e2e run, not
the app: repeated copies of `fight.spec.ts` ran at once against the table's one fight. The stress
workflow takes `workers=1` for it.

## 61. What gets used up: features carry their uses, and ticks are relative

**Date:** 2026-10-04

**Context.** After two sessions, the sheet's Notes tab held attacks, spells and a once-a-day spell
as free text with nothing to tick off. Sheets are now live data on the hosted app.

**Options considered.**

- **A separate list of limited uses beside features:** simple, but a use and the feature it
  belongs to are typed twice and drift apart.
- **Features that carry their uses (chosen):** a feature (class, species, feat, item or other;
  used as an action, bonus action, reaction, other or passive) may have uses with what gives them
  back. Ki points or a wand's charges are a feature with uses; a feat's free spell is a spell
  pointing at a feature's uses.
- **Rules first (slots from class and level, spells from the SRD):** the table doesn't need them
  yet, and typed values from paper are what the players trust.

**Decision.** On the sheet: the spellcasting ability, spells, nine levels of slots, hit dice by
size, features, attacks, and what's being concentrated on. Every change is an action applied to
what's stored now (decision 30): a tick is relative ("use one more"), so two tabs' ticks add up; a
maximum is a set action with `from`; spells, attacks and features change by list changes whose
edits name only the fields they change, and a feature's uses are edited by their maximum and reset,
never by how many are used, so an edit can't undo someone's tick. Undo sends what each action
changed, as differences. The spell save DC and attack bonus come from `deriveSheet`, typed numbers
winning, so rules can later fill in computed values and flag typed ones they disagree with.

Stored data must always load: every new field has a default, a counter used past its maximum is
clamped and an unknown source reads as "other", rather than the sheet being refused (a file that
fails its schema is never overwritten, so a too-strict schema would stop the Characters pages
loading). Rolling a deploy back after spells or uses are saved would drop them on the next save,
since an older build doesn't know the fields: backups of the data folder cover that.

## 62. Rests: the player's buttons, 2024 rules, one step each

**Date:** 2026-10-04

Resting is a button the player presses, never something Guildhall decides (decision 55), and
there's no "rest for everyone": the DM says the party rests, and each player presses theirs. A
**short rest** spends hit dice, each rolled in the dialog or rolled at the table and typed in, and
each heals its roll plus the CON modifier (at least 1), skipping any spent meanwhile in another
tab; uses that come back on a short rest do. A **long rest**, as in the 2024 rules: all hit points
back and temporary ones gone, every hit die and spell slot back, short and long rest uses back, and
concentration ends; uses kept by hand stay. "At dawn" isn't a reset of its own, since a long rest
can happen at any time of day: something that recharges at dawn is set to come back on a long
rest. Each rest is one action, so one Undo puts back everything that rest did and nothing else, and
a toast says what it gave back.

## 63. Spells on the sheet: typed, cast from the sheet, rolled separately

**Date:** 2026-10-04

Spells are typed in from paper (casting time, range, components, duration, concentration, ritual,
save or attack, dice, an effect, an area) in the player's own words; no rules text is copied and
nothing is generated. A spell can link to a vault spell note (`type: spell`), which players read
without its DM parts, like item notes; the spell keeps its own typed details, so a note kept from
players shows nothing more. Cast only ticks off what's spent (the lowest slot left at the spell's
level or above, a higher one, a feature's free use, or nothing for a ritual) and takes over
concentration, as one undoable step; attack and damage are clicks of their own. An area uses the
battle map's own shapes, so a later "Show on map" can lay it out with the spell area tool.

## 64. The sheet beside the map: a player's panel, loaded when opened, still polled

**Date:** 2026-10-04

A prototype compared a drawer over the map, a card over it, and tabs in the side panel; the DM
chose tabs. A player's panel on a map is Map │ Sheet │ Bag at one fixed width (the map jumped when
the width followed the tab), folding to a strip of icons. C and I open the sheet and bag, as games
do; V, M and A stay the map's tools. What's open is kept in the browser, so it stays open from map
to map. The compact sheet keeps what matters mid-session and links to the full sheet; it saves
through the same editor, so actions, undo and merging are the same.

The map page carries only the names of the characters a player may open. The sheet is fetched
when it's opened, from `/characters/:id/sheet`, which loads exactly what the sheet page does behind
the same check, so the map page still never carries a party member's note path, and a sheet that
can't be opened shows as such in the panel rather than failing the map page. The panel is for
players; a read-only view of the party for the DM is on the roadmap.

Sheets still poll every 10 seconds, as each one is mostly changed by its owner and the fight
already hears of hit point changes. Pushing changes live is the next step: a small message with
only the new revision, sent to those who may edit, after which the browser fetches the character
through the changes endpoint as now, so what anyone may see is still decided in one place.

## 65. NPC tokens are markers with a note; their name is their own, and players see what the DM sees

**Date:** 2026-10-06

**Context.** The DM wants NPCs on the map (the innkeeper, a hooded stranger, a cart) with a
picture, moved like the party's tokens, and points of interest with something better than a
colour. A shown NPC may be in disguise: the note says who they really are.

**Options considered.**

- **A new kind of token for NPCs:** clear types, but it repeats everything markers already do
  (visibility failing closed, editing, showing and hiding, End fight's leftovers) on a second path.
- **Markers gain an optional note, picture and icon (chosen):** one kind for everything the DM
  places, so every rule about markers covers NPCs.
- **Pictures:** the note's first image (as portraits are, decision 32), built-in icons from
  game-icons.net (as the bag's, decision 33), a tokens folder in the vault, or initials. The first
  two now, initials as the fallback; a folder would need a picker and its own rule for which
  images may be served, and can come with handouts.

**Decision.** A marker may carry a `note` (the NPC's, by entity ID), a `picture` (`note` or
`icon`) and an `icon`. Its name is always its own, filled in from the note's title when it's
added and never read from the note again, so the note's title can't reach anyone through a
token: a shown NPC can be "Hooded figure". Showing a token shows exactly what the DM sees on it:
its name and its picture, even when the picture comes from a DM-only note, since the DM chose it
(an icon suits a disguise better than the real face). The picture is the note's first image as
the DM sees it, served from `/maps/:id/tokens/:token/picture`: by the token, never the image's
path or the note, to the DM, or to a player only if the token is among those they're sent (shown,
revealed, not set aside); otherwise the same 404 as a missing token. The URL's version hashes the
token and the image together, so two tokens showing one image can't be matched. The note, and
what's behind the picture, are the DM's only. The new fields are optional and dropped if
unreadable, so stored tokens load as they were; an old build strips them, leaving plain markers.
56 icons for people, creatures and places are imported with the item icons and credited, and one
is guessed from a token's name. Placing several of the same numbers them (Bandit 1 to 3), carrying
on from those already on the map, side by side in one click.

## 66. The DM's side panel in tabs, with all token management in a Tokens tab

**Date:** 2026-10-06

The DM's panel on a map stacked the map's note, the party, markers and areas, and combat and fog
replaced it. It's now tabs, as the players' panel is (decision 64), sharing its one width,
folding and remembering what's open: **Map** (the note and areas) and **Tokens** (the party as
before, NPCs and markers on this map with a one-click Shown / DM only button, adding them, those
set aside or on other maps, and the chosen token's settings). While the fight is open, a **Fight**
tab holds the tracker and opens when it starts, so the DM can drop in an NPC mid-fight and come
back. Fog still takes over the panel while it's on, since it changes what a click on the map does.
Choosing a token on the map opens the Tokens tab, except while the fight is picking monsters.
Monsters in the fight stay in the tracker, not the Tokens tab. The panel stays on the right, like
the players' and most virtual tabletops'. Another tab (handouts) can join these.

## 67. Setting a token aside, and moving tokens between maps

**Date:** 2026-10-06

Trying the prototype, the DM asked for a way to take a token off the map without deleting it (an
innkeeper who walks off but may be back soon); hiding is for what players haven't come across yet.
So a marker can be **set aside**: kept, with everything about it, but drawn nowhere and sent to
no one, and listed in the Tokens tab of every map ("last on" where it was) to place again there.
A set-aside marker survives its map being deleted. NPCs on other maps are listed too, folded, to
bring here; plain markers belong to their own maps. The DM moves any token but a monster to
another map with **Send to map** (to its middle, to be moved from there), or brings one here from
the lists, which is a move naming this map: the only move the server accepts for a token on
another map, and only from the DM. The party's one place each (decision 45) is unchanged.

## 68. The hub no longer links to Roll20

**Date:** 2026-10-10

Guildhall now does what the table used Roll20 for (battle maps, tokens, fog, the fight), so the
hub's "At the table" link to the Roll20 campaign is gone, and with it `ROLL20_CAMPAIGN_URL`. It was
the hub's only external link, so the cards are all Guildhall's own modules and the support for
external and unconfigured links went too. A `ROLL20_CAMPAIGN_URL` still set on a server is ignored,
so an old `.env` doesn't stop it starting.

## 69. Portraits in circles are cropped from the top

**Date:** 2026-10-10

Portraits are usually tall (half or full-body art), and cropping them to a circle from the middle
cut off heads. Every round face (party cards, sheets, map tokens, the Tokens tab, badges) now
crops from the top, where heads almost always are. Wide or square pictures, as creature art often
is, are only trimmed at the sides, so they're unchanged. A focus point set for each picture was
the alternative, kept for if a picture ever needs it.

## 70. Nightly backups of the data folder, off the server

**Date:** 2026-10-11

The hosted app holds real campaign data (sheets, maps, fog, tokens), and the server is a friend's,
so a backup on the same machine wouldn't protect against losing it. Dokploy's Volume Backups copy
the data volume every night to a private S3-compatible bucket in the DM's own account (Cloudflare
R2, well inside its free tier), keeping two weeks. Nothing in Guildhall changed: the backup is the
host's job, and since every file is written whole and renamed into place, it's taken with the app
running. The tile cache is included rather than split into its own volume; it's tens of
megabytes. A restore was checked by hand the day it was set up.

## 71. Three themes, picked per account

**Date:** 2026-10-11

Guildhall looked like a default Tailwind app: stone and amber, following the device's light or
dark mode. Eight looks were tried as mock-ups (inspired by Middle-earth, the Stormlight Archive,
D&D's books and Avatar), three shortlisted on real screens, and rather than choose one, each person
picks their own on a new **Settings** page, saved on their account so it follows them between
devices: **Storybook** (light: teal and gold, rounded, a storybook serif), **Iron and Ember**
(dark: black iron, ember red, blackletter headings, clipped corners) and **Gemlight** (dark: night
blue, a gem colour for each part of the app, glows). Someone who hasn't picked gets Storybook on a
light device and Iron and Ember on a dark one; a fourth "follow my device" choice was left out as
one more thing to explain. Only the look changed: no behaviour, layout or wording.

- **Named colours, not palette colours.** Components use names (`page`, `surface`, `ink`,
  `muted`, `accent`, `link`, `dm`, `danger`, `module`, …) mapped in `app/app.css`, and each theme
  only sets the values behind them. About a thousand hard-coded palette classes were converted, and
  a lint rule now refuses raw palette classes in `app/`, so new screens work in every theme.
- **Content keeps its colours.** What's drawn over map art (fog, grids, area outlines, tokens and
  their markers, measuring, spell areas, stunts), the turn strip's faces and the Discord button
  look the same in every theme; the bars, panels and tools around them follow it.
- **Decoration lives in theme CSS.** Clipped corners, glows, gold rules and rounded cards hang off
  a few `gh-*` hooks on shared pieces (cards, panels, buttons, the top bar); components never style
  for a theme. Dense screens (the tracker, sheets, map panels) take only colours, fonts and buttons.
- **No flash of the wrong theme.** The server puts the pick on `<html data-theme>`, so the first
  paint is right without a script. `<body data-module>` gives each part of the app its colour.
- **Fonts are self-hosted** (`@fontsource`, all under the SIL Open Font License, listed on the
  Credits page): nothing is fetched from Google, and a browser downloads only its theme's faces.
- **Stored data:** a member's `theme` is optional, and an unknown value reads as no pick, so older
  data loads unchanged and a rollback only means picking again.
- **Statblocks** keep the books' parchment in Storybook and get a dark page in the dark themes.
- **Readability is tested:** an e2e spec opens each part of the app in each theme and runs axe's
  colour-contrast check.

## 72. Preparing spells: a flag per spell, a typed number, and only what's ready day to day

**Date:** 2026-10-11

**Context.** Typing in the second PC's sheet, a level 1 artificer who prepares 3 of 18 spells and
changes them after a long rest, left two bad choices: all 18 spells (and no way to tell which are
ready), or only 3 (retyped after every change). Sheets are live data, so existing ones must load
as they are.

**Options considered.**

- **A list of prepared spell IDs on the sheet:** new add and remove actions with their own
  inverses, IDs left behind when a spell is deleted, and a missing list that could mean "all" or
  "none".
- **Three states per spell (prepared, not, always):** covers subclass spells early, before they
  exist.
- **A `prepared` flag per spell (chosen):** preparing is a field edit of one spell, so two tabs'
  choices merge and undo puts back only that field, with no new machinery. Spells stored before it
  existed load as prepared, so nothing changes for a character who doesn't prepare.

**Decision.** What's always ready is worked out, never stored (`preparing.ts`): cantrips (known,
not prepared, in both rule sets) and spells cast through a feature's free use (a feat's spell is
always prepared). They never count, and their flag is ignored. Always-prepared subclass spells can
join that one function later. "Spells to prepare" is typed from paper like other numbers, blank for
a character who doesn't prepare, with its own set action carrying `from`.

The Spells tab lists only what's ready day to day, with a line saying how many aren't and a way in;
greying them out was tried in a prototype and buried the three that matter among fifteen. Prepare
mode lists everything with checkboxes and a count; going over turns it to a warning and Done asks
once, but nothing is blocked, and casting never checks it (decision 55): rituals cast unprepared
are left to the table. A new spell starts prepared without a number, or while there's room under
it, so typing in a whole class list doesn't leave every spell prepared. A long rest's toast offers
"Change prepared spells" to a character who prepares. Others' summaries still show no spells.

## 73. The SRD's monsters: bundled from openly licensed data, in the plugin's format

**Date:** 2026-10-11

**Context.** Every monster the tracker could use had to be typed into the vault as statblock YAML
first: slow when prepping, and impossible mid-session when the party wanders somewhere unplanned.
The SRD 5.1 (2014 rules) and SRD 5.2.1 (2024) are both CC BY 4.0, so their monsters can ship with
Guildhall, credited. The table mainly plays 2024 rules but wants 2014's on hand.

**Options considered.**

- **The source.** Wizards publish the SRDs only as PDFs. Open5e's data has both versions and the
  2024 initiative, but split over several tables, with damage bonuses missing on most 2014
  attacks. The Fantasy Statblocks plugin's own bestiary is 2014 only, and already has slips.
  5e-bits' 5e-database (MIT) has both versions in one well-structured shape, actively maintained,
  with the SRD's spells beside them for the spell picker to come.
- **The format.** Generated `Statblock` objects, or YAML text to parse, or the plugin's fields as
  JSON.
- **Pointing at one.** A made-up entity ID ("srd-2024/goblin") keeps stored refs' shape but gives
  an ID a hidden meaning that a note's `id:` could clash with; a union of two ref kinds is the
  cleanest type but changes every stored ref; an optional `source` changes nothing stored.

**Decision.** `scripts/import-srd.ts` converts 5e-bits' monsters, pinned to a release, into the
plugin's statblock fields (`monsters-5.1.json`, `monsters-5.2.json`, committed): the format the
vault already uses, so they go through the same parser, renderer and click-to-roll, and a "make
this my own" copy can later be plain YAML. 2024 monsters' initiative, which 5e-bits lacks and
which differs from DEX for 106 of them, comes from Open5e at a pinned commit, by name. The
conversion only lays monsters out as each book prints them; the SRD's words are never changed,
and the SRD's own descriptions come as lore (45 monsters in 5.1, none in 5.2.1). `npm run
srd:check` in CI fails if the committed files differ from what the pinned data makes, and the
script refuses to drop a monster stored fights may point at.

The parser learns the 2024 statblock: `initiative` (which wins over DEX) and `gear`, keys the
plugin doesn't define but keeps, and "Attack Roll: +4" rolls like "+4 to hit". A ref to an SRD
monster is `{ entityId: "<its ID>", name, source: "srd-5.1" | "srd-5.2" }`; without `source` it's
the vault's, so everything stored before loads unchanged, and a source this version doesn't know
is read as the vault's rather than refused (the combatant keeps its copied numbers).

Known gaps, from the data: 2024's Octopus and Giant Fly aren't in 5e-bits; neither version says
how many legendary actions a monster has; 2024 saving throws show as a line, not in the ability
table. Bestiary references (`monster: Goblin`) still don't resolve.

## 74. Statblocks loaded when shown, and finding a monster among hundreds

**Date:** 2026-10-11

**Context.** Decision 17 sent every statblock pre-rendered with the combat tools' pages. With the
SRD that would be 3.1 MB (239 KB compressed) on every tracker and map page the DM opens, rendered
on each request.

**Decision.** The catalogue carries only what's needed to find and add a creature (17 KB
compressed for all 682 with the fixture vault, held to a budget in a test), and the statblock
panel loads the one it shows from a DM-only route, `/combat/statblock?key=` (players get the same
404 as for one that isn't there). The SRD's are rendered once; the vault's each time, so edits
show. The browser keeps what it loads with the catalogue it came with, so a page that loads again
sees vault edits, and fetches everyone in the fight ahead so a turn's statblock shows at once.

The picker was tried as a prototype first. One search (exact names, then prefixes, a word's
start, anywhere), chips for Mine / 2024 / 2014, a challenge rating range and a type, and a + on
each row that adds How many at once. Browsing lists everything by name, tagged: the DM found that
easier than their own first. While searching, within a match the DM's own come first, then 2024,
then 2014. Size and environment filters were left out (the data has no environments); the DM would
like one by home region or theme one day.

## 75. The SRD's spells: a picked spell is the player's copy, linked to the SRD's text

**Date:** 2026-10-11

**Context.** Every spell on a sheet was typed in from paper, field by field (decision 63): slow
for the artificer's long list to prepare from (decision 72). The SRD 5.1 and SRD 5.2.1 spells are
CC BY 4.0 like their monsters (decision 73), and 5e-bits' 5e-database has both at the release
already pinned. Sheets are live data, so old ones must load exactly as they are.

**Options considered.**

- **What the data can fill in.** Both versions have the SRD's fields and text. Only 2014's has a
  structured save and area (and some of its areas are odd: Forbiddance is a "cube 40000"); 2024's
  has neither, gives damage only at the spell's own level, and healing only in the text. Leaving
  saves and areas to the player, taking them only from 2014, or reading them from 2024's text by
  strict patterns.
- **A copy, a link, or both.** A copy alone can't hold the text (20 descriptions in 2014 and 12 in
  2024 are longer than a sheet's 2000 characters, and a reaction's casting time is up to 136
  against 80) and would put kilobytes per spell into every save and poll. A link alone leaves
  nothing to edit.

**Decision.** `scripts/import-srd.ts` also writes `spells-5.1.json` (319) and `spells-5.2.json`
(339) through a pure `convertSpell`, which lays the text out (paragraphs, 2014's tables kept
together so they render) without changing a word, and fills in what a sheet's spell can use: a
save (2014's own; 2024's from "makes" or "succeeds on" one named ability, so "advantage on
Dexterity saving throws" isn't one: 123 found, agreeing with 2014 wherever both have one, bar
Black Tentacles, which 2024 changed), a roll (the first typed damage at the spell's level, or
healing, without 2014's "+ MOD"), and an area in the battle map's shapes (2014's own; 2024's from
the text, an Emanation as a sphere around the caster). Five spells whose only damage in the data
is a mishap or a cost (Wish, Teleport, Dimension Door, Meld into Stone, Contact Other Plane) are
named and get no roll; the DM chose that over filling in rolls only for spells that attack, save
or heal, which lost every smite, Hex and Magic Missile. `srd:check` covers the spells, and the
removal guard protects them, as sheets point at them.

Picking one adds an ordinary spell through the usual action (`pickedSpell`): the short fields are
the player's copy, edited like any typed spell, and `srd: { source, id }` links its text, shown
from the data with its material, higher levels and a reaction's trigger. The description stays
the player's own words. A re-import changes the text a link shows, never a sheet's fields. Old
spells have no link and load as they were; a link this build can't read is dropped, never the
sheet refused; rolling a deploy back drops links on the next save (decision 61's backups cover
it). The SRD's names and rules move to `app/campaign/srd.ts`, shared by monsters and spells.

Known gaps, from the data: 2024's Control Water has part of Control Weather's text, three 2024
tables are flattened into lines and Divine Word's lacks a row; 2014's Spirit Guardians has no
save or damage; cantrips' damage is their first level's, with the upgrade in the text.

## 76. The spell picker: loaded when opened, with the DM's spell notes as theirs

**Date:** 2026-10-11

**Context.** All 658 SRD spells with their text are 149 KB compressed; sent with every sheet
page (and the sheet beside the map) that's decision 74's problem again. Players pick their own
spells (decision 55), and the DM's vault spell notes may be DM-only. A prototype tried the feel.

**Decision.** Add spells on the Spells tab (and Find a spell beside Add spell while editing)
opens the picker, which loads its list from `/spells` (20 KB compressed with the fixture vault,
held to a budget in a test): the SRD's spells and the vault spell notes the viewer may read, a
DM-only one marked for the DM and never there for players. A row opens to the spell's text from
`/spells/text?key=` (the same 404 for a note that's missing or not theirs); + adds it. The sheet
page carries only the text of the SRD spells its spells link to (1.6 KB compressed for twenty).
Anyone who can edit the sheet can pick, the DM included; it's always someone's click, and nothing
checks a spell against class rules.

From the prototype: chips for Mine / 2024 / 2014 start on 2024 and Mine (2014 is a click away,
where 300 near-duplicates would confuse new players); browsing goes by level under headings,
searching best match first as for monsters; filters for level, class, concentration and ritual
(school didn't earn its place). A new spell starts prepared as decision 72 says, and the notice
says which, with Undo. A class's whole list at once waits for class lists.

The SRD has no Artificer, and some of the table's spells aren't in it, so vault spell notes can
say what they are in frontmatter (level, classes, casting time and the rest, all optional, read
leniently and documented in the README); picking one fills in what it gives and links the note.

## 77. Editing spells one at a time, and a feat's free spell shown where it's cast

**Date:** 2026-10-13

**Context.** Filling in Percy's sheet (eighteen spells) made editing a wall of forms, and a
typed-in spell arrived as "New spell" somewhere in the middle. Magic Initiate's spell (always
prepared, once a day for free, or with a slot) already worked through a spell's "Free cast" link,
but nothing on the sheet said so.

**Decision.** While editing, each spell is one row (prepared, moved within its level, removed)
that opens to its form, one at a time. Add spell asks for the name and level first, then opens the
new spell where it's listed and scrolls to it. A free spell shows its feature and that feature's
uses beside it, the feature says "Casts …", and a feature with uses can choose its spell while
editing (one step that unlinks any other). Cast's one click spends the free use while one is
left, saving a slot; slots stay in ▾. Nothing is stored differently: it's still `freeUse`.

## 78. The Maps page as a list with a preview; thumbnails one pixel per fog cell; areas as pins

**Date:** 2026-10-13

**Context.** The Maps page was a list of names: fine with three maps, hard to find one among
thirty. On the map itself, areas were amber and grey fills over the art, sitting on the lettering
the DM's Wonderdraft maps already have. A thumbnail is also a new way for players to get a map's
pixels, so it has to keep decision 30's promise that nothing under the fog leaves the server. A
prototype tried three Maps page layouts in the real themes (and eight more in a mock-up), and five
styles of area.

**Decision.** The Maps page is a nested list of names beside a preview (a tree of thumbnails felt
cluttered, and a grid of cards lost the nesting). Pointing at a name (after a moment, so sweeping
down the list doesn't flick through every map) or tabbing to it previews it: the whole map in a
frame that keeps its height from map to map, fading in; a pin for each map inside it, named on
hover, where the party's faces stand in for the pin; breadcrumbs; and a small copy of its parent,
ringed where it is. It opens on the party's map, and "Where the party is" is one line. On touch,
the first tap on a name previews it while the preview is beside the list. Players see shared maps
only, pins only over areas they can see, and "Where you are" for their own.

Thumbnails are made from an overview with one pixel per fog cell (512 along the longer side),
each the average of the image pixels whose centres are in that cell, the same rule the tiles'
masking uses. The DM gets the overview as it is; players get it masked from an exact copy, cell by
cell, from the fog as it is now, so a hidden cell's pixel is transparent with nothing of the image
in it (a test checks the bytes are the same whatever is under the fog). A shared map with nothing
revealed, a map that isn't shared and a missing one are the same 404. The overview is made once
per image version and fog grid, in the tile cache (one image decoded at a time), and ahead of time
when the server starts and when the vault changes. A minimap or a preview for slow connections can
use the same overview at more pixels per cell.

Areas are quiet by default: a small pin where the name goes (for the DM, hollow while it isn't
mapped yet, with a dashed outline), the party's faces in place of the pin. The outline (white over
a dark halo) and the name show on hover, on keyboard focus, when the area is pointed at in the
side panel's list, and for every place at once with the Places switch beside the zoom (or P). The
whole area still takes the pointer. On touch, the first tap shows an area and the second opens it.
The editor still draws outlines as before.

## 79. Skills that add monsters, spells and items to the vault, with nothing made up

**Date:** 2026-10-14

**Context.** The DM finds it easiest to have Claude add statblocks, spells and items from the
books (or tweaked versions of them) to the vault, but each kind has a shape Guildhall reads (a
Fantasy Statblocks block, a spell note's frontmatter, an item note), and Guildhall's rule was
never to write to the vault.

**Decision.** Three Claude Code skills, `/add-monster`, `/add-spell` and `/add-item`, committed in
`.claude/skills/`, with their shared rules in `docs/vault-authoring.md`. They're Claude writing
into the vault on the DM's request, not Guildhall: the app stays read-only, and the rule in
`CLAUDE.md` now says so. The skills only add notes; anything else needs the DM's say-so for exactly
that.

Nothing is made up: every word comes from the bundled SRDs, from what the DM pastes or photographs
(copied verbatim, flavour text included), or from the DM's own tweak with the numbers they gave.
Not from memory, and no invented flavour. The edition is asked when not given, never picked, and a
tweak's knock-on numbers are asked about rather than changed or left inconsistent.

Two scripts back them. `srd-lookup` prints an SRD monster or spell as a note (and asks which SRD
when both have the name). `check-note` reports what Guildhall makes of a note (statblocks the
tracker can't use, spell fields the picker would drop), so mistakes show before the table finds
them. Both load the app's own modules through Vite, so they read notes exactly as the app does.
The vault's path is `VAULT_PATH` from the gitignored `.env`, so nothing personal is committed.
Guildhall bundles no SRD items, so items always come from the DM.

## 80. Fights start from tokens on the map; a monster is the same marker all through

**Date:** 2026-10-31

**Context.** Preparing a fight meant a separate list (prepared encounters), placed on a map, with
monsters becoming new tokens when it started: named "Goblin 2" by the tracker, red, then grey
markers after the fight. The DM sets up scenes with tokens anyway, and wanted the tokens to be
the fight. A plan where prepared fights pointed at markers (2026-10-14) was dropped for this.

**Decision.** The map is the preparation. A marker may carry a monster's statblock (picked from the
vault's and both SRDs', or a note's own). The DM picks tokens on the map (Shift-click, a box drawn
with Shift held, or ticks in the Tokens tab) and starts a fight with them, or adds them to the
running one: markers with a statblock join as monsters, party members as themselves.

A monster is the same marker all through. It's linked to its combatant (`combatant`, set by a
`joinFight` token action) and keeps its own name (the combatant takes it, so players see "Snaggle",
not "Goblin 1"), colour and picture. While it's in the fight, the fight says whether it's hidden
(one switch: showing the marker reveals the monster) and its hit points; at 0 it's crossed out,
never greyed. When it leaves the fight (taken out, or the fight left on the map) it stays a plain
marker with the hit points it had (`hp`, which only fights set; Full HP forgets them) and shown as
its monster was; clearing the monsters at the end removes it. Monsters added in the tracker are
placed as linked markers too, so every monster behaves the same. Tokens stored as `combatant`
tokens by earlier versions are still read.

The links are saved before the fight changes, so the answer to them can't arrive after the
fight's own live update and undo it in the browser. Prepared encounters keep working for now, to
be retired once this has been used at the table.

## 81. Players take their own tokens between maps, through what they can see

**Date:** 2026-10-31

**Context.** Only the DM moved tokens between maps (decisions 45 and 67), since entering
somewhere is a story beat. At the table that meant the DM doing every "we go into the inn" by
hand, when the place was already revealed and shared and the players knew it was there.

**Decision.** Players take their own party members (their PC, and the companion the party shares)
to another map, with buttons: **Go in** beside an area in the map's Places list, and **Back to**
the map above beside the breadcrumbs. Dragging onto an area stays an ordinary move, so standing on
a building doesn't send you inside it. The ways are worked out on the server from the explicit
`Viewer` (`travelWays`): into a map an area leads to, if the area is seen (not secret, at least
half revealed) and the map is shared; up to the map above, if it's shared and the area there that
leads here is seen. A way they don't have is the same 404 as a map that doesn't exist, so nothing
about hidden maps gets out.

It's its own route (`/maps/:id/travel`, `{ token, to }`), not a token action: the server decides
where the token lands, from things the browser doesn't have (the map above's areas). Going up, it
lands inside the area it came out of; going in, beside a party member already there whom the
player would see, else in the middle; on a battle map that snaps, on a square. The token route
still refuses players' moves with a `map`.

The DM gets no lock: keeping a place shut is keeping it fogged, secret or unshared, and the DM sees
tokens go live and can bring them back. Fights stop it: no one walks into a map with a fight on it,
and no one in the fight walks out of its map; the DM still moves them as the story needs.

## 82. 3D dice, landing on the result already rolled, on each person's own screen

**Date:** 2026-10-31

**Context.** The DM wanted rolls to feel like dice, as on Roll20 or D&D Beyond, without giving up
what decides them: every result comes from the injected `Rng` (decision 55's table still rolls
real dice, and Guildhall's rolls are a convenience beside them). A spike
(`docs/spikes/3d-dice.md`) compared `@3d-dice/dice-box` (can't land on a result chosen first),
`@3d-dice/dice-box-threejs` (can, but stale since 2022) and three.js with cannon-es by hand.

**Decision.** three.js and cannon-es (both MIT), by hand, loaded in one lazy chunk on the first
roll. The roll is made as before; then the whole throw is simulated (`planThrow`) and each die
numbered so that the face that ends up on top shows the rolled value. The physics only decides
how the dice move. The throw's motion comes from `seededRng`, never the roll's `Rng`, so scripted
dice in tests aren't used up.

- Everything that shows a roll (the dice box, the sheet's latest roll, the panel beside the map)
  holds it back until the dice land, about 3 seconds (`useDiceTray`); if they never do (a hidden
  tab), it shows after 6. With reduced motion asked for, the dice appear landed and the result
  shows at once.
- Each person sees only their own dice: the DM's on the map and Combat page, a player's on their
  sheet and beside the map. Nothing is sent to anyone else. Shared rolls stay on the roadmap.
- Dice are on for everyone, with a switch in Settings saved on the account (`dice.off`).
- Dice sets (Gilded, Glass, Bone, Blood) are defined in the app, not the vault. The DM gives them
  per member on the Members page (`dice.given`) and has them all; each member picks theirs in
  Settings (`dice.set`), or the theme's dice in its accent colours. A set taken back falls back to
  the theme's dice. Sets belong to members, not to bags.
- The sounds are made with Web Audio (knocks from the simulation's collisions, a patter while
  rolling), following the stunts' sound switch and volume.
- End-to-end tests ask for reduced motion, so results show at once; `dice.spec.ts` throws them.
