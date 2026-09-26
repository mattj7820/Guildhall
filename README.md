# Guildhall

[![CI](https://github.com/OWNER/guildhall/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/guildhall/actions/workflows/ci.yml)

A personal hub for running a Dungeons & Dragons campaign. It links out to the tools used at the
table and hosts its own modules, starting with a **read-only wiki over an Obsidian vault**, with a
preview of what the players are allowed to see.

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
  - Folder-tree navigation and full-text search (prefix and fuzzy, boosted by title and aliases).
  - Picks up edits made in Obsidian on the next page load.
- **DM / player preview.** Notes are DM-only unless their frontmatter says `visibility: players`.
  The player view hides DM-only notes from navigation, search, links and direct URLs, and strips
  Obsidian `%%comments%%`, so DMs can keep inline secrets inside shared notes.
  _This is a preview, not access control. Real authentication comes with multiplayer._

## Getting started

Requires Node.js 22.22 or later (see `.nvmrc`).

```sh
npm install
cp .env.example .env    # then set VAULT_PATH (and optionally ROLL20_CAMPAIGN_URL)
npm run dev             # http://localhost:3000
```

With no vault of your own, the default `.env.example` points at the fixture vault in
`tests/fixtures/vault`, so the app runs out of the box.

| Variable              | Required | Description                                                    |
| --------------------- | -------- | -------------------------------------------------------------- |
| `VAULT_PATH`          | yes      | Path to the Obsidian vault. **Only ever read, never written.** |
| `ROLL20_CAMPAIGN_URL` | no       | Roll20 campaign link shown on the hub.                         |
| `PORT`                | no       | Web server port (default `3000`).                              |

### Frontmatter conventions

```yaml
---
visibility: players # players | dm. Missing or unrecognised means dm (fails closed).
type: npc # optional entity type: npc, pc, location, faction, item, session, lore, map…
aliases: [Mira] # standard Obsidian aliases; also searchable
tags: [brindleford]
id: npc-mira # optional stable ID that survives renaming the file
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

Unit tests cover vault parsing, Obsidian link resolution, rendering and visibility rules.
Playwright covers the user journeys: the hub, wikilink navigation, search, and the player view
hiding DM content everywhere. All tests run against an invented fixture vault, and the e2e run
fails if that vault is modified in any way. CI runs lint, typecheck, unit tests (Linux and
Windows) and e2e tests on every push. See [docs/testing.md](docs/testing.md) for the strategy.

## Tech stack

TypeScript, [React Router 8](https://reactrouter.com) (framework mode, SSR) on Express, Tailwind
CSS, unified/remark/rehype for markdown, MiniSearch, Vitest, Playwright, GitHub Actions. The
reasons are in [docs/decisions.md](docs/decisions.md).

## Project structure

```
app/
  campaign/        Shared campaign model: roles, visibility, entity types (isomorphic)
  hub/             Hub links configuration
  wiki/            Wiki types and URL helpers shared by server and browser
  .server/         Server-only code: config, viewer cookie
    vault/         Vault reading, parsing, link resolution, rendering, search
  routes/          Pages and resource routes
  components/      UI components
server/app.ts      Express app: creates long-lived services, mounts React Router
server.js          HTTP entry point (dev: Vite middleware; prod: static + build)
tests/
  fixtures/vault/  Invented Obsidian vault used by all tests
  e2e/             Playwright specs
docs/              Roadmap, decisions, testing strategy
```

## Principles

- **The vault is read-only.** The app never writes, moves or deletes vault files. This is enforced
  by an ESLint rule banning filesystem write APIs in app code, and by a test-run check that the
  fixture vault is byte-identical before and after.
- **The story is human-written.** Guildhall has no AI-generated story, lore or narrative content.
- **Built for more than one user.** Every visibility decision takes an explicit viewer, and
  entities have stable IDs, so multiplayer and real roles can be added without a rewrite.
