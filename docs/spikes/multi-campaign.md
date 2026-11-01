# Spike: one campaign folder, and then several campaigns

**Date:** 2026-11-01 · **Prototype:** none; this is a read of the code, nothing built yet

**Question:** decision 88 scoped only the tome to one campaign folder. What would it take to
scope the whole app to that folder, and then to support more than one campaign?

**Answer:** scoping the whole app is small, because every vault read goes through one `Vault`
snapshot: build it from the campaign folder's notes and files only, keeping vault-relative paths,
and every module follows. The real work is Guildhall's own data, since maps, tokens, fog, the
fight and sheets are about one campaign's notes, and another campaign needs its own copy of them.
Several campaigns running at once, each with its own players, is a much bigger step: visibility
would gain a second dimension (which campaign) on every page, file and live message.

## Where the app reads the vault

Every read is a `Vault` method on `services.vault.current`. Scoping the snapshot itself (rather
than each caller) scopes all of them at once:

| Reader                                                          | What it reads                                                         | Scoped to the folder                                                                                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| wiki routes (`wiki`, `wiki-home`, `wiki-note`)                  | tree, search, tags, notes, render, linked from                        | Only the campaign's notes. A link to a note outside becomes plain text, as a hidden note's does.                                                            |
| `vault-asset`                                                   | attachments                                                           | Files outside are a 404.                                                                                                                                    |
| `characters/*`, `routes/characters`, `character-changes`        | PC and companion notes by ID, portraits, spell notes, item statblocks | A sheet whose note is outside is `unknown`: its players lose it (fails closed); the DM can relink. Spells already on sheets are the player's copy and stay. |
| `combat/catalogue.ts`                                           | party, vault statblocks                                               | Statblocks outside leave the picker; a combatant already in a fight keeps its ref, and its statblock no longer loads. The SRD is unaffected.                |
| `home/front-page.ts`, `members/players.ts`                      | notes (latest session), party                                         | Only the campaign's sessions and PCs.                                                                                                                       |
| `maps/load.ts`, `map-image`, `map-edit`, `map-view`, `maps.tsx` | map images (`findImage`, `mapImages`), area notes                     | A map whose image is outside shows as missing in `ImageHealth`; area links to notes outside go. The picker lists only the campaign's images.                |
| `maps/tokens.ts`                                                | NPC notes, their pictures                                             | A marker whose note is outside keeps its own name, loses its note and note picture.                                                                         |
| `map-stunts`, `sound`                                           | `soundsIn(SOUNDS_FOLDER)`                                             | `SOUNDS_FOLDER` is a vault path (default `Sounds`): outside the campaign folder the board would be empty.                                                   |
| `wiki/book.ts` (tome)                                           | top folders                                                           | Redundant: the campaign folder is the book.                                                                                                                 |
| `server/app.ts`                                                 | note count, logged                                                    | Logs the campaign's count.                                                                                                                                  |

Things that matter when building it:

- **Keep paths vault-relative.** Note IDs default to the slug (the path), and `maps.json`,
  `tokens.json` and `characters.json` hold those IDs and image paths. Re-rooting the vault at the
  campaign folder would change every slug and break all stored links; filtering the snapshot
  changes none of them. URLs would keep the folder's name (`/wiki/<Campaign>/Places/…`), unless a
  later step strips it for display.
- **Link resolution follows the snapshot.** Obsidian's shortest-path links would resolve among the
  campaign's files only, which is what Obsidian does when the campaign folder is opened as its own
  vault.
- **What vanishes.** In the owner's vault today, outside the campaign folder there are only two
  untyped DM-only notes, so nothing the campaign uses would go. Production's stored data hasn't
  been checked: a map image, PC note or NPC note kept outside would go quiet. A DM-only "what
  would be left out" check before switching is worth having.

## Guildhall's own data

| File                                     | Belongs to                    | Why                                                                                                                                          |
| ---------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `members.json`                           | global                        | Who people are, approval, theme, dice settings, tome look. `playerId` is a name matched to PC notes' `player:`, so it works in any campaign. |
| `dice.json`                              | global                        | Each member's collection is theirs, not a campaign's.                                                                                        |
| sessions, `cache/`                       | global                        | Cookies; tiles keyed by image and version.                                                                                                   |
| `campaign.json`                          | becomes the list of campaigns | Today one name and folder; it grows into each campaign's name and folder, and which is active.                                               |
| `maps.json`, `fog.json`, `tokens.json`   | campaign                      | About the campaign's images and notes.                                                                                                       |
| `fight.json`, `prepared-encounters.json` | campaign                      | One fight at a time per table.                                                                                                               |
| `characters.json`                        | campaign                      | Sheets hang off the campaign's PC notes.                                                                                                     |
| `next-session.json`                      | campaign                      | Each table has its own next session.                                                                                                         |

