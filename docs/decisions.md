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
