# Guildhall

[![CI](https://github.com/mattj7820/Guildhall/actions/workflows/ci.yml/badge.svg)](https://github.com/mattj7820/Guildhall/actions/workflows/ci.yml)

A personal hub for running a Dungeons & Dragons campaign. It links out to the tools used at the
table and hosts its own modules: a **read-only wiki over an Obsidian vault**, with a preview of
what the players are allowed to see, and a **combat tracker** that runs monsters straight from the
vault's statblocks.

The long-term goal is interconnection: wiki, maps, characters, combat and dice all linking through
one shared model of the campaign (NPCs, locations, sessions…). See [the roadmap](docs/roadmap.md).

> **Screenshots:** _placeholder, coming soon._
>
> <!-- ![Hub home page](docs/screenshots/home.png) ![Wiki note in player view](docs/screenshots/wiki-player.png) -->

## Features

- **Hub home page** with a configurable link to the Roll20 campaign and cards for in-app modules.
- **Campaign wiki**, read straight from an Obsidian vault folder, which stays the source of truth:
  - Obsidian-flavoured markdown: frontmatter, `[[wikilinks]]` (aliases, heading links, Obsidian's
    shortest-path resolution), `![[image]]` embeds with sizes, GitHub-flavoured markdown.
  - Audio embeds (`![[voice.m4a]]`, e.g. from Obsidian's recorder) play inline.
  - Monster statblocks written for the Fantasy Statblocks plugin (` ```statblock ` blocks),
    laid out like the 5e books.
  - Folder-tree navigation and full-text search (prefix and fuzzy, boosted by title and aliases).
  - Picks up edits made in Obsidian on the next page load.
- **Combat tracker** (DM only), made for a second screen next to the VTT and voice chat:
  - Builds an encounter from the vault: monsters from any statblock (numbered "Goblin 1",
    "Goblin 2"…, with hit points rolled from their hit dice), the party from PC notes, and
    companions assigned to a player for the battle.
  - Initiative: monsters roll d20 + DEX, and players' physical rolls are typed in. Ties are broken
    by rerolls until they differ: automatically for monsters, with a prompt for players. The order
    can be changed by hand.
  - Turns and rounds, adding and removing combatants mid-fight, and monster HP with damage,
    healing, temporary HP, and bloodied and down states (down monsters are skipped). Condition
    tags and short notes for anyone.
  - The current monster's statblock alongside, in the same book layout as the wiki.
  - **Click to roll** from the statblock: attacks (`+4 to hit`), damage (`5 (1d6 + 2)`), ability
    checks, saves, skills and recharges, labelled "Goblin 1 · Scimitar attack". A natural 20 arms
    a critical-damage roll with doubled dice, and advantage applies to one roll at a time.
  - A dice roller (`2d6+3`, advantage and disadvantage), undo, and an encounter that survives a
    page reload (kept in the browser's local storage).
  - **Prepared encounters:** set up fights before the session (monsters with their HP rolled,
    companions, notes), then start one at the table. Just untick anyone absent and type the
    players' initiative. They're reusable templates you can edit, duplicate and delete, saved in
    Guildhall's data folder.
- **DM / player preview.** Notes are DM-only unless their frontmatter says `visibility: players`.
  The player view hides DM-only notes from navigation, search, links and direct URLs, and strips
  Obsidian `%%comments%%`, so DMs can keep inline secrets inside shared notes.
  _This is a preview, not access control. Real authentication comes with multiplayer._

## Getting started

Requires Node.js 26 or later (see `.nvmrc`).

```sh
npm install
cp .env.example .env    # then set VAULT_PATH (and optionally ROLL20_CAMPAIGN_URL)
npm run dev             # http://localhost:3000
```

With no vault of your own, the default `.env.example` points at the fixture vault in
`tests/fixtures/vault`, so the app runs out of the box.

| Variable              | Required | Description                                                                                   |
| --------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `VAULT_PATH`          | yes      | Path to the Obsidian vault. **Only ever read, never written.**                                |
| `DATA_PATH`           | no       | Where Guildhall keeps its own data (default `./data`). Must be outside the vault; back it up. |
| `ROLL20_CAMPAIGN_URL` | no       | Roll20 campaign link shown on the hub.                                                        |
| `PORT`                | no       | Web server port (default `3000`).                                                             |

### Frontmatter conventions

```yaml
---
visibility: players # players | dm. Missing or unrecognised means dm (fails closed).
type: npc # optional entity type: npc, pc, location, faction, item, session, lore, map…
aliases: [Mira] # standard Obsidian aliases; also searchable
tags: [brindleford]
id: npc-mira # optional stable ID that survives renaming the file
player: Sam # on type: pc notes, who plays the character (used by the combat tracker)
---
```

## Scripts

| Command             | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Development server with hot reload                       |
| `npm run build`     | Production build                                         |
| `npm start`         | Run the production build                                 |
| `npm run lint`      | ESLint + Prettier check                                  |
| `npm run typecheck` | Generate route types and run `tsc`                       |
| `npm test`          | Unit tests (Vitest)                                      |
| `npm run test:e2e`  | End-to-end tests (Playwright; builds and starts the app) |
| `npm run check`     | All of the above, as CI runs it                          |

Before running the end-to-end tests for the first time: `npx playwright install chromium`.

## Testing

Unit tests cover vault parsing, Obsidian link resolution, rendering and visibility rules, and the
combat rules (initiative and reroll tie-breaks, turns and rounds, HP, dice, what a player may see)
with scripted dice. Playwright covers the user journeys: the hub, wikilink navigation, search, the
player view hiding DM content everywhere, and running a fight in the combat tracker. All tests run against an invented fixture vault, and the e2e run
fails if that vault is modified in any way. CI runs lint, typecheck, unit tests (Linux and
Windows) and e2e tests on every push. See [docs/testing.md](docs/testing.md) for the strategy.

## Tech stack

TypeScript, [React Router 8](https://reactrouter.com) (framework mode, SSR) on Express, Tailwind
CSS, unified/remark/rehype for markdown, MiniSearch, Vitest, Playwright, GitHub Actions. The
reasons are in [docs/decisions.md](docs/decisions.md).

## Project structure

```
app/
  campaign/        Shared campaign model: roles, players, visibility, entity types (isomorphic)
  combat/          Combat tracker model and rules: encounters, initiative, turns, HP (isomorphic)
  dice/            Dice expressions and rolling, with injectable randomness (isomorphic)
  hub/             Hub links configuration
  wiki/            Wiki types and URL helpers shared by server and browser
  .server/         Server-only code: config, viewer cookie
    vault/         Vault reading, parsing, link resolution, rendering, search, statblocks
    combat/        The combat tracker's catalogue and the prepared-encounter store
    data/          The JSON store: the only code that writes files, and only in DATA_PATH
  routes/          Pages and resource routes
  components/      UI components (combat/ holds the tracker's)
server/app.ts      Express app: creates long-lived services, mounts React Router
server.js          HTTP entry point (dev: Vite middleware; prod: static + build)
tests/
  fixtures/vault/  Invented Obsidian vault used by all tests
  e2e/             Playwright specs
docs/              Roadmap, decisions, testing strategy
```

## Principles

- **The vault is read-only.** The app never writes, moves or deletes vault files. This is enforced
  by an ESLint rule banning filesystem write APIs in app code (the one exception is the JSON store
  for Guildhall's own data folder, which config refuses to place inside the vault), and by a
  test-run check that the fixture vault is byte-identical before and after.
- **The story is human-written.** Guildhall has no AI-generated story, lore or narrative content.
- **Built for more than one user.** Every visibility decision takes an explicit viewer, and
  entities have stable IDs, so multiplayer and real roles can be added without a rewrite.

## License

[MIT](LICENSE)
