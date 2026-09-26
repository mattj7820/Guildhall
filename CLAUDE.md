# Guildhall: notes for Claude

A personal D&D campaign hub (hobby project and public portfolio repo). The owner DMs an online
campaign for two players: Roll20 for maps, Discord for voice, and all notes in an Obsidian vault.
Guildhall links out to those tools and grows its own modules. The point of building it is
**interconnection**: eventually wiki, maps, characters, combat and dice all link through a shared
campaign model (NPCs, locations, maps, characters, sessions). See `docs/roadmap.md`.

Current slice: hub home page + read-only Obsidian wiki with a DM/player preview.

## Hard constraints

- **Never write to, move or delete anything in the vault.** Read-only access only. An ESLint rule
  bans fs write APIs (and namespace `fs` imports) in `app/` and `server/`; don't work around it.
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
- `server/app.ts`: creates long-lived services once (config, `LiveVault`) and passes them to
  React Router through `servicesContext`.
- `app/root.tsx`: middleware sets `viewerContext` from the view cookie (`app/.server/viewer.ts`).
  **Loaders read the viewer from context and pass it into every vault query.**
- `app/campaign/`: shared model (isomorphic): `Viewer`, `Visibility`, `EntityId`, entity types,
  `canView`.
- `app/.server/vault/`:
  - `read-vault.ts`: the only reader of vault files. Skips dotfolders.
  - `parse-note.ts`: frontmatter → `Note`. Visibility fails closed to `dm`.
  - `link-resolver.ts`: Obsidian wikilink parsing and shortest-path resolution.
  - `comments.ts`: `%%comments%%` stripped for players, highlighted for the DM.
  - `remark-wikilinks.ts` + `render.ts`: markdown → sanitised HTML.
  - `search.ts`: MiniSearch, one index per role, built from role-appropriate text.
  - `statblock/`: parses ` ```statblock ` YAML (Fantasy Statblocks plugin format) and renders it
    book-style, after sanitising, with vault values inserted only as text nodes.
  - `vault.ts`: immutable snapshot. `live-vault.ts` rebuilds it on file changes.
- `app/wiki/`: URL helpers and types shared with the browser.
- `app/routes/`: `home`, `wiki` (layout + sidebar), `wiki-home` (landing page + `?q=` search),
  `wiki-note` (`/wiki/*`), `vault-asset` (resource route), `view-mode` (toggle action).

## Conventions

- Vault paths are POSIX, vault-relative, with extension (`NPCs/Mira.md`). The slug drops `.md`.
  Note URLs come from `noteUrl()` in `app/wiki/urls.ts`.
- Server-only code lives under `app/.server/`. Browser code must not import from it (types
  included; put shared shapes in `app/wiki/` or `app/campaign/`).
- Frontmatter: `visibility` (`players`|`dm`, default `dm`), `type`, `aliases`, `tags`, `id`.
- Hidden content must be indistinguishable from missing content in player view (same 404, links
  become plain text, excluded from search and the tree).
- Unit tests sit next to the code (`*.test.ts`); e2e specs in `tests/e2e/` use accessible
  locators (`getByRole`) and the helpers in `tests/e2e/support/app.ts`. New behaviour gets a
  fixture note whose body states what it tests. See `docs/testing.md`.
- Prettier formats everything (print width 100). Keep comments short and about _why_.
