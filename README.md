# Guildhall

[![CI](https://github.com/mattj7820/Guildhall/actions/workflows/ci.yml/badge.svg)](https://github.com/mattj7820/Guildhall/actions/workflows/ci.yml)

A personal hub for running a Dungeons & Dragons campaign. It links out to the tools used at the
table and hosts its own modules: a **read-only wiki over an Obsidian vault**, with a preview of
what the players are allowed to see, a **combat tracker** that runs monsters straight from the
vault's statblocks, and **interactive maps** made from the vault's map images, with **fog of war**
that opens up as the party explores and **tokens** showing where everyone is, moved live by the
DM and players alike. Players sign in
with Discord, and it's built to be hosted, with the vault copied read-only from Google Drive.

The long-term goal is interconnection: wiki, maps, characters, combat and dice all linking through
one shared model of the campaign (NPCs, locations, sessions…). See [the roadmap](docs/roadmap.md).

> **Screenshots:** _placeholder, coming soon._
>
> <!-- ![Hub home page](docs/screenshots/home.png) ![Wiki note in player view](docs/screenshots/wiki-player.png) -->

## Features

- **Hub home page** with cards for in-app modules.
- **Campaign wiki**, read straight from an Obsidian vault folder, which stays the source of truth:
  - Obsidian-flavoured markdown: frontmatter, `[[wikilinks]]` (aliases, heading links, Obsidian's
    shortest-path resolution), `![[image]]` embeds with sizes, GitHub-flavoured markdown.
  - Audio embeds (`![[voice.m4a]]`, e.g. from Obsidian's recorder) play inline.
  - Monster statblocks written for the Fantasy Statblocks plugin (` ```statblock ` blocks),
    laid out like the 5e books.
  - Folder-tree navigation and full-text search (prefix and fuzzy, boosted by title and aliases).
  - Picks up edits made in Obsidian on the next page load.
- **Combat tracker**, made for a second screen next to the VTT and voice chat, or run from a
  battle map:
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
  - A dice roller (`2d6+3`, advantage and disadvantage), and undo.
  - **One fight for the table**, kept on the server: it survives reloads and restarts, and every
    change reaches everyone at once. Players follow it on their Combat page (or over the map): the
    turn order, their own characters' conditions and hit points (from their sheets), and an "End
    my turn" button. They never get monsters' hit points, initiative numbers or the DM's notes.
    The DM's tracker shows the party's hit points from their sheets too.
  - Monsters can be **hidden** from players (an ambusher) until the DM reveals them: left out of
    their turn order and their map entirely.
  - **Prepared encounters:** set up fights before the session (monsters with their HP rolled,
    companions, notes), then start one at the table. Just untick anyone absent and type the
    players' initiative. They're reusable templates you can edit, duplicate and delete, saved in
    Guildhall's data folder. Set one up on a map and it starts there, with the monsters where you
    put them; bring the party in with a click.
- **Character sheets**, one per PC note, laid out like the paper sheet:
  - Numbers are typed in as they are on paper; the sheet works out only what paper does
    (modifiers, save and skill bonuses with proficiency or expertise, initiative, passive scores),
    and any of those can be typed over for features it doesn't know about.
  - Click any bonus to roll it, labelled "Kit · Stealth", with advantage and disadvantage.
  - Hit points with Heal and Damage always to hand (temporary HP soaks up damage first).
  - Changes save as they're made, with undo and redo. The DM and the player can edit the same
    sheet at once: changes to different things are both kept, and if both change the same thing,
    the later one wins and its sender is told what it replaced.
  - Players open and edit only their own characters; everyone else sees a summary (name,
    portrait, species, class, level and equipped items). The PC note is the sheet's story.
- **What gets used up**, tracked on the sheet as typed from paper (no rules engine):
  - Spell slots by level, hit dice by size and each feature's uses as lit pips, like a game's
    charges: one click uses one, a click on a spent one gives it back. What's being concentrated
    on, with Drop.
  - Features: class features, species traits, feats and items' powers, each with how it's used
    (action, bonus action, reaction, other or passive), a one-line note, a roll and uses that come
    back on a short rest, a long rest or only by hand. A reminder of everything a character can do.
  - Attacks with to-hit and damage, and spells by level with their casting time, range,
    components, duration, save or attack and dice, all rolled with a click. The spell save DC and
    attack bonus are worked out, and can be typed over. A spell can link to the vault's spell note
    (`type: spell`, DM parts left out) and be cast for free through a feat's once a day.
  - Cast spends the lowest slot left in one click (or a higher slot, the free use, or as a ritual)
    and takes over concentration. Rolling stays a click of its own.
  - **Preparing spells:** keep a class's whole list on the sheet and tick which are ready today in
    Prepare mode, against a typed "Spells to prepare" (going over warns, never blocks). Day to day
    the Spells tab shows only what's ready: prepared spells, cantrips and a feat's free spell, which
    are always ready. A long rest offers to change them.
  - Filters, as on D&D Beyond's sheet: actions by attack, action, bonus action, reaction or limited
    use; spells by level, concentration or ritual; features by where they come from.
  - Short rest (spend hit dice, rolled there or rolled at the table and typed in) and Long rest
    (2024 rules: everything back), each one step to undo.
- **The sheet beside the map**: on a map, a player's side panel has Map, Sheet and Bag tabs, so
  hit points, slots, uses, rests, attacks and spells are to hand mid-session without leaving the
  map. It keeps one width, folds away for more map, and opens with C (sheet) and I (bag).
- **A game-style bag** beside the sheet (press I):
  - Items as tiles with icons and names, in a grid that grows as needed. Drag to move, drop on an
    identical item to stack, hold Shift to take half, drop on the Equipped slots to equip (and
    drag back out, or press ✕, to unequip), or on the bin to remove, with undo. Everything also
    works from the keyboard and with a screen reader, and by long press on a phone.
  - Quick add: type "3 torches" and press Enter. Items can link to the vault's item notes, whose
    shared text shows in the item's details (the DM's parts never reach players).
  - Descriptions, where an item came from, coins (drawn copper to platinum, with their worth in
    gold), sorting and search.
  - The DM can give items to anyone; they arrive marked new. Players give items to each other,
    and to the party's shared companion (a `type: companion` note), whose bag everyone can use.
- **Interactive maps**, made from the map images already in the vault (Wonderdraft or
  Dungeondraft exports, say):
  - Outline anything on a map (a region, a town, one building) by clicking round it, then name it
    and reshape it by dragging its points, or with the keyboard. Undo and redo, and every change
    saves itself.
  - An area can lead to a more detailed map, a wiki note, or both. Maps nest to any depth (world,
    region, town, building), with breadcrumbs back up. An area with no map yet is shown dashed,
    with its note and a one-click way to attach a map, never a dead end.
  - Large images (a 4K, 15 MB export) fit the screen, then pan and zoom smoothly and stay sharp.
    Present mode shows just the map, for sharing on a call.
  - Outlines are stored relative to the image, so re-exporting a map at a new resolution keeps
    them lined up; the DM is warned if the image has moved, gone or changed shape.
  - Maps and areas are kept in Guildhall's data folder; the vault is only read. Wiki notes link to
    their maps.
- **Fog of war**, like a game's map screen: the DM shares a map, and players see only what's been
  revealed. Everything else is black.
  - Reveal as the party moves, mid-session: a brush with an adjustable size, a rectangle, or a
    click on an outlined area, and hide again the same way (hold Alt). Reveal all, hide all, undo
    and redo. The DM sees the whole map through the fog, and which areas players can see.
  - Players see a reveal as it happens, without reloading, and pan and zoom freely. Areas appear
    once half of them is revealed, leading to deeper maps the DM has shared; a secret area never
    appears.
  - Hidden parts never leave the server: players get the image as tiles with the fogged pixels
    taken out, never the image itself, and tests prove a player's tiles are byte-for-byte the same
    whatever is under the fog. The fog's edge is soft and only ever eats into what's revealed.
- **Tokens, shared live**, like a game's map screen showing where the party is.
  - A token for each PC and the party's companion, with their portrait (or an initial), and the
    DM's own: NPCs from their vault notes, drawn with the note's picture under a name of the DM's
    choosing (so a hooded figure stays hooded), and markers with an icon or a colour. All DM-only
    until shown, in one click.
  - The DM manages every token from a Tokens tab beside the map: add several at once (Bandit 1 to
    3), set one aside off the map to bring back later, and send tokens between maps.
  - Players drag their own PC and the companion, or move them with the arrow keys; the DM moves
    anything. Everyone sees a token move as it's dragged, and whoever picks one up holds it until
    they let go, so nobody fights over the blink dog (the DM can always take it).
  - Each party member is in one place: the maps above show who's inside an area, the Maps page says
    where you are, and Find takes you to your token. The DM brings the party into a deeper map
    with one click.
  - Tokens under the fog never reach players, not in the page, its data or the live connection:
    only their own, drawn "in the dark". An NPC's picture is served by its token, only to those
    who may see the token, and its note never reaches players at all. Live updates run over websockets on the same server,
    signed in like pages, with every message built for the person receiving it.
- **Battle maps**: turn a grid on for any map (a Dungeondraft export, a town, a cave) and it
  becomes a battle map.
  - Squares of 5 ft, scaled to fit the map with a slider (it suggests the exact fit for
    Dungeondraft exports), offset to line up with a grid in the image, and faint or hidden lines.
  - Tokens fill their squares, from Medium to Gargantuan, and snap to them (a switch per map, or
    hold Alt), by mouse or a square at a time with the arrow keys.
  - A toolbar over the map: measure true distances, with turns; lay out a spell's sphere, cube,
    cone or line and see which squares and who it catches. Just on your own screen.
  - **The fight on the map:** Combat puts the tracker beside the map and a turn strip across it.
    Monsters joining are placed with a click, sized from their statblocks; their tokens show the
    DM an HP bar, go grey when down, and leave when the monster does. Whoever's turn it is is
    ringed, for everyone. Players move only on their own turn, unless the DM switches on free
    movement (the DM moves anything). End fight clears the monsters, or leaves them where they
    fell.
  - **Quick damage:** click a monster's token (Shift-click for more, or pick everyone a spell area
    catches) and type the number a player rolled: Damage, Half or Heal, all at once.
  - **Stunts, for the big moments:** the DM can play an impact, a flash, a cloud of smoke or a
    screen shake on the map, or make a token wobble, glow or fall, and play sounds from a vault
    folder, for everyone watching. Nothing plays by itself. Anyone can turn stunts off, mute
    sounds or set the volume, and reduced-motion settings get gentler versions.
- **What players see.** Notes are DM-only unless their frontmatter says `visibility: players`.
  Players never get DM-only notes: they're left out of navigation, search and links, and a direct
  URL gives the same 404 as a missing note. Inside a shared note, the DM's parts stay secret: a
  section under a `## DM` heading, a `> [!dm]` callout, or an Obsidian `%%comment%%`. Players never
  receive them (not on the page, in search or in statblocks), while the DM sees them boxed as
  "DM only". The DM can preview the players' view at any time.
- **Sign in with Discord.** Everyone signs in with their Discord account; newcomers wait until the
  DM lets them in on the Members page and says which player they are, which links them to their
  characters. Removing someone signs them out everywhere. Only the Discord name is asked for.
- **Ready to host:** a Docker image, and a companion container that copies the vault from Google
  Drive every minute, read-only, so Obsidian stays the place you write. See
  [docs/deployment.md](docs/deployment.md).

## Getting started

Requires Node.js 26 or later (see `.nvmrc`).

```sh
npm install
cp .env.example .env    # then set VAULT_PATH
npm run dev             # http://localhost:3000
```

With no vault of your own, the default `.env.example` points at the fixture vault in
`tests/fixtures/vault`, and turns on dev sign-in (one-click pretend accounts, this computer only),
so the app runs out of the box.

| Variable     | Required | Description                                                                                   |
| ------------ | -------- | --------------------------------------------------------------------------------------------- |
| `VAULT_PATH` | yes      | Path to the Obsidian vault. **Only ever read, never written.**                                |
| `DATA_PATH`  | no       | Where Guildhall keeps its own data (default `./data`). Must be outside the vault; back it up. |
| `PORT`       | no       | Web server port (default `3000`).                                                             |
| `DEV_LOGIN`  | no       | `true` for one-click sign-in as the DM or a player, on this computer only.                    |

Hosting adds a few more settings (the public address, the session secret and the Discord
application); see `.env.example` and [docs/deployment.md](docs/deployment.md).

### Frontmatter conventions

```yaml
---
visibility: players # players | dm. Missing or unrecognised means dm (fails closed).
type: npc # optional entity type: npc, pc, companion, location, faction, item, session, lore, map…
aliases: [Mira] # standard Obsidian aliases; also searchable
tags: [brindleford]
id: npc-mira # optional stable ID that survives renaming the file
player: Sam # on type: pc notes, who plays the character (their sheet, the combat tracker)
# type: item and type: spell notes can be linked from bags and spells on sheets
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

Unit tests cover vault parsing, Obsidian link resolution, rendering and visibility rules, the combat
rules (initiative and reroll tie-breaks, turns and rounds, HP, dice, what a player may see) with
scripted dice, and characters (the modifier maths, who may do what, every change and its undo,
merging two people's edits, and the bag's rules for stacking, splitting and giving), and tokens (who
may move and see what, and what the live connection may send to whom, checked on a real server).
Playwright covers the user journeys: the hub, wikilink navigation, search, the player view hiding DM
content everywhere, running a fight, editing a sheet and rolling from it, using the bag by mouse and
keyboard, and the DM and a player moving tokens on the same map in two browsers. All tests run
against an invented fixture vault, and the e2e run fails if that vault is modified in any way. CI
runs lint, typecheck, unit tests (Linux and Windows) and e2e tests on every push. See
[docs/testing.md](docs/testing.md) for the strategy.

## Tech stack

TypeScript, [React Router 8](https://reactrouter.com) (framework mode, SSR) on Express, Tailwind
CSS, unified/remark/rehype for markdown, MiniSearch, Vitest, Playwright, GitHub Actions. The
reasons are in [docs/decisions.md](docs/decisions.md).

## Project structure

```
app/
  campaign/        Shared campaign model: roles, players, visibility, entity types (isomorphic)
  combat/          Combat tracker model and rules: encounters, initiative, turns, HP, the
                   shared fight and what each person sees of it (isomorphic)
  dice/            Dice expressions and rolling, with injectable randomness (isomorphic)
  hub/             Hub links configuration
  wiki/            Wiki types and URL helpers shared by server and browser
  maps/            Interactive maps model: areas, geometry, pan and zoom, the editor (isomorphic)
    fog/           Fog of war: the mask, reveals and hides, undo, pixels and tiles (isomorphic)
    tokens/        Tokens: who may move and see what, moves as actions, drags (isomorphic)
    grid/          Battle grids: squares and snapping, distances, spell areas (isomorphic)
  live/            The browser's live connection, and the messages both ends send
  characters/      Sheets and bags: the model, spells and preparing, uses and rests, changes as actions,
                   undo, saving (isomorphic)
  members/         Who can sign in: member shapes shared with the browser
  .server/         Server-only code: config, the DM's preview cookie
    auth/          Sessions, who may reach what, Discord sign-in, dev sign-in
    members/       The member list and waiting list
    vault/         Vault reading, parsing, link resolution, rendering, search, statblocks
    combat/        The combat tracker's catalogue, the prepared-encounter store and the fight
    maps/          The map, fog and token stores, maps prepared for a viewer, players' map tiles
    live/          Websockets: signing them in, rooms per map, messages built per viewer, holds
    characters/    The character store, who plays whom, and sheets prepared for a viewer
    data/          The JSON store and file cache: the only code that writes files, only in DATA_PATH
  routes/          Pages and resource routes
  components/      UI components (combat/, maps/, characters/ and inventory/ by module)
server/app.ts      Express app: creates long-lived services, mounts React Router
server/http.ts     Proxy trust, security headers, health check
server.js          HTTP entry point (dev: Vite middleware; prod: static + build), and websockets
scripts/           One-off tools (importing the item icons)
tests/
  fixtures/vault/  Invented Obsidian vault used by all tests
  e2e/             Playwright specs
docs/              Roadmap, decisions, testing strategy, deployment
Dockerfile, docker-compose.yml   The image, and the app beside its Google Drive sync
```

## Principles

- **The vault is read-only.** The app never writes, moves or deletes vault files. This is enforced
  by an ESLint rule banning filesystem write APIs in app code (the one exception is the JSON store
  for Guildhall's own data folder, which config refuses to place inside the vault), and by a
  test-run check that the fixture vault is byte-identical before and after.
- **The story is human-written.** Guildhall has no AI-generated story, lore or narrative content.
- **Built for more than one user.** Everyone signs in, and every visibility decision takes an
  explicit viewer worked out on the server for each request, so players never receive DM content.

## License

[MIT](LICENSE)

Item and token icons are from [game-icons.net](https://game-icons.net) by Lorc, Delapouite,
Willdabeast, Lucas and Carl Olsen, licensed under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Each icon's author is recorded in
`app/characters/item-icons.ts` and `app/maps/tokens/token-icons.ts`.
