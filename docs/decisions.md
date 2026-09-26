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
