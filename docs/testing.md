# Testing strategy

Testing is a first-class part of Guildhall. The aim is confidence that the rules that matter hold
(links resolve like Obsidian does, and players never see DM content), with tests that read as a
specification of the behaviour.

## Layers

| Layer       | Tool                    | Location                             | What it covers                                                                                                                                                              |
| ----------- | ----------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                  | `app/**/*.test.ts`, next to the code | Pure logic: frontmatter parsing, wikilink parsing and resolution, `%%comment%%` handling, markdown rendering and sanitising, visibility rules, config validation, hub links |
| Integration | Vitest                  | `app/.server/vault/vault.test.ts`    | The `Vault` over the real fixture vault on disk: reading, folder tree, search, visibility filtering, asset access                                                           |
| End-to-end  | Playwright              | `tests/e2e/*.spec.ts`                | User journeys against the production build: hub, wikilink navigation, search, the player view hiding DM content                                                             |
| Static      | ESLint, Prettier, `tsc` | whole repo                           | Types, style, and a lint rule that bans filesystem write APIs in app code                                                                                                   |

Most behaviour is pinned down at the unit level, where it's fast and precise. End-to-end tests
prove the pieces are wired together and cover what only a browser can show: client-side
navigation, heading anchors scrolling into view, images loading, cookies switching views.

## Fixture vault

`tests/fixtures/vault` is a small, invented Obsidian vault. It is **test data, not campaign
content**, and it's never a real vault. Each note exists to exercise a specific behaviour, and
its body says which, for example:

- `Home.md`: one of each link form (plain, aliased, heading, path, `.md` extension, broken, and
  links inside code).
- `NPCs/Captain Voss.md`: no `visibility` field, so DM-only by default.
- `Secrets/Villain Plan.md`: explicit `visibility: dm`, a stable `id`, and a DM-only image.
- `Secrets/Broken Frontmatter.md`: invalid YAML that must fail closed to DM-only.
- `Locations/Old Mill.md` and `Locations/Brindleford/Old Mill.md`: an ambiguous name.
- `NPCs/Mira Stonehand.md`: image embeds and inline and block `%%DM comments%%`.
- `.obsidian/` and `.trash/`: must be ignored.

Pure unit tests build their inputs inline (for example, a string of markdown and a stub resolver)
so each test shows everything it depends on. Integration and e2e tests use the fixture vault.

To add a scenario, add or extend a fixture note, state its purpose in the note body, then assert
on it. Keep fixture text short and functional.

## Guarding the read-only rule

The app must never modify the vault. Three independent checks:

1. **Lint:** ESLint's `no-restricted-imports`/`no-restricted-properties` ban `fs` write APIs
   (`writeFile`, `rename`, `rm`, `mkdir`…) and namespace imports of `fs` in `app/` and `server/`.
2. **Construction:** the asset route can only serve files the vault index discovered, so a
   crafted path can't reach outside the vault.
3. **E2E fingerprint:** Playwright's global setup hashes every fixture file (path, size, mtime,
   contents) before the run, and fails the run if anything changed afterwards.

## Conventions

- Test names describe behaviour ("hides DM-only notes from the sidebar"), not implementation.
- E2E tests use accessible locators (`getByRole`, `getByText`, labelled landmarks) rather than
  test IDs or CSS selectors, so they also check that the UI is accessible. Shared helpers live in
  `tests/e2e/support/app.ts`.
- Each Playwright test starts in a fresh browser context, so it begins in the DM view with no
  cookies.
- Table-driven cases (`it.each`) for input/output rules such as link parsing and invalid config.

## Running

```sh
npm test               # unit + integration
npm run test:watch     # watch mode
npm run test:e2e       # builds the app, serves it on :4173 with the fixture vault, runs Playwright
npx playwright show-report
```

The e2e config sets `VAULT_PATH` itself, overriding any local `.env`, so a real vault is never
used in tests.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

- **checks** (Ubuntu): lint, typecheck, unit tests
- **unit-windows**: unit tests on Windows, since vault paths are normalised across OSes
- **e2e** (Ubuntu): Playwright (Chromium); the HTML report is uploaded when it fails

## Next steps

- Component tests for UI pieces as they grow (for example, the folder tree).
- Coverage reporting once the codebase is larger; kept as a signal, not a target.
- Accessibility checks with `@axe-core/playwright` on key pages.
- Visual regression screenshots once the design settles.