Migration, with prod's data in mind (stored data is never refused, and rolling back to an older
image must still work): **the existing files stay where they are** and are the first campaign's.
A new campaign's files go in `DATA_PATH/campaigns/<id>/`. An older image never sees the new
folder and reads the first campaign's files as always. `campaign.json` keeps its `name` and
`folder` fields as the first campaign's and gains an optional list of others and which is active,
all with defaults.

## Options

### a. One active campaign, picked by the DM (recommended)

The DM names campaigns (a folder each) and picks the active one; the whole app is that campaign,
and the others are dormant, their data kept.

- **Work:** filter the snapshot (`LiveVault` with a folder; switching rebuilds it), repositories
  opened per campaign (the services hold the active campaign's set, swapped on a switch), a DM
  campaign picker (the tome cover's folder picker becomes it), `Live` telling every open page to
  reload on a switch, `SOUNDS_FOLDER` resolved inside the campaign folder, the dry-run check.
  Decision 88's book picker folds into it. About three or four steps.
- **Players and visibility:** unchanged. Visibility is still `players` or `dm` on notes in the
  active folder; nothing from a dormant campaign is ever read, so nothing leaks. Players see one
  campaign: whichever is running.
- **Limit:** two tables in one week means the DM switches before each session; a player only in
  campaign B could read campaign A's shared notes while A is active (they're an approved member).

### b. Several campaigns at once, each with its own players

- **Work:** everything in (a), plus: a campaign in every URL or a per-person current campaign;
  services holding one set of repositories per campaign; members belonging to campaigns (and
  perhaps a different `playerId` in each); `Viewer` gaining the campaign, checked in `canView`,
  `access.ts`, every resource route, search, the live hub's rooms (`FIGHT_ROOM`, `PARTY_ROOM` and
  maps per campaign), presence, and the tests for each. A DM previewing as a player of one
  campaign. Large: it touches nearly every loader, and the "players never get DM content" rule
  becomes "nor another campaign's".
- **Players and visibility:** a player sees only campaigns they're in. The safest shape is (a)'s
  scoping done per request.

### c. Keep it tome-only

- **Work:** none. **Players:** unchanged; the plain wiki, search, statblocks and pickers keep
  showing the notes outside the folder (today two DM-only notes, so the DM only).
- Starting a second campaign later would mix both campaigns' notes everywhere but the tome, and
  their maps, tokens and fight in one set of files.

**Recommendation:** (a). It solves today's problem (ignore everything outside the campaign
folder) everywhere, makes room for future campaigns without touching visibility, and (b) can grow
from it later by making the scoping per request instead of per server.

## Questions for the owner

1. One active campaign at a time (a), or campaigns running side by side with their own players
   (b)? Will you ever run two campaigns in the same weeks?
2. If (a): should players see which campaigns exist (dormant ones listed), or only the one that's
   running?
3. The sounds folder: inside each campaign's folder (one setting, resolved per campaign), or one
   shared folder for every campaign?
4. Should a new campaign start empty (no maps, sheets or fight), or can maps or prepared
   encounters be copied from another?
5. Note URLs: keep the campaign folder in them (`/wiki/<Campaign>/NPCs/…`, nothing to do), or drop
   it?

## The owner's answers (2026-11-01)

1. One active campaign at a time, option (a).
2. Players see nothing of dormant campaigns; only the DM sees the list.
3. The sound board's folder is inside each campaign: `SOUNDS_FOLDER` is read relative to the
   active campaign's folder.
4. A new campaign starts empty, and note URLs keep the campaign folder.

## Slice plan

One green commit per step, on a branch from the tome's (decision 88 is folded in):

1. **A scoped vault.** `Vault.load`/`LiveVault.open` take an optional folder; the snapshot keeps
   only notes and files inside it, with vault-relative paths, so slugs, IDs and links stay as
   stored. Fixture notes outside a fixture campaign folder, each saying what it tests; unit tests
   that they're absent from notes, search, statblocks, party, assets, map images and links.
2. **The list of campaigns.** `campaign.json` read as campaigns: its existing `name` and `folder`
   are the first campaign's, plus an optional list of others and which is active, all with
   defaults; an old file reads exactly as before.
3. **Each campaign's data.** The per-campaign repositories (maps, fog, tokens, fight, prepared
   encounters, characters, next session) opened for a campaign: the first in `DATA_PATH` as now,
   others in `DATA_PATH/campaigns/<id>/`. Members, dice, sessions and the cache stay global.
4. **The active campaign runs the app.** The services build the vault scoped to the active
   campaign's folder and its repositories; switching rebuilds both, and `Live` tells every open
   page to reload. The sound board reads `SOUNDS_FOLDER` inside the campaign folder. The tome's
   book is the campaign's folder (the cover's folder picker goes).
5. **The DM's Campaigns.** A DM-only section (in Settings) to add a campaign (name and a top
   folder), rename it and make one active, with a check before switching that lists what stored
   data points outside the new folder. Players see nothing of it.
6. **E2E and docs.** A spec for switching (the DM and a player's open page), decision 89,
   CLAUDE.md's architecture map and built-so-far line, README and `docs/deployment.md`.
